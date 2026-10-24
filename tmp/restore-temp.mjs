import pg from "pg";
import bcrypt from "bcryptjs";
const TEMP = "Remo-Temp-2026#1";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
await c.query("UPDATE users SET password=$1, must_change_password=true WHERE username='admin'", [bcrypt.hashSync(TEMP, 10)]);
const r = await c.query("SELECT username, must_change_password, length(password) len FROM users ORDER BY id");
console.log(JSON.stringify(r.rows));
await c.end();
