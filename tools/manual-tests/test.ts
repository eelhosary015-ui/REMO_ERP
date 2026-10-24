import { pool } from "./server-db.js";
async function run() {
  const res = await pool.query("SELECT * FROM hr_job_postings");
  console.log(res.rows);
  process.exit(0);
}
run();
