/**
 * App Router — Parse trigger dari normalizedMsg → cari app yang cocok di registry
 * Sesuai diagram: WhatsApp user → App Router → App Registry
 *
 * Trigger types:
 *   KEYWORD          - text dimulai dengan keyword tertentu
 *   VOICE_NOTE       - semua voice note (tanpa filter)
 *   KEYWORD_THEN_VOICE - fase 1: keyword → simpan session; fase 2: voice note → cek session
 *   IMAGE            - semua gambar
 *   MENTION          - pesan dengan mention
 *   ALL              - semua tipe pesan
 */
import { logger } from '../config/logger.js';
import { setAppSession, getAppSession } from './AppSessionManager.js';

/**
 * Cari app manifest yang cocok berdasarkan pesan masuk
 *
 * @param {object} normalizedMsg
 * @param {Array}  registry - Array manifest yang sudah difilter untuk user ini
 * @param {number} userId   - ID user pemilik bot
 * @returns {{ manifest: object|null, sessionCleared: boolean }}
 */
export const route = async (normalizedMsg, registry = [], userId) => {
  const { text, rawMessage } = normalizedMsg;
  // Gunakan participant (group) atau jid (private chat) sebagai sender identifier
  const contactJid = normalizedMsg.participant || normalizedMsg.jid;

  // Deteksi tipe pesan
  const isVoiceNote = rawMessage?.message?.audioMessage?.ptt === true;
  const isImage     = !!(rawMessage?.message?.imageMessage);
  const isMention   = !!(rawMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length);
  const textLower   = (text || '').toLowerCase().trim();

  for (const manifest of registry) {
    const { trigger } = manifest;

    switch (trigger.type) {

      // ─── KEYWORD ────────────────────────────────────────────────────────────
      case 'KEYWORD': {
        // trigger.value bisa string (manifest lama) atau array (dari DB)
        const kwList = Array.isArray(trigger.value)
          ? trigger.value
          : (trigger.value ? [trigger.value] : []);
        if (textLower && kwList.length > 0 && kwList.some(kw => textLower.startsWith(kw.toLowerCase()))) {
          logger.info(`[AppRouter] KEYWORD matched "${textLower}" → ${manifest.id}`);
          return { manifest, sessionCleared: false };
        }
        break;
      }

      // ─── VOICE_NOTE (tanpa filter) ──────────────────────────────────────────
      case 'VOICE_NOTE':
        if (isVoiceNote) {
          logger.info(`[AppRouter] VOICE_NOTE matched → ${manifest.id}`);
          return { manifest, sessionCleared: false };
        }
        break;

      // ─── KEYWORD_THEN_VOICE (2 fase) ────────────────────────────────────────
      case 'KEYWORD_THEN_VOICE': {
        const keywords = Array.isArray(trigger.value) ? trigger.value : [trigger.value];

        // Fase 1: User kirim keyword → simpan session, beri konfirmasi
        if (textLower && keywords.some(kw => textLower.includes(kw.toLowerCase()))) {
          await setAppSession(userId, contactJid, manifest.id);
          logger.info(`[AppRouter] KEYWORD_THEN_VOICE phase-1: keyword matched → session set for ${manifest.id}`);
          // Kembalikan manifest khusus "aktivasi" (bukan eksekusi handler)
          return { manifest, sessionCleared: false, phase: 'ACTIVATION' };
        }

        // Fase 2: User kirim voice note → cek apakah ada session aktif
        if (isVoiceNote && userId && contactJid) {
          const pendingAppId = await getAppSession(userId, contactJid);
          if (pendingAppId === manifest.id) {
            logger.info(`[AppRouter] KEYWORD_THEN_VOICE phase-2: voice note with active session → ${manifest.id}`);
            return { manifest, sessionCleared: true, phase: 'EXECUTION' };
          }
        }
        break;
      }

      // ─── KEYWORD_THEN_IMAGE (2 fase) ────────────────────────────────────────
      case 'KEYWORD_THEN_IMAGE': {
        const keywords = Array.isArray(trigger.value) ? trigger.value : [trigger.value];
        const hasKeyword = textLower && keywords.some(kw => textLower.includes(kw.toLowerCase()));

        // Kasus spesial: User kirim gambar DAN keyword di caption sekaligus
        if (isImage && hasKeyword) {
          logger.info(`[AppRouter] KEYWORD_THEN_IMAGE: image with keyword matched → ${manifest.id}`);
          return { manifest, sessionCleared: true, phase: 'EXECUTION' };
        }

        // Fase 1: User kirim keyword saja → simpan session, beri konfirmasi
        if (hasKeyword && !isImage) {
          await setAppSession(userId, contactJid, manifest.id);
          logger.info(`[AppRouter] KEYWORD_THEN_IMAGE phase-1: keyword matched → session set for ${manifest.id}`);
          return { manifest, sessionCleared: false, phase: 'ACTIVATION' };
        }

        // Fase 2: User kirim gambar → cek apakah ada session aktif
        if (isImage && userId && contactJid) {
          const pendingAppId = await getAppSession(userId, contactJid);
          if (pendingAppId === manifest.id) {
            logger.info(`[AppRouter] KEYWORD_THEN_IMAGE phase-2: image with active session → ${manifest.id}`);
            return { manifest, sessionCleared: true, phase: 'EXECUTION' };
          }
        }
        break;
      }

      // ─── IMAGE ──────────────────────────────────────────────────────────────
      case 'IMAGE':
        if (isImage) {
          logger.info(`[AppRouter] IMAGE matched → ${manifest.id}`);
          return { manifest, sessionCleared: false };
        }
        break;

      // ─── MENTION ────────────────────────────────────────────────────────────
      case 'MENTION':
        if (isMention) {
          logger.info(`[AppRouter] MENTION matched → ${manifest.id}`);
          return { manifest, sessionCleared: false };
        }
        break;

      // ─── ALL ────────────────────────────────────────────────────────────────
      case 'ALL':
        if (text || isVoiceNote || isImage) {
          logger.info(`[AppRouter] ALL matched → ${manifest.id}`);
          return { manifest, sessionCleared: false };
        }
        break;
    }
  }

  return { manifest: null, sessionCleared: false };
};
