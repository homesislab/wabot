/**
 * Style Analyzer — Image Processor
 * Utility untuk mendownload gambar dari WhatsApp Message (Baileys)
 * dan mengkonversinya menjadi Base64 string untuk API Vision.
 */
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { logger } from '../../config/logger.js';

/**
 * Download gambar dari WhatsApp message dan kembalikan sebagai Base64 string
 * @param {object} normalizedMsg 
 * @returns {Promise<string>} Base64 string gambar (tanpa prefix data:image/jpeg;base64,)
 */
export const downloadAndEncodeImage = async (normalizedMsg) => {
  try {
    const imageMessage = normalizedMsg.rawMessage?.message?.imageMessage;
    if (!imageMessage) {
      throw new Error('Tidak ada pesan gambar yang ditemukan');
    }

    const stream = await downloadContentFromMessage(imageMessage, 'image');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    
    // Return the raw base64 string
    return buffer.toString('base64');
  } catch (error) {
    logger.error(`[StyleAnalyzer] Gagal download gambar: ${error.message}`);
    throw error;
  }
};
