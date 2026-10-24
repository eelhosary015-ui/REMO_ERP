import { pool } from "./server-db.js";
async function run() {
  const res = await pool.query("SELECT * FROM attendance ORDER BY date DESC LIMIT 5");
  console.log("attendance length:", res.rows.length);
  console.log(res.rows);
  process.exit(0);
}
run();
