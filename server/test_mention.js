import { processMessage } from './src/services/ruleEngine.js';

const mockClient = {
    user: { id: '628123456789:15@s.whatsapp.net', name: 'Wabot' },
    authState: { creds: { me: { id: '628123456789:15@s.whatsapp.net', lid: '123456@lid' } } }
};

const mockMessage = {
    platform: 'whatsapp',
    sessionId: 'test_session',
    participant: '628999999999@s.whatsapp.net',
    jid: '123456789-987654@g.us',
    text: '@628123456789 hello',
    client: mockClient,
    rawMessage: {
        key: { id: 'test_msg_id' },
        message: {
            extendedTextMessage: {
                text: '@628123456789 hello',
                contextInfo: {
                    mentionedJid: ['628123456789@s.whatsapp.net']
                }
            }
        }
    }
};

async function run() {
    console.log("Running mock processMessage...");
    await processMessage(mockMessage);
}

run().catch(console.error);
