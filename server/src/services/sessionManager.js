import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, extractMessageContent } from '@whiskeysockets/baileys';
import { prisma } from '../prisma.js';
import { logger } from '../config/logger.js';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import * as ruleEngine from './ruleEngine.js';
import * as messageAdapter from './messageAdapter.js';
import * as aiService from './aiService.js';

const sessions = new Map();

const activeQRs = new Map();

export const startSession = async (sessionId) => {
    if (sessions.has(sessionId)) {
        return sessions.get(sessionId);
    }

    const sessionDir = path.join('sessions', sessionId);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WA version v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        version,
        printQRInTerminal: false,
        browser: ['Wabot', sessionId, '1.0.0'], // UNIQUE browser identity per session name
        syncFullHistory: false, // Must be false for WA Business to prevent 405 constraint
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000, // Slightly higher interval for better stability
        getMessage: async (key) => {
            return {
                conversation: 'Wabot System'
            };
        }
    });

    sessions.set(sessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.info(`Generating QR for session ${sessionId}`);
            // Generate QR code and emit
            const qrImage = await QRCode.toDataURL(qr);
            activeQRs.set(sessionId, qrImage);
            global.io.emit('session-qr', { sessionId, qr: qrImage });

            await prisma.session.update({
                where: { id: sessionId },
                data: { status: 'CONNECTING' }
            });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const isLoggedOut = Number(statusCode) === DisconnectReason.loggedOut;
            const isConflict = Number(statusCode) === 405; // 405 means Conflict/Stream Errored
            const isUnauthorized = Number(statusCode) === 401;

            // Do not auto-reconnect if logged out
            const shouldReconnect = !isLoggedOut;

            logger.error(`Session ${sessionId} closed. StatusCode: ${statusCode}, Error: ${lastDisconnect?.error?.message}. Reconnecting: ${shouldReconnect}`);

            // Always remove the closed session from memory
            sessions.delete(sessionId);
            activeQRs.delete(sessionId);

            if (isUnauthorized || isLoggedOut) {
                logger.warn(`Session ${sessionId} is corrupted or unauthorized (${statusCode}). Cleaning up session directory...`);
                try {
                    const sessionDir = path.join('sessions', sessionId);
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                    logger.info(`Cleanup for ${sessionId} complete.`);
                } catch (e) {
                    logger.error(`Cleanup for ${sessionId} failed:`, e);
                }
            }

            if (shouldReconnect) {
                setTimeout(() => {
                    logger.info(`Attempting to reconnect session ${sessionId}...`);
                    startSession(sessionId);
                }, 5000); // 5 sec delay
            } else {
                await prisma.session.update({
                    where: { id: sessionId },
                    data: { status: 'DISCONNECTED' }
                });
                global.io.emit('session-status', { sessionId, status: 'DISCONNECTED' });
            }
        } else if (connection === 'open') {
            logger.info(`Session ${sessionId} opened successfully`);
            activeQRs.delete(sessionId);
            await prisma.session.update({
                where: { id: sessionId },
                data: { status: 'CONNECTED' }
            });
            global.io.emit('session-status', { sessionId, status: 'CONNECTED' });
        }
    });



    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                try {
                    const isFromMe = msg.key.fromMe;

                    // Normalize message to handle ephemeral, view once, etc.
                    const actualMessage = extractMessageContent(msg.message) || msg.message;

                    // Deteksi voice note (Push-to-Talk) atau file audio
                    const isVoiceNote = actualMessage?.audioMessage?.ptt === true ||
                        !!(actualMessage?.audioMessage) ||
                        !!(actualMessage?.documentMessage && actualMessage?.documentMessage?.mimetype?.startsWith('audio/'));

                    const content = actualMessage?.conversation ||
                        actualMessage?.extendedTextMessage?.text ||
                        actualMessage?.imageMessage?.caption ||
                        "";

                    // Skip pesan kosong KECUALI audio
                    if (!content && !isVoiceNote) continue;

                    const remoteJid = msg.key.remoteJid;

                    await prisma.messageLog.create({
                        data: {
                            sessionId,
                            direction: isFromMe ? 'OUT' : 'IN',
                            from: isFromMe ? sessionId : remoteJid,
                            to: isFromMe ? remoteJid : sessionId,
                            content: isVoiceNote ? '[voice note]' : content,
                            status: isFromMe ? 'SENT' : 'RECEIVED'
                        }
                    });

                    // Handle incoming messages (rules + apps)
                    if (!isFromMe) {
                        const participant = msg.key.participant || msg.key.remoteJid;
                        const jid = msg.key.remoteJid;

                        const normalizedMsg = messageAdapter.normalizeMessage(
                            'whatsapp',
                            sessionId,
                            participant,
                            jid,
                            content, // kosong untuk voice note, App akan pakai rawMessage
                            msg,
                            sock
                        );
                        normalizedMsg.pushName = msg.pushName;

                        await ruleEngine.processMessage(normalizedMsg);
                    }

                    // Auto-Read Message
                    await sock.readMessages([msg.key]);

                } catch (err) {
                    logger.error(`Failed to log message: ${err.message}`);
                }
            }
        }
    });

    return sock;
};

export const getSession = (sessionId) => {
    return sessions.get(sessionId);
};

export const getQR = (sessionId) => {
    return activeQRs.get(sessionId);
};

export const deleteSession = async (sessionId) => {
    const sock = sessions.get(sessionId);
    if (sock) {
        sock.ev.removeAllListeners('connection.update');
        sock.end(undefined);
        sessions.delete(sessionId);
    }
    activeQRs.delete(sessionId);

    const sessionDir = path.join('sessions', sessionId);
    if (fs.existsSync(sessionDir)) {
        if (fs.statSync(sessionDir).isDirectory()) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        } else {
            fs.rmSync(sessionDir, { force: true });
        }
    }

    // Also clean up any flat files that Baileys might have created in the sessions directory
    const baseSessionsPath = 'sessions';
    if (fs.existsSync(baseSessionsPath)) {
        const files = fs.readdirSync(baseSessionsPath);
        for (const file of files) {
            if (file.startsWith(`session-${sessionId}`) || file.startsWith(`app-state-sync-version-${sessionId}`)) {
                fs.rmSync(path.join(baseSessionsPath, file), { force: true });
            }
        }
    }

    await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'DISCONNECTED' }
    });
};

export const getGroups = async (sessionId) => {
    const sock = sessions.get(sessionId);
    if (!sock) throw new Error('Session not found');

    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups);
};

export const initSessions = async () => {
    logger.info('Initializing sessions...');
    const sessions = await prisma.session.findMany();
    for (const session of sessions) {
        if (session.status !== 'DISCONNECTED') {
            logger.info(`Resuming session ${session.id}`);
            startSession(session.id);
        }
    }
};
