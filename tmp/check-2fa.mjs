import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
try {
  const r = await c.query("SELECT count(*)::int n FROM user_2fa");
  console.log("user_2fa rows:", r.rows[0].n);
} catch (e) { console.log("user_2fa:", e.message); }
await c.end();
