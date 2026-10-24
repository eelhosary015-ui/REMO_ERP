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
  for (const name of ["bank_checks", "bank_transfers", "bank_reconciliations", "bank_reconciliation_items", "bank_interest_entries", "bank_fees", "bank_transaction_categories", "bank_accounts_ext", "bank_transactions_ext", "bank_account_limits", "bank_facilities", "bank_recurring_payments", "bank_account_types", "bank_audit_log"]) {
    const cols = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [name]
    );
    if (cols.rows.length) console.log(`[${name}] ${cols.rows.map((r) => r.column_name).join(", ")}`);
    else console.log(`[${name}] MISSING`);
  }
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
