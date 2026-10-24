import crypto from 'crypto';
import QRCode from 'qrcode';
import { pool } from '../../../server-db.js';

const securityKey = String(process.env.SECURITY_ENCRYPTION_KEY || "").trim();
if (securityKey.length < 32) {
  throw new Error("SECURITY_ENCRYPTION_KEY must be set to a value of at least 32 characters (used to encrypt 2FA secrets)");
}
const encKey = crypto.createHash('sha256').update(securityKey).digest();

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}
function decrypt(value: string): string {
  const [ivB64, tagB64, dataB64] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0, out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const out: number[] = [];
  for (const ch of input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')) { const idx = alphabet.indexOf(ch); if (idx < 0) throw new Error('Invalid base32'); value = (value << 5) | idx; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function generateTotp(secret: string, counter: number): string {
  const key = base32Decode(secret); const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest(); const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false; const counter = Math.floor(Date.now() / 1000 / 30);
  return Array.from({length: window * 2 + 1}, (_, i) => counter + i - window).some(c => crypto.timingSafeEqual(Buffer.from(generateTotp(secret, c)), Buffer.from(code)));
}

export async function ensureSecurityTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS security_sessions (
    id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti VARCHAR(128) UNIQUE NOT NULL, ip_address TEXT, user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON security_sessions(user_id, revoked_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_sessions_jti ON security_sessions(jti)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_2fa (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret_enc TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY, user_id INTEGER, event_type VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', ip_address TEXT, user_agent TEXT,
    details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC)`);
}

export async function createSecuritySession(userId: number, jti: string, req: any, expiresAt: Date) {
  await pool.query(`INSERT INTO security_sessions (user_id,jti,ip_address,user_agent,expires_at) VALUES ($1,$2,$3,$4,$5)`, [userId, jti, req.ip || req.connection?.remoteAddress || null, String(req.headers?.['user-agent'] || '').slice(0,1000), expiresAt]);
}
export async function isSecuritySessionActive(jti: string, userId: number): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM security_sessions WHERE jti=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at > NOW()`, [jti, userId]);
  if (!r.rows.length) return false;
  await pool.query(`UPDATE security_sessions SET last_seen_at=NOW() WHERE jti=$1`, [jti]).catch(() => {});
  return true;
}
export async function revokeSession(jti: string, userId: number) { await pool.query(`UPDATE security_sessions SET revoked_at=NOW() WHERE jti=$1 AND user_id=$2`, [jti,userId]); }
export async function revokeAllSessions(userId: number, exceptJti?: string) {
  if (exceptJti) await pool.query(`UPDATE security_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL AND jti<>$2`, [userId, exceptJti]);
  else await pool.query(`UPDATE security_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
}
export async function listSessions(userId: number) { const r = await pool.query(`SELECT id,jti,ip_address,user_agent,created_at,last_seen_at,expires_at,revoked_at FROM security_sessions WHERE user_id=$1 ORDER BY created_at DESC`, [userId]); return r.rows; }
export async function securityEvent(userId: number|null, eventType: string, req: any, details: any = {}, severity='info') {
  await pool.query(`INSERT INTO security_events(user_id,event_type,severity,ip_address,user_agent,details) VALUES($1,$2,$3,$4,$5,$6)`, [userId,eventType,severity,req?.ip || null,String(req?.headers?.['user-agent'] || '').slice(0,1000),JSON.stringify(details)]).catch(()=>{});
}
export async function setup2FA(userId: number, username: string) {
  const secret = base32Encode(crypto.randomBytes(20));
  const issuer = encodeURIComponent('Remo Pro'); const account = encodeURIComponent(username);
  const otpauth = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 260, margin: 2 });
  await pool.query(`INSERT INTO user_2fa(user_id,secret_enc,enabled) VALUES($1,$2,false) ON CONFLICT(user_id) DO UPDATE SET secret_enc=EXCLUDED.secret_enc, enabled=false`, [userId,encrypt(secret)]);
  return { secret, otpauth, qrDataUrl };
}
export async function confirm2FA(userId: number, code: string) {
  const r = await pool.query(`SELECT secret_enc FROM user_2fa WHERE user_id=$1`, [userId]); if (!r.rows[0]) return false;
  const secret = decrypt(r.rows[0].secret_enc); if (!verifyTotp(secret, code)) return false;
  await pool.query(`UPDATE user_2fa SET enabled=true,last_used_at=NOW() WHERE user_id=$1`, [userId]); return true;
}
export async function disable2FA(userId: number, code: string) {
  const r = await pool.query(`SELECT secret_enc FROM user_2fa WHERE user_id=$1`, [userId]); if (!r.rows[0]) return false;
  if (!verifyTotp(decrypt(r.rows[0].secret_enc), code)) return false; await pool.query(`DELETE FROM user_2fa WHERE user_id=$1`, [userId]); return true;
}
export async function get2FAStatus(userId: number) { const r=await pool.query(`SELECT enabled FROM user_2fa WHERE user_id=$1`,[userId]); return !!r.rows[0]?.enabled; }
export async function verifyUser2FA(userId:number, code:string) { const r=await pool.query(`SELECT secret_enc,enabled FROM user_2fa WHERE user_id=$1`,[userId]); if(!r.rows[0]?.enabled) return false; const ok=verifyTotp(decrypt(r.rows[0].secret_enc),code); if(ok) await pool.query(`UPDATE user_2fa SET last_used_at=NOW() WHERE user_id=$1`,[userId]); return ok; }
