import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  const r = await pool.query("SELECT id, code, name FROM cost_centers ORDER BY code ASC LIMIT 20");
  console.log(JSON.stringify({ count: r.rowCount, rows: r.rows }, null, 1));
} catch (e) {
  console.log("ERR", e.message);
} finally { await pool.end(); }
