import fs from 'fs';

let content = fs.readFileSync('modules/hr/hr_api.routes.ts', 'utf-8');

const importStatement = `
import { startWhatsAppClient, getWhatsAppStatus, sendWhatsAppMessage, logoutWhatsApp } from './whatsapp_client.js';
`;

// add imports after last import
content = content.replace(/import .*?;\n/g, (match) => {
    return match;
}); // just a trick, better to put it at the top
content = importStatement + "\n" + content;

const apiEndpoints = `
// GET /api/hr/whatsapp/client/status
router.get("/api/hr/whatsapp/client/status", async (req: any, res: any) => {
  res.json(getWhatsAppStatus());
});

// POST /api/hr/whatsapp/client/start
router.post("/api/hr/whatsapp/client/start", async (req: any, res: any) => {
  startWhatsAppClient();
  res.json({ success: true, message: "Client started" });
});

// POST /api/hr/whatsapp/client/logout
router.post("/api/hr/whatsapp/client/logout", async (req: any, res: any) => {
  await logoutWhatsApp();
  res.json({ success: true, message: "Client logged out" });
});
`;

content = content.replace('// GET /api/hr/whatsapp/logs', apiEndpoints + '\n// GET /api/hr/whatsapp/logs');

fs.writeFileSync('modules/hr/hr_api.routes.ts', content);
console.log('Routes updated');
