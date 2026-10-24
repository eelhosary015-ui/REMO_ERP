import { pool } from "./server-db.js";

async function main() {
  const empId = 5; // employee with fingerprint_code 834
  const date = '2026-08-23';
  const start = `${date}T00:00:00.000Z`;
  const end   = `${date}T23:59:59.999Z`;

  // Raw fingerprint logs for that day
  const logsRes = await pool.query(
    `SELECT id, device_id, fingerprint_code, timestamp FROM fingerprint_logs 
     WHERE employee_id = $1 AND timestamp >= $2 AND timestamp <= $3 
     ORDER BY timestamp`,
    [empId, start, end]
  );
  console.log('Raw fingerprint logs (employee 5, 2026-08-23):', logsRes.rows);

  // Attendance record for that day (if any)
  const attRes = await pool.query(
    `SELECT * FROM attendance WHERE employee_id = $1 AND date = $2::date`,
    [empId, date]
  );
  console.log('Attendance record for employee 5 on 2026-08-23:', attRes.rows);

  await pool.end();
}

main();
