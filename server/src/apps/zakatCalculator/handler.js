/**
 * Zakat Calculator — Handler
 * Logic: parse angka dari pesan → hitung zakat → GPT explain → kirim hasil
 */
import OpenAI from 'openai';
import { sendFormatted } from '../ResponseFormatter.js';
import { logger } from '../../config/logger.js';

const NISAB_EMAS_GRAM = 85;   // gram emas
const HARGA_EMAS_PER_GRAM = 1350000; // estimasi (bisa diupdate)
const NISAB_RUPIAH = NISAB_EMAS_GRAM * HARGA_EMAS_PER_GRAM;
const KADAR_ZAKAT = 0.025; // 2.5%

const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/**
 * Parse angka dari teks (support format: 10jt, 10.000.000, 10000000)
 */
const parseAmount = (text) => {
  // Hapus prefix command
  const clean = text.replace(/^!zakat\s*/i, '').trim();

  // Support shorthand: 10jt, 5rb, 100rb
  if (/jt|juta/i.test(clean)) return parseFloat(clean.replace(/[^0-9.]/g, '')) * 1_000_000;
  if (/rb|ribu/i.test(clean)) return parseFloat(clean.replace(/[^0-9.]/g, '')) * 1_000;

  // Hapus titik dan koma sebagai separator
  return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
};

export const handler = async (normalizedMsg, context) => {
  const { userId, user } = context;
  const { text } = normalizedMsg;

  const harta = parseAmount(text);

  // Validasi input
  if (!harta || harta <= 0) {
    await sendFormatted(normalizedMsg, {
      text: `💰 *Kalkulator Zakat Mal*\n\nFormat: \`!zakat <jumlah harta>\`\n\n*Contoh:*\n• \`!zakat 10000000\`\n• \`!zakat 10jt\`\n• \`!zakat 500rb\`\n\n_Zakat dihitung berdasarkan nisab emas (85 gram ≈ ${formatRupiah(NISAB_RUPIAH)})_`
    }, userId);
    return;
  }

  // Hitung zakat
  const wajibZakat = harta >= NISAB_RUPIAH;
  const zakatAmount = wajibZakat ? harta * KADAR_ZAKAT : 0;

  let msg = `💰 *Kalkulator Zakat Mal*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `💵 Harta: *${formatRupiah(harta)}*\n`;
  msg += `📏 Nisab: ${formatRupiah(NISAB_RUPIAH)} (85 gr emas)\n\n`;

  if (wajibZakat) {
    msg += `✅ *Wajib Zakat*\n`;
    msg += `📤 Jumlah Zakat (2.5%): *${formatRupiah(zakatAmount)}*\n\n`;
  } else {
    msg += `❌ *Belum Wajib Zakat*\n`;
    msg += `Harta belum mencapai nisab.\n`;
    msg += `Kekurangan: *${formatRupiah(NISAB_RUPIAH - harta)}*\n\n`;
  }

  // Penjelasan AI (opsional, jika ada API key)
  if (user?.aiApiKey && wajibZakat) {
    try {
      const openai = new OpenAI({ apiKey: user.aiApiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Kamu adalah konsultan zakat. Berikan saran singkat (2-3 kalimat) cara terbaik membayar zakat mal dalam Bahasa Indonesia yang ramah.'
        }, {
          role: 'user',
          content: `Harta: ${formatRupiah(harta)}, Zakat: ${formatRupiah(zakatAmount)}`
        }],
        max_tokens: 150
      });
      const advice = completion.choices[0].message.content;
      msg += `💡 *Saran:*\n_${advice}_\n\n`;
    } catch { /* skip AI jika gagal */ }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_Semoga Allah menerima zakat Anda_ 🤲`;

  await sendFormatted(normalizedMsg, { text: msg }, userId);
  logger.info(`[ZakatHandler] Calculated for ${formatRupiah(harta)} → ${formatRupiah(zakatAmount)}`);
};
