import app from './src/app.js';
import { logger } from './src/config/logger.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 3002;
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for now, restrict for prod
        methods: ["GET", "POST"]
    }
});

// Socket.io connection handler
io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
    });
});

// Store io instance in app or global for access in services
// Better: Dependency Injection or a singleton service.
// For now, let's export it or attach to global.
global.io = io;

import { initScheduler, initAutoRetryJob } from './src/services/schedulerService.js';
import { initSessions } from './src/services/sessionManager.js';
import { initializeBots } from './src/services/telegramService.js';
import { initGameAutoAdvance } from './src/services/gameService.js';

httpServer.listen(port, async () => {
    logger.info(`Server running on port ${port}`);
    await initSessions();
    await initScheduler();
    initAutoRetryJob();
    await initializeBots();
    initGameAutoAdvance();
});

// Clean shutdown signal handling
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    try {
        const { stopAllBots } = await import('./src/services/telegramService.js');
        stopAllBots();
        logger.info("Cleanup complete. Exiting.");
        process.exit(0);
    } catch (e) {
        logger.error(`Error during shutdown: ${e.message}`);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
