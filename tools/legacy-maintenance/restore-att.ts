import { pool } from "./server-db.js";
import fs from "fs";

async function main() {
  const backupStr = fs.readFileSync('backups/backup-auto-2026-08-23T05-06-40-691Z.json', 'utf8');
  const backup = JSON.parse(backupStr);
  const atts = backup.tables.attendance;
  
  if (!atts) {
    console.log("No attendance in backup");
    return;
  }
  
  // Filter for dates before Aug 9
  const oldAtts = atts.filter((a: any) => new Date(a.date) < new Date('2026-08-09'));
  console.log(`Found ${oldAtts.length} old attendance records to restore.`);
  
  let restored = 0;
  for (const a of oldAtts) {
    // Only restore if not already there
    const existing = await pool.query("SELECT id FROM attendance WHERE employee_id = $1 AND date = $2", [a.employee_id, a.date]);
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO attendance (
          employee_id, date, check_in, check_out, work_hours, overtime, penalty, status, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
      `, [
        a.employee_id, a.date, a.check_in, a.check_out, 
        a.work_hours || 0, a.overtime || 0, a.penalty || 0, 
        a.status || 'present', a.notes || 'بصمة جهاز'
      ]);
      restored++;
    }
  }
  
  console.log(`Successfully restored ${restored} records.`);
  await pool.end();
}
main();
