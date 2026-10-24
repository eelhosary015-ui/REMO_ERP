import { pool } from "./server-db.js";
async function run() {
  try {
    await pool.query("ALTER TABLE fingerprint_devices ADD COLUMN timezone_shift INTEGER DEFAULT 0");
    console.log("Added timezone_shift");
  } catch(e) {
    console.log(e.message);
  }
}
run();
