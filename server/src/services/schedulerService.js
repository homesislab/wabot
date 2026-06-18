import cron from 'node-cron';
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import { sendOutgoingMessageBySession } from './messageAdapter.js';
import * as creditService from './creditService.js';
import * as aiService from './aiService.js';
import { getToolsForUser } from './toolManager.js';
import { fixJsonString } from '../utils/jsonUtils.js';
import { validateOutboundUrl, fetchWithTimeout } from '../utils/urlGuard.js';

const jobs = new Map();

export const initScheduler = async () => {
    const schedules = await prisma.schedule.findMany({
        where: { isActive: true },
        include: { credential: true }
    });
    schedules.forEach(scheduleJob);
    logger.info(`Initialized ${schedules.length} schedules`);
};

export const scheduleJob = (schedule) => {
    if (jobs.has(schedule.id)) {
        jobs.get(schedule.id).stop();
    }

    if (!schedule.isActive) return;

    try {
        const task = cron.schedule(schedule.cronExpression, async () => {
            logger.info(`Executing schedule ${schedule.id}`);
            try {
                // Check if user has scheduler enabled
                const userCheck = await prisma.user.findUnique({
                    where: { id: schedule.userId },
                    select: { isSchedulerEnabled: true }
                });

                if (!userCheck || userCheck.isSchedulerEnabled === false) {
                    logger.info(`Schedule ${schedule.id} skipped: Scheduler is disabled for user ${schedule.userId}`);
                    return;
                }

                const isTelegram = schedule.sessionId.startsWith('telegram_');
                const jid = isTelegram ? schedule.recipient : (schedule.recipient.includes('@') ? schedule.recipient : `${schedule.recipient}@s.whatsapp.net`);

                let finalPayload = null;

                if (schedule.actionType === 'AI_REPLY') {
                    // Fetch User Data for AI
                    const user = await prisma.user.findUnique({
                        where: { id: schedule.userId },
                        select: { aiApiKey: true, aiProvider: true, aiModel: true }
                    });

                    if (user?.aiApiKey) {
                        const tools = await getToolsForUser(schedule.userId);

                        // System prompt: instruksi konten + larangan prefix
                        const strictSystemPrompt = `${schedule.content}

PENTING: Balas HANYA dengan pesan yang siap dikirim. Jangan tambahkan:
- Kalimat pembuka seperti "Here's a message:", "Tentu, berikut pesannya:", atau sejenisnya
- Penjelasan, komentar, atau catatan apapun di luar isi pesan
- Tanda kutip di awal/akhir pesan
Output langsung adalah isi pesan, tidak lebih.`;

                        const response = await aiService.generateResponse({
                            apiKey: user.aiApiKey,
                            provider: user.aiProvider || 'openai',
                            modelString: user.aiModel,
                            tools: tools,
                            mediaUrl: schedule.mediaUrl
                        }, strictSystemPrompt, "Tulis pesan sesuai instruksi di atas.");

                        if (response) {
                            // Strip prefix yang mungkin masih lolos
                            const cleanResponse = response
                                .replace(/^(here'?s?\s+a?\s*(scheduled\s+)?message\s*(you\s+can\s+use)?:?\s*)/i, '')
                                .replace(/^(berikut\s+(adalah\s+)?pesan.*?:\s*)/i, '')
                                .replace(/^(tentu[,.]?\s*)/i, '')
                                .replace(/^---\n?/, '')
                                .trim();

                            if (schedule.mediaUrl) {
                                finalPayload = { image: { url: schedule.mediaUrl }, caption: cleanResponse };
                            } else {
                                finalPayload = { text: cleanResponse };
                            }
                        }
                    } else {
                        logger.warn(`Schedule ${schedule.id} skipped: Missing AI Key`);
                        return; // Don't deduct credit
                    }

                } else if (schedule.actionType === 'API_CALL' && schedule.apiUrl) {
                    let url = schedule.apiUrl;
                    const method = schedule.apiMethod || 'GET';
                    const headers = { 'Content-Type': 'application/json' };

                    // Inject Credential
                    if (schedule.credential) {
                        if (schedule.credential.location === 'HEADER' && schedule.credential.key) {
                            headers[schedule.credential.key] = schedule.credential.value;
                        } else if (schedule.credential.location === 'QUERY') {
                            const separator = url.includes('?') ? '&' : '?';
                            url += `${separator}${encodeURIComponent(schedule.credential.key)}=${encodeURIComponent(schedule.credential.value)}`;
                        } else if (schedule.credential.type === 'BEARER') {
                            headers['Authorization'] = `Bearer ${schedule.credential.value}`;
                        }
                    }

                    const options = { method, headers };
                    if (method !== 'GET' && method !== 'HEAD' && schedule.apiPayload) {
                        try {
                            // Validate JSON first
                            JSON.parse(schedule.apiPayload);
                            options.body = schedule.apiPayload;
                        } catch (e) {
                            // Attempt to fix unescaped newlines/tabs in JSON strings
                            const fixed = fixJsonString(schedule.apiPayload);
                            try {
                                const parsed = JSON.parse(fixed);
                                options.body = JSON.stringify(parsed);
                                logger.info(`Schedule ${schedule.id}: Fixed invalid JSON payload`);
                            } catch (e2) {
                                logger.warn(`Schedule ${schedule.id} encountered JSON parse error, sending as-is: ${e.message}`);
                                options.body = schedule.apiPayload;
                            }
                        }
                    }

                    const safeUrl = validateOutboundUrl(url);
                    const res = await fetchWithTimeout(safeUrl, options);
                    const data = await res.json();

                    // Respond with result (simple text or 'message' field)
                    const replyText = data.message ? (typeof data.message === 'string' ? data.message : JSON.stringify(data.message)) : JSON.stringify(data);
                    finalPayload = { text: replyText };

                } else if (schedule.messageType === 'IMAGE' || schedule.actionType === 'IMAGE') {
                    if (schedule.mediaUrl) {
                        finalPayload = { image: { url: schedule.mediaUrl }, caption: schedule.content };
                    }
                } else {
                    // Default TEXT
                    finalPayload = { text: schedule.content };
                }

                if (!finalPayload) {
                    logger.warn(`Schedule ${schedule.id} generated empty payload - skipping sending`);
                    await prisma.scheduleLog.create({
                        data: {
                            scheduleId: schedule.id,
                            status: 'FAILED',
                            errorMessage: 'Generated empty payload'
                        }
                    });
                    return;
                }

                const sent = await sendOutgoingMessageBySession(schedule.sessionId, jid, finalPayload, null);

                if (!sent) {
                    logger.warn(`Session ${schedule.sessionId} disconnected or failed to send for schedule ${schedule.id}`);
                    await prisma.scheduleLog.create({
                        data: {
                            scheduleId: schedule.id,
                            status: 'FAILED',
                            errorMessage: 'Session disconnected or failed to send'
                        }
                    });
                    return;
                }

                // Deduct credits AFTER a successful send attempt (in legacy code it was done unconditionally after block)
                const hasCredits = await creditService.checkCredits(schedule.userId);
                if (!hasCredits) {
                    logger.warn(`User ${schedule.userId} has insufficient credits. Payment might fail next run.`);
                } else {
                    await creditService.deductCredit(schedule.userId);
                }

                await prisma.scheduleLog.create({
                    data: {
                        scheduleId: schedule.id,
                        status: 'SUCCESS'
                    }
                });

                await prisma.schedule.update({
                    where: { id: schedule.id },
                    data: { lastRun: new Date() }
                });

            } catch (error) {
                logger.error(`Failed to execute schedule ${schedule.id}: ${error.message}`);
                try {
                    await prisma.scheduleLog.create({
                        data: {
                            scheduleId: schedule.id,
                            status: 'FAILED',
                            errorMessage: error.message
                        }
                    });
                } catch (logError) {
                    logger.error(`Failed to create error log for schedule ${schedule.id}: ${logError.message}`);
                }
            }
        });

        jobs.set(schedule.id, task);
    } catch (error) {
        logger.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
    }
};

export const removeJob = (id) => {
    if (jobs.has(id)) {
        jobs.get(id).stop();
        jobs.delete(id);
    }
};

export const initAutoRetryJob = () => {
    // Run at minute 0 past every hour
    cron.schedule('0 * * * *', async () => {
        logger.info('Running global Auto-Retry job for failed broadcasts');
        try {
            // Find users with auto-retry enabled
            const users = await prisma.user.findMany({
                where: { isAutoRetryEnabled: true },
                select: { id: true }
            });
            const userIds = users.map(u => u.id);

            if (userIds.length === 0) return;

            // Find broadcasts with failed logs for these users
            const broadcasts = await prisma.broadcast.findMany({
                where: {
                    userId: { in: userIds },
                    failed: { gt: 0 }
                },
                include: { logs: { where: { status: 'FAILED' } } }
            });

            for (const broadcast of broadcasts) {
                if (broadcast.logs.length === 0) continue;
                logger.info(`Auto-retrying ${broadcast.logs.length} messages for Broadcast ${broadcast.id}`);
                
                for (const log of broadcast.logs) {
                    try {
                        const isTelegram = broadcast.sessionId.startsWith('telegram_');
                        const jid = isTelegram ? log.contactPhone : (log.contactPhone.includes('@') ? log.contactPhone : `${log.contactPhone}@s.whatsapp.net`);
                        
                        let payload = broadcast.messageType === 'IMAGE' ? { image: { url: broadcast.mediaUrl }, caption: broadcast.content } : { text: broadcast.content };
                        
                        const sent = await sendOutgoingMessageBySession(broadcast.sessionId, jid, payload, null);
                        if (sent) {
                            await prisma.broadcastLog.update({ where: { id: log.id }, data: { status: "SUCCESS", errorMessage: null } });
                            await prisma.broadcast.update({ where: { id: broadcast.id }, data: { sent: { increment: 1 }, failed: { decrement: 1 } }});
                            await creditService.deductCredit(broadcast.userId);
                            
                            const delay = Math.floor(Math.random() * 3000) + 2000;
                            await new Promise(r => setTimeout(r, delay));
                        }
                    } catch (e) {
                         logger.warn(`Auto-Retry failed for broadcast ${broadcast.id} log ${log.id}: ${e.message}`);
                    }
                }
            }
        } catch(err) {
            logger.error(`Error in Auto-Retry job: ${err.message}`);
        }
    });
};

