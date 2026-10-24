const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function run() {
  try {
    const devices = await pool.query("SELECT id, name, ip_address, port, device_type, is_active, last_sync FROM fingerprint_devices");
    console.log("=== DEVICES ===");
    console.table(devices.rows);

    const emps = await pool.query("SELECT id, name, employee_code, fingerprint_code, national_id, fingerprint_status FROM employees LIMIT 20");
    console.log("=== EMPLOYEES (First 20) ===");
    console.table(emps.rows);

    const logsCount = await pool.query("SELECT COUNT(*) FROM fingerprint_logs");
    console.log("=== FINGERPRINT LOGS COUNT ===", logsCount.rows[0]);

    const logsSample = await pool.query("SELECT * FROM fingerprint_logs ORDER BY timestamp DESC LIMIT 10");
    console.log("=== FINGERPRINT LOGS (Latest 10) ===");
    console.table(logsSample.rows);

    const attCount = await pool.query("SELECT COUNT(*) FROM attendance");
    console.log("=== ATTENDANCE COUNT ===", attCount.rows[0]);

    const attSample = await pool.query("SELECT * FROM attendance ORDER BY date DESC LIMIT 10");
    console.log("=== ATTENDANCE (Latest 10) ===");
    console.table(attSample.rows);
  } catch (err) {
    console.error("Error connecting to database:", err.message);
  } finally {
    await pool.end();
  }
}

run();
