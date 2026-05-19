import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import * as creditService from './creditService.js';
import * as aiService from './aiService.js';
import { getToolsForUser } from './toolManager.js';
import { fixJsonString } from '../utils/jsonUtils.js';
import * as gameService from './gameService.js';
import * as messageAdapter from './messageAdapter.js';
import { redis } from '../config/redis.js';
import { messagesReceivedTotal, rulesTriggeredTotal, aiGenerationsTotal, apiCallsTotal, deduplicatedMessagesTotal } from '../config/metrics.js';
import { route } from '../apps/AppRouter.js';
import { executeApp } from '../apps/AppExecutor.js';
import { getRegistryForUser } from '../apps/AppRegistry.js';
import { setAppSession, getAppSession, clearAppSession } from '../apps/AppSessionManager.js';

export const processMessage = async (normalizedMsg) => {
    try {
        messagesReceivedTotal.inc();
        const { platform, sessionId, participant, jid, text, client, rawMessage } = normalizedMsg;

        // Cek apakah ini voice note (audio)
        const isVoiceNote = rawMessage?.message?.audioMessage?.ptt === true;

        // Hanya skip jika teks kosong DAN bukan voice note
        if (!text && !isVoiceNote) return;

        // Deduplication using message ID (Redis instead of memory Set)
        // Note: For Telegram, message_id is unique only within a chat, so we use platform:sessionId:msgId
        const rawId = platform === 'telegram' ? rawMessage?.message_id?.toString() : rawMessage?.key?.id;
        const msgId = rawId ? `${platform}:${sessionId}:${rawId}` : null;

        if (msgId) {
            const isNewMessage = await redis.set(`dedup:${msgId}`, '1', 'NX', 'EX', 3600); // 1 hour TTL
            if (!isNewMessage) {
                deduplicatedMessagesTotal.inc();
                logger.info(`Duplicate message ${msgId} ignored`);
                return true;
            }
        }

        logger.info(`Processing message ${msgId} from ${participant} in ${jid}`);

        // 1. Check if user is actively playing a game
        const isPlaying = await gameService.handleActiveGame(normalizedMsg);
        if (isPlaying) {
            logger.info(`Message intercepted by Game Engine for ${participant} in ${jid}`);
            return true; // Stop processing rules
        }

        // 2. Check if text triggers a new game start
        const isGameTriggered = await gameService.checkGameTrigger(normalizedMsg);
        if (isGameTriggered) {
            logger.info(`Game Triggered by ${jid}`);
            return true; // Stop processing rules
        }

        let userId = null;
        if (platform === 'whatsapp') {
            const session = await prisma.session.findUnique({ where: { id: sessionId } });
            if (!session) return;
            userId = session.userId;
        } else if (platform === 'telegram') {
            const botId = parseInt(sessionId.replace('telegram_', ''), 10);
            const tgBot = await prisma.telegramBot.findUnique({ where: { id: botId } });
            if (!tgBot) return;
            userId = tgBot.userId;
        }

        if (!userId) return;

        // 3. Check for Notes commands (!simpan, !catatan, !hapus, !kumpulan)
        const notesHandled = await handleNotesCommand(userId, normalizedMsg);
        if (notesHandled) {
            return true; // Stop processing rules
        }

        // 4. Check for Image Generation command (!image)
        const imageHandled = await handleImageCommand(userId, normalizedMsg);
        if (imageHandled) {
            return true; // Stop processing rules
        }

        // 5. Dispatch ke App Framework via AppRouter + AppExecutor
        // - AppRouter: cari manifest yang cocok (async — bisa check Redis session)
        // - AppExecutor: validasi → inject context → jalankan handler
        const userRegistry = await getRegistryForUser(userId);
        const { manifest: matchedManifest, phase } = await route(normalizedMsg, userRegistry, userId);
        if (matchedManifest) {
            await executeApp(matchedManifest, normalizedMsg, userId, phase);
            return true; // Stop — jangan proses Auto Reply rules
        }

        // Jika voice note tapi tidak ada app yang handle, stop di sini
        if (isVoiceNote) return false;

        const rules = await prisma.rule.findMany({
            where: {
                isActive: true,
                userId: userId,
                OR: [
                    { sessionId: sessionId },
                    { sessionId: null }
                ]
            },
            include: { credential: true } // Include credential for API calls
        });

        for (const rule of rules) {
            // Check Filter Group ID
            if (rule.filterGroupId) {
                if (jid !== rule.filterGroupId) continue; // Skip if not the target group
            }

            let matched = false;

            if (rule.triggerType === 'KEYWORD') {
                // FALLBACK: Handle case where user selected KEYWORD but typed "On Mention (Tag Bot)"
                if (rule.triggerValue.toLowerCase() === 'on mention (tag bot)') {
                    if (platform === 'whatsapp') {
                        const mentions = rawMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        const botJid = client?.user?.id ? jidNormalizedUser(client.user.id) : null;
                        if (botJid && mentions.includes(botJid)) matched = true;
                    } else if (platform === 'telegram') {
                        const botUser = normalizedMsg.botUsername;
                        if (botUser && text.includes(`@${botUser}`)) matched = true;
                        else if (text.includes('@')) matched = true; // Fallback
                    }
                } else {
                    if (text.toLowerCase().includes(rule.triggerValue.toLowerCase())) matched = true;
                }
            } else if (rule.triggerType === 'ALL') {
                matched = true;
            } else if (rule.triggerType === 'REGEX') {
                try {
                    const regex = new RegExp(rule.triggerValue, 'i');
                    if (regex.test(text)) matched = true;
                } catch (e) {
                    logger.error(`Invalid Regex for rule ${rule.id}: ${e.message}`);
                }
            } else if (rule.triggerType === 'MENTION') {
                if (platform === 'whatsapp') {
                    const mentions = rawMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const botJid = client?.user?.id ? jidNormalizedUser(client.user.id) : null;
                    if (botJid && mentions.includes(botJid)) matched = true;
                } else if (platform === 'telegram') {
                    const botUser = normalizedMsg.botUsername;
                    if (botUser && text.includes(`@${botUser}`)) matched = true;
                    else if (text.includes('@')) matched = true; // Fallback
                }
            }

            if (matched) {
                logger.info(`Rule ${rule.id} matched for session ${sessionId}`);
                rulesTriggeredTotal.inc({ action_type: rule.actionType });
                executeAction(rule, normalizedMsg);
                return true;
            }
        }
        return false;
    } catch (error) {
        logger.error(`Error processing message: ${error.message}`);
        return false;
    }
};

