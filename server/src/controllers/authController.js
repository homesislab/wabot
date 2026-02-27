import { prisma } from '../prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import { getSession } from '../services/sessionManager.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangedinprod';

export const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            role: user.role,
            username: user.username,
            credits: user.credits,
            planType: user.planType
        });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
};

export const register = async (req, res) => {
    const { username, password, role, email, phone, planType } = req.body;

    try {
        const userCount = await prisma.user.count();
        let userRole = 'USER';
        let isActive = false;

        if (userCount === 0) {
            userRole = 'ADMIN';
            isActive = true; // First user is always active admin
            planType = 'UNLIMITED'; // Admin gets unlimited plan
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: userRole,
                isActive,
                email,
                phone,
                planType: planType || 'PAY_AS_YOU_GO'
            }
        });

        // Notify Admin
        try {
            const adminPhone = process.env.ADMIN_PHONE;
            if (adminPhone) {
                // Find an active admin session to send from
                const adminSession = await prisma.session.findFirst({
                    where: {
                        user: { role: 'ADMIN' },
                        status: 'CONNECTED'
                    }
                });

                if (adminSession) {
                    const sock = getSession(adminSession.id);
                    if (sock) {
                        const message = `*New User Registered!*\n\nUsername: ${username}\nEmail: ${email}\nPhone: ${phone}\nPlan: ${planType || 'PAY_AS_YOU_GO'}\n\nPlease check the dashboard to activate this user.`;
                        const jid = adminPhone.includes('@') ? adminPhone : `${adminPhone}@s.whatsapp.net`;
                        await sock.sendMessage(jid, { text: message });
                    }
                }
            }
        } catch (notifyErr) {
            logger.error(`Failed to notify admin: ${notifyErr.message}`);
            // Continue even if notification fails
        }

        res.status(201).json({ message: 'User created', userId: user.id });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        logger.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, username: true, role: true, credits: true, isActive: true, planType: true, messageCost: true, planExpiresAt: true, aiApiKey: true, aiProvider: true, aiModel: true, aiBriefing: true, isAiEnabled: true, email: true, phone: true }
        });
        if (!user) return res.sendStatus(404);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

export const updateProfile = async (req, res) => {
    const { email, phone, aiProvider, aiModel, aiApiKey, isAiEnabled } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                email,
                phone,
                aiProvider,
                aiModel,
                aiApiKey,
                isAiEnabled
            }
        });
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            aiProvider: user.aiProvider,
            aiModel: user.aiModel,
            aiApiKey: user.aiApiKey,
            isAiEnabled: user.isAiEnabled
        });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to update password' });
    }
};
