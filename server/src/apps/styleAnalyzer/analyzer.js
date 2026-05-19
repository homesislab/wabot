/**
 * Style Analyzer — AI Analyzer
 * Menggunakan Anthropic API (via @anthropic-ai/sdk atau http request)
 * Menggunakan OpenAI API (via http request)
 * karena konteks sistem menggunakan OpenAI API.
 * Di sini kita asumsikan menggunakan request HTTP fetch standar agar tidak perlu instal package baru.
 */
import { logger } from '../../config/logger.js';

export const analyzeStyle = async (base64Image, apiKey) => {
  try {
    logger.info(`[StyleAnalyzer] Menganalisis gambar menggunakan OpenAI Vision API...`);

    // Prompt yang ketat meminta format JSON dari OpenAI
    const systemPrompt = `You are an expert personal stylist and AI Prompt Engineer. Analyze the provided photo.
You must reply ONLY with a valid JSON object matching this structure (no markdown wrapper, no extra text):
{
  "skinTone": "...", 
  "bodyShape": "...", 
  "colorPalette": ["Color1", "Color2", "Color3"],
  "recommendations": [
    { "style": "Casual", "outfit": "...", "tips": "..." },
    { "style": "Formal", "outfit": "...", "tips": "..." }
  ],
  "avoid": ["...", "..."],
  "imagePrompt": "A highly detailed photorealistic full body fashion photography shot of a [ethnicity/skin tone] [gender] with [body shape] body type, wearing [detailed casual outfit from your recommendation]. Editorial fashion magazine cover, 8k resolution, natural lighting, highly detailed face."
}
If you cannot see the person clearly, return an error in JSON: { "error": "Foto tidak jelas atau tidak ada orang." }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Please analyze this photo.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error(`[StyleAnalyzer] API Error: ${JSON.stringify(data)}`);
      throw new Error(data.error?.message || 'Gagal menghubungi AI Provider.');
    }

    // Ekstrak teks balasan OpenAI (seharusnya JSON murni)
    let jsonText = data.choices[0].message.content.trim();

    // Hapus markdown wrapper jika AI masih membandel (misal: ```json ... ```)
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText);
  } catch (error) {
    logger.error(`[StyleAnalyzer] Exception: ${error.message}`);
    throw new Error('Gagal memproses gambar. Pastikan API Key OpenAI Anda valid.');
  }
};

/**
 * Format hasil JSON menjadi teks WhatsApp yang rapi
 */
export const formatFeedback = (analysis) => {
  if (analysis.error) {
    return `❌ *Gagal Menganalisis*\n\n${analysis.error}`;
  }

  let text = `✨ *STYLE & OUTFIT ANALYZER* ✨\n\n`;
  text += `👤 *Analisis Profil*\n`;
  text += `• *Undertone:* ${analysis.skinTone}\n`;
  text += `• *Bentuk Tubuh:* ${analysis.bodyShape}\n\n`;

  text += `🎨 *Palet Warna Terbaik:*\n${analysis.colorPalette.join(', ')}\n\n`;

  text += `👗 *Rekomendasi Outfit*\n`;
  analysis.recommendations.forEach(r => {
    text += `*${r.style}:*\n- ${r.outfit}\n- _Tips: ${r.tips}_\n\n`;
  });

  text += `⚠️ *Hindari:* ${analysis.avoid.join(', ')}\n\n`;
  text += `✨ _Berikut adalah AI *Visual Try-On* dari gaya kasual yang kami rekomendasikan untuk Anda!_`;
  
  return text;
};
