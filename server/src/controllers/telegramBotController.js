import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';

export const getBots = async (req, res) => {
    try {
        const bots = await prisma.telegramBot.findMany({
            where: { userId: req.user.id }
        });
        res.json(bots);
    } catch (error) {
        logger.error(`Error fetching Telegram bots: ${error}`);
        res.status(500).json({ error: 'Failed to fetch Telegram bots' });
    }
};

export const getBotById = async (req, res) => {
    try {
        const bot = await prisma.telegramBot.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        if (!bot || bot.userId !== req.user.id) {
            return res.status(404).json({ error: 'Bot not found' });
        }
        res.json(bot);
    } catch (error) {
        logger.error(`Error fetching Telegram bot ${req.params.id}: ${error}`);
        res.status(500).json({ error: 'Failed to fetch bot details' });
    }
};

export const createBot = async (req, res) => {
    const { name, token, username, isActive } = req.body;
    try {
        const newBot = await prisma.telegramBot.create({
            data: {
                userId: req.user.id,
                name,
                token,
                username,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        res.status(201).json(newBot);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Bot Token already exists' });
        logger.error(`Error creating Telegram bot: ${error}`);
        res.status(500).json({ error: 'Failed to create bot' });
    }
};

export const updateBot = async (req, res) => {
    const { name, token, username, isActive } = req.body;
    try {
        const existing = await prisma.telegramBot.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = await prisma.telegramBot.update({
            where: { id: parseInt(req.params.id) },
            data: {
                name,
                token,
                username,
                isActive: isActive !== undefined ? isActive : undefined
            }
        });
        res.json(bot);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Bot Token already exists' });
        logger.error(`Error updating Telegram bot ${req.params.id}: ${error}`);
        res.status(500).json({ error: 'Failed to update bot' });
    }
};

export const deleteBot = async (req, res) => {
    try {
        const existing = await prisma.telegramBot.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        await prisma.telegramBot.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Bot deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting Telegram bot ${req.params.id}: ${error}`);
        res.status(500).json({ error: 'Failed to delete bot' });
    }
};
