import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='account_config' ORDER BY ordinal_position");
console.log("account_config:", cols.rows.map(r=>`${r.column_name}:${r.data_type}`).join(", "));
const rows = await c.query("SELECT * FROM account_config ORDER BY key LIMIT 60");
for (const r of rows.rows) console.log(JSON.stringify(r));
await c.end();
