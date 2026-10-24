// Read-only diagnostics part 2: order lines + sales invoices + their entries.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function tryQuery(label, sql, params) {
  try {
    return { label, rows: (await pool.query(sql, params)).rows };
  } catch (e) {
    return { label, error: e.message };
  }
}

async function main() {
  const results = [];
  results.push(await tryQuery("order_items_latest", `
    SELECT oi.order_id, oi.product_id, p.name, oi.quantity, oi.price,
           (oi.quantity * oi.price) AS line_gross, o.total, o.tax_amount, o.discount
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
     ORDER BY oi.order_id DESC, oi.id DESC LIMIT 15`));

  results.push(await tryQuery("sales_invoice_tables", `
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND (table_name LIKE '%invoice%' OR table_name LIKE '%sales%')
     ORDER BY table_name`));

  results.push(await tryQuery("sales_invoices_latest", `
    SELECT * FROM sales_invoices ORDER BY id DESC LIMIT 5`));

  results.push(await tryQuery("journal_recent_all", `
    SELECT id, source_type, source_id, description, total_debit, total_credit, date
      FROM journal_entries ORDER BY id DESC LIMIT 10`));

  results.push(await tryQuery("discount_account_usage", `
    SELECT je.id, je.source_type, je.source_id, a.name AS account, ji.debit, ji.credit
      FROM journal_items ji
      JOIN journal_entries je ON je.id = ji.journal_entry_id
      LEFT JOIN accounts a ON a.id = ji.account_id
     WHERE ji.notes ILIKE '%خصم%'
     ORDER BY je.id DESC LIMIT 20`));

  for (const r of results) {
    console.log("=== " + r.label + " ===");
    console.log(r.error ? "ERROR: " + r.error : JSON.stringify(r.rows, null, 1));
  }
}

main()
  .catch((e) => { console.error("ERR", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
