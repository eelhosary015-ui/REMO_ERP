const fs = require("fs");
const { Client } = require("pg");
const t = fs.readFileSync(".env", "utf8");
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system2_test");
(async () => {
  const c = new Client({ connectionString: db });
  await c.connect();
  const cols = await c.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log(cols.rows.map((r) => `${r.column_name}${r.is_nullable === "NO" ? "*" : ""}`).join(", "));
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
