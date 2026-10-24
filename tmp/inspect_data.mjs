import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2' });

async function main() {
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM sales_invoices) as sales_count,
      (SELECT COUNT(*) FROM purchases) as purchases_count,
      (SELECT COUNT(*) FROM sales_returns) as sales_returns_count,
      (SELECT COUNT(*) FROM purchase_returns) as purchase_returns_count,
      (SELECT COUNT(*) FROM journal_entries) as je_count,
      (SELECT COUNT(*) FROM journal_items) as ji_count
  `);
  console.log('Record counts in erp_system2:', counts.rows[0]);

  const salesSample = await pool.query(`SELECT id, invoice_no, customer_name, status, is_posted, journal_entry_id, net_amount, tax_total FROM sales_invoices LIMIT 5`);
  console.log('Sales invoices sample:', salesSample.rows);

  const purchaseSample = await pool.query(`SELECT id, invoice_number, supplier_invoice_number, status, invoice_status, posted_journal_entry_id, total_amount, subtotal, tax_amount FROM purchases LIMIT 5`);
  console.log('Purchases sample:', purchaseSample.rows);

  const jeSample = await pool.query(`SELECT id, source_type, source_id, reference, status, total_debit, total_credit FROM journal_entries WHERE source_type IN ('sales', 'purchase', 'sales_return', 'purchase_return') LIMIT 10`);
  console.log('Journal entries sample for sales/purchases/returns:', jeSample.rows);

  await pool.end();
}
main();
