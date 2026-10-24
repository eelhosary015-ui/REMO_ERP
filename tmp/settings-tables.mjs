import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%setting%' OR table_name ILIKE '%warehouse_type%' OR table_name ILIKE '%transaction_type%'");
console.log(t.rows.map(r=>r.table_name).join(", "));
const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='settings'");
console.log("settings cols:", cols.rows.map(r=>r.column_name).join(", "));
await c.end();
