import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import * as creditService from './creditService.js';
import * as aiService from './aiService.js';
import { getToolsForUser } from './toolManager.js';

import * as messageAdapter from './messageAdapter.js';

const formatPlayerName = (p) => {
    if (!p) return 'Unknown';
    if (p.includes('@s.whatsapp.net') || p.includes('@g.us') || p.includes('@lid')) {
        return p.split('@')[0];
    }
    if (p.startsWith('@')) return p.substring(1);
    return p;
};


async function sendGameMessage(normalizedMsg, userId, payload) {
    await messageAdapter.sendMessage(normalizedMsg, payload, userId);
}

/**
 * Check if the incoming message corresponds to an active game session for this user.
 * Returns true if a game was handled, false otherwise.
 */
export const handleActiveGame = async (normalizedMsg) => {
    try {
        const { sessionId, participant, jid, text } = normalizedMsg;
        const activeGame = await prisma.activeGame.findFirst({
            // Look up by group JID (playerPhone acts as the room JID for groups)
            where: { playerPhone: jid, sessionId: sessionId },
            include: { game: true }
        });

        if (!activeGame) return false;

        // --- BYPASS SYSTEM COMMANDS ---
        const systemCommands = ['!catatan', '!simpan', '!hapus', '!kumpulan'];
        if (systemCommands.some(cmd => text.toLowerCase().startsWith(cmd))) {
            return false; // Let ruleEngine handle these
        }

        const game = activeGame.game;
        let state = JSON.parse(activeGame.state);

        if (text.toLowerCase() === '!quit' || text.toLowerCase() === '!keluar') {
            await sendGameMessage(normalizedMsg, game.userId, { text: `Berhenti bermain ${game.name}. Sampai jumpa!` });
            await prisma.activeGame.delete({ where: { id: activeGame.id } });
            return true;
        }

        // --- LOBBY PHASE INTERCEPTION ---
        if (state.status === 'LOBBY') {
            const cmd = text.toLowerCase().trim();
            if (cmd === '!join') {
                if (!state.players.includes(participant)) {
                    state.players.push(participant);
                    await prisma.activeGame.update({
                        where: { id: activeGame.id },
                        data: { state: JSON.stringify(state), lastActive: new Date() }
                    });
                    await sendGameMessage(normalizedMsg, game.userId, {
                        text: `✅ @${formatPlayerName(participant)} bergabung! Total pemain: ${state.players.length}\n\nKetik !join untuk ikut, atau !start untuk memulai.`,
                        mentions: [participant]
                    });
                } else {
                    await sendGameMessage(normalizedMsg, game.userId, {
                        text: `⚠️ @${formatPlayerName(participant)} sudah bergabung di lobi.`,
                        mentions: [participant]
                    });
                }
                return true;
            } else if (cmd === '!start') {
                if (state.players.length === 0) {
                    await sendGameMessage(normalizedMsg, game.userId, { text: "⚠️ Minimal 1 pemain harus !join sebelum !start." });
                    return true;
                }
                state.status = 'PLAYING';

                // Construct and send the initial message based on game type
                const config = JSON.parse(game.config);
                let startMsg = `🚀 Permainan Dimulai!\n\n`;
                if (game.type === 'TRIVIA') {
                    const q = config.questions[0];
                    startMsg += `Pertanyaan 1:\n${q.question}\n`;
                    q.options.forEach((opt, idx) => {
                        startMsg += `${String.fromCharCode(65 + idx)}. ${opt}\n`;
                    });
                } else if (game.type === 'GUESS_NUMBER') {
                    startMsg += `Saya telah memikirkan angka antara ${state.min} hingga ${state.max}.\nKalian punya ${state.maxAttempts} tebakan bersama!`;
                } else if (game.type === 'AI_RPG') {
                    // Start Loading...
                    await sendGameMessage(normalizedMsg, game.userId, { text: "Menyiapkan dunia RPG dan membangkitkan karakter... Mohon tunggu." });

                    try {
                        const user = await prisma.user.findUnique({ where: { id: game.userId } });
                        const tools = await getToolsForUser(game.userId);

                        const prompt = `Anda adalah Game Master RPG. \n` +
                            `Pemain yang bergabung: ${state.players.join(', ')}.\n` +
                            `Tema/Skenario/Lokasi: ${config.openingScene || "Petualangan acak."}\n\n` +
                            `Buatkan peran (role) unik dan menarik untuk masing-masing pemain berdasarkan tema di atas, dan buatkan narasi pembuka cerita dengan latar yang sesuai.\n` +
                            `PENTING: Jawab HANYA menggunakan format JSON valid persis seperti ini, tanpa markdown backticks atau tambahan teks apa pun:\n` +
                            `{\n  "roles": { "nomorhp@s.whatsapp.net": "Deskripsi singkat peran (Misal: Ksatria Berani)" },\n  "scene": "Narasi pembuka..."\n}`;

                        let aiText = await aiService.generateResponse({
                            apiKey: user.aiApiKey,
                            provider: user.aiProvider || 'openai',
                            modelString: user.aiModel,
                            tools: tools
                        }, config.systemPrompt && config.systemPrompt.length > 5 ? config.systemPrompt : "Anda merespons hanya dalam format JSON murni.", prompt);

                        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
                        // Handle potential non-JSON wrapper
                        if (aiText.indexOf('{') > 0) aiText = aiText.substring(aiText.indexOf('{'));
                        if (aiText.lastIndexOf('}') < aiText.length - 1) aiText = aiText.substring(0, aiText.lastIndexOf('}') + 1);

                        const parsed = JSON.parse(aiText);

                        state.roles = parsed.roles || {};
                        state.alivePlayers = [...state.players]; // Everyone starts alive
                        state.history = ["Latar Cerita:", parsed.scene || config.openingScene || "Petualangan dimulai..."];
                        state.accumulatedChats = [];

                        startMsg = `⚔️ *RPG Dimulai!* ⚔️\n\n`;

                        // List roles
                        for (const p of state.players) {
                            startMsg += `🔹 @${formatPlayerName(p)}: ${state.roles[p] || 'Penduduk Biasa'}\n`;
                        }

                        startMsg += `\n📖 *Cerita:*\n${parsed.scene || config.openingScene || 'Petualangan dimulai...'}\n\n`;
                        startMsg += `💡 *Instruksi:*\nSetelah ini, semua pemain silakan ber-roleplay dengan mengirimkan chat biasa di grup ini (bot akan mencatatnya diam-diam). Jika sudah selesai berdiskusi atau bertindak, **ketik !lanjut untuk meneruskan cerita** dan melihat reaksi Game Master.\n`;
                    } catch (e) {
                        logger.error(`Failed to init RPG AI: ${e.message}`);
                        startMsg += "Gagal menghubungi AI untuk memuat RPG. Pastikan API Key valid.";
                        await sendGameMessage(normalizedMsg, game.userId, { text: startMsg });
                        // Delete session because it's broken
                        await prisma.activeGame.delete({ where: { id: activeGame.id } });
                        return true;
                    }
                }

                await prisma.activeGame.update({
                    where: { id: activeGame.id },
                    data: { state: JSON.stringify(state), lastActive: new Date() }
                });
                await sendGameMessage(normalizedMsg, game.userId, {
                    text: startMsg,
                    mentions: state.players
                });
                return true;
            }
            return true; // Ignore other inputs while in lobby
        }

        // --- PLAYING PHASE COMMAND INTERCEPTION ---
        if (state.status === 'PLAYING') {
            if (text.toLowerCase().trim() === '!score') {
                if (game.type === 'TRIVIA' && state.scores) {
                    const sortedPlayers = Object.keys(state.scores).sort((a, b) => state.scores[b] - state.scores[a]);
                    let msg = `📊 *Papan Skor Sementara*\n\n`;
                    if (sortedPlayers.length === 0) {
                        msg += `Belum ada yang mencetak poin.`;
                    } else {
                        sortedPlayers.forEach((p, idx) => {
                            msg += `${idx + 1}. @${formatPlayerName(p)} - ${state.scores[p]} Poin\n`;
                        });
                    }
                    await sendGameMessage(normalizedMsg, game.userId, { text: msg, mentions: sortedPlayers });
                } else {
                    await sendGameMessage(normalizedMsg, game.userId, { text: `Game tipe ${game.type} tidak mendukung sistem skor live.` });
                }
                return true;
            }
        }

        // --- PLAYING PHASE LOGIC ROUTING ---
        switch (game.type) {
            case 'TRIVIA':
                await handleTriviaInput(activeGame, normalizedMsg, game, state);
                break;
            case 'GUESS_NUMBER':
                await handleGuessNumberInput(activeGame, normalizedMsg, game, state);
                break;
            case 'AI_RPG':
                await handleAiRpgInput(activeGame, normalizedMsg, game, state);
                break;
            default:
                await sendGameMessage(normalizedMsg, game.userId, { text: "Tipe game tidak didukung." });
                await prisma.activeGame.delete({ where: { id: activeGame.id } });
        }

        return true;

    } catch (error) {
        logger.error(`Error handling active game for ${jid}: ${error.message}`);
        return false; // Fallback to rule engine if game crashes
    }
};

