import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='workflow_definitions' ORDER BY ordinal_position");
console.log(r.rows.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
const n = await c.query("SELECT count(*)::int n FROM workflow_definitions");
console.log("rows:", n.rows[0].n);
await c.end();
