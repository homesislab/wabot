import { prisma } from '../prisma.js';
import * as sessionManager from '../services/sessionManager.js';
import { logger } from '../config/logger.js';

export const getAllSessions = async (req, res) => {
    // 1. Fetch WhatsApp Sessions
    const sessions = await prisma.session.findMany({ where: { userId: req.user.id } });
    const sessionsWithQr = sessions.map(session => ({
        ...session,
        qr: sessionManager.getQR(session.id)
    }));

    // 2. Fetch Active Telegram Bots
    const telegramBots = await prisma.telegramBot.findMany({
        where: { userId: req.user.id, isActive: true }
    });

    // Map bots to match Session response format
    const botSessions = telegramBots.map(bot => ({
        id: `telegram_${bot.id}`,
        name: `${bot.name} (Telegram)`,
        status: 'CONNECTED', // Bots are always considered connected if active
        qr: null,
        userId: bot.userId,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt
    }));

    // Combine and send
    res.json([...sessionsWithQr, ...botSessions]);
};

export const createSession = async (req, res) => {
    const { id, name } = req.body;

    // Check if exists
    const existing = await prisma.session.findUnique({ where: { id } });
    if (existing) {
        return res.status(400).json({ error: 'Session ID already exists' });
    }

    try {
        await prisma.session.create({
            data: { id, name, status: 'DISCONNECTED', userId: req.user.id }
        });

        // Start logic
        await sessionManager.startSession(id);

        res.status(201).json({ message: 'Session created and starting' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to create session' });
    }
};

export const updateSession = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session || session.userId !== req.user.id) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const updated = await prisma.session.update({
            where: { id },
            data: { name }
        });
        res.json(updated);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to update session' });
    }
};

export const deleteSession = async (req, res) => {
    const { id } = req.params;
    try {
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session || session.userId !== req.user.id) {
            return res.status(404).json({ error: 'Session not found' });
        }

        await sessionManager.deleteSession(id);
        await prisma.session.delete({ where: { id } });
        res.json({ message: 'Session deleted' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
};

export const getGroups = async (req, res) => {
    const { id } = req.params;
    try {
        const groups = await sessionManager.getGroups(id);
        res.json(groups);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
};

export const getSession = async (req, res) => {
    const { id } = req.params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.userId !== req.user.id) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
};

export const reconnectSession = async (req, res) => {
    const { id } = req.params;
    try {
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session || session.userId !== req.user.id) {
            return res.status(404).json({ error: 'Session not found' });
        }

        await sessionManager.deleteSession(id); // Clears the dirty session state and folder
        await sessionManager.startSession(id);  // Re-initializes, which will emit new QR

        res.json({ message: 'Session reconnecting' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to reconnect session' });
    }
};