/**
 * Check if the text matches any Game trigger keyword.
 * If yes, create an active game session and return true.
 */
export const checkGameTrigger = async (normalizedMsg) => {
    try {
        const { sessionId, participant, jid, text } = normalizedMsg;
        const game = await prisma.game.findUnique({
            where: { trigger: text.trim().toLowerCase() }
        });

        if (!game || !game.isActive) return false;

        // Check if user is already playing something IN THIS SPECIFIC SESSION
        const existing = await prisma.activeGame.findFirst({ where: { playerPhone: jid, sessionId: sessionId } });
        if (existing) {
            await sendGameMessage(normalizedMsg, game.userId, { text: "Anda sedang bermain game lain. Ketik !quit untuk keluar." });
            return true;
        }

        let initialState = { status: 'LOBBY', players: [participant] };
        let welcomeMessage = `👋 Selamat datang di *${game.name}*!\n\n@${formatPlayerName(participant)} telah membuat Lobi Permainan.\n\nKetik *!join* untuk bergabung.\nKetik *!start* untuk memulai!\n`;

        if (game.type === 'AI_RPG') {
            welcomeMessage += `\n*(Khusus RPG: Setelah mulai, pemain mengobrol bebas. Ketik !lanjut untuk meneruskan cerita)*\n\n`;
        }

        welcomeMessage += `Ketik *!quit* kapan saja untuk membatalkannya.`;

        const config = JSON.parse(game.config);

        if (game.type === 'TRIVIA') {
            initialState = { ...initialState, currentQuestionIndex: 0, scores: {} };
        } else if (game.type === 'GUESS_NUMBER') {
            const min = config.min || 1;
            const max = config.max || 100;
            const target = Math.floor(Math.random() * (max - min + 1)) + min;
            initialState = { ...initialState, target, min, max, attempts: 0, maxAttempts: config.maxAttempts || 5 };
        } else if (game.type === 'AI_RPG') {
            initialState = { ...initialState, history: [], accumulatedChats: [], alivePlayers: [], roles: {} }; // Pre-initialize
        }

        await prisma.activeGame.create({
            data: {
                gameId: game.id,
                playerPhone: jid,
                sessionId: sessionId,
                state: JSON.stringify(initialState)
            }
        });

        await sendGameMessage(normalizedMsg, game.userId, {
            text: welcomeMessage,
            mentions: [participant]
        });
        return true;

    } catch (error) {
        if (error.code === 'P2002') {
            // Another bot session just created the game atomically at the same millisecond!
            // We silently return false to allow ruleEngine to continue (or do nothing)
            logger.info(`Concurrent game creation ignored for ${jid} on session ${sessionId}`);
        } else {
            logger.error(`Error checking game trigger for ${jid}: ${error.message}`);
        }
        return false;
    }
};

