const fs = require("fs");
const { Client } = require("pg");
const t = fs.readFileSync(".env", "utf8");
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
(async () => {
  const u = new URL(process.env.DATABASE_URL);
  console.log("db:", u.pathname);
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
  console.log("databases:", r.rows.map((x) => x.datname).join(", "));
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
