import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import * as appsController from '../controllers/appsController.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', appsController.getApps);
router.post('/', appsController.createApp);
router.put('/:appId/toggle', appsController.toggleApp);
router.put('/:appId', appsController.updateApp);
router.delete('/:appId', appsController.deleteApp);

export default router;