// --- Game Logic Processors ---

async function handleTriviaInput(activeGame, normalizedMsg, game, state) {
    const { participant, text } = normalizedMsg;
    const config = JSON.parse(game.config);
    const questions = config.questions;
    const currentIndex = state.currentQuestionIndex;
    const currentQ = questions[currentIndex];

    const textTrimmed = text.trim().toUpperCase();
    // Silent ignore if not a single character, heavily reduces spam in groups and prevents bot loops
    if (textTrimmed.length !== 1) {
        return;
    }

    const charCode = textTrimmed.charCodeAt(0);
    const optionIndex = charCode - 65; // A=0, B=1, C=2...

    if (optionIndex < 0 || optionIndex >= currentQ.options.length) {
        return; // Silent ignore invalid options
    }

    const selectedAnswer = currentQ.options[optionIndex];
    const isCorrect = selectedAnswer === currentQ.answer;

    if (isCorrect) {
        if (!state.scores[participant]) state.scores[participant] = 0;
        state.scores[participant] += 1;

        await sendGameMessage(normalizedMsg, game.userId, {
            text: `✅ Benar! @${formatPlayerName(participant)}\n\n`,
            mentions: [participant]
        });
    } else {
        await sendGameMessage(normalizedMsg, game.userId, {
            text: `❌ Salah @${formatPlayerName(participant)}. Jawaban yang benar adalah: ${currentQ.answer}\n\n`,
            mentions: [participant]
        });
    }

    state.currentQuestionIndex += 1;

    // Check if game is over
    if (state.currentQuestionIndex >= questions.length) {

        // Calculate Winners
        const sortedPlayers = Object.keys(state.scores).sort((a, b) => state.scores[b] - state.scores[a]);
        const mentions = sortedPlayers;

        let leaderboardMsg = `🎉 *Kuis Selesai!*\n\n*Papan Skor:*\n`;
        if (sortedPlayers.length === 0) {
            leaderboardMsg += `Tidak ada yang berhasil menjawab benar satupun.\n`;
        } else {
            sortedPlayers.forEach((p, index) => {
                leaderboardMsg += `${index + 1}. @${formatPlayerName(p)} - ${state.scores[p]} poin\n`;
            });
            const winner = sortedPlayers[0];
            leaderboardMsg += `\n🏆 Selamat kepada @${formatPlayerName(winner)}!`;
        }

        await sendGameMessage(normalizedMsg, game.userId, {
            text: leaderboardMsg,
            mentions: mentions
        });

        await prisma.activeGame.delete({ where: { id: activeGame.id } });
    } else {
        // Next Question
        const nextQ = questions[state.currentQuestionIndex];
        let msg = `Pertanyaan ${state.currentQuestionIndex + 1}:\n${nextQ.question}\n`;
        nextQ.options.forEach((opt, idx) => {
            msg += `${String.fromCharCode(65 + idx)}. ${opt}\n`;
        });

        await prisma.activeGame.update({
            where: { id: activeGame.id },
            data: { state: JSON.stringify(state), lastActive: new Date() }
        });

        await sendGameMessage(normalizedMsg, game.userId, { text: msg });
    }
}

