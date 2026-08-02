import { logger } from '../config/logger.js';
import * as creditService from './creditService.js';

/**
 * Normalizes an incoming message from any platform into a standard object.
 */
export const normalizeMessage = (platform, sessionId, participant, jid, text, rawMessage, client, pushName = null) => {
    return {
        platform,
        sessionId,
        participant,
        jid,
        text,
        rawMessage,
        client,
        pushName
    };
};

/**
 * Resolve media content dari object n8n response.
 * n8n bisa kirim balik: { image }, { video }, { audio }, { document }, { sticker }
 * masing-masing bisa berisi { url } atau { base64, mimetype }
 */
const resolveMediaFromResponse = async (content) => {
    // Jika ada base64, ubah ke Buffer dulu
    const toBuffer = (b64, mime) => {
        if (!b64) return null;
        const raw = b64.includes(',') ? b64.split(',')[1] : b64;
        return Buffer.from(raw, 'base64');
    };

    if (content.image) {
        let img = content.image;
        if (img.base64) {
            return { type: 'image', data: { image: toBuffer(img.base64, img.mimetype || 'image/jpeg') }, caption: content.caption || '' };
        }
        return { type: 'image', data: { image: { url: img.url || img } }, caption: content.caption || '' };
    }
    if (content.video) {
        let vid = content.video;
        if (vid.base64) {
            return { type: 'video', data: { video: toBuffer(vid.base64, vid.mimetype || 'video/mp4') }, caption: content.caption || '' };
        }
        return { type: 'video', data: { video: { url: vid.url || vid } }, caption: content.caption || '' };
    }
    if (content.audio) {
        let aud = content.audio;
        if (aud.base64) {
            return { type: 'audio', data: { audio: toBuffer(aud.base64, aud.mimetype || 'audio/ogg'), mimetype: aud.mimetype || 'audio/ogg', ptt: aud.ptt || false } };
        }
        return { type: 'audio', data: { audio: { url: aud.url || aud }, mimetype: 'audio/ogg', ptt: false } };
    }
    if (content.document) {
        let doc = content.document;
        if (doc.base64) {
            return { type: 'document', data: { document: toBuffer(doc.base64, doc.mimetype || 'application/octet-stream'), mimetype: doc.mimetype || 'application/octet-stream', fileName: doc.fileName || 'file' } };
        }
        return { type: 'document', data: { document: { url: doc.url || doc }, mimetype: doc.mimetype || 'application/octet-stream', fileName: doc.fileName || 'file' } };
    }
    if (content.sticker) {
        let stk = content.sticker;
        if (stk.base64) {
            return { type: 'sticker', data: { sticker: toBuffer(stk.base64, 'image/webp') } };
        }
        return { type: 'sticker', data: { sticker: { url: stk.url || stk } } };
    }
    return null;
};

