import express from 'express';
import { prisma } from '../prisma.js';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import * as creditService from '../services/creditService.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', async (req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true, phone: true, role: true, credits: true, isActive: true, planType: true, messageCost: true, planExpiresAt: true, aiApiKey: true, aiProvider: true, aiModel: true, aiBriefing: true, isAiEnabled: true, createdAt: true }
    });
    res.json(users);
});

router.post('/', async (req, res) => {
    const { username, password, role, email, phone } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, password: hashedPassword, role: role || 'USER', email, phone }
        });
        res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
        res.status(400).json({ error: 'Failed to create user' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role, username } = req.body;
    try {
        const data = {};
        if (password) data.password = await bcrypt.hash(password, 10);
        if (role) data.role = role;
        if (username) data.username = username;
        if (req.body.email !== undefined) data.email = req.body.email;
        if (req.body.phone !== undefined) data.phone = req.body.phone;
        if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
        if (req.body.planType) data.planType = req.body.planType;
        if (req.body.messageCost !== undefined) data.messageCost = parseInt(req.body.messageCost);
        if (req.body.planExpiresAt !== undefined) data.planExpiresAt = req.body.planExpiresAt ? new Date(req.body.planExpiresAt) : null;
        if (req.body.aiApiKey !== undefined) data.aiApiKey = req.body.aiApiKey;
        if (req.body.aiProvider !== undefined) data.aiProvider = req.body.aiProvider;
        if (req.body.aiModel !== undefined) data.aiModel = req.body.aiModel;
        if (req.body.aiBriefing !== undefined) data.aiBriefing = req.body.aiBriefing;
        if (req.body.isAiEnabled !== undefined) data.isAiEnabled = req.body.isAiEnabled;

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data
        });
        res.json({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const userId = parseInt(id);

        // Delete related records transactionally
        await prisma.$transaction([
            prisma.session.deleteMany({ where: { userId } }),
            prisma.rule.deleteMany({ where: { userId } }),
            prisma.schedule.deleteMany({ where: { userId } }),
            prisma.contact.deleteMany({ where: { userId } }),
            prisma.user.delete({ where: { id: userId } })
        ]);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

router.put('/:id/credits', async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    try {
        const user = await creditService.addCredits(parseInt(id), parseInt(amount));
        res.json({ id: user.id, username: user.username, credits: user.credits });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update credits' });
    }
});

export default router;
