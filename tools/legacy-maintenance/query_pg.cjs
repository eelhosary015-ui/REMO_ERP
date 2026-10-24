const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
  });
  const res = await pool.query("SELECT id, name, fingerprint_code FROM employees");
  console.log("Employees:", res.rows);
  const attRes = await pool.query("SELECT COUNT(*) FROM attendance");
  console.log("Attendance count:", attRes.rows[0]);
  process.exit(0);
}
run();
