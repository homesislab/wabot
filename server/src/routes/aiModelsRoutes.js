import express from 'express';
const router = express.Router();
import aiModelsController from '../controllers/aiModelsController.js';

router.get('/', aiModelsController.getAllModels);
router.post('/', aiModelsController.addModel);
router.put('/:id', aiModelsController.updateModel);
router.delete('/:id', aiModelsController.deleteModel);

export default router;
