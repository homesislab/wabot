import { jidNormalizedUser } from '@whiskeysockets/baileys';

const bareUser = (jid) => {
    if (!jid || typeof jid !== 'string') return null;
    return jid.split('@')[0].split(':')[0];
};

const isBotMentioned = (client, mentions) => {
    if (!Array.isArray(mentions) || mentions.length === 0) return false;
    const candidates = new Set();
    for (const raw of [client?.user?.id, client?.user?.lid]) {
        if (!raw) continue;
        let norm = raw;
        try { norm = jidNormalizedUser(raw); } catch { /* abaikan JID tak valid */ }
        candidates.add(norm);
        const bare = bareUser(norm);
        if (bare) candidates.add(bare);
    }
    console.log("Candidates:", candidates);
    if (candidates.size === 0) return false;
    return mentions.some((m) => {
        if (!m) return false;
        console.log("Checking mention:", m);
        if (candidates.has(m)) return true;
        const bare = bareUser(m);
        return bare ? candidates.has(bare) : false;
    });
};

const client = {
    user: {
        id: "628123456789:12@s.whatsapp.net"
    }
};

const mentions = ["628123456789@s.whatsapp.net"];

console.log("Is mentioned?", isBotMentioned(client, mentions));
