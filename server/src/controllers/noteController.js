import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';

export const getNotes = async (req, res) => {
    try {
        const notes = await prisma.note.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notes);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
};

export const createNote = async (req, res) => {
    const { keyword, content } = req.body;
    try {
        const note = await prisma.note.upsert({
            where: {
                userId_keyword: {
                    userId: req.user.id,
                    keyword: keyword.trim().toLowerCase()
                }
            },
            update: {
                content
            },
            create: {
                userId: req.user.id,
                keyword: keyword.trim().toLowerCase(),
                content
            }
        });
        res.status(201).json(note);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to create or update note' });
    }
};

export const deleteNote = async (req, res) => {
    try {
        const existing = await prisma.note.findUnique({
            where: {
                id: parseInt(req.params.id)
            }
        });

        if (!existing || existing.userId !== req.user.id) {
            return res.status(404).json({ error: 'Note not found' });
        }

        await prisma.note.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
};
