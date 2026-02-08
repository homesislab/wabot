import cron from 'node-cron';
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import { getSession } from './sessionManager.js';
import * as creditService from './creditService.js';
import * as aiService from './aiService.js';
import { getToolsForUser } from './toolManager.js';

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
                const sock = getSession(schedule.sessionId);
                if (!sock) {
                    logger.warn(`Session ${schedule.sessionId} not found for schedule ${schedule.id}`);
                    return;
                }

                const hasCredits = await creditService.checkCredits(schedule.userId);
                if (!hasCredits) {
                    logger.warn(`Skipping schedule ${schedule.id}: User ${schedule.userId} has insufficient credits`);
                    return;
                }

                // Check connection status
                // Baileys sock usually handles queuing, but if disconnected for long, might fail.

                const jid = schedule.recipient.includes('@') ? schedule.recipient : `${schedule.recipient}@s.whatsapp.net`; // Simple formatting

                if (schedule.actionType === 'AI_REPLY') {
                    // Fetch User Data for AI
                    const user = await prisma.user.findUnique({
                        where: { id: schedule.userId },
                        select: { aiApiKey: true, aiProvider: true }
                    });

                    if (user?.aiApiKey) {
                        const tools = await getToolsForUser(schedule.userId);
                        const response = await aiService.generateResponse({
                            apiKey: user.aiApiKey,
                            provider: user.aiProvider || 'openai',
                            tools: tools,
                            mediaUrl: schedule.mediaUrl
                        }, schedule.content, "Generate a scheduled message."); // System prompt is content, user message is dummy/context

                        if (response) {
                            if (schedule.mediaUrl) {
                                await sock.sendMessage(jid, {
                                    image: { url: schedule.mediaUrl },
                                    caption: response
                                });
                            } else {
                                await sock.sendMessage(jid, { text: response });
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
                            url += `${separator}${schedule.credential.key}=${schedule.credential.value}`;
                        } else if (schedule.credential.type === 'BEARER') {
                            headers['Authorization'] = `Bearer ${schedule.credential.value}`;
                        }
                    }

                    const options = { method, headers };
                    if (method !== 'GET' && method !== 'HEAD' && schedule.apiPayload) {
                        options.body = schedule.apiPayload;
                    }

                    const res = await fetch(url, options);
                    const data = await res.json();

                    // Respond with result (simple text or 'message' field)
                    const replyText = data.message ? (typeof data.message === 'string' ? data.message : JSON.stringify(data.message)) : JSON.stringify(data);
                    await sock.sendMessage(jid, { text: replyText });

                } else if (schedule.messageType === 'IMAGE' || schedule.actionType === 'IMAGE') {
                    if (schedule.mediaUrl) {
                        await sock.sendMessage(jid, {
                            image: { url: schedule.mediaUrl },
                            caption: schedule.content
                        });
                    }
                } else {
                    // Default TEXT
                    await sock.sendMessage(jid, { text: schedule.content });
                }

                await creditService.deductCredit(schedule.userId);

                await prisma.schedule.update({
                    where: { id: schedule.id },
                    data: { lastRun: new Date() }
                });

            } catch (error) {
                logger.error(`Failed to execute schedule ${schedule.id}: ${error.message}`);
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
