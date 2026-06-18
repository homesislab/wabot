import express from 'express';
const router = express.Router();
import aiModelsController from '../controllers/aiModelsController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

// AiModel is a GLOBAL catalog shared by every user (no userId scoping), so reads
// are allowed for any authenticated user but mutations must be admin-only.
router.get('/', aiModelsController.getAllModels);
router.post('/', requireAdmin, aiModelsController.addModel);
router.put('/:id', requireAdmin, aiModelsController.updateModel);
router.delete('/:id', requireAdmin, aiModelsController.deleteModel);

export default router;
