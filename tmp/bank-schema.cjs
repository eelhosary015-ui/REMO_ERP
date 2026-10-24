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
  const tables = await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND (table_name LIKE 'bank%' OR table_name LIKE '%cheque%' OR table_name='banks')
     ORDER BY table_name`
  );
  console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));
  for (const name of ["bank_accounts", "bank_transactions", "banks", "bank_statements", "bank_statement_lines", "bank_payment_orders", "bank_fees", "bank_reconciliations", "bank_beneficiaries", "bank_branches", "bank_cheques"]) {
    const cols = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [name]
    );
    if (cols.rows.length) {
      console.log(`\n[${name}] ${cols.rows.map((r) => r.column_name).join(", ")}`);
      const cnt = await c.query(`SELECT COUNT(*)::int AS c FROM ${name}`);
      console.log(`  rows: ${cnt.rows[0].c}`);
    }
  }
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
