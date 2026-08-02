import express from 'express';
import * as messageController from '../controllers/messageController.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     summary: Send a WhatsApp message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - to
 *               - type
 *             properties:
 *               sessionId:
 *                 type: string
 *               to:
 *                 type: string
 *                 description: Phone number or JID
 *               type:
 *                 type: string
 *                 enum: [TEXT, IMAGE, LOCATION]
 *               content:
 *                 type: string
 *                 description: Message text (required for TEXT; optional caption for IMAGE)
 *               mediaUrl:
 *                 type: string
 *                 description: Media URL (required for IMAGE)
 *               latitude:
 *                 type: number
 *                 description: Latitude in decimal degrees (required for LOCATION)
 *               longitude:
 *                 type: number
 *                 description: Longitude in decimal degrees (required for LOCATION)
 *               locationName:
 *                 type: string
 *                 description: Optional location label shown in WhatsApp (LOCATION only)
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid or missing fields for the given type
 *       403:
 *         description: Unauthorized session access
 *       404:
 *         description: Session not connected
 */
router.post('/send', messageController.sendMessage);

/**
 * @swagger
 * /api/messages/broadcast:
 *   post:
 *     summary: Broadcast a message to contacts with a specific tag
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - tag
 *               - type
 *               - content
 *             properties:
 *               sessionId:
 *                 type: string
 *               tag:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [TEXT, IMAGE]
 *               content:
 *                 type: string
 *               mediaUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Broadcast started
 *       404:
 *         description: No contacts found
 */
router.post('/broadcast', messageController.broadcastMessage);

/**
 * @swagger
 * /api/messages/broadcasts:
 *   get:
 *     summary: Get broadcast history
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of broadcasts
 */
router.get('/broadcasts', messageController.getBroadcasts);

/**
 * @swagger
 * /api/messages/broadcast/:id/retry:
 *   post:
 *     summary: Retry failed messages in a broadcast
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Retry started
 *       404:
 *         description: Broadcast not found
 */
router.post('/broadcast/:id/retry', messageController.retryBroadcast);


export default router;
