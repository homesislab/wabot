import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import multer from 'multer';
import fs from 'fs';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get all contacts
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contacts
 *   post:
 *     summary: Create a contact
 *     tags: [Contacts]
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
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               tags:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contact created
 */
router.get('/', async (req, res) => {
    try {
        const contacts = await prisma.contact.findMany({
            where: { userId: req.user.id },
            orderBy: { name: 'asc' }
        });
        res.json(contacts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/contacts/export:
 *   get:
 *     summary: Export contacts as CSV
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/export', async (req, res) => {
    try {
        const contacts = await prisma.contact.findMany({
            where: { userId: req.user.id },
            orderBy: { name: 'asc' }
        });

        const csvHeader = 'name,phone,tags\n';
        const csvRows = contacts.map(c => `"${c.name}","${c.phone}","${c.tags || ''}"`).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
        res.send(csvHeader + csvRows);
    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Failed to export contacts' });
    }
});

/**
 * @swagger
 * /api/contacts/import:
 *   post:
 *     summary: Import contacts from CSV
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import completion status
 */
router.post('/import', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const content = fs.readFileSync(req.file.path, 'utf-8');
        const lines = content.split(/\r?\n/);

        let successCount = 0;
        let failCount = 0;

        // Skip header if exists
        const startIdx = lines[0].toLowerCase().includes('name') ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Simple CSV split handling quotes basic way
            // This assumes simple CSV without commas inside quotes for now, or basic "value","value","value"
            // For MVP simplicity: split by comma, remove quotes
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

            if (parts.length < 2) continue;

            const [name, phone, tags] = parts;
            if (!name || !phone) continue;

            try {
                await prisma.contact.upsert({
                    where: { userId_phone: { userId: req.user.id, phone } },
                    update: { name, tags: tags || null },
                    create: {
                        name,
                        phone,
                        tags: tags || null,
                        userId: req.user.id
                    }
                });
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        // Cleanup
        fs.unlinkSync(req.file.path);

        res.json({
            message: `Imported ${successCount} contacts`,
            failed: failCount
        });

    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Failed to import contacts' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, phone, tags } = req.body;
        const contact = await prisma.contact.create({
            data: { name, phone, tags, userId: req.user.id }
        });
        res.status(201).json(contact);
    } catch (e) {
        if (e.code === 'P2002') {
            return res.status(400).json({ error: 'Phone number already exists' });
        }
        logger.error(e);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

/**
 * @swagger
 * /api/contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               tags:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contact updated
 *   delete:
 *     summary: Delete a contact
 *     tags: [Contacts]
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
 *         description: Contact deleted
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, phone, tags } = req.body;
        const contact = await prisma.contact.update({
            where: { id: parseInt(req.params.id), userId: req.user.id },
            data: { name, phone, tags }
        });
        res.json(contact);
    } catch (e) {
        if (e.code === 'P2002') return res.status(400).json({ error: 'Phone number already exists' });
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const count = await prisma.contact.deleteMany({
            where: { id: parseInt(req.params.id), userId: req.user.id }
        });
        if (count.count === 0) return res.status(404).json({ error: 'Contact not found' });
        res.json({ message: 'Contact deleted' });
    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

export default router;
