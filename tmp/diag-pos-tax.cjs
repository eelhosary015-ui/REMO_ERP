// Read-only diagnostics: how POS orders store discount / tax, and what the
// journal entry for the latest POS sale looks like.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const out = {};

  out.columns = (await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name IN
       ('total','discount','tax_amount','service_charge','discount_amount','subtotal','paid_amount')
     ORDER BY column_name`)).rows;

  out.latestOrders = (await pool.query(`
    SELECT id, timestamp, daily_number, total, discount, tax_amount, service_charge,
           payment_method, branch_id
      FROM orders
     ORDER BY id DESC LIMIT 12`)).rows;

  out.taxProducts = (await pool.query(`
    SELECT id, name, price, cost, tax_rate, stock
      FROM products
     WHERE tax_rate IS NOT NULL AND tax_rate > 0
     ORDER BY id DESC LIMIT 12`)).rows;

  out.latestEntries = (await pool.query(`
    SELECT id, entry_number, source_type, source_id, description, total_debit, total_credit, date
      FROM journal_entries
     WHERE source_type IN ('pos','sales','restaurant')
     ORDER BY id DESC LIMIT 6`)).rows;

  if (out.latestEntries.length) {
    const ids = out.latestEntries.map((e) => e.id);
    out.entryLines = (await pool.query(`
      SELECT ji.journal_entry_id, ji.account_id, a.name AS account_name, ji.debit, ji.credit, ji.notes
        FROM journal_items ji
        LEFT JOIN accounts a ON a.id = ji.account_id
       WHERE ji.journal_entry_id = ANY($1::int[])
       ORDER BY ji.journal_entry_id DESC, ji.id`, [ids])).rows;
  }

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => { console.error("ERR", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
