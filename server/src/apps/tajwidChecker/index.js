import { downloadAndConvertAudio, cleanupTempFile, checkFfmpegAvailable } from './audioProcessor.js';
import { transcribeArabic } from './transcriber.js';
import { analyzeTajwid, formatFeedback } from './tajwidAnalyzer.js';
import { prisma } from '../../prisma.js';
import { logger } from '../../config/logger.js';

// Set untuk mencegah proses paralel dari user yang sama (anti-spam)
const processingSet = new Set();

export default {
  name: 'tajwid-checker',
  description: "Cek tajwid membaca Al-Fatiha via voice note — kirim voice note dan bot akan menganalisis bacaan Anda",
  commands: [], // Tidak pakai command teks, trigger dari voice note (PTT)

  /**
   * Cek apakah pesan ini adalah voice note WhatsApp
   * Hanya trigger untuk WhatsApp PTT (Push-to-Talk)
   */
  canHandle: async (normalizedMsg) => {
    const { rawMessage, platform } = normalizedMsg;
    if (platform !== 'whatsapp') return false;

    const audioMsg = rawMessage?.message?.audioMessage;
    const isPTT = audioMsg?.ptt === true;

    return !!(audioMsg && isPTT);
  },

  handle: async (normalizedMsg, { userId, sendMessage }) => {
    const { jid, participant } = normalizedMsg;
    const msgKey = `${userId}:${jid}`;

    // Anti-spam: tolak jika user masih dalam proses
    if (processingSet.has(msgKey)) {
      await sendMessage(normalizedMsg, {
        text: '⏳ Masih memproses bacaan sebelumnya, mohon tunggu...'
      }, userId);
      return;
    }

    processingSet.add(msgKey);
    let mp3Path = null;

    try {
      // 1. Cek ffmpeg
      const hasFfmpeg = await checkFfmpegAvailable();
      if (!hasFfmpeg) {
        logger.error('[TajwidChecker] FFmpeg not found on system!');
        await sendMessage(normalizedMsg, {
          text: '⚠️ Sistem tidak dapat memproses audio.\nFFmpeg tidak tersedia di server.'
        }, userId);
        return;
      }

      // 2. Ambil API Key user dari database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiApiKey: true, aiProvider: true, isAiEnabled: true }
      });

      if (!user?.aiApiKey) {
        await sendMessage(normalizedMsg, {
          text: '⚠️ *Tajwid Checker memerlukan OpenAI API Key*\n\nSilakan set API Key di:\n*Dashboard → Pengaturan → AI Configuration*\n\nPastikan API Key sudah aktif dan memiliki akses ke Whisper & GPT-4.'
        }, userId);
        return;
      }

      // 3. Notifikasi awal ke user
      await sendMessage(normalizedMsg, {
        text: '🎙️ *Voice note diterima!*\n⏳ Menganalisis bacaan Al-Fatiha Anda...\n\n_(Proses biasanya 15–30 detik)_'
      }, userId);

      // 4. Download & convert audio
      logger.info(`[TajwidChecker] Processing voice note from user ${userId} in ${jid}`);
      mp3Path = await downloadAndConvertAudio(normalizedMsg);

      // 5. Transkripsi dengan Whisper
      const transcription = await transcribeArabic(mp3Path, user.aiApiKey);

      // Validasi: apakah ada teks yang terdeteksi?
      if (!transcription.text || transcription.text.trim().length < 3) {
        await sendMessage(normalizedMsg, {
          text: '❌ *Suara tidak terdeteksi*\n\nPastikan:\n• Mikrofon tidak terhalang\n• Ruangan cukup tenang\n• Bacaan cukup jelas dan tidak terlalu pelan\n\nSilakan coba kirim voice note lagi. 🎙️'
        }, userId);
        return;
      }

      // 6. Analisis Tajwid dengan GPT-4o
      const analysis = await analyzeTajwid(transcription, user.aiApiKey);

      // 7. Format & kirim feedback
      const feedback = formatFeedback(analysis, transcription.text);
      await sendMessage(normalizedMsg, { text: feedback }, userId);

      logger.info(`[TajwidChecker] ✅ Completed for user ${userId}. Score: ${analysis.score}`);

    } catch (error) {
      logger.error(`[TajwidChecker] Error for user ${userId}: ${error.message}`);

      // Pesan error yang ramah pengguna
      let errorMsg = '❌ *Terjadi kesalahan saat memproses bacaan.*\n\n';
      if (error.message.includes('API Key')) {
        errorMsg += error.message;
      } else if (error.message.includes('audio')) {
        errorMsg += 'Gagal memproses file audio. Coba kirim voice note ulang.';
      } else {
        errorMsg += 'Silakan coba lagi dalam beberapa saat.';
      }

      await sendMessage(normalizedMsg, { text: errorMsg }, userId);
    } finally {
      // Selalu cleanup
      if (mp3Path) cleanupTempFile(mp3Path);
      processingSet.delete(msgKey);
    }
  }
};