async function handleGuessNumberInput(activeGame, normalizedMsg, game, state) {
    const { participant, text } = normalizedMsg;
    const guess = parseInt(text.trim());
    if (isNaN(guess)) {
        return; // Silent ignore non-numbers to prevent infinite bot loops and group spam
    }

    state.attempts += 1;

    if (guess === state.target) {
        await sendGameMessage(normalizedMsg, game.userId, {
            text: `🎉 TEPAT SEKALI! @${formatPlayerName(participant)} menebak angka ${state.target} dalam ${state.attempts} tebakan total.`,
            mentions: [participant]
        });
        await prisma.activeGame.delete({ where: { id: activeGame.id } });
    } else if (state.attempts >= state.maxAttempts) {
        await sendGameMessage(normalizedMsg, game.userId, {
            text: `💀 Game Over @${formatPlayerName(participant)}! Kesempatan permainan habis. Angka yang benar adalah ${state.target}.`,
            mentions: [participant]
        });
        await prisma.activeGame.delete({ where: { id: activeGame.id } });
    } else {
        const hint = guess < state.target ? "Lebih besar!" : "Lebih kecil!";
        const sisa = state.maxAttempts - state.attempts;
        await prisma.activeGame.update({
            where: { id: activeGame.id },
            data: { state: JSON.stringify(state), lastActive: new Date() }
        });
        await sendGameMessage(normalizedMsg, game.userId, {
            text: `❌ Salah @${formatPlayerName(participant)}! ${hint}\nSisa tebakan: ${sisa}`,
            mentions: [participant]
        });
    }
}

