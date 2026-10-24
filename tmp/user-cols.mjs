import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
console.log("users:", r.rows.map(x=>x.column_name).join(", "));
await c.end();
