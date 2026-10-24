import { makeWASocket, Browsers, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

let sock: any = null;
let currentQr: string | null = null;
let status: 'idle' | 'generating' | 'ready' | 'connected' = 'idle';
let isConnecting = false;
let reconnectTimeout: any = null;

export const getWhatsAppStatus = () => {
  return { status, qr: currentQr };
};

export const startWhatsAppClient = async () => {
  if (status === 'connected' || isConnecting) {
    return sock;
  }

  isConnecting = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  status = 'generating';
  currentQr = null;

  const authFolder = path.join(process.cwd(), 'wa_auth_info');
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Create a silent logger so Baileys logs don't pollute or trigger socket errors
    const logger = pino({ level: 'silent' });

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      browser: Browsers.macOS('Desktop'),
      logger,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 250
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        status = 'ready';
        try {
          currentQr = await QRCode.toDataURL(qr);
        } catch (e) {
          console.error('QR Generate Error', e);
        }
      }

      if (connection === 'close') {
        isConnecting = false;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        status = 'idle';
        currentQr = null;

        if (shouldReconnect) {
          console.log(`[WhatsApp] Connection closed (${statusCode || 'unknown'}). Reconnecting in 3 seconds...`);
          if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              startWhatsAppClient().catch(err => {
                console.error('[WhatsApp] Reconnect failed:', err);
              });
            }, 3000);
          }
        } else {
          console.log('[WhatsApp] Logged out. Cleaning auth directory...');
          sock = null;
          if (fs.existsSync(authFolder)) {
            try {
              fs.rmSync(authFolder, { recursive: true, force: true });
            } catch (err) {
              console.error('[WhatsApp] Failed to delete auth folder:', err);
            }
          }
        }
      } else if (connection === 'open') {
        isConnecting = false;
        status = 'connected';
        currentQr = null;
        console.log('✅ WhatsApp Web connected and synchronized successfully!');
      }
    });

    return sock;
  } catch (error) {
    isConnecting = false;
    status = 'idle';
    console.error('[WhatsApp] Failed to initialize socket client:', error);
    throw error;
  }
};

export const sendWhatsAppMessage = async (phone: string, text: string) => {
  if (!sock || status !== 'connected') {
    throw new Error('واتساب غير متصل حالياً، يرجى إجراء المزامنة أولاً');
  }
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone.includes('@s.whatsapp.net')) {
    cleanPhone = `${cleanPhone}@s.whatsapp.net`;
  }
  await sock.sendMessage(cleanPhone, { text });
};

export const logoutWhatsApp = async () => {
  isConnecting = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error('[WhatsApp] Error during logout:', e);
    }
  }
  sock = null;
  status = 'idle';
  currentQr = null;
  const authFolder = path.join(process.cwd(), 'wa_auth_info');
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (err) {}
  }
};

