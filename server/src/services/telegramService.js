import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import * as ruleEngine from './ruleEngine.js';
import * as messageAdapter from './messageAdapter.js';

// Dictionary to keep track of active bot instances
const bots = {};

export const getBots = () => bots;

/**
 * Handle incoming Telegram messages
 */
const handleIncomingMessage = async (botInstance, botConfig, msg) => {
    try {
        if (!msg.text) return; // Only process text messages for now

        const jid = msg.chat.id.toString();
        const participant = msg.from.username
            ? `@${msg.from.username}`
            : `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();

        // Use the bot's token as the "sessionId" to differentiate contexts
        const sessionId = `telegram_${botConfig.id}`;

        const normalizedMsg = messageAdapter.normalizeMessage(
            'telegram',
            sessionId,
            participant,
            jid,
            msg.text,
            msg,
            botInstance
        );

        // Pass bot username for trigger matching
        normalizedMsg.botUsername = botInstance.botInfo?.username;

        logger.info(`Received Telegram message from ${participant} in ${jid}: ${msg.text}`);

        // Pass to the rule engine
        await ruleEngine.processMessage(normalizedMsg);

    } catch (error) {
        logger.error(`Error handling Telegram message: ${error.message}`);
    }
};

/**
 * Initialize a single bot and set up listeners
 */
export const startBot = (botConfig) => {
    try {
        if (bots[botConfig.id]) {
            logger.warn(`Telegram bot ${botConfig.name} (${botConfig.id}) is already running.`);
            return;
        }

        const bot = new TelegramBot(botConfig.token, { polling: true });

        // Fetch bot info to get username for precise mention detection in groups
        bot.getMe().then((me) => {
            bot.botInfo = me;
            logger.info(`Telegram bot ${botConfig.name} authenticated as @${me.username}`);
        }).catch(err => {
            logger.error(`Failed to get Telegram bot info for ${botConfig.name}: ${err.message}`);
        });

        bot.on('message', (msg) => {
            handleIncomingMessage(bot, botConfig, msg);
        });

        bot.on('polling_error', (error) => {
            logger.error(`Telegram Polling Error (${botConfig.name}): ${error.message}`);
        });

        bots[botConfig.id] = bot;
        logger.info(`Started Telegram bot: ${botConfig.name}`);

    } catch (error) {
        logger.error(`Failed to start Telegram bot ${botConfig.name}: ${error.message}`);
    }
};

/**
 * Stop a running bot instance
 */
export const stopBot = (botId) => {
    const bot = bots[botId];
    if (bot) {
        bot.stopPolling();
        delete bots[botId];
        logger.info(`Stopped Telegram bot with ID: ${botId}`);
    } else {
        logger.warn(`Attempted to stop non-existent Telegram bot with ID: ${botId}`);
    }
};

/**
 * Restart a bot (e.g., if config changes)
 */
export const restartBot = (botConfig) => {
    stopBot(botConfig.id);
    if (botConfig.isActive) {
        startBot(botConfig);
    }
};

/**
 * Initialize all active bots from the database on server startup
 */
export const initializeBots = async () => {
    try {
        const activeBots = await prisma.telegramBot.findMany({
            where: { isActive: true }
        });

        logger.info(`Found ${activeBots.length} active Telegram bots. Starting...`);

        for (const botConfig of activeBots) {
            startBot(botConfig);
        }
    } catch (error) {
        logger.error(`Error initializing Telegram bots: ${error.message}`);
    }
};

/**
 * Shut down all active bot instances
 */
export const stopAllBots = () => {
    logger.info("Stopping all Telegram bot instances...");
    for (const botId in bots) {
        try {
            bots[botId].stopPolling();
            logger.info(`Stopped bot ID: ${botId}`);
        } catch (e) {
            logger.error(`Error stopping bot ${botId}: ${e.message}`);
        }
    }
    // Clear bots object
    for (const key in bots) delete bots[key];
};
