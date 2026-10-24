import { pool } from "./server-db.js";

async function main() {
  const empId = 4;
  const resAtt = await pool.query(`SELECT * FROM fingerprint_logs WHERE employee_id = $1 ORDER BY timestamp DESC LIMIT 20`, [empId]);
  console.log("Logs:", resAtt.rows);
  await pool.end();
}
main();
