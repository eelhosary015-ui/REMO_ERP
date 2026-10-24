const { pool } = require('./dist/server-db.js');
async function run() {
  const res = await pool.query("SELECT * FROM attendance");
  console.log(res.rows.length, "attendance records");
  
  const empRes = await pool.query("SELECT id, name, employee_code, fingerprint_code FROM employees");
  console.log("Employees:", empRes.rows);
  process.exit(0);
}
run();
