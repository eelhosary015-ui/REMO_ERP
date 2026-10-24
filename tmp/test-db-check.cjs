const fs = require("fs");
const { Client } = require("pg");
const t = fs.readFileSync(".env", "utf8");
let base = "";
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
base = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system2_test");
(async () => {
  const c = new Client({ connectionString: base });
  await c.connect();
  for (const table of ["accounts", "account_config", "treasury_accounts", "bank_accounts", "bank_transactions", "journal_entries", "users", "financial_periods"]) {
    const r = await c.query("SELECT to_regclass($1) AS t", [`public.${table}`]);
    const exists = r.rows[0].t;
    let count = "-";
    if (exists) {
      count = (await c.query(`SELECT COUNT(*)::int AS c FROM ${table}`)).rows[0].c;
    }
    console.log(`${table}: ${exists ? "yes" : "NO"} rows=${count}`);
  }
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
