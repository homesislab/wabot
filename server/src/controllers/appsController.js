import { prisma } from '../prisma.js';
import { getCatalogForUser } from '../apps/AppRegistry.js';
import { logger } from '../config/logger.js';
import path from 'path';

/**
 * GET /api/apps
 * Semua apps user dari DB + isEnabled status
 */
export const getApps = async (req, res) => {
  try {
    const userId = req.user.id;
    const apps = await getCatalogForUser(userId);

    const result = apps.map(app => {
      let keywords = [];
      try { keywords = JSON.parse(app.triggerKeywords); } catch {}

      return {
        id: app.id,
        dbId: app.id,
        name: app.name,
        description: app.description,
        icon: app.icon,
        category: app.category,
        color: app.color,
        version: app.version,
        author: app.author,
        handlerType: app.handlerType,
        isDbApp: true,
        isEnabled: app.isActive,
        requiresApiKey: app.requiresApiKey,
        showProcessing: app.showProcessing,
        trigger: {
          type: app.triggerType === 'VOICE_APP'
            ? 'VOICE_NOTE'
            : app.triggerType,
          value: keywords,
        },
        triggerType: app.triggerType,
        triggerKeywords: keywords,
        systemPrompt: app.systemPrompt,
        referenceText: app.referenceText,
        activationMessage: app.activationMsg,
        isStatic: app.handlerType !== 'DYNAMIC',
      };
    });

    res.json(result);
  } catch (error) {
    logger.error(`[AppsController] getApps error: ${error.message}`);
    res.status(500).json({ error: 'Gagal mengambil daftar apps' });
  }
};

/**
 * PUT /api/apps/:appId/toggle
 */
export const toggleApp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appId } = req.params;
    const { isEnabled } = req.body;

    const updated = await prisma.miniApp.updateMany({
      where: { id: appId, userId },
      data: { isActive: Boolean(isEnabled) }
    });

    if (updated.count === 0) return res.status(404).json({ error: 'App tidak ditemukan' });
    res.json({ appId, isEnabled: Boolean(isEnabled) });
  } catch (error) {
    logger.error(`[AppsController] toggleApp error: ${error.message}`);
    res.status(500).json({ error: 'Gagal mengubah status app' });
  }
};

/**
 * POST /api/apps
 * Buat Mini App baru (DYNAMIC handler)
 */
export const createApp = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name, description, icon, category, color,
      triggerType, triggerKeywords, systemPrompt, activationMsg
    } = req.body;

    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'name dan systemPrompt wajib diisi' });
    }

    const keywordsArr = Array.isArray(triggerKeywords)
      ? triggerKeywords
      : (triggerKeywords || '').split(',').map(k => k.trim()).filter(Boolean);

    const app = await prisma.miniApp.create({
      data: {
        name,
        description: description || '',
        icon: icon || '🤖',
        category: category || 'General',
        color: color || '#6366f1',
        version: '1.0.0',
        author: 'Custom',
        triggerType: triggerType || 'KEYWORD',
        triggerKeywords: JSON.stringify(keywordsArr),
        systemPrompt,
        activationMsg: activationMsg || null,
        requiresApiKey: true,
        showProcessing: true,
        handlerType: 'DYNAMIC',
        isActive: true,
        userId
      }
    });

    logger.info(`[AppsController] User ${userId} created Mini App: ${app.id}`);
    res.status(201).json(app);
  } catch (error) {
    logger.error(`[AppsController] createApp error: ${error.message}`);
    res.status(500).json({ error: 'Gagal membuat Mini App' });
  }
};

/**
 * PUT /api/apps/:appId
 * Update app — semua app bisa diedit (termasuk static)
 * Static apps: hanya boleh edit name, description, icon, keywords, activationMsg
 * Dynamic apps: semua field bisa diedit
 */
export const updateApp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appId } = req.params;

    const existing = await prisma.miniApp.findFirst({ where: { id: appId, userId } });
    if (!existing) return res.status(404).json({ error: 'App tidak ditemukan' });

    const {
      name, description, icon, category, color,
      triggerType, triggerKeywords, systemPrompt, activationMsg, referenceText
    } = req.body;

    const isStatic = existing.handlerType !== 'DYNAMIC';

    let keywordsJson;
    if (triggerKeywords !== undefined) {
      const arr = Array.isArray(triggerKeywords)
        ? triggerKeywords
        : triggerKeywords.split(',').map(k => k.trim()).filter(Boolean);
      keywordsJson = JSON.stringify(arr);
    }

    const updateData = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(icon !== undefined && { icon }),
      ...(keywordsJson !== undefined && { triggerKeywords: keywordsJson }),
      ...(activationMsg !== undefined && { activationMsg }),
      // systemPrompt & referenceText: bisa diedit SEMUA app (override engine default)
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(referenceText !== undefined && { referenceText }),
      // Category, color, triggerType: hanya untuk DYNAMIC
      ...(!isStatic ? {} : {}),
      ...(!isStatic && {
        ...(category !== undefined && { category }),
        ...(color !== undefined && { color }),
        ...(triggerType !== undefined && { triggerType }),
      }),
    };


    const updated = await prisma.miniApp.update({
      where: { id: appId },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    logger.error(`[AppsController] updateApp error: ${error.message}`);
    res.status(500).json({ error: 'Gagal update app' });
  }
};

/**
 * DELETE /api/apps/:appId
 * Hanya DYNAMIC apps yang bisa dihapus
 */
export const deleteApp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appId } = req.params;

    const existing = await prisma.miniApp.findFirst({ where: { id: appId, userId } });
    if (!existing) return res.status(404).json({ error: 'App tidak ditemukan' });
    if (existing.handlerType !== 'DYNAMIC') {
      return res.status(403).json({ error: 'App bawaan tidak bisa dihapus' });
    }

    await prisma.miniApp.delete({ where: { id: appId } });
    res.json({ success: true });
  } catch (error) {
    logger.error(`[AppsController] deleteApp error: ${error.message}`);
    res.status(500).json({ error: 'Gagal menghapus app' });
  }
};

/**
 * POST /api/apps/:appId/analyze
 * Menganalisis file audio dengan AI (Whisper / Gemini) menggunakan prompt dari MiniApp
 */
export const analyzeAudio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appId } = req.params;
    const { filename, customPrompt, customReference } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename wajib dikirim' });
    }

    // 1. Ambil user AI Config
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiApiKey: true, aiProvider: true, aiModel: true }
    });

    if (!user || !user.aiApiKey) {
      return res.status(400).json({ error: 'AI API Key belum dikonfigurasi di Profil.' });
    }

    // 2. Ambil MiniApp Config jika appId bukan 'default'
    let systemPrompt = customPrompt || 'Analisis dan buat ringkasan / summary detail dari audio yang dilampirkan.';
    let referenceText = customReference || '';

    if (appId && appId !== 'default') {
      const app = await prisma.miniApp.findFirst({ where: { id: appId, userId } });
      if (app) {
        if (!customPrompt) {
          systemPrompt = app.systemPrompt || systemPrompt;
        }
        if (!customReference) {
          referenceText = app.referenceText || referenceText;
        }
      }
    }

    // 3. Bangun path file
    const filePath = path.join('uploads', String(userId), filename);

    // 4. Jalankan AI Analysis
    const { analyzeAudioFile } = await import('../services/aiService.js');
    const result = await analyzeAudioFile(filePath, user, systemPrompt, referenceText);

    res.json({ result });
  } catch (error) {
    logger.error(`[AppsController] analyzeAudio error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Gagal menganalisis audio' });
  }
};
