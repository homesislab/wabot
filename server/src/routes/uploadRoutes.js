import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../config/logger.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user ? req.user.id : 'public';
        const uploadDir = path.join('uploads', String(userId));

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for audio/images
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp|mp3|wav|ogg|m4a|aac|flac|mpeg|webm|3gp|m4a|bin|octet-stream/;
        const mimetype = /image|audio|video|octet-stream/.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload only supports images and audio files."));
    }
});

router.post('/', upload.any(), (req, res) => {
    try {
        const file = req.files && req.files[0];
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Construct public URL
        const protocol = req.protocol;
        const host = req.get('host');
        const userId = req.user ? req.user.id : 'public';
        const url = `${protocol}://${host}/uploads/${userId}/${file.filename}`;

        res.json({ url, filename: file.filename, originalName: file.originalname, size: file.size });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

router.get('/', (req, res) => {
    const userId = req.user ? req.user.id : 'public';
    const uploadDir = path.join('uploads', String(userId));

    if (!fs.existsSync(uploadDir)) {
        return res.json([]); // Return empty if user folder doesn't exist
    }

    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            logger.error(err);
            return res.status(500).json({ error: 'Unable to scan directory' });
        }

        const fileInfos = files
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map(file => {
                return {
                    name: file,
                    url: `${req.protocol}://${req.get('host')}/uploads/${userId}/${file}`
                };
            });

        // rudimentary sort by name (timestamp prefix helps) descending
        fileInfos.sort((a, b) => b.name.localeCompare(a.name));

        res.json(fileInfos);
    });
});

router.delete('/:filename', (req, res) => {
    const userId = req.user ? req.user.id : 'public';
    const filename = req.params.filename;
    const filepath = path.join('uploads', String(userId), filename);

    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    fs.unlink(filepath, (err) => {
        if (err) {
            logger.error(err);
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ success: true, message: 'File deleted' });
    });
});

export default router;
