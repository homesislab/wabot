import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import * as aiService from '../services/aiService.js';
import { getToolsForUser } from '../services/toolManager.js';

export const getGames = async (req, res) => {
    try {
        const games = await prisma.game.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(games);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
};

export const getGameById = async (req, res) => {
    try {
        const game = await prisma.game.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        if (!game || game.userId !== req.user.id) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json(game);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to fetch game' });
    }
};

export const createGame = async (req, res) => {
    const { name, trigger, type, config, reward, isActive } = req.body;
    try {
        const game = await prisma.game.create({
            data: {
                userId: req.user.id,
                name,
                trigger: trigger.trim().toLowerCase(),
                type,
                config: typeof config === 'string' ? config : JSON.stringify(config),
                reward: parseInt(reward) || 10,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        res.status(201).json(game);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Game trigger must be unique' });
        logger.error(error);
        res.status(500).json({ error: 'Failed to create game' });
    }
};

export const updateGame = async (req, res) => {
    const { name, trigger, type, config, reward, isActive } = req.body;
    try {
        const existing = await prisma.game.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const data = {
            name,
            trigger: trigger ? trigger.trim().toLowerCase() : undefined,
            type,
            reward: reward !== undefined ? parseInt(reward) : undefined,
            isActive: isActive !== undefined ? isActive : undefined
        };

        if (config) {
            data.config = typeof config === 'string' ? config : JSON.stringify(config);
        }

        const game = await prisma.game.update({
            where: { id: parseInt(req.params.id) },
            data
        });
        res.json(game);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Game trigger must be unique' });
        logger.error(error);
        res.status(500).json({ error: 'Failed to update game' });
    }
};

export const deleteGame = async (req, res) => {
    try {
        const existing = await prisma.game.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Clean up active games session that use this game
        await prisma.activeGame.deleteMany({ where: { gameId: parseInt(req.params.id) } });

        await prisma.game.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Game deleted successfully' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
};

// Generate Trivia via AI
export const generateTrivia = async (req, res) => {
    try {
        const { topic, numQuestions } = req.body;
        const count = parseInt(numQuestions) || 5;

        if (!topic) {
            return res.status(400).json({ error: 'Topik tidak boleh kosong' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { aiApiKey: true, aiProvider: true, aiModel: true }
        });

        if (!user || !user.aiApiKey) {
            return res.status(400).json({ error: 'API Key AI belum diatur di menu Settings.' });
        }

        const systemInstruction = `Anda adalah API generator soal kuis trivia Bahasa Indonesia.
Tugas Anda adalah membuat ${count} soal pilihan ganda tentang "${topic}".
Anda HANYA boleh merespons dengan array JSON murni, tanpa markdown \`\`\`json, tanpa teks pembuka/penutup.
Setiap objek soal harus memiliki format persis seperti ini:
{
  "question": "Pertanyaan...",
  "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
  "answer": "Opsi Benar (harus identik persis (copy-paste) dari salah satu string di options)"
}
Pastikan panjang kalimat pertanyaan dan opsi proporsional (tidak terlalu panjang untuk WhatsApp).
`;

        const prompt = `Buatkan ${count} soal trivia tentang ${topic} dalam format JSON array.`;

        // Dummy tools required by generateResponse signature
        const tools = await getToolsForUser(req.user.id);

        let aiText = await aiService.generateResponse({
            apiKey: user.aiApiKey,
            provider: user.aiProvider || 'openai',
            modelString: user.aiModel,
            tools: tools
        }, systemInstruction, prompt);

        if (!aiText) {
            return res.status(500).json({ error: 'AI gagal merespons. Coba lagi.' });
        }

        // Clean up markdown markers if AI ignores instructions
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();

        let questions;
        try {
            questions = JSON.parse(aiText);
            if (!Array.isArray(questions)) throw new Error("Respons bukan array");

            // Validate schema
            questions.forEach(q => {
                if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !q.answer) {
                    throw new Error("Format objek salah");
                }
            });
        } catch (jsonErr) {
            logger.error(`AI JSON parsing error: ${jsonErr.message}. Output was: ${aiText}`);
            return res.status(500).json({ error: 'Format JSON dari AI tidak valid. Coba ulangi kueri.' });
        }

        res.json(questions);

    } catch (error) {
        logger.error(`Error generating trivia: ${error.message}`);
        res.status(500).json({ error: 'Gagal membuat trivia via AI' });
    }
};
