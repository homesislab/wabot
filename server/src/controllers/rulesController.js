import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';

export const getRules = async (req, res) => {
    try {
        const rules = await prisma.rule.findMany({ where: { userId: req.user.id } });
        res.json(rules);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createRule = async (req, res) => {
    try {
        const {
            name, triggerType, triggerValue, actionType,
            apiUrl, apiMethod, apiPayload, responseContent,
            responseMediaType, responseMediaUrl, sessionId,
            filterGroupId, credentialId, miniAppId
        } = req.body;

        // triggerValue must never be null — auto-fill for types that don't use it
        const resolvedTriggerValue =
            (triggerType === 'ALL' || triggerType === 'MENTION')
                ? (triggerValue || triggerType)
                : triggerValue;

        const rule = await prisma.rule.create({
            data: {
                name,
                triggerType,
                triggerValue: resolvedTriggerValue,
                actionType,
                apiUrl: apiUrl || null,
                apiMethod: apiMethod || 'POST',
                apiPayload: apiPayload || '{}',
                responseContent: responseContent || null,
                responseMediaType: responseMediaType || 'TEXT',
                responseMediaUrl: responseMediaUrl || null,
                sessionId: sessionId || null,
                filterGroupId: filterGroupId || null,
                credentialId: credentialId ? parseInt(credentialId) : null,
                miniAppId: miniAppId || null,
                userId: req.user.id
            }
        });
        res.status(201).json(rule);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to create rule' });
    }
};

export const updateRule = async (req, res) => {
    const { id } = req.params;
    try {
        const rule = await prisma.rule.findUnique({ where: { id: parseInt(id) } });
        if (!rule || rule.userId !== req.user.id) return res.status(404).json({ error: 'Rule not found' });

        const allowedFields = [
            'name', 'triggerType', 'triggerValue', 'actionType',
            'apiUrl', 'apiMethod', 'apiPayload', 'responseContent',
            'responseMediaType', 'responseMediaUrl', 'sessionId',
            'filterGroupId', 'credentialId', 'miniAppId', 'isActive'
        ];
        
        const data = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'credentialId') {
                    data[field] = req.body[field] ? parseInt(req.body[field]) : null;
                } else if (field === 'isActive') {
                    data[field] = Boolean(req.body[field]);
                } else {
                    data[field] = req.body[field] === '' ? null : req.body[field];
                }
            }
        }

        // Ensure triggerValue is never null for ALL/MENTION types
        const effectiveTriggerType = data.triggerType || rule.triggerType;
        if ((effectiveTriggerType === 'ALL' || effectiveTriggerType === 'MENTION') &&
            (data.triggerValue === null || data.triggerValue === undefined)) {
            data.triggerValue = effectiveTriggerType;
        }

        const updatedRule = await prisma.rule.update({
            where: { id: parseInt(id) },
            data
        });
        res.json(updatedRule);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to update rule' });
    }
};

export const deleteRule = async (req, res) => {
    const { id } = req.params;
    try {
        const count = await prisma.rule.deleteMany({
            where: { id: parseInt(id), userId: req.user.id }
        });
        if (count.count === 0) return res.status(404).json({ error: 'Rule not found' });
        res.json({ message: 'Rule deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete rule' });
    }
};
