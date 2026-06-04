import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all AI models grouped by provider, or raw array
const getAllModels = async (req, res) => {
    try {
        const { group } = req.query;
        const models = await prisma.aiModel.findMany({
            where: { isActive: true },
            orderBy: [{ provider: 'asc' }, { id: 'asc' }]
        });

        if (group === 'true') {
            const grouped = models.reduce((acc, model) => {
                if (!acc[model.provider]) {
                    acc[model.provider] = [];
                }
                acc[model.provider].push({
                    value: model.value,
                    label: model.label
                });
                return acc;
            }, {});
            return res.json(grouped);
        }

        res.json(models);
    } catch (error) {
        console.error('Error fetching AI models:', error);
        res.status(500).json({ error: 'Failed to fetch AI models' });
    }
};

// Add a new AI model
const addModel = async (req, res) => {
    try {
        const { provider, value, label, isActive } = req.body;
        
        if (!provider || !value || !label) {
            return res.status(400).json({ error: 'Provider, value, and label are required' });
        }

        const newModel = await prisma.aiModel.create({
            data: {
                provider,
                value,
                label,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        res.status(201).json(newModel);
    } catch (error) {
        console.error('Error adding AI model:', error);
        res.status(500).json({ error: 'Failed to add AI model' });
    }
};

// Update an AI model
const updateModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { provider, value, label, isActive } = req.body;

        const updated = await prisma.aiModel.update({
            where: { id: parseInt(id) },
            data: {
                provider,
                value,
                label,
                isActive
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating AI model:', error);
        res.status(500).json({ error: 'Failed to update AI model' });
    }
};

// Delete an AI model
const deleteModel = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.aiModel.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting AI model:', error);
        res.status(500).json({ error: 'Failed to delete AI model' });
    }
};

export default {
    getAllModels,
    addModel,
    updateModel,
    deleteModel
};
