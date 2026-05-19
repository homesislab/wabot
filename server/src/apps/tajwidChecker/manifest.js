/**
 * Tajwid Checker — App Manifest
 * Mendefinisikan metadata, trigger, dan requirement app
 */
import { handler } from './handler.js';

const manifest = {
  // === IDENTITAS ===
  id: 'tajwid-checker',
  name: 'Tajwid Checker',
  description: 'Kirim voice note membaca Al-Fatiha, bot analisis tajwid per kata dan beri feedback detail.',
  icon: '🕌',
  color: '#10b981',
  category: 'Islami',
  version: '1.0.0',
  author: 'SISIA Team',

  // === TRIGGER ===
  // User harus ketik salah satu keyword dulu, BARU kirim voice note
  // Session aktif selama 5 menit setelah keyword dikirim
  trigger: {
    type: 'KEYWORD_THEN_VOICE',
    value: ['!tajwid', 'cek tajwid', 'tajwid', '!alfatihah', 'cek bacaan'],
  },

  // === REQUIREMENT ===
  requiresApiKey: true,   // Butuh AI API Key
  showProcessing: true,   // Tampilkan typing indicator

  // Pesan konfirmasi saat keyword berhasil mengatifkan mode
  activationMessage: `🕌 *Tajwid Checker siap!*\n\nSilahkan kirim *voice note* membaca *Surah Al-Fatiha* sekarang.\n\n⏱ Sesi aktif selama *5 menit*.`,

  // === HANDLER ===
  handler,
};

export default manifest;
