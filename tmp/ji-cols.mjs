import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='journal_items' ORDER BY ordinal_position");
console.log("journal_items columns:", cols.rows.map(r=>r.column_name).join(", "));
await c.end();
