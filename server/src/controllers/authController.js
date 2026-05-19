import { prisma } from '../prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import { getSession } from '../services/sessionManager.js';
import { OAuth2Client } from 'google-auth-library';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangedinprod';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        if (!user.password) {
            return res.status(400).json({ error: 'Akun ini terdaftar via Google. Gunakan "Login with Google".' });
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

/**
 * Google OAuth Login
 * Verify Google ID Token → find or create user → return JWT
 */
export const googleLogin = async (req, res) => {
    const { credential } = req.body; // Google ID token dari frontend

    if (!GOOGLE_CLIENT_ID || !googleClient) {
        return res.status(503).json({ error: 'Google login belum dikonfigurasi di server' });
    }

    try {
        // 1. Verifikasi token Google
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // 2. Cari user berdasarkan googleId atau email
        let user = await prisma.user.findFirst({
            where: { OR: [{ googleId }, { email }] }
        });

        if (!user) {
            // 3. Buat user baru (auto-register via Google)
            const username = (name || email.split('@')[0])
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .substring(0, 30);

            // Pastikan username unik
            const existing = await prisma.user.findUnique({ where: { username } });
            const finalUsername = existing ? `${username}_${Date.now().toString().slice(-4)}` : username;

            user = await prisma.user.create({
                data: {
                    username: finalUsername,
                    email,
                    googleId,
                    googleEmail: email,
                    googleAvatar: picture,
                    password: null,
                    isActive: false, // Perlu aktivasi admin
                    role: 'USER',
                    planType: 'PAY_AS_YOU_GO'
                }
            });

            // Notifikasi admin
            try {
                const adminPhone = process.env.ADMIN_PHONE;
                if (adminPhone) {
                    const adminSession = await prisma.session.findFirst({
                        where: { user: { role: 'ADMIN' }, status: 'CONNECTED' }
                    });
                    if (adminSession) {
                        const sock = getSession(adminSession.id);
                        if (sock) {
                            const jid = adminPhone.includes('@') ? adminPhone : `${adminPhone}@s.whatsapp.net`;
                            await sock.sendMessage(jid, {
                                text: `*New Google Login!*\n\nUsername: ${finalUsername}\nEmail: ${email}\nName: ${name}\n\nPlease activate this user from the dashboard.`
                            });
                        }
                    }
                }
            } catch (e) { /* ignore notify error */ }
        } else {
            // Update googleId & avatar jika belum ada
            if (!user.googleId) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId, googleEmail: email, googleAvatar: picture }
                });
            }
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Akun belum diaktifkan. Hubungi admin untuk aktivasi.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            role: user.role,
            username: user.username,
            credits: user.credits,
            planType: user.planType,
            googleAvatar: user.googleAvatar
        });
    } catch (error) {
        logger.error(`[GoogleLogin] ${error.message}`);
        res.status(401).json({ error: 'Token Google tidak valid atau kedaluwarsa' });
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
            select: { id: true, username: true, role: true, credits: true, isActive: true, planType: true, messageCost: true, planExpiresAt: true, aiApiKey: true, aiProvider: true, aiModel: true, aiBriefing: true, isAiEnabled: true, isImageEnabled: true, aiImageProvider: true, aiImageApiKey: true, email: true, phone: true, isSchedulerEnabled: true, isAutoRetryEnabled: true }
        });
        if (!user) return res.sendStatus(404);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

export const updateProfile = async (req, res) => {
    const { email, phone, aiProvider, aiModel, aiApiKey, isAiEnabled, isImageEnabled, aiImageProvider, aiImageApiKey, isSchedulerEnabled, isAutoRetryEnabled } = req.body;
    try {
        const dataToUpdate = {
            email, phone, aiProvider, aiModel, aiApiKey, aiImageProvider, aiImageApiKey
        };
        if (typeof isAiEnabled !== 'undefined') dataToUpdate.isAiEnabled = isAiEnabled;
        if (typeof isImageEnabled !== 'undefined') dataToUpdate.isImageEnabled = isImageEnabled;
        if (typeof isSchedulerEnabled !== 'undefined') dataToUpdate.isSchedulerEnabled = isSchedulerEnabled;
        if (typeof isAutoRetryEnabled !== 'undefined') dataToUpdate.isAutoRetryEnabled = isAutoRetryEnabled;

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: dataToUpdate
        });
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            aiProvider: user.aiProvider,
            aiModel: user.aiModel,
            aiApiKey: user.aiApiKey,
            isAiEnabled: user.isAiEnabled,
            isImageEnabled: user.isImageEnabled,
            aiImageProvider: user.aiImageProvider,
            isSchedulerEnabled: user.isSchedulerEnabled,
            isAutoRetryEnabled: user.isAutoRetryEnabled
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