const executeAction = async (rule, normalizedMsg) => {
    const { sessionId, jid, rawMessage, text, platform } = normalizedMsg;
    // Check credits first
    const hasCredits = await creditService.checkCredits(rule.userId);
    if (!hasCredits) {
        logger.warn(`Rule ${rule.id} execution skipped: User ${rule.userId} has insufficient credits`);
        return;
    }

    if (rule.actionType === 'API_CALL' && rule.apiUrl) {
        try {
            const messageText = text || '';
            let matches = null;

            if (rule.triggerType === 'REGEX') {
                try {
                    const regex = new RegExp(rule.triggerValue, 'i');
                    matches = messageText.match(regex);
                } catch (e) {
                    logger.error(`Regex compilation error in rule ${rule.id}: ${e.message}`);
                }
            }

            // 1. Context extraction
            const context = {
                messageText: messageText,
                senderName: normalizedMsg.pushName || normalizedMsg.participant?.split('@')[0] || 'User',
                senderNumber: normalizedMsg.participant ? normalizedMsg.participant.split('@')[0] : '',
                sessionId: sessionId
            };

            // 2. Safe Escaper for JSON strings
            const safeEscape = (str) => {
                if (str === null || str === undefined) return "";
                const stringified = JSON.stringify(String(str));
                return stringified.slice(1, -1); // Remove the outer quotes added by stringify
            };

            // 3. Process URL
            let url = rule.apiUrl;
            if (url) {
                // Replace variables in URL
                url = url.replace(/\{\{messageText\}\}/g, encodeURIComponent(context.messageText));
                url = url.replace(/\{\{senderName\}\}/g, encodeURIComponent(context.senderName));
                url = url.replace(/\{\{senderNumber\}\}/g, encodeURIComponent(context.senderNumber));
                url = url.replace(/\{\{sessionId\}\}/g, encodeURIComponent(context.sessionId));

                if (matches) {
                    matches.forEach((match, index) => {
                        // Fallback support for {0} and explicit support for {{0}}
                        url = url.replace(new RegExp(`\\{${index}\\}`, 'g'), encodeURIComponent(match));
                        url = url.replace(new RegExp(`\\{\\{${index}\\}\\}`, 'g'), encodeURIComponent(match));
                    });
                }
            }

            // 4. Process API Payload
            let rawPayloadStr = rule.apiPayload || "{}";

            rawPayloadStr = rawPayloadStr.replace(/\{\{messageText\}\}/g, safeEscape(context.messageText));
            rawPayloadStr = rawPayloadStr.replace(/\{\{senderName\}\}/g, safeEscape(context.senderName));
            rawPayloadStr = rawPayloadStr.replace(/\{\{senderNumber\}\}/g, safeEscape(context.senderNumber));
            rawPayloadStr = rawPayloadStr.replace(/\{\{sessionId\}\}/g, safeEscape(context.sessionId));

            if (matches) {
                matches.forEach((match, index) => {
                    rawPayloadStr = rawPayloadStr.replace(new RegExp(`\\{\\{${index}\\}\\}`, 'g'), safeEscape(match));
                });
            }

            // 5. Parse JSON Safely
            let apiPayloadObj = {};
            try {
                apiPayloadObj = JSON.parse(rawPayloadStr);
            } catch (e) {
                logger.error(`Rule ${rule.id} failed to parse JSON after variable injection: ${e.message}`);
                logger.debug(`Malformed Payload: ${rawPayloadStr}`);
                
                await messageAdapter.sendMessage(
                    normalizedMsg, 
                    { text: `⚠️ *System Error*: Invalid webhook payload configuration for this action. Please check your Rule settings.` }, 
                    rule.userId
                );
                return; // Stop execution if JSON is invalid
            }

            const payload = {
                ...apiPayloadObj,
                sessionId,
                message: rawMessage,
                trigger: rule.triggerValue
            };

            const method = rule.apiMethod || 'POST';
            const headers = { 'Content-Type': 'application/json' };

            // Inject Credential if available
            if (rule.credential) {
                if (rule.credential.location === 'HEADER' && rule.credential.key) {
                    headers[rule.credential.key] = rule.credential.value;
                } else if (rule.credential.location === 'QUERY') {
                    const separator = url.includes('?') ? '&' : '?';
                    url += `${separator}${rule.credential.key}=${rule.credential.value}`;
                } else if (rule.credential.type === 'BEARER') {
                    headers['Authorization'] = `Bearer ${rule.credential.value}`;
                }
            }

            const options = {
                method,
                headers
            };

            if (method !== 'GET' && method !== 'HEAD') {
                options.body = JSON.stringify(payload);
            }

            const response = await fetch(url, options); // Use dynamic URL
            apiCallsTotal.inc({ method: rule.apiMethod || 'POST' });

            const data = await response.json();
            logger.info(`Rule ${rule.id} API executed to ${url}. Status: ${response.status}`);

            // Optional: If the API returns a 'message' field, reply with it (Fonnte-like behavior)
            if (data && data.message) {
                await messageAdapter.sendMessage(normalizedMsg, { text: typeof data.message === 'string' ? data.message : JSON.stringify(data.message) }, rule.userId);
            }

        } catch (error) {
            logger.error(`Rule ${rule.id} execution failed: ${error.message}`);
        }
    } else if (rule.actionType === 'RESPONSE' && rule.responseContent) {
        try {
            if (rule.responseMediaType === 'IMAGE' && rule.responseMediaUrl) {
                await messageAdapter.sendMessage(normalizedMsg, {
                    image: { url: rule.responseMediaUrl },
                    caption: rule.responseContent
                }, rule.userId);
            } else {
                await messageAdapter.sendMessage(normalizedMsg, { text: rule.responseContent }, rule.userId);
            }

            logger.info(`Rule ${rule.id} auto-reply sent to ${jid}`);
        } catch (error) {
            logger.error(`Rule ${rule.id} auto-reply failed: ${error.message}`);
        }
    } else if (rule.actionType === 'AI_REPLY') {
        try {
            // Fetch User's API Key & Provider
            const user = await prisma.user.findUnique({
                where: { id: rule.userId },
                select: { aiApiKey: true, aiProvider: true, isAiEnabled: true, aiModel: true }
            });

            if (!user?.aiApiKey) {
                logger.warn(`Rule ${rule.id} skipped: User ${rule.userId} missing AI API Key`);
                return;
            }

            logger.info(`Generating AI response for rule ${rule.id} (Provider: ${user.aiProvider})`);

            const tools = await getToolsForUser(rule.userId);
            const userMessage = text || '';

            const response = await aiService.generateResponse({
                apiKey: user.aiApiKey,
                provider: user.aiProvider || 'openai',
                modelString: user.aiModel,
                tools: tools,
                mediaUrl: rule.responseMediaUrl
            }, rule.responseContent, userMessage);

            if (response) {
                aiGenerationsTotal.inc({ provider: user.aiProvider || 'openai', type: 'text' });
                if (rule.responseMediaUrl) {
                    await messageAdapter.sendMessage(normalizedMsg, {
                        image: { url: rule.responseMediaUrl },
                        caption: response
                    }, rule.userId);
                } else {
                    await messageAdapter.sendMessage(normalizedMsg, { text: response }, rule.userId);
                }
                logger.info(`Rule ${rule.id} AI response sent to ${jid}`);
            } else {
                logger.warn(`Rule ${rule.id} AI response generation failed`);
            }
        } catch (error) {
            logger.error(`Rule ${rule.id} AI execution failed: ${error.message}`);
        }
    } else if (rule.actionType === 'ACTIVATE_MINI_APP' && rule.miniAppId) {
        try {
            // Cari manifest app yang dimaksud
            const userRegistry = await getRegistryForUser(rule.userId);
            const manifest = userRegistry.find(m => m.id === rule.miniAppId);

            if (!manifest) {
                logger.warn(`Rule ${rule.id}: Mini App '${rule.miniAppId}' not found in registry`);
                return;
            }

            // Set Redis session untuk user+contact ini
            await setAppSession(rule.userId, normalizedMsg.participant || jid, rule.miniAppId);

            // Kirim pesan aktivasi dari manifest
            const activationMsg = manifest.activationMessage ||
                `✅ *${manifest.icon || ''} ${manifest.name}* siap!\n\nSilahkan ikuti instruksi selanjutnya. Sesi aktif 5 menit.`;

            await messageAdapter.sendMessage(normalizedMsg, { text: activationMsg }, rule.userId);
            logger.info(`Rule ${rule.id}: Activated Mini App '${rule.miniAppId}' for ${jid}`);
        } catch (error) {
            logger.error(`Rule ${rule.id} ACTIVATE_MINI_APP failed: ${error.message}`);
        }
    }
};

