/**
 * Dynamic App Handler
 * Handler universal untuk Mini Apps yang dibuat via dashboard (DB-driven)
 * Mendukung tipe: KEYWORD | VOICE_APP | KEYWORD_THEN_VOICE
 */
import { logger } from '../config/logger.js';
import { extractMessageContent } from '@whiskeysockets/baileys';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { downloadAndConvertAudio, cleanupTempFile } from './tajwidChecker/audioProcessor.js';
import fs from 'fs';

/**
 * Main handler — dipanggil oleh AppExecutor
 * @param {object} normalizedMsg
 * @param {object} context - { userId, user, appId, sendMessage, appConfig }
 */
export const handler = async (normalizedMsg, context) => {
    const { user, sendMessage, appConfig } = context;
    const { rawMessage } = normalizedMsg;

    const actualMsg = extractMessageContent(rawMessage?.message) || rawMessage?.message;
    const isVoiceNote = actualMsg?.audioMessage?.ptt === true ||
                        !!(actualMsg?.audioMessage) ||
                        !!(actualMsg?.documentMessage && actualMsg?.documentMessage?.mimetype?.startsWith('audio/'));

    logger.info(`[DynamicHandler] App: ${appConfig.name} | triggerType: ${appConfig.triggerType} | isVoice: ${isVoiceNote}`);

    let inputText = normalizedMsg.text || '';

    // Jika Voice App: transcribe audio dulu
    if (isVoiceNote && (appConfig.triggerType === 'VOICE_APP' || appConfig.triggerType === 'KEYWORD_THEN_VOICE')) {
        inputText = await transcribeVoice(normalizedMsg, user);
        if (!inputText) {
            await sendMessage(normalizedMsg, { text: '❌ Gagal memproses voice note. Coba lagi.' });
            return;
        }
        logger.info(`[DynamicHandler] Transcribed: "${inputText.slice(0, 80)}"`);
    }

    // Generate AI response dengan systemPrompt dari appConfig
    const response = await generateAIResponse(user, appConfig.systemPrompt, inputText);

    if (response) {
        await sendMessage(normalizedMsg, { text: response });
    } else {
        await sendMessage(normalizedMsg, { text: '❌ Tidak ada respons dari AI. Coba lagi.' });
    }
};

const transcribeVoice = async (normalizedMsg, user) => {
    let mp3Path = null;
    try {
        mp3Path = await downloadAndConvertAudio(normalizedMsg);
        const provider = user.aiProvider || 'openai';

        if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(user.aiApiKey);
            const geminiModel = genAI.getGenerativeModel({
                model: user.aiModel || 'gemini-1.5-flash'
            });

            const audioBuffer = fs.readFileSync(mp3Path);
            const audioBase64 = audioBuffer.toString('base64');

            const result = await geminiModel.generateContent([
                {
                    inlineData: {
                        data: audioBase64,
                        mimeType: 'audio/mp3'
                    }
                },
                {
                    text: 'Transkripsikan audio berikut ke dalam teks bahasa Indonesia secara akurat. Kembalikan HANYA teks transkripsi, tanpa komentar/penjelasan tambahan.'
                }
            ]);
            return result.response.text()?.trim() || '';
        } else {
            const openai = new OpenAI({ apiKey: user.aiApiKey });
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(mp3Path),
                model: 'whisper-1',
                language: 'id'
            });
            return transcription.text;
        }
    } catch (err) {
        logger.error(`[DynamicHandler] Transcribe error: ${err.message}`);
        return null;
    } finally {
        cleanupTempFile(mp3Path);
    }
};

const generateAIResponse = async (user, systemPrompt, userInput) => {
    const provider = user.aiProvider || 'openai';
    const model = user.aiModel;

    try {
        if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(user.aiApiKey);
            const useModel = model || 'gemini-1.5-flash';
            const geminiModel = genAI.getGenerativeModel({ model: useModel });
            const result = await geminiModel.generateContent(`${systemPrompt}\n\nUser: ${userInput}`);
            return result.response.text();
        } else {
            const openai = new OpenAI({ apiKey: user.aiApiKey });
            const useModel = model || 'gpt-4o-mini';
            const completion = await openai.chat.completions.create({
                model: useModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userInput }
                ]
            });
            return completion.choices[0].message.content;
        }
    } catch (err) {
        logger.error(`[DynamicHandler] AI error: ${err.message}`);
        throw err;
    }
};
