/**
 * Style Analyzer — Handler Utama
 * Alur: Terima gambar → Download & Base64 → Hit Claude API → Format & Kirim
 */
import { downloadAndEncodeImage } from './imageProcessor.js';
import { analyzeStyle, formatFeedback } from './analyzer.js';
import { sendFormatted } from '../ResponseFormatter.js';
import { logger } from '../../config/logger.js';

// Anti-spam: cegah proses paralel dari user yang sama
const processingSet = new Set();

export const handler = async (normalizedMsg, context) => {
  const { userId, user } = context;
  const { jid } = normalizedMsg;
  const lockKey = `${userId}:${jid}`;

  if (processingSet.has(lockKey)) {
    await sendFormatted(normalizedMsg, { text: '⏳ Masih memproses foto sebelumnya...' }, userId);
    return;
  }

  processingSet.add(lockKey);

  try {
    // 1. Validasi API Key
    if (!user?.aiApiKey) {
      await sendFormatted(normalizedMsg, {
        text: '⚠️ *Memerlukan Anthropic API Key*\n\nSilakan set API Key di:\n*Dashboard → Pengaturan → AI Configuration*'
      }, userId);
      return;
    }

    // 2. Beri pesan tunggu
    await sendFormatted(normalizedMsg, {
      text: '📸 *Foto diterima!*\n⏳ AI sedang menganalisis tone kulit dan bentuk tubuh Anda...\n\n_(Proses memakan waktu 15–30 detik)_'
    }, userId);

    // 3. Download dan konversi gambar
    const base64Image = await downloadAndEncodeImage(normalizedMsg);

    // 4. Analisis dengan AI
    const analysisJson = await analyzeStyle(base64Image, user.aiApiKey);

    // 5. Format hasil & kirim ke user
    const feedback = formatFeedback(analysisJson);
    
    if (analysisJson.imagePrompt) {
      // Gunakan Pollinations API dengan model flux untuk gambar photorealistic
      // PERBAIKAN: Gunakan endpoint 'image.pollinations.ai/prompt/' agar mengembalikan RAW image (JPEG)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(analysisJson.imagePrompt)}?width=768&height=1024&model=flux&nologo=true`;
      
      logger.info(`[StyleAnalyzer] Generating image via URL: ${imageUrl}`);
      
      try {
        // Fetch gambar ke buffer terlebih dahulu agar Sharp di Baileys tidak error jika ada redirect/format aneh
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
          throw new Error(`Pollinations HTTP Error: ${imgResponse.status}`);
        }
        
        // Pastikan kontennya benar-benar gambar
        const contentType = imgResponse.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
           throw new Error(`URL tidak mengembalikan gambar (mendapat ${contentType})`);
        }

        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        await sendFormatted(normalizedMsg, {
          image: buffer,
          caption: feedback
        }, userId);
      } catch (imgError) {
        logger.error(`[StyleAnalyzer] Gagal mendownload gambar Pollinations: ${imgError.message}`);
        // Fallback: kirim teks + URL gambar
        await sendFormatted(normalizedMsg, { 
          text: `${feedback}\n\n⚠️ _AI gagal memuat pratinjau gambar secara langsung, silakan klik link ini:_\n${imageUrl}` 
        }, userId);
      }
    } else {
      // Fallback jika hanya ada error atau text
      await sendFormatted(normalizedMsg, { text: feedback }, userId);
    }

    logger.info(`[StyleAnalyzer] ✅ Analisis selesai untuk user ${userId}`);
  } catch (error) {
    logger.error(`[StyleAnalyzer] Error untuk user ${userId}: ${error.message}`);
    await sendFormatted(normalizedMsg, {
      text: `❌ *Terjadi Kesalahan*\n\n${error.message}\nPastikan gambar yang dikirim jelas dan beresolusi baik.`
    }, userId);
  } finally {
    processingSet.delete(lockKey);
  }
};
