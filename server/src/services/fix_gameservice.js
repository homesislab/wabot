const fs = require('fs');
const filepath = '/home/gie/workspace/wabot/server/src/services/gameService.js';
let code = fs.readFileSync(filepath, 'utf8');

const helperText = `
const formatPlayerName = (p) => {
    if (!p) return 'Unknown';
    if (p.includes('@s.whatsapp.net') || p.includes('@g.us')) {
        return p.split('@')[0];
    }
    if (p.startsWith('@')) return p.substring(1);
    return p;
};
`;

if (!code.includes('const formatPlayerName =')) {
    code = code.replace("import * as messageAdapter from './messageAdapter.js';", "import * as messageAdapter from './messageAdapter.js';\n" + helperText);
}

code = code.replace(/\b([a-zA-Z0-9_]+)\.split\('@'\)\[0\]/g, "formatPlayerName($1)");

fs.writeFileSync(filepath, code);
console.log('Fixed gameService.js');
