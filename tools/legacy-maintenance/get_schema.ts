import { pool } from "./server-db.js";
async function run() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'fingerprint_devices'");
  console.log(res.rows.map(r => r.column_name));
}
run();
