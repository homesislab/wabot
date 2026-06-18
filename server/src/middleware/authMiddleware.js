import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangedinprod';

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }

        try {
            // Always resolve identity, role and active status from the DB rather
            // than trusting the (up to 24h stale) JWT payload. This ensures role
            // changes and deactivations take effect immediately, not after expiry.
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            if (!dbUser) {
                return res.sendStatus(401);
            }
            if (dbUser.isActive === false) {
                return res.status(403).json({ error: 'Account is deactivated' });
            }

            req.user = {
                id: dbUser.id,
                username: dbUser.username,
                role: dbUser.role,
                planType: dbUser.planType,
            };
            next();
        } catch (e) {
            logger.error(`Auth verification error: ${e.message}`);
            res.sendStatus(500);
        }
    });
};

export const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};
