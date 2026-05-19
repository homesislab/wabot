import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FULL_TEXT, AYAT_TEXTS, TAJWID_NOTES } from './alfatihaReference.js';
import { logger } from '../../config/logger.js';

// ─────────────────────────────────────────────
// Prompt Templates — support DB override via appConfig
// ─────────────────────────────────────────────
/**
 * @param {string} transcribedText
 * @param {number} duration
 * @param {object|null} appConfig - DB config dari MiniApp table (optional)
 *   appConfig.systemPrompt → override seluruh system prompt
 *   appConfig.referenceText → override teks referensi bacaan
 */
const buildPrompts = (transcribedText, duration, appConfig = null) => {
  // ── Referensi teks: dari DB jika ada, fallback ke alfatihaReference.js ──
  let referenceSection;
  if (appConfig?.referenceText?.trim()) {
    referenceSection = `=== TEKS REFERENSI ===\n${appConfig.referenceText.trim()}`;
    logger.info('[TajwidAnalyzer] Using custom referenceText from DB');
  } else {
    const referencePerAyat = AYAT_TEXTS.map(a => `Ayat ${a.ayat}: ${a.text}`).join('\n');
    const tajwidNotesList = Object.entries(TAJWID_NOTES)
      .map(([id, note]) => `- Kata ke-${id}: ${note}`)
      .join('\n');
    referenceSection = `=== TEKS REFERENSI AL-FATIHA ===\n${referencePerAyat}\n\n=== CATATAN HUKUM TAJWID KUNCI ===\n${tajwidNotesList}`;
  }

  // ── System prompt: dari DB jika ada, fallback ke default ──
  let systemPrompt;
  if (appConfig?.systemPrompt?.trim()) {
    // Inject referenceSection ke dalam custom prompt jika ada placeholder {{REFERENSI}}
    if (appConfig.systemPrompt.includes('{{REFERENSI}}')) {
      systemPrompt = appConfig.systemPrompt.replace('{{REFERENSI}}', referenceSection);
    } else {
      // Append referensi setelah custom prompt
      systemPrompt = `${appConfig.systemPrompt.trim()}\n\n${referenceSection}`;
    }
    logger.info('[TajwidAnalyzer] Using custom systemPrompt from DB');
  } else {
    systemPrompt = `Anda adalah guru tajwid Al-Qur'an yang ahli dan berpengalaman mengajar tahsin.
Tugas: Analisis bacaan Al-Fatiha user yang sudah ditranskripsi.

${referenceSection}

=== PETUNJUK ANALISIS ===
1. Whisper/ASR mungkin ada keterbatasan menangkap harakat → fokus pada kata yang salah atau terlewat
2. Kategorikan error: MAKHROJ | HARAKAT | MAD | WAQAF | TAMBAH | KURANG
3. Scoring: mulai dari 100, kurangi per kesalahan (KURANG: -5, TAMBAH: -3, MAKHROJ: -4, HARAKAT: -3, MAD: -3, WAQAF: -2)
4. Jika bacaan kosong atau tidak mirip Al-Fatiha sama sekali, berikan skor 0
5. Jawab HANYA dengan JSON valid (tanpa markdown, tanpa backtick)`;
  }

  const userPrompt = `Hasil transkripsi dari bacaan user:
"${transcribedText}"

Durasi rekaman: ${duration ? duration.toFixed(1) + ' detik' : 'tidak diketahui'}

Kembalikan JSON:
{
  "score": <integer 0-100>,
  "completeness": <integer 0-100>,
  "overall_feedback": "<satu kalimat dalam Bahasa Indonesia>",
  "mistakes": [
    {
      "word_user": "<kata user, atau '-' jika terlewat>",
      "word_reference": "<kata referensi>",
      "ayat": <1-7>,
      "error_type": "<MAKHROJ|HARAKAT|MAD|WAQAF|TAMBAH|KURANG>",
      "explanation": "<penjelasan dalam Bahasa Indonesia>",
      "correction": "<cara yang benar>"
    }
  ],
  "tips": ["<tip 1>", "<tip 2>"],
  "is_al_fatiha": <true|false>
}`;

  return { systemPrompt, userPrompt };
};

/**
 * Analisis tajwid — auto-detect provider dari user config
 *
 * @param {{text: string, words: Array, duration: number}} transcriptionResult
 * @param {object} user - { aiApiKey, aiProvider, aiModel }
 * @param {object|null} appConfig - DB config (systemPrompt, referenceText) dari MiniApp
 * @returns {Promise<object>}
 */
export const analyzeTajwid = async (transcriptionResult, user, appConfig = null) => {
  const { text: transcribedText, duration } = transcriptionResult;
  const provider = user.aiProvider || 'openai';

  if (provider === 'gemini') {
    return await analyzeWithGemini(transcribedText, duration, user.aiApiKey, user.aiModel, appConfig);
  }
  return await analyzeWithOpenAI(transcribedText, duration, user.aiApiKey, user.aiModel, appConfig);
};

