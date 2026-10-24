import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%workflow%'");
console.log("workflow tables:", t.rows.map(r=>r.table_name).join(", ") || "(none)");
const inv = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('inventory_items','ingredients')");
console.log("inventory tables:", inv.rows.map(r=>r.table_name).join(", "));
await c.end();
