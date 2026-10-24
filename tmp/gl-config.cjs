const fs = require("fs");
const { Client } = require("pg");
const t = fs.readFileSync(".env", "utf8");
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const cfg = await c.query("SELECT key, account_id FROM account_config ORDER BY key");
  console.log("config:", JSON.stringify(cfg.rows));
  const a = await c.query(
    "SELECT id,code,name,account_nature,account_type,balance FROM accounts WHERE code IN ('111','112','113') OR id IN (SELECT account_id FROM account_config WHERE key IN ('cash','bank','other_income','other_expense')) ORDER BY id"
  );
  console.log("accounts:", JSON.stringify(a.rows));
  const p = await c.query("SELECT * FROM financial_periods ORDER BY id DESC LIMIT 3").catch((e) => ({ rows: [{ error: e.message }] }));
  console.log("periods:", JSON.stringify(p.rows));
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
