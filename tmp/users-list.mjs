import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system4" });
await c.connect();
const r = await c.query("SELECT id, username, role_id FROM users ORDER BY id");
console.log(JSON.stringify(r.rows));
await c.end();
