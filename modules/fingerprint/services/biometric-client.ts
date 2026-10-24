/**
 * Unified Biometric Device Client
 * Supports:
 *   - ZKTeco (via @graphland/zkteco over TCP, port 4370)
 *   - HikVision (via ISAPI REST over HTTP/HTTPS, port 80/443)
 *
 * Both clients expose the same minimal interface so callers (sync endpoint,
 * disable/enable fingerprint endpoints) can stay agnostic of the device brand.
 */

import { ZKTecoClient } from "@graphland/zkteco";
import https from "https";
import http from "http";
import crypto from "crypto";

export interface BiometricAttendanceRecord {
  deviceUserId: string;
  timestamp: Date;
  type?: number; // 0=CheckIn, 1=CheckOut, 2=BreakOut, 3=BreakIn, 4=OT-In, 5=OT-Out
  verifyMode?: number; // 0=FP, 1=PIN, 2=PW, 3=Card, 4=Face, ...
  workCode?: number;
}

export interface BiometricUserInfo {
  uid: number;
  userId: string;
  name: string;
  role?: number;
  enabled?: boolean;
}

export interface IBiometricClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAttendances(): Promise<BiometricAttendanceRecord[]>;
  deleteUser(userId: string): Promise<void>;
  createUser(input: { userId: string; name: string; role?: number; password?: string; enabled?: boolean }): Promise<any>;
  updateUser(userId: string, fields: { enabled?: boolean; name?: string }): Promise<any>;
  // low-level escape hatch (mainly ZKTeco CMD_*)
  executeCmd?(command: number, data: Buffer): Promise<any>;
}

// ============================================================
// ZKTeco Client Adapter (wraps @graphland/zkteco)
// ============================================================

export class ZKTecoAdapter implements IBiometricClient {
  private client: any;
  private ip: string;
  private port: number;

  constructor(opts: { ip: string; port: number; timeout?: number }) {
    this.ip = opts.ip;
    this.port = opts.port || 4370;
    this.client = new ZKTecoClient({
      ip: this.ip,
      port: this.port,
      timeout: opts.timeout || 8000,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    try { await this.client.disconnect(); } catch (_) {}
  }

  async getAttendances(): Promise<BiometricAttendanceRecord[]> {
    const raw = await this.client.getAttendances();
    if (!Array.isArray(raw)) return [];
    return raw.map((r: any) => {
      const rawDate = r.recordTime || r.timestamp || r.dateTime || r.time;
      return {
        deviceUserId: String(r.deviceUserId ?? r.userId ?? r.userSn ?? r.uid ?? r.pin ?? ""),
        timestamp: rawDate ? new Date(rawDate) : new Date(),
        type: r.type ?? r.punch,
        verifyMode: r.verifyMode ?? r.status,
        workCode: r.workCode,
      };
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.deleteUser(userId);
  }

  async createUser(input: { userId: string; name: string; role?: number; password?: string; enabled?: boolean }): Promise<any> {
    return await this.client.createUser({
      userId: input.userId,
      name: input.name,
      role: input.role ?? 0,
      password: input.password ?? "",
      enabled: input.enabled ?? true,
    });
  }

  async updateUser(userId: string, fields: { enabled?: boolean; name?: string }): Promise<any> {
    return await this.client.updateUser(userId, fields as any);
  }

  async executeCmd(command: number, data: Buffer): Promise<any> {
    if (typeof this.client.executeCmd === 'function') {
      return await this.client.executeCmd(command, data);
    }
    throw new Error('executeCmd not supported by this SDK version');
  }
}

// ============================================================
// HikVision Client (ISAPI over HTTP/HTTPS + Digest auth)
// ============================================================
// HikVision terminal devices (DS-K1T801, DS-K1T201, DS-K1T641, etc.) expose
// their data via the ISAPI REST API. Common endpoints used here:
//   GET  /ISAPI/AccessControl/Aollog?searchID=...    → attendance logs
//   PUT  /ISAPI/AccessControl/UserInfo/detail?...
//   POST /ISAPI/AccessControl/UserInfo/Record        → create user
//   DEL  /ISAPI/AccessControl/UserInfo/detail?...     → delete user
//   GET  /ISAPI/System/deviceInfo                     → device info / connection test

export class HikVisionClient implements IBiometricClient {
  private ip: string;
  private port: number;
  private username: string;
  private password: string;
  private useHttps: boolean;
  private searchId: string;

  constructor(opts: { ip: string; port?: number; username: string; password: string; protocol?: 'http' | 'https' }) {
    this.ip = opts.ip;
    this.port = opts.port || 80;
    this.username = opts.username || 'admin';
    this.password = opts.password || '';
    this.useHttps = (opts.protocol || 'http') === 'https';
    this.searchId = crypto.randomBytes(8).toString('hex');
  }

  private buildUrl(path: string): string {
    const proto = this.useHttps ? 'https' : 'http';
    return `${proto}://${this.ip}:${this.port}${path}`;
  }

  /**
   * HikVision uses HTTP Digest authentication by default.
   * Node's fetch supports this with `auth: 'digest'` only via libraries,
   * so we implement a minimal Digest handshake using http(s) module directly.
   */
  private async request(method: string, path: string, body?: string, contentType: string = 'application/xml'): Promise<{ status: number; body: string; wwwAuth?: string }> {
    return new Promise((resolve, reject) => {
      const url = this.buildUrl(path);
      const lib = this.useHttps ? https : http;

      // Step 1: send a probe with Authorization: Digest (empty) to get the challenge
      const probe = lib.request(url, {
        method,
        headers: {
          'Content-Type': contentType,
          'Content-Length': body ? Buffer.byteLength(body) : 0,
        },
        timeout: 8000,
        // Insecure mode for self-signed device certs
        rejectUnauthorized: false,
      }, (res: any) => {
        // Capture WWW-Authenticate header if present
        if (res.statusCode === 401 && res.headers['www-authenticate']) {
          const authHeader = res.headers['www-authenticate'] as string;
          const digestAuth = this.buildDigestAuth(method, path, authHeader);
          // Drain response
          res.resume();
          // Step 2: retry with the computed Authorization header
          const retry = lib.request(url, {
            method,
            headers: {
              'Content-Type': contentType,
              'Content-Length': body ? Buffer.byteLength(body) : 0,
              'Authorization': digestAuth,
            },
            timeout: 8000,
            rejectUnauthorized: false,
          }, (res2: any) => {
            let chunks: Buffer[] = [];
            res2.on('data', (c: Buffer) => chunks.push(c));
            res2.on('end', () => {
              resolve({
                status: res2.statusCode || 0,
                body: Buffer.concat(chunks).toString('utf-8'),
              });
            });
          });
          retry.on('error', reject);
          retry.on('timeout', () => { retry.destroy(); reject(new Error('HikVision request timeout')); });
          if (body) retry.write(body);
          retry.end();
        } else {
          let chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString('utf-8'),
            });
          });
        }
      });

      probe.on('error', reject);
      probe.on('timeout', () => { probe.destroy(); reject(new Error('HikVision probe timeout')); });
      if (body) probe.write(body);
      probe.end();
    });
  }

