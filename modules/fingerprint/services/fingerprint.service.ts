import { pool } from "../../../server-db.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";
import { ZKTecoClient } from "@graphland/zkteco";
import { createBiometricClient } from "./biometric-client.js";

export interface AttendanceUpdateEvent {
  employee_id: number;
  employee_name?: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  fingerprint_code?: string;
  device_id: number;
  device_name: string;
  is_new: boolean;        // true = newly inserted row, false = updated existing
  is_check_in: boolean;    // true = this punch is a check-in, false = check-out
  punch_time: string;
  source: 'zkteco' | 'hikvision' | 'auto' | 'manual';
}

export interface SyncResult {
  success: boolean;
  total_pulled: number;
  newly_inserted: number;
  duplicate_skipped: number;
  unknown_fingerprint_codes: string[];
  /** Per-code detail of skipped punches (code, count, first/last date) */
  unmatched_details?: Array<{ code: string; count: number; first_date: string | null; last_date: string | null }>;
  pulled: number;
  inserted: number;
  duplicates_skipped: number;
  matched: number;
  unmatched_codes: string[];
  unmatchedCodes: string[];
  error?: string;
  updatedRecords?: AttendanceUpdateEvent[];
}

export class FingerprintService {
  
  private async ensureColumns(): Promise<void> {
    try {
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS branch_id INTEGER;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'zkteco';`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'tcp';`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS username TEXT;`);
      await pool.query(`ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS password TEXT;`);
    } catch (_e) {}
  }

  async getDevices(): Promise<any[]> {
    await this.ensureColumns();
    const cached = ERPCache.get("fingerprint:devices:all");
    if (cached) return cached;

    const devices = await pool.query("SELECT * FROM fingerprint_devices ORDER BY name ASC");
    ERPCache.set("fingerprint:devices:all", devices.rows, 45);
    return devices.rows;
  }

  async registerDevice(device: { name: string; ip_address: string; port: number; branch_id?: number | null; device_type?: string; protocol?: string; username?: string; password?: string }): Promise<any> {
    await this.ensureColumns();
    const result = await pool.query(
      `INSERT INTO fingerprint_devices
        (name, ip_address, port, branch_id, device_type, protocol, username, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        device.name,
        device.ip_address,
        device.port || (device.device_type === 'hikvision' ? 80 : 4370),
        device.branch_id || null,
        device.device_type || 'zkteco',
        device.protocol || (device.device_type === 'hikvision' ? 'http' : 'tcp'),
        device.username || null,
        device.password || null
      ]
    );
    const newDevice = result.rows[0];
    ERPCache.delete("fingerprint:devices:all");

    ERPEventBus.getInstance().emitEvent("FingerprintDeviceRegistered", {
      deviceId: newDevice.id,
      name: newDevice.name,
      ip: newDevice.ip_address,
      timestamp: new Date()
    });

    return newDevice;
  }

