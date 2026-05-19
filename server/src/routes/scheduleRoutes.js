import express from 'express';
import * as schedulerController from '../controllers/schedulerController.js';

const router = express.Router();

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: Get all schedules
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of schedules
 *   post:
 *     summary: Create a schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - cronExpression
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               cronExpression:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [TEXT, IMAGE]
 *               target:
 *                 type: string
 *                 enum: [GROUPS, CONTACTS, ALL]
 *     responses:
 *       201:
 *         description: Schedule created
 */
router.get('/', schedulerController.getSchedules);
router.post('/', schedulerController.createSchedule);

/**
 * @swagger
 * /api/schedules/{id}:
 *   put:
 *     summary: Update a schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Schedule updated
 *   delete:
 *     summary: Delete a schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule deleted
 */
router.put('/:id', schedulerController.updateSchedule);
router.delete('/:id', schedulerController.deleteSchedule);

/**
 * @swagger
 * /api/schedules/{id}/logs:
 *   get:
 *     summary: Get logs for a specific schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of schedule logs
 */
router.get('/:id/logs', schedulerController.getScheduleLogs);

export default router;
