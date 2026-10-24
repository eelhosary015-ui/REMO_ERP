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
  await c.query("BEGIN");
  const accountIds = (await c.query("SELECT id FROM bank_accounts WHERE name LIKE 'TEST-BANK-%'")).rows.map((r) => r.id);
  const treasuryIds = (await c.query("SELECT id FROM treasury_accounts WHERE name LIKE 'TEST-BANK-%'")).rows.map((r) => r.id);
  console.log("test accounts:", accountIds, "treasury:", treasuryIds);

  await c.query("DELETE FROM bank_statement_lines WHERE statement_id IN (SELECT id FROM bank_statements)");
  await c.query("DELETE FROM bank_statements");
  await c.query("DELETE FROM bank_checks");
  await c.query("DELETE FROM bank_transfers");
  await c.query("DELETE FROM bank_transactions");
  if (treasuryIds.length) {
    await c.query("DELETE FROM treasury_transactions WHERE account_id = ANY($1::int[])", [treasuryIds]);
  }
  await c.query("DELETE FROM bank_accounts WHERE name LIKE 'TEST-BANK-%'");
  await c.query("DELETE FROM treasury_accounts WHERE name LIKE 'TEST-BANK-%'");

  await c.query("DELETE FROM journal_items WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE source_type LIKE 'bank_%')");
  await c.query("DELETE FROM journal_entries WHERE source_type LIKE 'bank_%'");
  await c.query(
    "UPDATE accounts a SET balance = COALESCE((SELECT SUM(ji.debit - ji.credit) FROM journal_items ji WHERE ji.account_id = a.id), 0)"
  );
  await c.query(
    "DELETE FROM accounts WHERE code LIKE '1120%' AND LENGTH(code) > 4 AND NOT EXISTS (SELECT 1 FROM journal_items ji WHERE ji.account_id = accounts.id) AND NOT EXISTS (SELECT 1 FROM bank_accounts ba WHERE ba.gl_account_id = accounts.id)"
  );
  await c.query("DELETE FROM users WHERE username = 'banktest'");
  await c.query("COMMIT");

  const counts = await c.query(`SELECT
    (SELECT COUNT(*)::int FROM bank_accounts) AS bank_accounts,
    (SELECT COUNT(*)::int FROM bank_transactions) AS bank_tx,
    (SELECT COUNT(*)::int FROM bank_statements) AS statements,
    (SELECT COUNT(*)::int FROM bank_checks) AS cheques,
    (SELECT COUNT(*)::int FROM journal_entries) AS journals,
    (SELECT COUNT(*)::int FROM users WHERE username='banktest') AS users`);
  console.log("after cleanup:", JSON.stringify(counts.rows[0]));
  await c.end();
})().catch(async (e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
