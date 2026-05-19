/**
 * App Registry — Full DB-driven
 * Semua Mini Apps (static & custom) disimpan di DB tabel MiniApp
 * Static apps punya handlerType yang map ke filesystem handler
 * Custom apps (DYNAMIC) menggunakan DynamicHandler universal
 */

import { logger } from '../config/logger.js';
import { prisma } from '../prisma.js';
import { handler as dynamicHandler } from './dynamicHandler.js';
import { handler as tajwidHandler } from './tajwidChecker/handler.js';
import { handler as zakatHandler } from './zakatCalculator/handler.js';
import { handler as styleHandler } from './styleAnalyzer/handler.js';

/** Map handlerType → actual handler function */
const HANDLER_MAP = {
  TAJWID_CHECKER:   tajwidHandler,
  ZAKAT_CALCULATOR: zakatHandler,
  STYLE_ANALYZER:   styleHandler,
  DYNAMIC:          dynamicHandler,
};

/**
 * Konversi DB MiniApp record ke format manifest yang dipakai AppRouter/AppExecutor
 */
export const dbAppToManifest = (dbApp) => {
  let keywords = [];
  try { keywords = JSON.parse(dbApp.triggerKeywords); } catch {}

  let actualHandlerType = dbApp.handlerType;
  if (dbApp.triggerType === 'KEYWORD_THEN_IMAGE') {
    actualHandlerType = 'STYLE_ANALYZER';
  }

  const handler = HANDLER_MAP[actualHandlerType] || dynamicHandler;

  return {
    id: dbApp.id,
    name: dbApp.name,
    description: dbApp.description || '',
    icon: dbApp.icon || '🤖',
    category: dbApp.category || 'General',
    color: dbApp.color || '#6366f1',
    version: dbApp.version || '1.0.0',
    author: dbApp.author || 'Custom',
    isDbApp: true,
    dbId: dbApp.id,
    handlerType: dbApp.handlerType,
    trigger: {
      type: dbApp.triggerType === 'VOICE_APP'
        ? 'VOICE_NOTE'
        : dbApp.triggerType === 'KEYWORD_THEN_VOICE'
          ? 'KEYWORD_THEN_VOICE'
          : dbApp.triggerType === 'KEYWORD_THEN_IMAGE'
            ? 'KEYWORD_THEN_IMAGE'
            : 'KEYWORD',
      value: keywords.length === 1 ? keywords[0] : keywords,
    },
    requiresApiKey: dbApp.requiresApiKey ?? true,
    showProcessing: dbApp.showProcessing ?? true,
    activationMessage: dbApp.activationMsg || null,
    systemPrompt: dbApp.systemPrompt || null,
    // Wrap handler: inject appConfig ke context untuk DynamicHandler
    handler: (normalizedMsg, context) =>
      handler(normalizedMsg, { ...context, appConfig: dbApp }),
  };
};

/**
 * Ambil semua apps aktif milik user dari DB sebagai manifest
 */
export const getRegistryForUser = async (userId) => {
  if (!userId) return [];
  try {
    const dbApps = await prisma.miniApp.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' }
    });
    return dbApps.map(dbAppToManifest);
  } catch (err) {
    logger.error(`[AppRegistry] getRegistryForUser error: ${err.message}`);
    return [];
  }
};

/**
 * Catalog untuk UI: semua apps user (aktif maupun tidak)
 */
export const getCatalogForUser = async (userId) => {
  try {
    return await prisma.miniApp.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
  } catch (err) {
    logger.error(`[AppRegistry] getCatalogForUser error: ${err.message}`);
    return [];
  }
};

/** Backward compat */
export const getCatalog = () => [];
export const getRegistry = () => [];
