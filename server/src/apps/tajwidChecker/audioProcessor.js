import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from '../../config/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Download voice note dari WhatsApp dan convert ke mp3
 * Format WhatsApp: ogg/opus (ptt) → mp3 16kHz mono (optimal untuk Whisper)
 *
 * @param {object} normalizedMsg - Pesan ternormalisasi dari messageAdapter
 * @returns {Promise<string>} Path file mp3 temporary
 */
export const downloadAndConvertAudio = async (normalizedMsg) => {
  const { rawMessage, client } = normalizedMsg;
  const tmpDir = os.tmpdir();
  const fileId = `tajwid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const oggPath = path.join(tmpDir, `${fileId}.ogg`);
  const mp3Path = path.join(tmpDir, `${fileId}.mp3`);

  try {
    // 1. Download audio buffer dari Baileys
    logger.info('[TajwidChecker] Downloading voice note buffer...');
    const buffer = await downloadMediaMessage(
      rawMessage,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: client.updateMediaMessage
      }
    );

    if (!buffer || buffer.length === 0) {
      throw new Error('Downloaded audio buffer is empty');
    }

    // 2. Simpan sebagai ogg (format asli WhatsApp PTT)
    fs.writeFileSync(oggPath, buffer);
    logger.info(`[TajwidChecker] Voice note saved: ${oggPath} (${buffer.length} bytes)`);

    // 3. Convert ogg → mp3 via FFmpeg
    // - 16000 Hz sample rate (optimal untuk Whisper)
    // - 1 channel (mono)
    // - quality 0 (highest)
    const ffmpegCmd = `ffmpeg -i "${oggPath}" -ar 16000 -ac 1 -q:a 0 "${mp3Path}" -y 2>&1`;
    logger.info(`[TajwidChecker] Converting with FFmpeg...`);
    await execAsync(ffmpegCmd);

    if (!fs.existsSync(mp3Path)) {
      throw new Error('FFmpeg conversion failed: output file not created');
    }

    const mp3Stats = fs.statSync(mp3Path);
    logger.info(`[TajwidChecker] Converted to mp3: ${mp3Path} (${mp3Stats.size} bytes)`);

    return mp3Path;
  } catch (error) {
    logger.error(`[TajwidChecker] Audio processing error: ${error.message}`);
    throw new Error(`Gagal memproses audio: ${error.message}`);
  } finally {
    // Selalu hapus file ogg sementara
    if (fs.existsSync(oggPath)) {
      try { fs.unlinkSync(oggPath); } catch (_) {}
    }
  }
};

/**
 * Hapus file temporary setelah selesai dipakai
 * @param {string} filePath
 */
export const cleanupTempFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`[TajwidChecker] Temp file cleaned: ${filePath}`);
    }
  } catch (e) {
    logger.warn(`[TajwidChecker] Cleanup failed for ${filePath}: ${e.message}`);
  }
};

/**
 * Cek apakah ffmpeg tersedia di sistem
 * @returns {Promise<boolean>}
 */
export const checkFfmpegAvailable = async () => {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
};
