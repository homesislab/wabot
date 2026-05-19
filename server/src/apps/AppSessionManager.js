/**
 * App Session Manager
 * Menyimpan "pending session" per user+contact di Redis
 * Digunakan untuk trigger KEYWORD_THEN_VOICE:
 *   1. User kirim keyword → session dibuat (TTL 5 menit)
 *   2. User kirim voice note → session ditemukan → app dijalankan, session dihapus
 */
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

const SESSION_TTL = 300; // 5 menit dalam detik
const KEY_PREFIX = 'appsession:';

/**
 * Buat session untuk app tertentu
 * @param {string} userId - ID user pemilik bot
 * @param {string} contactJid - JID WhatsApp pengirim
 * @param {string} appId - ID app yang akan dijalankan
 */
export const setAppSession = async (userId, contactJid, appId) => {
    const key = `${KEY_PREFIX}${userId}:${contactJid}`;
    await redis.setex(key, SESSION_TTL, appId);
    logger.info(`[AppSession] Set session → user:${userId} contact:${contactJid} app:${appId} (TTL ${SESSION_TTL}s)`);
};

/**
 * Ambil app ID dari session yang aktif
 * @returns {string|null} appId jika ada session, null jika tidak
 */
export const getAppSession = async (userId, contactJid) => {
    const key = `${KEY_PREFIX}${userId}:${contactJid}`;
    const appId = await redis.get(key);
    return appId;
};

/**
 * Hapus session (setelah app selesai dieksekusi)
 */
export const clearAppSession = async (userId, contactJid) => {
    const key = `${KEY_PREFIX}${userId}:${contactJid}`;
    await redis.del(key);
    logger.info(`[AppSession] Cleared session → user:${userId} contact:${contactJid}`);
};
