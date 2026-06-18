import { logger } from '../config/logger.js';
import * as creditService from './creditService.js';

/**
 * Normalizes an incoming message from any platform into a standard object.
 * @param {string} platform 'whatsapp' | 'telegram'
 * @param {string} sessionId The session ID (or bot token/ID for Telegram)
 * @param {string} participant The unique ID of the sender (e.g., phone number or TG user ID)
 * @param {string} jid The unique ID of the chat room (group ID or private chat ID)
 * @param {string} text The text content of the message
 * @param {object} rawMessage The original message object from the platform's library
 * @param {object} client The platform client instance (e.g., Baileys sock or Telegraf bot)
 * @returns {object} Normalized message object
 */
export const normalizeMessage = (platform, sessionId, participant, jid, text, rawMessage, client) => {
    return {
        platform,
        sessionId,
        participant,
        jid,
        text,
        rawMessage,
        client
    };
};

/**
 * Sends a standard text message back to the platform.
 * It handles the platform-specific sending logic.
 * @param {object} normalizedMsg The normalized message object (contains platform and client references)
 * @param {string|object} content The text to send, or an object {text, mentions, image, caption}
 * @param {string} userId The owner/user ID checking for credits
 */
export const sendMessage = async (normalizedMsg, content, userId = null) => {
    const { platform, jid, client } = normalizedMsg;

    // Check credits if userId is provided
    if (userId) {
        const hasCredits = await creditService.checkCredits(userId);
        if (!hasCredits) {
            const warning = `⚠️ Engine terhenti. Pemilik sistem ini kehabisan Credits.`;
            content = typeof content === 'string' ? warning : { ...content, text: warning };
        } else {
            await creditService.deductCredit(userId);
        }
    }

    try {
        if (platform === 'whatsapp') {
            const sock = client;
            let payload = typeof content === 'string' ? { text: content } : { ...content };
            
            if (payload.image && typeof payload.image === 'object' && !Buffer.isBuffer(payload.image)) {
                if (payload.image.buffer) {
                    payload.image = payload.image.buffer;
                } else if (payload.image.url) {
                    payload.image = { url: payload.image.url };
                }
            }
            
            // Check if we should reply (quote message) when in a group chat
            const isGroup = jid.endsWith('@g.us');
            const options = {};
            if (isGroup && normalizedMsg?.rawMessage) {
                options.quoted = normalizedMsg.rawMessage;
            }
            
            await sock.sendMessage(jid, payload, options);
        } else if (platform === 'telegram') {
            const bot = client;

            const isGroup = jid.toString().startsWith('-') || jid.toString().includes('_');
            const options = {};
            if (isGroup && normalizedMsg?.rawMessage?.message_id) {
                options.reply_to_message_id = normalizedMsg.rawMessage.message_id;
            }

            // Extract text from object if needed
            let textToSend = typeof content === 'string' ? content : content.text;

            if (typeof content === 'object' && content.image) {
                // Handle image sending for Telegram
                const caption = content.caption || textToSend;
                let photo = content.image.buffer || content.image.url || content.image;

                // Robust check: if photo is a URL, try to fetch it as buffer to avoid Telegram 400 errors
                if (typeof photo === 'string' && photo.startsWith('http')) {
                    try {
                        const response = await fetch(photo);
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            photo = Buffer.from(arrayBuffer);
                        }
                    } catch (fetchErr) {
                        logger.warn(`Failed to fetch image URL for Telegram: ${fetchErr.message}. Sending URL directly.`);
                    }
                }

                if (photo) {
                    try {
                        if (Buffer.isBuffer(photo)) {
                            logger.info(`Sending image buffer to Telegram for JID ${jid}`);
                            await bot.sendPhoto(jid, photo, { caption, ...options }, { filename: 'image.png', contentType: 'image/png' });
                        } else {
                            logger.info(`Sending image URL to Telegram for JID ${jid}: ${typeof photo === 'string' ? photo.substring(0, 50) : 'object'}`);
                            await bot.sendPhoto(jid, photo, { caption, ...options });
                        }
                    } catch (photoError) {
                        logger.error(`Failed to send Telegram photo: ${photoError.message}. Falling back to text.`);
                        // Send just the text/caption if the image fails
                        await bot.sendMessage(jid, (caption || textToSend || "🎨 Image Generation") + "\n\n(⚠️ Gagal mengirim gambar, silakan cek log sistem/provider)", options);
                    }
                } else if (textToSend) {
                    await bot.sendMessage(jid, textToSend, options);
                }
            } else if (textToSend) {
                await bot.sendMessage(jid, textToSend, options);
            }
        } else {
            logger.error(`Unknown platform: ${platform}`);
        }
    } catch (error) {
        logger.error(`Failed to send message via ${platform}: ${error.message}`);
    }
};

/**
 * Sends an outgoing message based on the sessionId. Used for Broadcasts and Schedulers
 * where there is no incoming normalized message context.
 */
export const sendOutgoingMessageBySession = async (sessionId, jid, content, userId = null) => {
    // Determine platform
    const isTelegram = sessionId.startsWith('telegram_');
    const platform = isTelegram ? 'telegram' : 'whatsapp';
    let client = null;

    if (isTelegram) {
        const { getBots } = await import('./telegramService.js');
        const botId = parseInt(sessionId.replace('telegram_', ''), 10);
        const bots = getBots();
        client = bots[botId];
        if (!client) {
            logger.error(`[Telegram] Bot ${botId} not found or not active for session ${sessionId}`);
            return false;
        }
    } else {
        const { getSession } = await import('./sessionManager.js');
        client = getSession(sessionId);
        if (!client) {
            logger.error(`[WhatsApp] Session ${sessionId} not found or not connected`);
            return false; // Not connected
        }
    }

    // Reuse sendMessage logic by creating a pseudo-normalized message
    const pseudoMsg = {
        platform,
        sessionId,
        jid,
        client
    };

    await sendMessage(pseudoMsg, content, userId);
    return true;
};
