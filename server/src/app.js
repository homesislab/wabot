import express from 'express';
import cors from 'cors';
import { logger } from './config/logger.js';
import { register } from './config/metrics.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { swaggerDocs } from './config/swagger.js';

const app = express();


app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.send('OK');
});

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

import sessionRoutes from './routes/sessionRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import logRoutes from './routes/logRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import credentialRoutes from './routes/credentialRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import telegramBotRoutes from './routes/telegramBotRoutes.js';
import appsRoutes from './routes/appsRoutes.js';
import aiModelsRoutes from './routes/aiModelsRoutes.js';

app.use('/api/auth', authRoutes);

// Protected Routes
app.use('/api/sessions', authenticateToken, sessionRoutes);
app.use('/api/rules', authenticateToken, ruleRoutes);
app.use('/api/schedules', authenticateToken, scheduleRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/contacts', authenticateToken, contactRoutes);
app.use('/api/users', userRoutes); // userRoutes already has auth middleware inside
app.use('/api/logs', authenticateToken, logRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/credentials', authenticateToken, credentialRoutes);
app.use('/api/games', authenticateToken, gameRoutes);
app.use('/api/notes', authenticateToken, noteRoutes);
app.use('/api/telegram-bots', authenticateToken, telegramBotRoutes);
app.use('/api/apps', authenticateToken, appsRoutes);
app.use('/api/aimodels', authenticateToken, aiModelsRoutes);


import uploadRoutes from './routes/uploadRoutes.js';
app.use('/api/upload', authenticateToken, uploadRoutes);

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Serve uploads folder. Note: app.js is in src/, so we go up one level to root
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize Swagger
swaggerDocs(app, process.env.PORT || 3002);

export default app;
