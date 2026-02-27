import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import * as botController from '../controllers/telegramBotController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', botController.getBots);
router.get('/:id', botController.getBotById);
router.post('/', botController.createBot);
router.put('/:id', botController.updateBot);
router.delete('/:id', botController.deleteBot);

export default router;
