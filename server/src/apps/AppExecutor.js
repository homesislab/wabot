/**
 * App Executor — Layer antara Router dan Handler
 * Tugas: validasi input, inject context, jalankan handler, handle error
 *
 * Mendukung:
 *   - phase ACTIVATION: kirim pesan konfirmasi "siap dicek"
 *   - phase EXECUTION: jalankan handler + clear session
 *   - phase undefined: jalankan langsung (KEYWORD, VOICE_NOTE, etc)
 */
import { sendError, sendProcessing } from './ResponseFormatter.js';
import * as messageAdapter from '../services/messageAdapter.js';
import { clearAppSession } from './AppSessionManager.js';
import { logger } from '../config/logger.js';
import { prisma } from '../prisma.js';

/**
 * Eksekusi sebuah app manifest dengan normalizedMsg
 *
 * @param {object} manifest       - App manifest dari AppRegistry
 * @param {object} normalizedMsg  - Pesan ternormalisasi
 * @param {number} userId         - ID user pemilik bot
 * @param {string} phase          - 'ACTIVATION' | 'EXECUTION' | undefined
 */
export const executeApp = async (manifest, normalizedMsg, userId, phase) => {
  const { id: appId, name, handler } = manifest;

  logger.info(`[AppExecutor] Executing: ${name} (${appId}) phase=${phase || 'DIRECT'} user=${userId}`);

  // ─── FASE AKTIVASI: Kirim konfirmasi, jangan jalankan handler ──────────────
  if (phase === 'ACTIVATION') {
    const confirmMsg = manifest.activationMessage ||
      `✅ *${manifest.icon || ''} ${name}* siap!\n\nSilahkan kirim voice note sekarang. Sesi aktif selama 5 menit.`;

    await messageAdapter.sendMessage(normalizedMsg, { text: confirmMsg }, userId);
    return;
  }

  // ─── FASE EKSEKUSI / LANGSUNG ──────────────────────────────────────────────
  try {
    // 1. Ambil user context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiApiKey: true, aiProvider: true, aiModel: true, isAiEnabled: true }
    });

    // 2. Validasi API Key jika dibutuhkan
    if (manifest.requiresApiKey && !user?.aiApiKey) {
      await sendError(normalizedMsg, new Error('API Key tidak dikonfigurasi. Hubungi admin.'), userId);
      return;
    }

    // 3. Kirim typing indicator jika diperlukan
    if (manifest.showProcessing !== false) {
      await sendProcessing(normalizedMsg, appId, userId);
    }

    // 4. Build context yang di-inject ke handler
    const context = {
      userId,
      user,
      appId,
      sendMessage: (msg, content) => messageAdapter.sendMessage(msg, content, userId),
    };

    // 5. Jalankan handler
    await handler(normalizedMsg, context);

    // 6. Clear session jika ini adalah fase EXECUTION (KEYWORD_THEN_VOICE)
    if (phase === 'EXECUTION') {
      const senderJid = normalizedMsg.participant || normalizedMsg.jid;
      if (senderJid) await clearAppSession(userId, senderJid);
    }

    logger.info(`[AppExecutor] ✅ ${name} completed for user ${userId}`);
  } catch (error) {
    logger.error(`[AppExecutor] ❌ ${name} failed: ${error.message}`);
    // Clear session on error juga agar user bisa coba ulang
    if (phase === 'EXECUTION') {
      const senderJid = normalizedMsg.participant || normalizedMsg.jid;
      if (senderJid) await clearAppSession(userId, senderJid);
    }
    await sendError(normalizedMsg, error, userId);
  }
};
