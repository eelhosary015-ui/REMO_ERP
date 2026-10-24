// Quick diagnostic script for fingerprint devices and employee code mapping
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('\n========== FINGERPRINT DEVICES ==========');
  const devices = await client.query("SELECT id, name, ip_address, port, is_active, last_sync FROM fingerprint_devices ORDER BY id");
  console.table(devices.rows);

  console.log('\n========== EMPLOYEES WITH FINGERPRINT CODES ==========');
  const emps = await client.query("SELECT id, name, fingerprint_code FROM employees WHERE fingerprint_code IS NOT NULL AND fingerprint_code != '' ORDER BY id");
  console.table(emps.rows);
  console.log(`Total employees with fingerprint code: ${emps.rowCount}`);

  console.log('\n========== EMPLOYEES WITHOUT FINGERPRINT CODES ==========');
  const noCode = await client.query("SELECT COUNT(*) as count FROM employees WHERE fingerprint_code IS NULL OR fingerprint_code = ''");
  console.log(`Employees WITHOUT code: ${noCode.rows[0].count}`);

  console.log('\n========== RECENT ATTENDANCE (last 10) ==========');
  const att = await client.query("SELECT id, employee_id, date, check_in, check_out, status FROM attendance ORDER BY id DESC LIMIT 10");
  console.table(att.rows);
  console.log(`Total attendance records: ${att.rowCount}`);

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
