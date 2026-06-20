/**
 * Dynamic App Handler
 * Handler universal untuk Mini Apps yang dibuat via dashboard (DB-driven)
 * Mendukung tipe: KEYWORD | VOICE_APP | KEYWORD_THEN_VOICE
 */
import { logger } from '../config/logger.js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { downloadAndConvertAudio, cleanupTempFile } from './tajwidChecker/audioProcessor.js';
import fs from 'fs';
import * as creditService from '../services/creditService.js';
import { extractMessageContent } from '@whiskeysockets/baileys';

/**
 * Main handler — dipanggil oleh AppExecutor
 * @param {object} normalizedMsg
 * @param {object} context - { userId, user, appId, sendMessage, appConfig }
 */
export const handler = async (normalizedMsg, context) => {
    const { user, sendMessage, appConfig } = context;
    const { rawMessage } = normalizedMsg;
    const userId = user?.id ?? context.userId;

    // Gunakan extractMessageContent agar wrapped messages (ephemeral, viewOnce, dll) terdeteksi
    const trueMsg = extractMessageContent(rawMessage?.message);
    // Deteksi audio: PTT (voice note rekaman) ATAU file audio yang diupload (ptt: false)
    const isVoiceNote = !!(trueMsg?.audioMessage);

    logger.info(`[DynamicHandler] App: ${appConfig.name} | triggerType: ${appConfig.triggerType} | isVoice: ${isVoiceNote}`);

    // Credit guard
    const hasCredits = await creditService.checkCredits(userId);
    if (!hasCredits) {
        await sendMessage(normalizedMsg, { text: '⚠️ Kredit tidak cukup untuk menjalankan mini-app ini.' });
        return;
    }

    let inputText = normalizedMsg.text || '';

    // Strip keyword prefix dari inputText agar AI hanya terima konten sesungguhnya
    // Contoh: "!summary bla" → "bla", "!summary" (tanpa argumen) → ""
    try {
        const keywords = JSON.parse(appConfig.triggerKeywords || '[]');
        for (const kw of keywords) {
            if (inputText.toLowerCase().startsWith(kw.toLowerCase())) {
                inputText = inputText.slice(kw.length).trim();
                break;
            }
        }
    } catch { /* abaikan parse error triggerKeywords */ }

    // Ekstrak konten quoted message jika user me-reply pesan
    // Ini penting untuk app seperti !summary: user me-reply lalu bot merangkum isi pesan tersebut
    const contextInfo = trueMsg?.extendedTextMessage?.contextInfo
        || trueMsg?.imageMessage?.contextInfo
        || trueMsg?.videoMessage?.contextInfo
        || {};

    if (contextInfo?.quotedMessage) {
        const quotedTrue = extractMessageContent(contextInfo.quotedMessage);
        const quotedText = quotedTrue?.conversation
            || quotedTrue?.extendedTextMessage?.text
            || quotedTrue?.imageMessage?.caption
            || '';
        if (quotedText) {
            inputText = inputText
                ? `${inputText}\n\n[Pesan yang di-reply]:\n${quotedText}`
                : quotedText;
            logger.info(`[DynamicHandler] Quoted message extracted: "${quotedText.slice(0, 80)}"`);
        }
    }

    // Jika Voice App: transcribe audio dulu
    if (isVoiceNote && (appConfig.triggerType === 'VOICE_APP' || appConfig.triggerType === 'KEYWORD_THEN_VOICE')) {
        inputText = await transcribeVoice(normalizedMsg, user);
        if (!inputText) {
            await sendMessage(normalizedMsg, { text: '❌ Gagal memproses voice note. Coba lagi.' });
            return;
        }
        logger.info(`[DynamicHandler] Transcribed: "${inputText.slice(0, 80)}"`);
    }

    // Fallback: jika tidak ada konten sama sekali setelah semua ekstraksi
    if (!inputText && !isVoiceNote) {
        await sendMessage(normalizedMsg, {
            text: `ℹ️ Tidak ada teks yang bisa diproses.\n\nCara pakai: Reply pesan yang ingin diproses, lalu ketik perintah ini.`
        });
        return;
    }

    // Generate AI response
    const response = await generateAIResponse(user, appConfig.systemPrompt, inputText);

    if (response) {
        // Catatan: messageAdapter.sendMessage sudah handle credit deduction secara internal
        // JANGAN panggil creditService.deductCredit() lagi di sini (double deduction)
        await sendMessage(normalizedMsg, { text: response });
    } else {
        await sendMessage(normalizedMsg, { text: '❌ Tidak ada respons dari AI. Coba lagi.' });
    }
};

const transcribeVoice = async (normalizedMsg, user) => {
    let mp3Path = null;
    try {
        mp3Path = await downloadAndConvertAudio(normalizedMsg);
        const openai = new OpenAI({ apiKey: user.aiApiKey });
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(mp3Path),
            model: 'whisper-1',
            language: 'id'
        });
        return transcription.text;
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
