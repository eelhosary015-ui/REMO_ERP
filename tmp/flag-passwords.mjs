import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const r = await c.query("UPDATE users SET must_change_password = true WHERE username IN ('admin','elhosary') RETURNING id, username, must_change_password");
console.log("flagged:", JSON.stringify(r.rows));
await c.end();
