/**
 * Transcriber — STT (Speech-to-Text) untuk Arabic
 * Support: OpenAI Whisper | Google Gemini Audio
 */
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { logger } from '../../config/logger.js';

/**
 * Transkripsi audio Arabic
 * Auto-detect provider dari user config
 *
 * @param {string} mp3FilePath
 * @param {object} user - { aiApiKey, aiProvider, aiModel }
 * @returns {Promise<{text: string, words: Array, duration: number, provider: string}>}
 */
export const transcribeArabic = async (mp3FilePath, user) => {
  const provider = user.aiProvider || 'openai';

  if (provider === 'gemini') {
    return await transcribeWithGemini(mp3FilePath, user.aiApiKey, user.aiModel);
  }
  return await transcribeWithOpenAI(mp3FilePath, user.aiApiKey);
};

// ─────────────────────────────────────────────
// OpenAI Whisper
// ─────────────────────────────────────────────
const transcribeWithOpenAI = async (mp3FilePath, apiKey) => {
  logger.info('[Transcriber] Using OpenAI Whisper...');
  const openai = new OpenAI({ apiKey });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(mp3FilePath),
      model: 'whisper-1',
      language: 'ar',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      prompt: 'بسم الله الرحمن الرحيم الحمد لله رب العالمين'
    });

    const text = transcription.text?.trim() || '';
    const words = transcription.words || [];
    const duration = transcription.duration || 0;

    logger.info(`[Transcriber] Whisper: "${text}" (${duration.toFixed(1)}s)`);
    return { text, words, duration, provider: 'openai' };
  } catch (error) {
    if (error.status === 401) throw new Error('OpenAI API Key tidak valid');
    if (error.status === 429) throw new Error('Batas penggunaan OpenAI tercapai, coba lagi nanti');
    if (error.status === 413) throw new Error('File audio terlalu besar (maks 25MB)');
    throw new Error(`OpenAI Whisper error: ${error.message}`);
  }
};

// ─────────────────────────────────────────────
// Google Gemini Audio (Gemini 1.5+ support inline audio)
// ─────────────────────────────────────────────
const transcribeWithGemini = async (mp3FilePath, apiKey, model) => {
  logger.info('[Transcriber] Using Google Gemini for audio transcription...');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: model || 'gemini-1.5-flash'
    });

    // Baca file audio sebagai base64
    const audioBuffer = fs.readFileSync(mp3FilePath);
    const audioBase64 = audioBuffer.toString('base64');

    const result = await geminiModel.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: 'audio/mp3'
        }
      },
      {
        text: `Transkripsi audio ini ke teks Arab. Audio berisi bacaan Al-Qur'an surat Al-Fatiha.
Kembalikan HANYA teks Arab yang diucapkan, tanpa penjelasan tambahan.
Jika tidak ada suara yang jelas, kembalikan string kosong "".`
      }
    ]);

    const text = result.response.text()?.trim() || '';
    logger.info(`[Transcriber] Gemini audio: "${text}"`);

    // Gemini tidak kasih word timestamps — return tanpa words
    return { text, words: [], duration: 0, provider: 'gemini' };
  } catch (error) {
    if (error.message?.includes('API_KEY')) throw new Error('Gemini API Key tidak valid');
    if (error.message?.includes('QUOTA')) throw new Error('Batas penggunaan Gemini tercapai');
    throw new Error(`Gemini audio error: ${error.message}`);
  }
};
