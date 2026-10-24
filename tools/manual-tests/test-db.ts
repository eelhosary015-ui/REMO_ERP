import { pool } from './server-db.js';
async function run() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'production_boms'");
    console.log("production_boms:", res.rows);
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bom_items'");
    console.log("bom_items:", res2.rows);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
run();