// ─────────────────────────────────────────────
// OpenAI GPT Analysis
// ─────────────────────────────────────────────
const analyzeWithOpenAI = async (transcribedText, duration, apiKey, model, appConfig = null) => {
  const { systemPrompt, userPrompt } = buildPrompts(transcribedText, duration, appConfig);
  const openai = new OpenAI({ apiKey });
  const useModel = model || 'gpt-4o';

  logger.info(`[TajwidAnalyzer] Using OpenAI ${useModel}...`);

  const completion = await openai.chat.completions.create({
    model: useModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    // temperature: default (1) — gpt-5.x tidak support nilai custom
  });

  const analysis = JSON.parse(completion.choices[0].message.content);
  logger.info(`[TajwidAnalyzer] OpenAI score=${analysis.score}, mistakes=${analysis.mistakes?.length || 0}`);
  return analysis;
};

// ─────────────────────────────────────────────
// Google Gemini Analysis
// ─────────────────────────────────────────────
const analyzeWithGemini = async (transcribedText, duration, apiKey, model, appConfig = null) => {
  const { systemPrompt, userPrompt } = buildPrompts(transcribedText, duration, appConfig);
  const genAI = new GoogleGenerativeAI(apiKey);
  const useModel = model || 'gemini-1.5-flash';

  logger.info(`[TajwidAnalyzer] Using Google Gemini ${useModel}...`);

  const geminiModel = genAI.getGenerativeModel({
    model: useModel,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const result = await geminiModel.generateContent(
    `${systemPrompt}\n\n${userPrompt}`
  );

  const raw = result.response.text();
  const analysis = JSON.parse(raw);
  logger.info(`[TajwidAnalyzer] Gemini score=${analysis.score}, mistakes=${analysis.mistakes?.length || 0}`);
  return analysis;
};


/**
 * Format hasil analisis menjadi pesan WhatsApp yang informatif & mudah dibaca
 *
 * @param {object} analysis - Hasil dari analyzeTajwid()
 * @param {string} transcribedText - Teks transkripsi Whisper
 * @returns {string} Teks pesan WhatsApp
 */
export const formatFeedback = (analysis, transcribedText) => {
  const {
    score = 0,
    completeness = 0,
    overall_feedback = '-',
    mistakes = [],
    tips = [],
    is_al_fatiha = true
  } = analysis;

  // Jika bukan Al-Fatiha
  if (!is_al_fatiha) {
    return `❌ *Bukan Bacaan Al-Fatiha*\n\nSistem mendeteksi bacaan Anda bukan Al-Fatiha.\nSilakan kirim voice note membaca *Surat Al-Fatiha* dari awal.\n\n💡 Mulai dari: _بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ_`;
  }

  // Score emoji & label
  let scoreEmoji, scoreLabel;
  if (score >= 95)      { scoreEmoji = '🏆'; scoreLabel = 'Sempurna!'; }
  else if (score >= 85) { scoreEmoji = '⭐'; scoreLabel = 'Sangat Baik'; }
  else if (score >= 70) { scoreEmoji = '✅'; scoreLabel = 'Baik'; }
  else if (score >= 55) { scoreEmoji = '⚠️'; scoreLabel = 'Perlu Perbaikan'; }
  else                  { scoreEmoji = '❌'; scoreLabel = 'Perlu Banyak Latihan'; }

  let msg = `🕌 *Analisis Tajwid Al-Fatiha*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Skor
  msg += `${scoreEmoji} *Skor: ${score}/100* — ${scoreLabel}\n`;
  msg += `📊 Kelengkapan ayat: ${completeness}%\n`;
  msg += `💬 _${overall_feedback}_\n\n`;

  // Transkripsi
  if (transcribedText) {
    msg += `🎙️ *Yang terdeteksi:*\n${transcribedText}\n\n`;
  }

  // Kesalahan
  if (mistakes.length > 0) {
    const errorTypeEmoji = {
      MAKHROJ: '👄',
      HARAKAT: '🔤',
      MAD:     '📏',
      WAQAF:   '⏸️',
      TAMBAH:  '➕',
      KURANG:  '➖'
    };

    msg += `❌ *Kesalahan (${mistakes.length}):*\n`;
    msg += `──────────────────────\n`;

    mistakes.forEach((m, idx) => {
      const icon = errorTypeEmoji[m.error_type] || '⚠️';
      msg += `\n*${idx + 1}. Ayat ${m.ayat}* ${icon} ${m.error_type}\n`;
      if (m.word_user && m.word_user !== '-') {
        msg += `   Anda ucapkan: _${m.word_user}_\n`;
      } else {
        msg += `   Anda ucapkan: _(terlewat)_\n`;
      }
      msg += `   Seharusnya: *${m.word_reference}*\n`;
      msg += `   📌 ${m.explanation}\n`;
      if (m.correction) {
        msg += `   ✏️ ${m.correction}\n`;
      }
    });
    msg += `\n`;
  } else {
    msg += `✅ *Tidak ada kesalahan terdeteksi!*\n`;
    msg += `MasyaAllah, bacaan Anda sangat baik! 🤲\n\n`;
  }

  // Tips
  if (tips.length > 0) {
    msg += `💡 *Tips Perbaikan:*\n`;
    tips.forEach(tip => {
      msg += `• ${tip}\n`;
    });
    msg += `\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔄 Kirim voice note lagi untuk mencoba ulang\n`;
  msg += `_Semoga Allah mudahkan belajar Al-Qur'an_ 🤲`;

  return msg;
};