  /**
   * Sync attendance logs from a fingerprint device (ZKTeco or HikVision).
   * Connects to the physical device, pulls logs, matches to employees, and inserts attendance records.
   * Returns details about each new/updated attendance record so the caller can emit socket events.
   */
  async syncDeviceLogs(id: number): Promise<SyncResult> {
    const deviceResult = await pool.query("SELECT * FROM fingerprint_devices WHERE id = $1", [id]);
    const device = deviceResult.rows[0];
    if (!device) {
      return {
        success: false,
        total_pulled: 0,
        newly_inserted: 0,
        duplicate_skipped: 0,
        unknown_fingerprint_codes: [],
        pulled: 0,
        matched: 0,
        inserted: 0,
        duplicates_skipped: 0,
        unmatched_codes: [],
        unmatchedCodes: [],
        error: "الجهاز غير موجود في قاعدة البيانات"
      };
    }

    // Try to connect to the physical device (ZKTeco or HikVision via unified client)
    let zkInstance: any;
    try {
      zkInstance = createBiometricClient({
        ip_address: device.ip_address,
        port: device.port || 4370,
        device_type: device.device_type,
        protocol: device.protocol,
        username: device.username,
        password: device.password,
      }, 10000);
      await zkInstance.connect();
    } catch (connectError: any) {
      // Mark device as inactive on connection failure
      await pool.query(
        "UPDATE fingerprint_devices SET is_active = 0 WHERE id = $1",
        [id]
      );
      ERPCache.delete("fingerprint:devices:all");
      return {
        success: false,
        total_pulled: 0,
        newly_inserted: 0,
        duplicate_skipped: 0,
        unknown_fingerprint_codes: [],
        pulled: 0,
        matched: 0,
        inserted: 0,
        duplicates_skipped: 0,
        unmatched_codes: [],
        unmatchedCodes: [],
        error: `فشل الاتصال بالجهاز ${device.ip_address}:${device.port} - ${connectError.message || "Connection refused"}`
      };
    }

    // Fetch attendance logs from device
    let logs: any;
    try {
      logs = await zkInstance.getAttendances();
    } catch (fetchError: any) {
      try { await zkInstance.disconnect(); } catch (_) {}
      await pool.query(
        "UPDATE fingerprint_devices SET is_active = 0 WHERE id = $1",
        [id]
      );
      ERPCache.delete("fingerprint:devices:all");
      return {
        success: false,
        total_pulled: 0,
        newly_inserted: 0,
        duplicate_skipped: 0,
        unknown_fingerprint_codes: [],
        pulled: 0,
        matched: 0,
        inserted: 0,
        duplicates_skipped: 0,
        unmatched_codes: [],
        unmatchedCodes: [],
        error: `فشل سحب البصمات من الجهاز - ${fetchError.message || "Timeout"}`
      };
    }

    // Always disconnect after fetching
    try { await zkInstance.disconnect(); } catch (_) {}

    if (!logs || logs.length === 0) {
      await pool.query(
        "UPDATE fingerprint_devices SET is_active = 1, last_sync = CURRENT_TIMESTAMP WHERE id = $1",
        [id]
      );
      ERPCache.delete("fingerprint:devices:all");
      return {
        success: true,
        total_pulled: 0,
        newly_inserted: 0,
        duplicate_skipped: 0,
        unknown_fingerprint_codes: [],
        pulled: 0,
        inserted: 0,
        duplicates_skipped: 0,
        matched: 0,
        unmatched_codes: [],
        unmatchedCodes: [],
        updatedRecords: []
      };
    }

    // Map fingerprint codes strictly based on employee fingerprint_code
    const employeesResult = await pool.query(`
      SELECT e.id, e.name, e.employee_code, e.fingerprint_code, e.fingerprint_status
      FROM employees e
    `);

    const codeToEmpMap: Record<string, { id: number; name: string; fingerprint_code: string }> = {};
    const empNameMap: Record<number, string> = {};
    const empFpMap: Record<number, string> = {};

    employeesResult.rows.forEach((e: any) => {
      empNameMap[e.id] = e.name;
      const fpCodeStr = (e.fingerprint_code || "").trim();
      const empCodeStr = (e.employee_code || "").trim();
      const empIdStr = String(e.id);
      empFpMap[e.id] = fpCodeStr || empCodeStr || empIdStr;

      if (e.fingerprint_status === "suspended" || e.fingerprint_status === "disabled") {
        return;
      }

      const val = {
        id: e.id,
        name: e.name,
        fingerprint_code: fpCodeStr || empCodeStr || empIdStr
      };

      const addKey = (k: any) => {
        if (k === null || k === undefined) return;
        const strKey = String(k).trim();
        if (!strKey) return;

        codeToEmpMap[strKey] = val;

        const numVal = parseInt(strKey, 10);
        if (!isNaN(numVal)) {
          codeToEmpMap[numVal.toString()] = val;
        }

        const digitsMatch = strKey.match(/\d+/);
        if (digitsMatch) {
          const digits = digitsMatch[0];
          codeToEmpMap[digits] = val;
          const numDigits = parseInt(digits, 10);
          if (!isNaN(numDigits)) {
            codeToEmpMap[numDigits.toString()] = val;
          }
        }
      };

      if (fpCodeStr) addKey(fpCodeStr);
      if (empCodeStr) addKey(empCodeStr);
      addKey(empIdStr);
    });

    const lookupEmp = (rawCode: any) => {
      if (rawCode === null || rawCode === undefined) return null;
      const strCode = String(rawCode).trim();
      if (!strCode) return null;

      if (codeToEmpMap[strCode]) return codeToEmpMap[strCode];

      const numVal = parseInt(strCode, 10);
      if (!isNaN(numVal) && codeToEmpMap[numVal.toString()]) {
        return codeToEmpMap[numVal.toString()];
      }

      const digitsMatch = strCode.match(/\d+/);
      if (digitsMatch) {
        const digits = digitsMatch[0];
        if (codeToEmpMap[digits]) return codeToEmpMap[digits];
        const numDigits = parseInt(digits, 10);
        if (!isNaN(numDigits) && codeToEmpMap[numDigits.toString()]) {
          return codeToEmpMap[numDigits.toString()];
        }
      }

      return null;
    };

    const total_pulled = logs.length;
    let newly_inserted = 0;
    let duplicate_skipped = 0;
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const unknown_fingerprint_codes = new Set<string>();
    // Track date ranges per unmatched code so the user can see WHICH days
    // were skipped and diagnose device-side issues (re-enrollment with a
    // different user ID, wrong device clock, etc.)
    const unmatchedCodeDates: Record<string, { count: number; first: string; last: string }> = {};
    const updatedRecords: AttendanceUpdateEvent[] = [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Pre-process and sort valid logs chronologically
      const processedLogs: Array<{
        rawCode: string;
        punchDate: Date;
        emp: any;
        punchType: 'check_in' | 'check_out';
        log: any;
      }> = [];

      for (const log of logs) {
        const rawCode = String(log.deviceUserId ?? log.userId ?? log.userSn ?? log.uid ?? log.pin ?? log.id ?? "").trim();
        const rawTime = log.recordTime ?? log.timestamp ?? log.dateTime ?? log.time;

        let punchDate: Date;
        if (rawTime instanceof Date) {
          punchDate = rawTime;
        } else if (rawTime) {
          punchDate = new Date(rawTime);
        } else {
          continue;
        }

        if (isNaN(punchDate.getTime())) {
          continue;
        }

        // ── Sanity filter: skip phantom/future-dated records ──────────
        // Some device logs carry corrupted or zeroed time fields that decode
        // to dates far in the future (year 2099, 2133, etc.). Such "ghost"
        // records create attendance on days that don't exist.
        // We accept up to 30 days ahead (legitimate clock skew + timezone)
        // and reject anything further out as garbage.
        const FUTURE_LIMIT_MS = 30 * 24 * 3600 * 1000;
        if (punchDate.getTime() - Date.now() > FUTURE_LIMIT_MS) {
          console.warn(`[Fingerprint Sync] Skipping phantom future punch: code="${rawCode}", date=${punchDate.toISOString()}`);
          if (rawCode) {
            unknown_fingerprint_codes.add(`${rawCode} (تاريخ مستقبلي)`);
          }
          continue;
        }

        // Map log to employee via fingerprint_code / employee_code / id
        const emp = lookupEmp(rawCode);
        if (!emp) {
          if (rawCode) {
            unknown_fingerprint_codes.add(rawCode);
            const dStr = `${punchDate.getFullYear()}-${pad2(punchDate.getMonth() + 1)}-${pad2(punchDate.getDate())}`;
            const info = unmatchedCodeDates[rawCode] || { count: 0, first: dStr, last: dStr };
            info.count++;
            if (dStr < info.first) info.first = dStr;
            if (dStr > info.last) info.last = dStr;
            unmatchedCodeDates[rawCode] = info;
          }
          continue;
        }

        // Check if device explicitly tagged punch state (0=in, 1=out, 2=break-out, 3=break-in, 4=ot-in, 5=ot-out)
        let punchType: 'check_in' | 'check_out' = 'check_in';
        const p = log.punch ?? log.type;
        if (p === 1 || p === 2 || p === 5 || log.type === 'check_out' || log.punchLabel?.includes('out')) {
          punchType = 'check_out';
        } else if (p === 0 || p === 3 || p === 4 || log.type === 'check_in' || log.punchLabel?.includes('in')) {
          punchType = 'check_in';
        } else {
          punchType = 'check_in'; // Will be refined by day sequence below if unassigned
        }

        processedLogs.push({ rawCode, punchDate, emp, punchType, log });
      }

      // Sort chronologically
      processedLogs.sort((a, b) => a.punchDate.getTime() - b.punchDate.getTime());

      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStrOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      // ============================================================
      // STEP 1 — Resolve each punch's FINAL target date.
      //
      // Night-shift rule (FIXED): an early-morning punch (before 08:00)
      // belongs to YESTERDAY only when yesterday's session is still OPEN
      // (check_in exists AND check_out is empty) AND the punch falls within
      // 16 hours of that open check-in (a realistic maximum shift length).
      //
      // The OLD rule re-assigned ANY pre-8AM punch to yesterday whenever
      // yesterday merely had a check_in — which stole the morning check-in
      // of early-shift employees (07:00-08:00 starts) and credited it to the
      // previous day as a check-out, producing inflated ~24h work-days and
      // cascading date corruption.
      // ============================================================
      interface ResolvedPunch {
        rawCode: string;
        punchDate: Date;
        emp: any;
        punchType: 'check_in' | 'check_out';
        log: any;
        targetDateStr: string;
      }
      const resolved: ResolvedPunch[] = [];

      for (const item of processedLogs) {
        let targetDateStr = dateStrOf(item.punchDate);

        if (item.punchDate.getHours() < 8) {
          const prevDate = new Date(item.punchDate.getTime() - 24 * 3600 * 1000);
          const prevDateStr = dateStrOf(prevDate);
          const prevAtt = await client.query(
            "SELECT id, check_in, check_out FROM attendance WHERE employee_id = $1 AND date = $2::date LIMIT 1",
            [item.emp.id, prevDateStr]
          );
          const prevRow = prevAtt.rows[0];
          const prevIn = prevRow?.check_in ? new Date(prevRow.check_in) : null;
          const prevOut = prevRow?.check_out ? new Date(prevRow.check_out) : null;

          // Only close a genuinely OPEN overnight session:
          //   - yesterday has check_in, NO check_out, and
          //   - this punch is within 16h of that check-in
          if (prevIn && !prevOut) {
            const gapHours = (item.punchDate.getTime() - prevIn.getTime()) / 3600000;
            if (gapHours > 0 && gapHours <= 16) {
              targetDateStr = prevDateStr;
            }
          }
        }

        resolved.push({ ...item, targetDateStr });
      }

      // ============================================================
      // STEP 2 — Alternate in/out per (employee, FINAL target date).
      // Done AFTER date resolution so the parity is computed on the day
      // the punch will actually be stored under.
      // ============================================================
      const hasExplicitPunch = (l: any) => {
        const p = l.punch ?? l.type;
        return p === 0 || p === 1 || p === 2 || p === 3 || p === 4 || p === 5 ||
               l.type === 'check_in' || l.type === 'check_out';
      };

      const dayPunchCount: Record<string, number> = {};
      for (const item of resolved) {
        const key = `${item.emp.id}_${item.targetDateStr}`;
        const count = dayPunchCount[key] || 0;
        if (!hasExplicitPunch(item.log)) {
          item.punchType = count % 2 === 0 ? 'check_in' : 'check_out';
        }
        dayPunchCount[key] = count + 1;
      }

      // ============================================================
      // STEP 2.5 — Clean rebuild: delete every (employee, date) row that
      // this sync will reconstruct. This guarantees each day's record is
      // rebuilt ONLY from the actual device punches — wiping out any legacy
      // corruption (e.g., rows from the old <8AM bug whose check_out was a
      // next-morning punch, inflating hours to ~24h) AND any phantom-date
      // garbage that may have landed in the table before.
      // ============================================================
      const seenDayKeys = new Set<string>();
      for (const item of resolved) {
        seenDayKeys.add(`${item.emp.id}_${item.targetDateStr}`);
      }
      for (const key of seenDayKeys) {
        const [empIdStr, dateStr] = key.split("_");
        await client.query(
          "DELETE FROM attendance WHERE employee_id = $1 AND date = $2::date",
          [Number(empIdStr), dateStr]
        );
      }

      // ============================================================
      // STEP 3 — Persist, one consolidated row per (employee, date).
      // first punch of the day = check_in, last = check_out (min/max merge).
      // ============================================================
      for (const item of resolved) {
        const empId = item.emp.id;
        const punchDate = item.punchDate;
        const punchTimeStr = `${item.targetDateStr} ${pad(punchDate.getHours())}:${pad(punchDate.getMinutes())}:${pad(punchDate.getSeconds())}`;
        const targetDateStr = item.targetDateStr;
        const actionType = item.punchType;

        // Find existing attendance for this employee & date to guarantee 1 consolidated row
        const existingAtt = await client.query(
          "SELECT id, check_in, check_out, work_hours FROM attendance WHERE employee_id = $1 AND date = $2::date LIMIT 1",
          [empId, targetDateStr]
        );

        if (existingAtt.rows.length > 0) {
          const cur = existingAtt.rows[0];
          const curIn = cur.check_in ? new Date(cur.check_in) : null;
          const curOut = cur.check_out ? new Date(cur.check_out) : null;
          const newPunch = new Date(punchTimeStr);

          let updatedIn = curIn ? (newPunch < curIn ? punchTimeStr : cur.check_in) : punchTimeStr;
          let updatedOut = curOut ? (newPunch > curOut ? punchTimeStr : cur.check_out) : (curIn && newPunch > curIn ? punchTimeStr : cur.check_out);

          let workHours = 0;
          if (updatedIn && updatedOut) {
            const inMs = new Date(updatedIn).getTime();
            const outMs = new Date(updatedOut).getTime();
            if (outMs > inMs) {
              workHours = Math.round(((outMs - inMs) / 3600000) * 100) / 100;
            }
          }

          await client.query(
            `UPDATE attendance SET 
              check_in = $1::timestamp, 
              check_out = $2::timestamp, 
              work_hours = $3, 
              status = 'present' 
             WHERE id = $4`,
            [updatedIn, updatedOut, workHours, cur.id]
          );
          duplicate_skipped++;
        } else {
          // First punch for this day — store it in the correct column based on
          // its resolved type (previously every first punch was forced into
          // check_in even when it was an out-punch).
          const isIn = actionType === 'check_in';
          await client.query(
            `INSERT INTO attendance (
              employee_id, date, punch_time, check_in, check_out, action_type, notes, status, work_hours
            ) VALUES ($1, $2::date, $3::timestamp, $4::timestamp, $5::timestamp, $6, 'بصمة جهاز', 'present', 0)`,
            [empId, targetDateStr, punchTimeStr, isIn ? punchTimeStr : null, isIn ? null : punchTimeStr, actionType]
          );
          newly_inserted++;
        }

        updatedRecords.push({
          employee_id: empId,
          employee_name: item.emp.name,
          date: targetDateStr,
          check_in: punchTimeStr,
          check_out: null,
          fingerprint_code: item.emp.fingerprint_code,
          device_id: id,
          device_name: device.name,
          is_new: existingAtt.rows.length === 0,
          is_check_in: actionType === 'check_in',
          punch_time: punchTimeStr,
          source: (device.device_type === 'hikvision' ? 'hikvision' : 'zkteco'),
        });
      }

      // Mark device as active and update last_sync
      await client.query(
        "UPDATE fingerprint_devices SET is_active = 1, last_sync = CURRENT_TIMESTAMP WHERE id = $1",
        [id]
      );
      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    ERPCache.delete("fingerprint:devices:all");

    const unknownList = Array.from(unknown_fingerprint_codes);
    const matchedCount = total_pulled - Object.values(unmatchedCodeDates).reduce((s, i) => s + i.count, 0);

    // Detailed console diagnostics — helps identify why some days are missing
    // (e.g., old logs stored under a different device user ID / code)
    if (unknownList.length > 0) {
      console.warn(`[Fingerprint Sync] Device "${device.name}": ${total_pulled} logs pulled, ${unknownList.length} unmatched code(s), ${total_pulled - matchedCount} punch(es) SKIPPED:`);
      for (const code of unknownList) {
        const info = unmatchedCodeDates[code];
        if (info) {
          console.warn(`  - Code "${code}": ${info.count} punches from ${info.first} to ${info.last}`);
        }
      }
      console.warn('  → Assign these codes to employees (ملف الموظف → كود البصمة) then re-sync to import them.');
    } else {
      console.log(`[Fingerprint Sync] Device "${device.name}": ${total_pulled} logs pulled, all matched.`);
    }

    // Include per-code date ranges in the API response so the UI can show them
    const unmatched_details = unknownList.map(code => ({
      code,
      count: unmatchedCodeDates[code]?.count || 0,
      first_date: unmatchedCodeDates[code]?.first || null,
      last_date: unmatchedCodeDates[code]?.last || null,
    }));

    ERPEventBus.getInstance().emitEvent("FingerprintLogsSynced", {
      deviceId: id,
      total_pulled,
      newly_inserted,
      duplicate_skipped,
      unknown_fingerprint_codes: unknownList,
      pulled: total_pulled,
      matched: matchedCount,
      inserted: newly_inserted,
      updatedRecordsCount: updatedRecords.length,
      timestamp: new Date()
    });

    return {
      success: true,
      total_pulled,
      newly_inserted,
      duplicate_skipped,
      unknown_fingerprint_codes: unknownList,
      unmatched_details,
      pulled: total_pulled,
      inserted: newly_inserted,
      duplicates_skipped: duplicate_skipped,
      matched: matchedCount,
      unmatched_codes: unknownList,
      unmatchedCodes: unknownList,
      updatedRecords
    };
  }

  /**
   * Sync all active devices — used by the automatic cron job.
   */
  async syncAllActiveDevices(): Promise<Map<number, SyncResult>> {
    const devices = await pool.query("SELECT * FROM fingerprint_devices WHERE is_active = 1");
    const results = new Map<number, SyncResult>();

    for (const device of devices.rows) {
      try {
        const result = await this.syncDeviceLogs(device.id);
        results.set(device.id, result);
        console.log(`[Fingerprint AutoSync] Device "${device.name}" (${device.ip_address}): pulled=${result.pulled}, matched=${result.matched}, inserted=${result.inserted}`);
      } catch (err: any) {
        console.error(`[Fingerprint AutoSync] Device "${device.name}" (${device.ip_address}) failed:`, err.message);
        results.set(device.id, {
          success: false,
          total_pulled: 0,
          newly_inserted: 0,
          duplicate_skipped: 0,
          unknown_fingerprint_codes: [],
          pulled: 0,
          matched: 0,
          inserted: 0,
          duplicates_skipped: 0,
          unmatched_codes: [],
          unmatchedCodes: [],
          error: err.message
        });
      }
    }

    return results;
  }
}