const handleNotesCommand = async (userId, normalizedMsg) => {
    try {
        const { jid, text } = normalizedMsg;
        if (!text.startsWith('!')) return false;

        logger.info(`Checking Notes Command: '${text}' in ${jid} for user ${userId}`);

        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ').trim();

        if (command === '!simpan') {
            // Format: !simpan keyword | content
            const splitIndex = args.indexOf('|');
            if (splitIndex === -1) {
                await messageAdapter.sendMessage(normalizedMsg, '❌ Format salah. Gunakan: !simpan keyword | isi catatan');
                return true;
            }

            const keyword = args.substring(0, splitIndex).trim().toLowerCase();
            const content = args.substring(splitIndex + 1).trim();

            if (!keyword || !content) {
                await messageAdapter.sendMessage(normalizedMsg, '❌ Keyword dan konten tidak boleh kosong.');
                return true;
            }

            await prisma.note.upsert({
                where: {
                    userId_keyword: {
                        userId,
                        keyword
                    }
                },
                update: { content },
                create: { userId, keyword, content }
            });

            await messageAdapter.sendMessage(normalizedMsg, `✅ Catatan '${keyword}' berhasil disimpan.`);
            return true;
        }

        if (command === '!catatan') {
            const keyword = args.toLowerCase();
            if (!keyword) {
                await messageAdapter.sendMessage(normalizedMsg, '❌ Masukkan keyword. Contoh: !catatan jadwal');
                return true;
            }

            const note = await prisma.note.findUnique({
                where: {
                    userId_keyword: { userId, keyword }
                }
            });

            if (note) {
                await messageAdapter.sendMessage(normalizedMsg, note.content);
            } else {
                await messageAdapter.sendMessage(normalizedMsg, `❌ Catatan '${keyword}' tidak ditemukan.`);
            }
            return true;
        }

        if (command === '!hapus') {
            const keyword = args.toLowerCase();
            if (!keyword) {
                await messageAdapter.sendMessage(normalizedMsg, '❌ Masukkan keyword yang mau dihapus. Contoh: !hapus jadwal');
                return true;
            }

            const note = await prisma.note.findUnique({
                where: {
                    userId_keyword: { userId, keyword }
                }
            });

            if (note) {
                await prisma.note.delete({
                    where: { id: note.id }
                });
                await messageAdapter.sendMessage(normalizedMsg, `✅ Catatan '${keyword}' berhasil dihapus.`);
            } else {
                await messageAdapter.sendMessage(normalizedMsg, `❌ Catatan '${keyword}' tidak ditemukan.`);
            }
            return true;
        }

        if (command === '!kumpulan') {
            const notes = await prisma.note.findMany({
                where: { userId },
                orderBy: { keyword: 'asc' }
            });

            if (notes.length === 0) {
                await messageAdapter.sendMessage(normalizedMsg, '📂 Belum ada catatan yang tersimpan.');
            } else {
                const list = notes.map((n, i) => `${i + 1}. ${n.keyword}`).join('\n');
                await messageAdapter.sendMessage(normalizedMsg, `📂 *Daftar Catatan:*\n\n${list}\n\nGunakan !catatan <nama_catatan> untuk melihat.`);
            }
            return true;
        }

        if (command === '!stop' || command === '!batal') {
            const contactJid = normalizedMsg.participant || jid;
            const activeAppId = await getAppSession(userId, contactJid);

            if (activeAppId) {
                await clearAppSession(userId, contactJid);
                // Ambil nama app dari registry jika bisa
                const userRegistry = await getRegistryForUser(userId);
                const manifest = userRegistry.find(m => m.id === activeAppId);
                const appName = manifest ? `${manifest.icon || ''} ${manifest.name}` : activeAppId;
                await messageAdapter.sendMessage(normalizedMsg, {
                    text: `⏹️ Sesi *${appName}* telah dihentikan.\n\nKetik perintah kembali jika ingin menggunakannya lagi.`
                }, userId);
            } else {
                await messageAdapter.sendMessage(normalizedMsg, {
                    text: `ℹ️ Tidak ada sesi Mini App yang sedang aktif.`
                }, userId);
            }
            return true;
        }

        return false;
    } catch (error) {
        logger.error(`Error in handleNotesCommand: ${error.message}`);
        await messageAdapter.sendMessage(normalizedMsg, '❌ Terjadi kesalahan saat memproses catatan.');
        return true;
    }
};

