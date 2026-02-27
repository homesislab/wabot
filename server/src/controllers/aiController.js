import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
console.log("AI Controller Loaded V2");
import * as aiService from '../services/aiService.js';
import { getToolsForUser } from '../services/toolManager.js';

export const getTools = async (req, res) => {
    try {
        const tools = await prisma.aiTool.findMany({
            where: { userId: req.user.id }
        });
        res.json(tools);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to fetch tools' });
    }
};

export const createTool = async (req, res) => {
    try {
        const { name, description, method, baseUrl, endpoint, parameters, headers, body, authType, authKey, authToken, authLocation, authRefreshUrl, authRefreshPayload, authTokenPath } = req.body;

        const prismaData = {
            user: { connect: { id: req.user.id } },
            name,
            description,
            method,
            baseUrl,
            endpoint,
            parameters: JSON.stringify(parameters || {}),
            headers: JSON.stringify(headers || {}),
            body: JSON.stringify(body || {}),
            authType,
            authRefreshUrl,
            authRefreshPayload: authRefreshPayload ? JSON.stringify(authRefreshPayload) : null,
            authTokenPath
        };


        const tool = await prisma.aiTool.create({
            data: prismaData
        });
        res.status(201).json(tool);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to create tool' });
    }
};

export const updateTool = async (req, res) => {
    const { id } = req.params;
    try {
        const tool = await prisma.aiTool.findUnique({ where: { id: parseInt(id) } });
        if (!tool || tool.userId !== req.user.id) {
            return res.status(404).json({ error: 'Tool not found' });
        }


        const {
            name, description, method, baseUrl, endpoint, parameters, headers, body,
            authType, authRefreshUrl, authRefreshPayload, authTokenPath, credentialId
        } = req.body;

        const data = {
            name,
            description,
            method,
            baseUrl,
            endpoint,
            authType,
            authRefreshUrl,
            authRefreshPayload: authRefreshPayload ? JSON.stringify(authRefreshPayload) : null,
            authTokenPath,
            credentialId: credentialId ? parseInt(credentialId) : undefined
        };

        // Stringify JSON fields if present
        if (data.parameters) data.parameters = JSON.stringify(data.parameters);
        if (data.headers) data.headers = JSON.stringify(data.headers);
        if (data.body) data.body = JSON.stringify(data.body);

        console.log("DEBUG: updateTool payload:", JSON.stringify(data, null, 2));

        const updated = await prisma.aiTool.update({
            where: { id: parseInt(id) },
            data
        });
        res.json(updated);
    } catch (error) {
        logger.error(error);
        logger.error(res);
        res.status(500).json({ error: 'Failed to update tool' });
    }
};

export const deleteTool = async (req, res) => {
    const { id } = req.params;
    try {
        const tool = await prisma.aiTool.findUnique({ where: { id: parseInt(id) } });
        if (!tool || tool.userId !== req.user.id) {
            return res.status(404).json({ error: 'Tool not found' });
        }

        await prisma.aiTool.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Tool deleted' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to delete tool' });
    }
};

export const testChat = async (req, res) => {
    try {
        const { message, systemInstruction } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        if (!user.aiApiKey) {
            return res.status(400).json({ error: 'AI API Key not configured' });
        }

        const tools = await getToolsForUser(req.user.id);

        const response = await aiService.generateResponse({
            apiKey: user.aiApiKey,
            provider: user.aiProvider || 'openai',
            modelString: user.aiModel,
            tools
        }, systemInstruction || "You are a helpful assistant.", message);

        res.json({ response });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Chat failed' });
    }
};
