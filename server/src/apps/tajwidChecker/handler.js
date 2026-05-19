/**
 * Tajwid Checker — Handler
 * Logic utama: download audio → Whisper → GPT-4o analisis → kirim feedback
 */
import { downloadAndConvertAudio, cleanupTempFile, checkFfmpegAvailable } from './audioProcessor.js';
import { transcribeArabic } from './transcriber.js';
import { analyzeTajwid, formatFeedback } from './tajwidAnalyzer.js';
import { sendFormatted, sendError } from '../ResponseFormatter.js';
import { logger } from '../../config/logger.js';

// Anti-spam: cegah proses paralel dari user yang sama
const processingSet = new Set();

/**
 * Handler utama tajwid checker
 * @param {object} normalizedMsg
 * @param {object} context - { userId, user, sendMessage, formatter }
 */
export const handler = async (normalizedMsg, context) => {
  const { userId, user, appConfig } = context;  // appConfig: DB config dari MiniApp
  const { jid } = normalizedMsg;
  const lockKey = `${userId}:${jid}`;

  if (processingSet.has(lockKey)) {
    await sendFormatted(normalizedMsg, { text: '⏳ Masih memproses bacaan sebelumnya...' }, userId);
    return;
  }

  processingSet.add(lockKey);
  let mp3Path = null;

  try {
    // 1. Cek ffmpeg
    const hasFfmpeg = await checkFfmpegAvailable();
    if (!hasFfmpeg) throw new Error('ffmpeg tidak tersedia di server');

    // 2. Download & convert audio
    mp3Path = await downloadAndConvertAudio(normalizedMsg);

    // 3. Transkripsi dengan STT (Whisper atau Gemini)
    const transcription = await transcribeArabic(mp3Path, user);

    if (!transcription.text || transcription.text.trim().length < 3) {
      await sendFormatted(normalizedMsg, {
        text: '❌ *Suara tidak terdeteksi*\n\nPastikan:\n• Mikrofon tidak terhalang\n• Ruangan cukup tenang\n• Bacaan cukup jelas\n\nSilakan coba kirim voice note lagi. 🎙️'
      }, userId);
      return;
    }

    // 4. Analisis Tajwid — pass appConfig untuk override prompt/referensi dari DB
    const analysis = await analyzeTajwid(transcription, user, appConfig || null);

    // 5. Format & kirim
    const feedback = formatFeedback(analysis, transcription.text);
    await sendFormatted(normalizedMsg, { text: feedback }, userId);

    logger.info(`[TajwidHandler] ✅ Score: ${analysis.score} for user ${userId}`);
  } finally {
    if (mp3Path) cleanupTempFile(mp3Path);
    processingSet.delete(lockKey);
  }
};
