import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2' });

// Check purchase tax_rate bug - should be 14% but showing 0
async function main() {
  const q = await pool.query(`SELECT id, invoice_number, subtotal, tax_amount, tax_rate, ROUND(tax_amount/NULLIF(subtotal,0)*100, 2) as computed_rate FROM purchases`);
  console.log('Purchases tax rates:', q.rows);

  // Test with corrected tax_rate calculation using NULLIF
  console.log('\n--- Summary on erp_system2 ---');
  const r = await pool.query(`
    WITH m AS (
      SELECT 'sale' AS doc_type, COALESCE(tax_total,0) AS tax_amount,
        journal_entry_id IS NOT NULL AS has_je
      FROM sales_invoices WHERE status NOT IN ('ملغاة','ملغي','cancelled','canceled')
      UNION ALL
      SELECT 'purchase', COALESCE(tax_amount,0),
        posted_journal_entry_id IS NOT NULL OR invoice_status = 'posted' OR EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_type='purchase' AND je.source_id=purchases.id) 
      FROM purchases WHERE status NOT IN ('ملغي','ملغاة','cancelled','canceled')
      UNION ALL
      SELECT 'sale_return', COALESCE(tax_total,0), journal_entry_id IS NOT NULL FROM sales_returns WHERE status NOT IN ('ملغى','cancelled')
      UNION ALL
      SELECT 'purchase_return', COALESCE(tax_amount,0), status IN ('approved','معتمد') FROM purchase_returns WHERE status NOT IN ('ملغي','rejected','cancelled')
    )
    SELECT doc_type, COUNT(*) cnt, SUM(tax_amount) total_tax, SUM(CASE WHEN has_je THEN tax_amount ELSE 0 END) posted_tax FROM m GROUP BY 1 ORDER BY 1
  `);
  console.log(r.rows);
  
  // GL account balances
  const g = await pool.query(`
    SELECT a.id, a.code, a.name, 
      SUM(CASE WHEN je.status='posted' THEN ji.credit ELSE 0 END) total_credit,
      SUM(CASE WHEN je.status='posted' THEN ji.debit ELSE 0 END) total_debit
    FROM journal_items ji
    JOIN journal_entries je ON je.id=ji.journal_entry_id
    JOIN accounts a ON a.id=ji.account_id
    WHERE a.id IN (19, 24)
    GROUP BY 1,2,3
  `);
  console.log('GL balances for tax accounts:', g.rows);
  await pool.end();
}
main();