  private buildDigestAuth(method: string, path: string, wwwAuth: string): string {
    // Parse WWW-Authenticate: Digest realm="...", nonce="...", qop="auth", ...
    const params: Record<string, string> = {};
    const match = wwwAuth.match(/Digest\s+(.*)/i);
    if (!match) return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    const kvPairs = match[1].match(/(\w+)=("([^"]*)"|([^,]+))/g) || [];
    for (const p of kvPairs) {
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const k = p.substring(0, eq).trim();
      let v = p.substring(eq + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      params[k] = v;
    }

    const realm = params['realm'] || '';
    const nonce = params['nonce'] || '';
    const qop = params['qop'] || '';
    const opaque = params['opaque'];

    const ha1 = crypto.createHash('md5').update(`${this.username}:${realm}:${this.password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');

    let response: string;
    let nc = '00000001';
    let cnonce = crypto.randomBytes(8).toString('hex');

    if (qop.includes('auth')) {
      response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`).digest('hex');
      let auth = `Digest username="${this.username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop=auth, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
      if (opaque) auth += `, opaque="${opaque}"`;
      return auth;
    } else {
      response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
      let auth = `Digest username="${this.username}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${response}"`;
      if (opaque) auth += `, opaque="${opaque}"`;
      return auth;
    }
  }

  /**
   * Parse HikVision XML to extract attendance records.
   * Format: <AolLog><Log><DateTime>...</DateTime><User><employeeNo>123</employeeNo></User><Major>0</Major><Minor>0</Minor></Log>...</AolLog>
   *
   * IMPORTANT — Timestamp parsing (fixed 2026-08-24):
   * The previous `new Date(dateTime.replace('T', ' '))` had two flaws:
   *   1. It destroyed any explicit timezone suffix the device may have sent
   *      (e.g. `2026-08-13T19:52:00+03:00` → `2026-08-13 19:52:00+03:00`,
   *       which is non-standard and may parse as Invalid Date on some runtimes).
   *   2. When the device sends wall-clock time WITHOUT a TZ suffix, the
   *      resulting Date is interpreted in the SERVER's local TZ, which skews
   *      the absolute instant but preserves the wall-clock representation.
   * The fix: try the original ISO string first (preserves TZ if present);
   * only fall back to space-separated parsing if ISO parsing fails.
   */
  private parseAollogXml(xml: string): BiometricAttendanceRecord[] {
    const records: BiometricAttendanceRecord[] = [];
    const logRegex = /<Log>([\s\S]*?)<\/Log>/g;
    let m: RegExpExecArray | null;
    while ((m = logRegex.exec(xml)) !== null) {
      const block = m[1];
      const dateTime = block.match(/<DateTime>([^<]+)<\/DateTime>/)?.[1];
      const employeeNo = block.match(/<employeeNo>([^<]*)<\/employeeNo>/)?.[1] || '';
      const major = parseInt(block.match(/<Major>([^<]*)<\/Major>/)?.[1] || '0', 10);
      const minor = parseInt(block.match(/<Minor>([^<]*)<\/Minor>/)?.[1] || '0', 10);
      const verifyMode = parseInt(block.match(/<VerifyMode>([^<]*)<\/VerifyMode>/)?.[1] || '0', 10);

      if (dateTime) {
        // Strategy: keep TZ info if present; otherwise parse the wall-clock
        // string directly. The downstream code uses getHours() which returns
        // the server-local hour — since the wall-clock is preserved, this
        // returns the SAME hour the device's clock was showing when the punch
        // happened, which is what we want for the night-shift rule (<8 AM).
        let ts: Date;
        const isoParsed = new Date(dateTime);
        if (!isNaN(isoParsed.getTime())) {
          // Original ISO string parses cleanly (with or without TZ suffix).
          // Use it directly to preserve any embedded offset.
          ts = isoParsed;
        } else {
          // Fallback: space-separate and let V8 treat it as local wall-clock.
          // This is the legacy path that worked for "2026-08-13 19:52:00"
          // strings but broke for "+03:00" suffixed strings.
          const fallback = new Date(dateTime.replace('T', ' '));
          ts = isNaN(fallback.getTime()) ? new Date() : fallback;
        }

        records.push({
          deviceUserId: employeeNo,
          timestamp: ts,
          // major=0 → attendance log; minor 0=check-in, 1=check-out
          type: major === 0 ? (minor === 1 ? 1 : 0) : undefined,
          verifyMode,
        });
      }
    }
    return records;
  }

  async connect(): Promise<void> {
    // Test the connection by hitting /ISAPI/System/deviceInfo
    const res = await this.request('GET', '/ISAPI/System/deviceInfo');
    if (res.status === 200) return;
    if (res.status === 401) throw new Error('HikVision authentication failed - check username/password');
    throw new Error(`HikVision connect failed (HTTP ${res.status})`);
  }

  async disconnect(): Promise<void> {
    // Stateless HTTP — nothing to disconnect
  }

  async getAttendances(): Promise<BiometricAttendanceRecord[]> {
    // Use the Aollog search endpoint with a fresh searchID.
    //
    // BUGFIX 2026-08-24:
    //   1. The previous request body had a malformed XML tag — opening
    //      <CASearchDescription> but closing </CASASearchDescription> (extra
    //      "A" in the closing name). HikVision's ISAPI may parse this
    //      leniently OR return partial results, which silently dropped
    //      attendance records. Both tags now match exactly.
    //   2. The previous implementation did a single request with
    //      maxResults=4096 and NO pagination. HikVision returns records in
    //      CHRONOLOGICAL order (oldest first), so on a device that has
    //      accumulated more than 4096 punches the OLDEST 4096 were returned
    //      and the recent punches (today/yesterday) were NEVER pulled —
    //      explaining the "some punches missing" symptom in production.
    //      We now loop with an incrementing searchResultPosition until the
    //      device returns fewer records than maxResults (indicating the
    //      tail of the result set) or we hit a hard cap.
    const allRecords: BiometricAttendanceRecord[] = [];
    const PAGE_SIZE = 500;       // smaller pages = more reliable on devices with limited RAM
    const HARD_CAP = 200_000;    // safety upper bound to avoid infinite loop on misbehaving firmware
    let position = 0;
    let consecutiveEmpty = 0;

    while (allRecords.length < HARD_CAP) {
      // Each iteration uses a FRESH searchID — HikVision ISAPI expects a
      // new searchID per search request; reusing one returns the same page.
      this.searchId = crypto.randomBytes(8).toString('hex');

      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<CASearchDescription>
  <searchID>${this.searchId}</searchID>
  <searchResultPosition>${position}</searchResultPosition>
  <maxResults>${PAGE_SIZE}</maxResults>
</CASearchDescription>`;

      // Primary path: PUT to Aollog?searchID=...
      let res = await this.request(
        'PUT',
        '/ISAPI/AccessControl/Aollog?searchID=' + this.searchId,
        xmlBody
      );

      let body = res.body;
      if (res.status !== 200) {
        // Fallback: POST to Aollog/search (firmware-dependent)
        const altRes = await this.request('POST', '/ISAPI/AccessControl/Aollog/search', xmlBody);
        if (altRes.status !== 200) {
          // If we already have SOME records from earlier pages, return them
          // rather than failing the whole sync — partial data is better than
          // none, and the missing pages can be picked up on the next sync.
          if (allRecords.length > 0) {
            console.warn(`[HikVision] getAttendances: page ${position} failed (HTTP ${res.status}/${altRes.status}) after ${allRecords.length} records — returning partial results.`);
            break;
          }
          throw new Error(`HikVision getAttendances failed: HTTP ${res.status} ${res.body.substring(0, 200)}`);
        }
        body = altRes.body;
      }

      const page = this.parseAollogXml(body);
      if (page.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 2) break;   // device reports no more data
        position += PAGE_SIZE;
        continue;
      }
      consecutiveEmpty = 0;

      // De-duplicate by (userId, timestamp, type) — HikVision occasionally
      // returns the same log entry on overlapping pages.
      const seenKeys = new Set<string>();
      for (const rec of page) {
        const key = `${rec.deviceUserId}|${rec.timestamp.getTime()}|${rec.type ?? ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allRecords.push(rec);
        }
      }

      // Last page indicator: device returned fewer records than PAGE_SIZE
      if (page.length < PAGE_SIZE) break;

      position += PAGE_SIZE;
    }

    return allRecords;
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete user by employeeNo
    const path = `/ISAPI/AccessControl/UserInfo/detail?employeeNo=${encodeURIComponent(userId)}`;
    const res = await this.request('DELETE', path);
    if (res.status === 200) return;
    if (res.status === 404) return; // Already gone
    throw new Error(`HikVision deleteUser failed: HTTP ${res.status} ${res.body.substring(0, 200)}`);
  }

  async createUser(input: { userId: string; name: string; role?: number; password?: string; enabled?: boolean }): Promise<any> {
    // Build UserInfo XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UserInfo>
  <employeeNo>${input.userId}</employeeNo>
  <name>${this.escapeXml(input.name)}</name>
  <userType>visitor</userType>
  <maxOpenDoorTime>0</maxOpenDoorTime>
  <password>${this.escapeXml(input.password || '')}</password>
  <beginTime>2000-01-01T00:00:00Z</beginTime>
  <endTime>2030-12-31T23:59:59Z</endTime>
</UserInfo>`;

    const res = await this.request('POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', xml);
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`HikVision createUser failed: HTTP ${res.status} ${res.body.substring(0, 200)}`);
    }
    return { ok: true };
  }

  async updateUser(userId: string, fields: { enabled?: boolean; name?: string }): Promise<any> {
    // HikVision: enable/disable is not directly a flag — to "disable", we delete;
    // to "enable" we re-create. For partial updates we can do a PUT to modify name only.
    if (fields.name) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UserInfo>
  <employeeNo>${userId}</employeeNo>
  <name>${this.escapeXml(fields.name)}</name>
</UserInfo>`;
      const res = await this.request('PUT', `/ISAPI/AccessControl/UserInfo/detail?employeeNo=${encodeURIComponent(userId)}`, xml);
      if (res.status !== 200) {
        throw new Error(`HikVision updateUser failed: HTTP ${res.status}`);
      }
      return { ok: true };
    }
    return { ok: true };
  }

  private escapeXml(s: string): string {
    return (s || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}

// ============================================================
// Factory: returns the right client based on device_type
// ============================================================

export interface DeviceRow {
  ip_address: string;
  port: number;
  device_type?: string;
  protocol?: string;
  username?: string;
  password?: string;
}

export function createBiometricClient(device: DeviceRow, timeout: number = 8000): IBiometricClient {
  const deviceType = (device.device_type || 'zkteco').toLowerCase();

  if (deviceType === 'hikvision' || deviceType === 'hik') {
    return new HikVisionClient({
      ip: device.ip_address,
      port: device.port || 80,
      username: device.username || 'admin',
      password: device.password || '',
      protocol: (device.protocol === 'https' ? 'https' : 'http') as 'http' | 'https',
    });
  }

  // Default: ZKTeco over TCP
  return new ZKTecoAdapter({
    ip: device.ip_address,
    port: device.port || 4370,
    timeout,
  });
}
