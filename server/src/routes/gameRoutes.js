import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import * as gameController from '../controllers/gameController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', gameController.getGames);
router.post('/generate-trivia', gameController.generateTrivia);
router.get('/:id', gameController.getGameById);
router.post('/', gameController.createGame);
router.put('/:id', gameController.updateGame);
router.delete('/:id', gameController.deleteGame);

export default router;
