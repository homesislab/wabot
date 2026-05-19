/**
 * Seed Static Mini Apps ke DB
 * Dipanggil satu kali saat startup atau manual
 * Static apps (Tajwid, Zakat) tetap pakai filesystem handler tapi config-nya ada di DB
 */
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';

const STATIC_APPS_SEED = [
  {
    id: 'static_zakat-calculator',
    name: 'Kalkulator Zakat',
    description: 'Hitung zakat mal dengan mudah. Ketik !zakat <jumlah harta> dan bot langsung hitung beserta penjelasannya.',
    icon: '💰',
    color: '#f59e0b',
    category: 'Islami',
    version: '1.0.0',
    author: 'SISIA Team',
    triggerType: 'KEYWORD',
    triggerKeywords: JSON.stringify(['!zakat', 'zakat mal', 'hitung zakat']),
    systemPrompt: null,
    activationMsg: null,
    requiresApiKey: false,
    showProcessing: false,
    handlerType: 'ZAKAT_CALCULATOR',
    isActive: true,
  },
  {
    id: 'static_tajwid-checker',
    name: 'Tajwid Checker',
    description: 'Kirim voice note membaca Al-Fatiha, bot analisis tajwid per kata dan beri feedback detail.',
    icon: '🕌',
    color: '#10b981',
    category: 'Islami',
    version: '1.0.0',
    author: 'SISIA Team',
    triggerType: 'KEYWORD_THEN_VOICE',
    triggerKeywords: JSON.stringify(['!tajwid', 'cek tajwid', 'tajwid', '!alfatihah', 'cek bacaan']),
    systemPrompt: null,
    activationMsg: '🕌 *Tajwid Checker siap!*\n\nSilahkan kirim *voice note* membaca *Surah Al-Fatiha* sekarang.\n\n⏱ Sesi aktif selama *5 menit*.',
    requiresApiKey: true,
    showProcessing: true,
    handlerType: 'TAJWID_CHECKER',
    isActive: true,
  },
];

/**
 * Seed semua static apps untuk userId (admin by default)
 * Hanya insert jika belum ada (upsert by id)
 */
export const seedStaticApps = async (userId = 1) => {
  try {
    for (const app of STATIC_APPS_SEED) {
      await prisma.miniApp.upsert({
        where: { id: app.id },
        update: {}, // Jangan overwrite jika sudah pernah diedit user
        create: { ...app, userId },
      });
    }
    logger.info(`[SeedApps] Static apps seeded for userId ${userId}`);
  } catch (err) {
    logger.error(`[SeedApps] Error: ${err.message}`);
  }
};
