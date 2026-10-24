import { pool } from "./server-db.js";
async function main() {
  const res = await pool.query("SELECT MIN(timestamp) as min_ts FROM fingerprint_logs");
  console.log("Earliest log in DB:", res.rows[0]);
  
  const res2 = await pool.query("SELECT COUNT(*) FROM fingerprint_logs WHERE employee_id = 4 AND timestamp < '2026-08-08'");
  console.log("Employee 4 logs before Aug 8:", res2.rows[0]);

  await pool.end();
}
main();
