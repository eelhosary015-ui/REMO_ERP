import { pool } from "./server-db.js";
import { runHistoricalSyncBackground } from "./modules/fingerprint/jobs/sync-historical.js";

async function main() {
  console.log("Deleting corrupted fingerprint attendances from Aug 9 onwards...");
  await pool.query(`DELETE FROM attendance WHERE (notes = 'بصمة جهاز' OR status = 'present') AND date >= '2026-08-09'`);
  
  console.log("Running historical sync...");
  const { rows } = await pool.query("SELECT id FROM fingerprint_devices");
  for (const row of rows) {
    await runHistoricalSyncBackground(row.id);
  }
  
  console.log("Checking employee 4 attendance...");
  const resAtt = await pool.query(`SELECT date, check_in, check_out, work_hours FROM attendance WHERE employee_id = 4 ORDER BY date DESC LIMIT 10`);
  console.log("Attendance for Emp 4:", resAtt.rows);
  
  await pool.end();
}
main();
