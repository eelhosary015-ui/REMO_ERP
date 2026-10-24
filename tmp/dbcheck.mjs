import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const t = await c.query("select to_regclass('public.material_requests') as t, to_regclass('public.material_request_items') as i");
console.log("tables", t.rows);
const cols = await c.query("select column_name, data_type from information_schema.columns where table_name='material_requests' order by ordinal_position");
console.log("cols", cols.rows.map(r => r.column_name).join(", "));
const icols = await c.query("select column_name from information_schema.columns where table_name='material_request_items' order by ordinal_position");
console.log("icols", icols.rows.map(r => r.column_name).join(", "));
try {
  const n = await c.query("select count(*)::int as c from material_requests");
  console.log("count", n.rows[0]);
} catch (e) { console.log("count err", e.message); }
await c.end();
