/**
 * Response Formatter — Layer khusus untuk memformat output ke WhatsApp
 * Handle: typing indicator, error messages, WhatsApp markdown formatting
 */
import * as messageAdapter from '../services/messageAdapter.js';
import { logger } from '../config/logger.js';

/**
 * Kirim pesan "sedang mengetik..." lalu kirim hasil
 * @param {object} normalizedMsg
 * @param {string|object} content
 * @param {number} userId
 */
export const sendFormatted = async (normalizedMsg, content, userId) => {
  await messageAdapter.sendMessage(normalizedMsg, content, userId);
};

/**
 * Kirim notifikasi "sedang diproses" (typing indicator via teks)
 * @param {object} normalizedMsg
 * @param {string} appName - nama app untuk konteks pesan
 * @param {number} userId
 */
export const sendProcessing = async (normalizedMsg, appName, userId) => {
  const msgs = {
    'tajwid-checker': '🎙️ *Voice note diterima!*\n⏳ Menganalisis bacaan Al-Fatiha...\n_(15–30 detik)_',
    'zakat-calculator': '💰 Menghitung zakat Anda...',
    default: '⏳ Sedang memproses, mohon tunggu...',
  };
  const text = msgs[appName] || msgs.default;
  await messageAdapter.sendMessage(normalizedMsg, { text }, userId);
};

/**
 * Kirim pesan error yang ramah pengguna
 */
export const sendError = async (normalizedMsg, error, userId) => {
  let text = '❌ Terjadi kesalahan. Silakan coba lagi.';

  if (error.message?.includes('API Key')) {
    text = `⚠️ *API Key tidak dikonfigurasi*\n\nSilakan set OpenAI API Key di:\n*Dashboard → My Profile → AI Configuration*`;
  } else if (error.message?.includes('audio') || error.message?.includes('ffmpeg')) {
    text = '❌ Gagal memproses audio. Pastikan voice note jelas dan coba lagi.';
  } else if (error.message?.includes('429')) {
    text = '⚠️ Batas penggunaan API tercapai. Coba lagi dalam beberapa menit.';
  }

  logger.error(`[ResponseFormatter] Error sent to user: ${error.message}`);
  await messageAdapter.sendMessage(normalizedMsg, { text }, userId);
};

/**
 * Format teks dengan WhatsApp markdown
 * Bold: *teks*, Italic: _teks_, Monospace: `teks`
 */
export const bold = (text) => `*${text}*`;
export const italic = (text) => `_${text}_`;
export const mono = (text) => `\`${text}\``;
export const divider = () => '━━━━━━━━━━━━━━━━━━━━';