async function handleAiRpgInput(activeGame, normalizedMsg, game, state) {
    const { participant, text } = normalizedMsg;
    if (!state.alivePlayers.includes(participant)) {
        // Silent ignore or prompt? Silent is better for groups, but we can notify once.
        return; // Dead players can't do anything
    }

    const config = JSON.parse(game.config);
    const cmd = text.toLowerCase().trim();

    // Ensure state properties exist for robust handling
    if (!state.history) state.history = [];
    if (!state.accumulatedChats) state.accumulatedChats = [];

    if (cmd === '!lanjut' || cmd === '!next') {
        if (!state.accumulatedChats || state.accumulatedChats.length === 0) {
            await sendGameMessage(normalizedMsg, game.userId, { text: "Belum ada pemain yang melakukan aksi. Kirim chat apa saja sebelum !lanjut." });
            return;
        }

        await sendGameMessage(normalizedMsg, game.userId, { text: "🎲 Game Master sedang memproses cerita berdasarkan aksi kalian..." });
        await advanceAiRpg(activeGame, normalizedMsg, game, state);
    } else {
        // Record chat
        const role = state.roles[participant] || "Unknown Role";
        const playerName = formatPlayerName(participant);
        const chatLog = `@${playerName} (${role}): "${text}"`;

        if (!state.accumulatedChats) state.accumulatedChats = [];
        state.accumulatedChats.push(chatLog);

        await prisma.activeGame.update({
            where: { id: activeGame.id },
            data: { state: JSON.stringify(state), lastActive: new Date() }
        });

        // We do NOT send a reply here, just quietly record it.
    }
}