const handleImageCommand = async (userId, normalizedMsg) => {
    try {
        const { text } = normalizedMsg;
        if (!text.toLowerCase().startsWith('!image ')) return false;

        const prompt = text.substring(7).trim();
        if (!prompt) {
            await messageAdapter.sendMessage(normalizedMsg, '❌ Masukkan deskripsi gambar. Contoh: !image ksatria di atas naga');
            return true;
        }

        // 1. Check Credits
        const hasCredits = await creditService.checkCredits(userId);
        if (!hasCredits) {
            await messageAdapter.sendMessage(normalizedMsg, '⚠️ Saldo (Credits) Anda tidak cukup untuk generate gambar.');
            return true;
        }

        // 2. Notify processing (optional but better UX for long generation)
        await messageAdapter.sendMessage(normalizedMsg, '🎨 Sedang melukis gambar Anda, mohon tunggu sebentar...');

        // 3. Fetch User AI Config
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { aiApiKey: true, aiProvider: true, isImageEnabled: true, aiImageProvider: true, aiImageApiKey: true }
        });

        if (user && user.isImageEnabled !== true) {
            await messageAdapter.sendMessage(normalizedMsg, '⚠️ Fitur pembuatan gambar dinonaktifkan oleh pemilik sistem.');
            return true;
        }

        // 4. Generate Image
        const result = await aiService.generateImage(user?.aiImageApiKey || user?.aiApiKey, user?.aiImageProvider || user?.aiProvider || 'openai', prompt);

        if (result && (result.url || result.buffer)) {
            aiGenerationsTotal.inc({ provider: user?.aiImageProvider || user?.aiProvider || 'openai', type: 'image' });
            // 5. Build Caption
            let caption = `🎨 *AI Image Generation*\nPrompt: ${prompt}`;
            if (result.refinedPrompt) {
                caption += `\n\n✨ *Expanded Prompt (Gemini):*\n_${result.refinedPrompt}_`;
            }

            // 6. Send Image
            await messageAdapter.sendMessage(normalizedMsg, {
                image: result.buffer ? { buffer: result.buffer } : { url: result.url },
                caption: caption
            }, userId);
        } else {
            await messageAdapter.sendMessage(normalizedMsg, '❌ Gagal membuat gambar. Coba lagi nanti.');
        }

        return true;
    } catch (error) {
        logger.error(`Error in handleImageCommand: ${error.message}`);
        await messageAdapter.sendMessage(normalizedMsg, '❌ Terjadi kesalahan teknis saat membuat gambar.');
        return true;
    }
};
