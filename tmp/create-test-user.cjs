const fs = require("fs");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const t = fs.readFileSync(".env", "utf8");
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system2_test");
(async () => {
  const c = new Client({ connectionString: db });
  await c.connect();
  const hash = await bcrypt.hash("BankTest@1234", 10);
  await c.query("DELETE FROM users WHERE username = 'banktest'");
  const r = await c.query(
    `INSERT INTO users (username, password, role, permissions, must_change_password, status)
     VALUES ('banktest', $1, 'admin', '{"all":true}', false, 'active') RETURNING id, username, role`,
    [hash]
  );
  console.log("created:", JSON.stringify(r.rows[0]));
  const res = await fetch("http://127.0.0.1:3010/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "banktest", password: "BankTest@1234" }),
  });
  const body = await res.json().catch(() => null);
  console.log("login HTTP", res.status, "token?", !!body?.token, "user:", body?.user?.username);
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