/**
 * Sends a standard message (text or media) back to the platform.
 * Supports: text, image, video, audio, document, sticker
 * Content object shapes:
 *   - { text: '...' }
 *   - { image: { url } | { buffer } | Buffer, caption: '...' }
 *   - { video: { url } | Buffer, caption: '...' }
 *   - { audio: { url } | Buffer, mimetype, ptt }
 *   - { document: { url } | Buffer, mimetype, fileName }
 *   - { sticker: { url } | Buffer }
 *   - { image: { base64, mimetype }, caption } (from n8n)
 *   - { video: { base64, mimetype }, caption } (from n8n)
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
            let payload;

            if (typeof content === 'string') {
                payload = { text: content };
            } else {
                // Coba resolve media dari format n8n (base64 / url terstruktur)
                const resolved = await resolveMediaFromResponse(content);
                if (resolved) {
                    const { type, data, caption } = resolved;
                    if (type === 'image') {
                        payload = { ...data, caption };
                    } else if (type === 'video') {
                        payload = { ...data, caption };
                    } else if (type === 'audio') {
                        payload = { ...data };
                    } else if (type === 'document') {
                        payload = { ...data };
                    } else if (type === 'sticker') {
                        payload = { ...data };
                    }
                } else {
                    // Fallback: raw payload (backward compatible)
                    payload = content;
                }
            }

            if (payload) {
                await sock.sendMessage(jid, payload);
            }

        } else if (platform === 'telegram') {
            const bot = client;

            if (typeof content === 'string') {
                await bot.sendMessage(jid, content);
                return;
            }

            const resolved = await resolveMediaFromResponse(content);

            if (resolved) {
                const { type, data, caption } = resolved;
                const cap = caption || content.caption || '';

                if (type === 'image') {
                    let photo = data.image?.buffer || data.image?.url || data.image;
                    if (typeof photo === 'string' && photo.startsWith('http')) {
                        try {
                            const r = await fetch(photo);
                            if (r.ok) photo = Buffer.from(await r.arrayBuffer());
                        } catch (e) { logger.warn(`[Telegram] Image fetch failed: ${e.message}`); }
                    }
                    try {
                        if (Buffer.isBuffer(photo)) {
                            await bot.sendPhoto(jid, photo, { caption: cap }, { filename: 'image.jpg', contentType: 'image/jpeg' });
                        } else {
                            await bot.sendPhoto(jid, photo, { caption: cap });
                        }
                    } catch (e) {
                        logger.error(`[Telegram] sendPhoto failed: ${e.message}`);
                        await bot.sendMessage(jid, cap || '🖼️ Media');
                    }
                    return;
                }

                if (type === 'video') {
                    let vid = data.video?.buffer || data.video?.url || data.video;
                    if (typeof vid === 'string' && vid.startsWith('http')) {
                        try {
                            const r = await fetch(vid);
                            if (r.ok) vid = Buffer.from(await r.arrayBuffer());
                        } catch (e) { logger.warn(`[Telegram] Video fetch failed: ${e.message}`); }
                    }
                    try {
                        if (Buffer.isBuffer(vid)) {
                            await bot.sendVideo(jid, vid, { caption: cap }, { filename: 'video.mp4', contentType: 'video/mp4' });
                        } else {
                            await bot.sendVideo(jid, vid, { caption: cap });
                        }
                    } catch (e) {
                        logger.error(`[Telegram] sendVideo failed: ${e.message}`);
                        await bot.sendMessage(jid, cap || '🎥 Video');
                    }
                    return;
                }

                if (type === 'audio') {
                    let aud = data.audio?.buffer || data.audio?.url || data.audio;
                    if (typeof aud === 'string' && aud.startsWith('http')) {
                        try {
                            const r = await fetch(aud);
                            if (r.ok) aud = Buffer.from(await r.arrayBuffer());
                        } catch (e) { logger.warn(`[Telegram] Audio fetch failed: ${e.message}`); }
                    }
                    try {
                        if (Buffer.isBuffer(aud)) {
                            await bot.sendAudio(jid, aud, {}, { filename: 'audio.ogg', contentType: data.mimetype || 'audio/ogg' });
                        } else {
                            await bot.sendAudio(jid, aud);
                        }
                    } catch (e) {
                        logger.error(`[Telegram] sendAudio failed: ${e.message}`);
                        await bot.sendMessage(jid, '🎵 Audio');
                    }
                    return;
                }

                if (type === 'document') {
                    let doc = data.document?.buffer || data.document?.url || data.document;
                    if (typeof doc === 'string' && doc.startsWith('http')) {
                        try {
                            const r = await fetch(doc);
                            if (r.ok) doc = Buffer.from(await r.arrayBuffer());
                        } catch (e) { logger.warn(`[Telegram] Document fetch failed: ${e.message}`); }
                    }
                    try {
                        if (Buffer.isBuffer(doc)) {
                            await bot.sendDocument(jid, doc, {}, { filename: data.fileName || 'file', contentType: data.mimetype || 'application/octet-stream' });
                        } else {
                            await bot.sendDocument(jid, doc);
                        }
                    } catch (e) {
                        logger.error(`[Telegram] sendDocument failed: ${e.message}`);
                        await bot.sendMessage(jid, '📄 Document');
                    }
                    return;
                }

            } else {
                // Legacy / backward compat: handle { image, caption } langsung
                if (content.image) {
                    const caption = content.caption || content.text || '';
                    let photo = content.image?.buffer || content.image?.url || content.image;
                    if (typeof photo === 'string' && photo.startsWith('http')) {
                        try {
                            const r = await fetch(photo);
                            if (r.ok) photo = Buffer.from(await r.arrayBuffer());
                        } catch (e) { logger.warn(`[Telegram] Image fetch failed: ${e.message}`); }
                    }
                    if (photo) {
                        try {
                            if (Buffer.isBuffer(photo)) {
                                await bot.sendPhoto(jid, photo, { caption }, { filename: 'image.jpg', contentType: 'image/jpeg' });
                            } else {
                                await bot.sendPhoto(jid, photo, { caption });
                            }
                        } catch (e) {
                            logger.error(`[Telegram] sendPhoto failed: ${e.message}`);
                            await bot.sendMessage(jid, caption || '🖼️ Image');
                        }
                    }
                    return;
                }

                const textToSend = typeof content === 'string' ? content : content.text;
                if (textToSend) await bot.sendMessage(jid, textToSend);
            }

        } else {
            logger.error(`Unknown platform: ${platform}`);
        }
    } catch (error) {
        logger.error(`Failed to send message via ${platform}: ${error.message}`);
    }
};

/**
 * Sends an outgoing message based on the sessionId.
 * Used for Broadcasts and Schedulers.
 */
export const sendOutgoingMessageBySession = async (sessionId, jid, content, userId = null) => {
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
            return false;
        }
    }

    const pseudoMsg = { platform, sessionId, jid, client };
    await sendMessage(pseudoMsg, content, userId);
    return true;
};