async function advanceAiRpg(activeGame, normalizedMsg, game, state) {
    const config = JSON.parse(game.config);

    // Ensure state properties exist for robust handling
    if (!state.history) state.history = [];
    if (!state.accumulatedChats) state.accumulatedChats = [];
    if (!state.alivePlayers) state.alivePlayers = state.players || [];
    try {
        const user = await prisma.user.findUnique({
            where: { id: game.userId },
            select: { id: true, aiApiKey: true, aiProvider: true, aiModel: true, isAiEnabled: true, isImageEnabled: true, aiImageProvider: true, aiImageApiKey: true }
        });

        logger.info(`RPG User AI Settings [User:${game.userId}]: isImageEnabled=${user?.isImageEnabled}(${typeof user?.isImageEnabled}), provider=${user?.aiImageProvider}`);

        if (!user?.aiApiKey) {
            await sendGameMessage(normalizedMsg, game.userId, { text: "Maaf, AI Game Engine sedang offline (API Key tidak diset)." });
            return;
        }

        let historyContext = state.history.join("\n");
        let accumulatedActions = state.accumulatedChats.join("\n");

        let prompt = `Anda adalah Game Master RPG yang tidak kenal ampun namun adil.\n` +
            `Cerita Sebelumnya:\n${historyContext}\n\n` +
            `Aksi Para Pemain:\n${accumulatedActions}\n\n` +
            `Tugas Anda:\n` +
            `1. Buatkan kelanjutan cerita (scene) yang seru, responsif terhadap setiap aksi aksi pemain.\n` +
            `2. Tentukan siapa yang GUGUR/TEWAS berdasarkan aksi mereka (jika aksinya bodoh atau sangat berbahaya). Bolehkah tidak ada yang gugur? Boleh. Bolehkah semua gugur? Boleh jika memang pantas.\n` +
            `3. Tentukan apakah permainan SELESAI (isGameOver=true) misal boss mati, atau semua pemain tewas.\n` +
            `4. (Opsional) Jika adegan sangat dramatis atau visualnya penting, tambahkan "imagePrompt" berupa deskripsi visual mendetail dalam Bahasa Inggris.\n` +
            `JAWAB HANYA DALAM FORMAT JSON SEPERTI BERIKUT TANPA MARKDOWN (tanpa \`\`\`json):\n` +
            `{\n` +
            `  "scene": "Terjadi ledakan besar setelah Ksatria mencoba memotong kabel merah...",\n` +
            `  "imagePrompt": "A large explosion in a steampunk fantasy laboratory, dramatic lighting, high quality digital art",\n` +
            `  "eliminated": ["nomor1@s.whatsapp.net", "nomor2@s.whatsapp.net"],\n` +
            `  "isGameOver": false\n` +
            `}`;

        const tools = await getToolsForUser(game.userId);
        let aiText = await aiService.generateResponse({
            apiKey: user.aiApiKey,
            provider: user.aiProvider || 'openai',
            modelString: user.aiModel,
            tools: tools
        }, config.systemPrompt || "Anda merespons HANYA dalam format JSON murni.", prompt);

        aiText = aiText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
        const parsed = JSON.parse(aiText);

        // --- IMAGE GENERATION ---
        let imageResult = null;
        logger.info(`RPG Image Generation Status Check: prompt=${!!parsed.imagePrompt}, enabled_setting=${user.isImageEnabled}`);
        if (parsed.imagePrompt && user.isImageEnabled === true) {
            try {
                imageResult = await aiService.generateImage(user.aiImageApiKey || user.aiApiKey, user.aiImageProvider || user.aiProvider, parsed.imagePrompt);
            } catch (imgError) {
                logger.error(`RPG Image Generation Failed: ${imgError.message}`);
            }
        }

        // Update state
        state.history.push("=== Ronde Lanjut ===");
        state.history.push(`Aksi Pemain:\n${accumulatedActions}`);
        state.history.push(`GM:\n${parsed.scene}`);

        if (state.history.length > 20) state.history = state.history.slice(state.history.length - 20);

        // Process eliminations
        let deadAnnouncements = [];
        if (parsed.eliminated && Array.isArray(parsed.eliminated)) {
            for (const dead of parsed.eliminated) {
                if (state.alivePlayers.includes(dead)) {
                    state.alivePlayers = state.alivePlayers.filter(p => p !== dead);
                    deadAnnouncements.push(dead);
                }
            }
        }

        // Clear chats for next round
        state.accumulatedChats = [];

        let finalMessage = `📖 *Cerita Berlanjut (Auto):*\n${parsed.scene}\n\n`;
        let mentions = [];

        if (deadAnnouncements.length > 0) {
            finalMessage += `☠️ *Pemain Gugur:*\n`;
            for (const d of deadAnnouncements) {
                finalMessage += `- @${formatPlayerName(d)} (${state.roles[d] || 'Unknown'})\n`;
                mentions.push(d);
            }
            finalMessage += `*Mulai sekarang, pemain yang gugur tidak bisa beraksi lagi.*\n\n`;
        }

        if (parsed.isGameOver || state.alivePlayers.length === 0) {
            finalMessage += `🛑 *PERMAINAN SELESAI* 🛑\nTerima kasih telah bermain!`;
            if (imageResult && (imageResult.url || imageResult.buffer)) {
                const imagePayload = imageResult.buffer ? { buffer: imageResult.buffer } : { url: imageResult.url };
                await sendGameMessage(normalizedMsg, game.userId, { image: imagePayload, caption: finalMessage, mentions });
            } else {
                await sendGameMessage(normalizedMsg, game.userId, { text: finalMessage, mentions });
            }
            try {
                // Check if still exists before deleting to avoid Prisma error
                const stillExists = await prisma.activeGame.findUnique({ where: { id: activeGame.id } });
                if (stillExists) {
                    await prisma.activeGame.delete({ where: { id: activeGame.id } });
                }
            } catch (delError) {
                logger.warn(`Failed to delete game ${activeGame.id}: ${delError.message}`);
            }
        } else {
            finalMessage += `Silakan sisa pemain (@${state.alivePlayers.map(p => formatPlayerName(p)).join(', @')}) melakukan chat aksi lagi sebelum *!lanjut*.`;
            mentions.push(...state.alivePlayers);

            await prisma.activeGame.update({
                where: { id: activeGame.id },
                data: { state: JSON.stringify(state), lastActive: new Date() }
            });

            if (imageResult && (imageResult.url || imageResult.buffer)) {
                const imagePayload = imageResult.buffer ? { buffer: imageResult.buffer } : { url: imageResult.url };
                await sendGameMessage(normalizedMsg, game.userId, { image: imagePayload, caption: finalMessage, mentions });
            } else {
                await sendGameMessage(normalizedMsg, game.userId, { text: finalMessage, mentions });
            }
        }

    } catch (e) {
        logger.error(`AI RPG Error during auto-advance: ${e.message}`);
    }
}

