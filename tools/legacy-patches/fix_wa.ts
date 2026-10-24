import fs from 'fs';
let content = fs.readFileSync('modules/hr/whatsapp_client.ts', 'utf-8');
content = content.replace("import { makeWASocket, useMultiFileAuthState", "import { makeWASocket, Browsers, useMultiFileAuthState");
content = content.replace("syncFullHistory: false", "syncFullHistory: false, browser: Browsers.macOS('Desktop')");
fs.writeFileSync('modules/hr/whatsapp_client.ts', content);
