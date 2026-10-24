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
  for (const name of ["treasury_accounts", "treasury_transactions", "accounts", "journal_entries", "journal_items", "bank_module_settings", "financial_transactions"]) {
    const cols = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [name]
    );
    const cnt = await c.query(`SELECT COUNT(*)::int AS c FROM ${name}`);
    console.log(`\n[${name}] rows=${cnt.rows[0].c}\n  ${cols.rows.map((r) => r.column_name).join(", ")}`);
  }
  const ta = await c.query("SELECT id,name,type,current_balance,branch_id FROM treasury_accounts ORDER BY id");
  console.log("\ntreasury_accounts:", JSON.stringify(ta.rows));
  const gl = await c.query("SELECT id,code,name,type,balance FROM accounts WHERE type ILIKE '%bank%' OR name ILIKE '%بنك%' OR code LIKE '11%' ORDER BY id LIMIT 30").catch((e) => ({ rows: [{ error: e.message }] }));
  console.log("gl accounts:", JSON.stringify(gl.rows));
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
