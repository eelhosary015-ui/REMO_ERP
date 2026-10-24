import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const tables = ["inventory_items", "stock_reservations", "inventory_transactions", "ingredients", "inventory_movements"];
for (const t of tables) {
  const ex = await c.query("select to_regclass('public.'||$1) as t", [t]);
  if (!ex.rows[0].t) { console.log("MISSING TABLE:", t); continue; }
  const cols = await c.query("select column_name from information_schema.columns where table_name=$1 order by ordinal_position", [t]);
  console.log(t, "=>", cols.rows.map(r => r.column_name).join(", "));
  const n = await c.query(`select count(*)::int as c from ${t}`);
  console.log("   rows:", n.rows[0].c);
}
const cons = await c.query("select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.material_requests'::regclass");
console.log("constraints:", cons.rows.map(r => r.def).join(" | "));
await c.end();
