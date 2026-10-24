import { pool } from "../../../server-db.js";
import { createBiometricClient } from "../services/biometric-client.js";
import { ERPCache } from "../../../server-erp-core.js";

export async function runHistoricalSyncBackground(deviceId: number) {
  try {
    // 1. Create fingerprint_logs table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fingerprint_logs (
        id SERIAL PRIMARY KEY,
        device_id INTEGER,
        fingerprint_code VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        type VARCHAR(50),
        employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (device_id, fingerprint_code, timestamp)
      )
    `);

    // Fetch device
    const deviceResult = await pool.query("SELECT * FROM fingerprint_devices WHERE id = $1", [deviceId]);
    const device = deviceResult.rows[0];
    if (!device) {
      console.log(`[HistoricalSync] Device ${deviceId} not found`);
      return;
    }

    // 2. Connect to device
    const zkInstance = createBiometricClient({
      ip_address: device.ip_address,
      port: device.port || 4370,
      device_type: device.device_type,
      protocol: device.protocol,
      username: device.username,
      password: device.password,
    }, 15000);

    await zkInstance.connect();
    
    // 3. Fetch all logs
    const logs = await zkInstance.getAttendances();
    await zkInstance.disconnect();

    if (!logs || logs.length === 0) {
      console.log(`[HistoricalSync] No logs found on device ${deviceId}`);
      return;
    }

    // 4. Map employees
    const employeesResult = await pool.query(`
      SELECT e.id, e.employee_code, e.fingerprint_code, e.national_id, e.fingerprint_status,
             (SELECT s.start_time FROM employee_shifts es JOIN hr_shifts s ON es.shift_id = s.id WHERE es.employee_id = e.id LIMIT 1) as start_time,
             (SELECT s.end_time FROM employee_shifts es JOIN hr_shifts s ON es.shift_id = s.id WHERE es.employee_id = e.id LIMIT 1) as end_time
      FROM employees e
    `);

    const codeToEmpMap: Record<string, { id: number; crossesMidnight: boolean }> = {};
    employeesResult.rows.forEach((e: any) => {
      const val = {
        id: e.id,
        crossesMidnight: e.start_time && e.end_time ? e.end_time < e.start_time : false
      };
      
      const addKey = (k: any) => {
        if (k === null || k === undefined) return;
        const strKey = String(k).trim();
        if (!strKey) return;
        codeToEmpMap[strKey] = val;
        const numVal = parseInt(strKey, 10);
        if (!isNaN(numVal)) codeToEmpMap[numVal.toString()] = val;
      };
      addKey(e.fingerprint_code);
      addKey(e.employee_code);
      addKey(String(e.id));
    });

    const lookupEmp = (rawCode: any) => {
      if (!rawCode) return null;
      const strCode = String(rawCode).trim();
      if (codeToEmpMap[strCode]) return codeToEmpMap[strCode];
      const numVal = parseInt(strCode, 10);
      if (!isNaN(numVal) && codeToEmpMap[numVal.toString()]) return codeToEmpMap[numVal.toString()];
      
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

    // 5. Save logs and process
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const grouped: Record<string, Record<string, { min?: string; max?: string; ci?: string; co?: string }>> = {};
      
      let linkedCount = 0;
      let unlinkedCount = 0;
      let ignoredCount = 0;

      for (const log of logs) {
        const rawLog = log as unknown as Record<string, any>;
        const fpCode = String(rawLog.deviceUserId || rawLog.userSn || rawLog.uid || rawLog.userId || rawLog.pin || rawLog.id || "").trim();
        const ts = rawLog.timestamp || rawLog.recordTime;
        const timestampIso = ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
        const emp = lookupEmp(fpCode);
        const empId = emp ? emp.id : null;
        
        if (emp) linkedCount++; else unlinkedCount++;

        // Insert into fingerprint_logs to avoid duplicates
        try {
          const res = await client.query(
            `INSERT INTO fingerprint_logs (device_id, fingerprint_code, timestamp, type, employee_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (device_id, fingerprint_code, timestamp) DO NOTHING
             RETURNING id`,
            [deviceId, fpCode, timestampIso, 'auto', empId]
          );
          if (res.rowCount === 0) {
            ignoredCount++;
          }
        } catch (err: any) {
          console.error("Error inserting fingerprint_logs", err);
        }

        if (empId && emp) {
          let dt = new Date(timestampIso);
          if (!isNaN(dt.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            const hours = pad(dt.getHours());
            const minutes = pad(dt.getMinutes());
            const timeStr = `${hours}:${minutes}`;
            // Handle cross midnight
            if (emp.crossesMidnight && timeStr < "12:00") {
              dt.setDate(dt.getDate() - 1);
            }
            const dateKey = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
            if (!grouped[empId]) grouped[empId] = {};
            if (!grouped[empId][dateKey]) grouped[empId][dateKey] = {};
            
            const dayGroup = grouped[empId][dateKey];
            if (!dayGroup.min || timeStr < dayGroup.min) dayGroup.min = timeStr;
            if (!dayGroup.max || timeStr > dayGroup.max) dayGroup.max = timeStr;
          }
        }
      }

      // Update Attendance Table
      for (const [empIdStr, dates] of Object.entries(grouped)) {
        const empIdNum = parseInt(empIdStr, 10);
        for (const [date, times] of Object.entries(dates)) {
          const t = times as any;
          const ci = t.min;
          let co: string | null = t.max !== t.min ? t.max : null;
          
          if (ci && co) {
            const [hIn, mIn] = ci.split(':').map(Number);
            const [hOut, mOut] = co.split(':').map(Number);
            const inMins = hIn * 60 + mIn;
            const outMins = hOut * 60 + mOut;
            if (outMins - inMins < 5) {
              co = null;
            }
          }
          
          const ciTs = ci ? `${date} ${ci.length === 5 ? ci + ":00" : ci}` : null;
          const coTs = co ? `${date} ${co.length === 5 ? co + ":00" : co}` : null;

          await client.query(`
            INSERT INTO attendance (employee_id, date, check_in, check_out, work_hours, status)
            VALUES (
              $1, $2::date,
              $3::timestamp,
              $4::timestamp,
              CASE WHEN $3::timestamp IS NOT NULL AND $4::timestamp IS NOT NULL THEN
                EXTRACT(EPOCH FROM ($4::timestamp - $3::timestamp + (CASE WHEN $4::timestamp < $3::timestamp THEN interval '24 hours' ELSE interval '0 hours' END))) / 3600.0
              ELSE 0 END,
              'present'
            )
            ON CONFLICT(employee_id, date) DO UPDATE SET
              check_in = LEAST(EXCLUDED.check_in, attendance.check_in),
              check_out = NULLIF(
                GREATEST(
                  EXCLUDED.check_out, 
                  attendance.check_out, 
                  EXCLUDED.check_in, 
                  attendance.check_in
                ), 
                LEAST(EXCLUDED.check_in, attendance.check_in)
              ),
              work_hours = CASE
                WHEN LEAST(EXCLUDED.check_in, attendance.check_in) IS NOT NULL
                 AND NULLIF(GREATEST(EXCLUDED.check_out, attendance.check_out, EXCLUDED.check_in, attendance.check_in), LEAST(EXCLUDED.check_in, attendance.check_in)) IS NOT NULL
                THEN
                  EXTRACT(EPOCH FROM (
                    (CAST(TO_CHAR(NULLIF(GREATEST(EXCLUDED.check_out, attendance.check_out, EXCLUDED.check_in, attendance.check_in), LEAST(EXCLUDED.check_in, attendance.check_in)), 'HH24:MI:SS') AS TIME) -
                     CAST(TO_CHAR(LEAST(EXCLUDED.check_in, attendance.check_in), 'HH24:MI:SS') AS TIME)) +
                    CASE WHEN CAST(TO_CHAR(NULLIF(GREATEST(EXCLUDED.check_out, attendance.check_out, EXCLUDED.check_in, attendance.check_in), LEAST(EXCLUDED.check_in, attendance.check_in)), 'HH24:MI:SS') AS TIME) <
                              CAST(TO_CHAR(LEAST(EXCLUDED.check_in, attendance.check_in), 'HH24:MI:SS') AS TIME)
                       THEN interval '24 hours' ELSE interval '0 hours' END
                  )) / 3600.0
                ELSE 0
              END
          `, [empIdNum, date, ciTs, coTs]);
        }
      }

      // 6. Update device last_sync
      await client.query(
        "UPDATE fingerprint_devices SET is_active = 1, last_sync = CURRENT_TIMESTAMP WHERE id = $1",
        [deviceId]
      );
      ERPCache.delete("fingerprint:devices:all");
      
      await client.query("COMMIT");
      console.log(`[HistoricalSync] Done for device ${deviceId}. Total: ${logs.length}, Linked: ${linkedCount}, Unlinked: ${unlinkedCount}, Ignored: ${ignoredCount}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`[HistoricalSync] Error for device ${deviceId}:`, err.message);
  }
}
