import pg from "pg";
import bcrypt from "bcryptjs";
const TEMP = "Remo-Temp-2026#1";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const hash = bcrypt.hashSync(TEMP, 10);
const r = await c.query(
  "UPDATE users SET password = $1, must_change_password = true WHERE username = 'admin' RETURNING id, username, must_change_password",
  [hash]
);
console.log("updated:", JSON.stringify(r.rows));
const check = await c.query("SELECT password FROM users WHERE username='admin'");
console.log("hash valid bcrypt:", bcrypt.compareSync(TEMP, check.rows[0].password));
await c.end();
console.log("TEMP_PASSWORD=" + TEMP);
