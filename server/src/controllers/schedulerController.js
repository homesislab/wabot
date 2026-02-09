import { prisma } from '../prisma.js';
import { scheduleJob, removeJob } from '../services/schedulerService.js';
import { logger } from '../config/logger.js';

export const getSchedules = async (req, res) => {
    const schedules = await prisma.schedule.findMany({ where: { userId: req.user.id } });
    res.json(schedules);
};

export const createSchedule = async (req, res) => {
    try {
        const data = { ...req.body, userId: req.user.id };
        if (data.credentialId === '') data.credentialId = null;
        if (data.credentialId) data.credentialId = parseInt(data.credentialId);

        const schedule = await prisma.schedule.create({
            data
        });
        scheduleJob(schedule);
        res.status(201).json(schedule);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
};

export const updateSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        const check = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
        if (!check || check.userId !== req.user.id) return res.status(404).json({ error: 'Schedule not found' });

        const data = { ...req.body };
        if (data.credentialId === '') data.credentialId = null;
        if (data.credentialId) data.credentialId = parseInt(data.credentialId);

        const schedule = await prisma.schedule.update({ where: { id: parseInt(id) }, data });
        scheduleJob(schedule); // Updates the job
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update schedule' });
    }
};

export const deleteSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        const check = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
        if (!check || check.userId !== req.user.id) return res.status(404).json({ error: 'Schedule not found' });

        removeJob(parseInt(id));
        await prisma.schedule.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Schedule deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
};
