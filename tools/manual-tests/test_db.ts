import { pool } from "./server-db.js";
async function run() {
  const res = await pool.query("SELECT * FROM attendance");
  console.log("attendance:", res.rows);
}
run();