export const initGameAutoAdvance = () => {
    logger.info("Initializing Game Auto-Advance Worker (30s interval)");
    setInterval(async () => {
        try {
            const now = new Date();
            const activeGames = await prisma.activeGame.findMany({
                include: { game: true }
            });

            for (const ag of activeGames) {
                if (ag.game.type !== 'AI_RPG') continue;

                const state = JSON.parse(ag.state);
                const config = JSON.parse(ag.game.config);
                const autoAdvanceInterval = (config.autoAdvanceInterval !== undefined) ? config.autoAdvanceInterval : 30000;

                if (autoAdvanceInterval <= 0) continue; // Feature disabled for this game

                const lastActive = new Date(ag.lastActive);
                const diff = now.getTime() - lastActive.getTime();

                // Log every check for debugging
                logger.info(`[AUTO-ADVANCE CHECK] ${ag.playerPhone}: diff=${Math.round(diff / 1000)}s, interval=${autoAdvanceInterval / 1000}s, chats=${state.accumulatedChats?.length || 0}`);

                if (diff > autoAdvanceInterval && state.accumulatedChats && state.accumulatedChats.length > 0) {
                    logger.info(`[AUTO-ADVANCE] Triggering for ${ag.playerPhone}. Inactive for ${Math.round(diff / 1000)}s. Interval set to ${autoAdvanceInterval / 1000}s.`);

                    const isTelegram = ag.sessionId.startsWith('telegram_');
                    let client = null;

                    try {
                        if (isTelegram) {
                            const { getBots } = await import('./telegramService.js');
                            const botId = parseInt(ag.sessionId.replace('telegram_', ''), 10);
                            client = getBots()[botId];
                        } else {
                            const { getSession } = await import('./sessionManager.js');
                            client = getSession(ag.sessionId);
                        }
                    } catch (e) {
                        logger.error(`Error resolving client for auto-advance: ${e.message}`);
                    }

                    if (!client) {
                        logger.warn(`[AUTO-ADVANCE] Client not found for session ${ag.sessionId}. Skipping.`);
                        continue;
                    }

                    const dummyMsg = {
                        platform: isTelegram ? 'telegram' : 'whatsapp',
                        sessionId: ag.sessionId,
                        jid: ag.playerPhone,
                        participant: ag.playerPhone,
                        client: client
                    };

                    await advanceAiRpg(ag, dummyMsg, ag.game, state);
                }
            }
        } catch (error) {
            logger.error(`Error in Game Auto-Advance worker: ${error.message}`);
        }
    }, 15000);
};
