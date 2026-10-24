import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='employees' ORDER BY ordinal_position");
console.log("employees:", r.rows.map(x=>x.column_name).join(", "));
const s = await c.query("SELECT count(*)::int n FROM payroll");
console.log("payroll rows:", s.rows[0].n);
await c.end();
