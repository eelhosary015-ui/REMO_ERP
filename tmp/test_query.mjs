import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2' });

async function main() {
  const q = `
    WITH movements AS (
      SELECT 
        'sale' AS doc_type, 
        si.id, 
        si.invoice_no AS doc_no, 
        NULL::text AS supplier_invoice_number,
        NULL::text AS original_doc_no,
        NULL::integer AS original_doc_id,
        si.date::date AS doc_date,
        COALESCE(si.customer_name, '-') AS party,
        si.customer_id AS party_id,
        COALESCE(si.subtotal, COALESCE(si.net_amount,0) - COALESCE(si.tax_total,0)) AS base_amount,
        COALESCE(si.tax_total, 0) AS tax_amount,
        COALESCE(si.net_amount, 0) AS total_amount,
        CASE 
          WHEN COALESCE(si.subtotal, COALESCE(si.net_amount,0) - COALESCE(si.tax_total,0)) > 0 
          THEN ROUND((COALESCE(si.tax_total,0) / COALESCE(si.subtotal, COALESCE(si.net_amount,0) - COALESCE(si.tax_total,0)) * 100)::numeric, 2)
          ELSE 14.00 
        END AS tax_rate,
        COALESCE(si.journal_entry_id, (SELECT je.id FROM journal_entries je WHERE je.source_type IN ('sales', 'SALES_INVOICE') AND je.source_id = si.id AND je.status = 'posted' LIMIT 1)) AS entry_id,
        (SELECT je.reference FROM journal_entries je WHERE je.id = COALESCE(si.journal_entry_id, (SELECT j2.id FROM journal_entries j2 WHERE j2.source_type IN ('sales', 'SALES_INVOICE') AND j2.source_id = si.id AND j2.status = 'posted' LIMIT 1))) AS entry_number,
        si.status AS doc_status, 
        si.branch_id,
        (si.is_posted = true OR si.journal_entry_id IS NOT NULL OR EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_type IN ('sales', 'SALES_INVOICE') AND je.source_id = si.id AND je.status = 'posted')) AS is_posted,
        true AS is_deductible,
        CASE 
          WHEN si.status IN ('ملغاة', 'ملغي', 'cancelled', 'canceled') THEN 'فاتورة ملغاة'
          WHEN NOT (si.is_posted = true OR si.journal_entry_id IS NOT NULL OR EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_type IN ('sales', 'SALES_INVOICE') AND je.source_id = si.id AND je.status = 'posted')) THEN 'فاتورة مسودة / غير مرحلة إلى الأستاذ'
          ELSE NULL
        END AS exclusion_reason
      FROM sales_invoices si
      WHERE COALESCE(si.status,'') NOT IN ('ملغي','ملغاة','cancelled','canceled')

      UNION ALL

      SELECT 
        'purchase' AS doc_type, 
        p.id, 
        p.invoice_number AS doc_no, 
        COALESCE(p.supplier_invoice_number, p.invoice_number) AS supplier_invoice_number,
        NULL::text AS original_doc_no,
        NULL::integer AS original_doc_id,
        p.date::date AS doc_date, 
        COALESCE(s.name, '-') AS party,
        p.supplier_id AS party_id,
        COALESCE(p.subtotal, COALESCE(p.total_amount,0) - COALESCE(p.tax_amount,0)) AS base_amount,
        COALESCE(p.tax_amount, 0) AS tax_amount,
        COALESCE(p.total_amount, 0) AS total_amount,
        COALESCE(p.tax_rate, CASE 
          WHEN COALESCE(p.subtotal, COALESCE(p.total_amount,0) - COALESCE(p.tax_amount,0)) > 0 
          THEN ROUND((COALESCE(p.tax_amount,0) / COALESCE(p.subtotal, COALESCE(p.total_amount,0) - COALESCE(p.tax_amount,0)) * 100)::numeric, 2)
          ELSE 14.00 
        END) AS tax_rate,
        COALESCE(p.posted_journal_entry_id, (SELECT je.id FROM journal_entries je WHERE je.source_type = 'purchase' AND je.source_id = p.id AND je.status = 'posted' LIMIT 1)) AS entry_id,
        (SELECT je.reference FROM journal_entries je WHERE je.id = COALESCE(p.posted_journal_entry_id, (SELECT j2.id FROM journal_entries j2 WHERE j2.source_type = 'purchase' AND j2.source_id = p.id AND j2.status = 'posted' LIMIT 1))) AS entry_number,
        COALESCE(p.invoice_status, p.status) AS doc_status, 
        p.branch_id,
        (p.posted_journal_entry_id IS NOT NULL OR p.invoice_status = 'posted' OR EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_type = 'purchase' AND je.source_id = p.id AND je.status = 'posted')) AS is_posted,
        (COALESCE(p.tax_borne_by, '') NOT IN ('non_deductible', 'غير_مسترد', 'exempt') AND COALESCE(p.tax_amount,0) > 0) AS is_deductible,
        CASE 
          WHEN p.status IN ('ملغاة', 'ملغي', 'cancelled', 'canceled') THEN 'فاتورة ملغاة'
          WHEN NOT (p.posted_journal_entry_id IS NOT NULL OR p.invoice_status = 'posted' OR EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_type = 'purchase' AND je.source_id = p.id AND je.status = 'posted')) THEN 'فاتورة شراء غير مرحلة إلى الأستاذ'
          WHEN COALESCE(p.tax_borne_by, '') IN ('non_deductible', 'غير_مسترد', 'exempt') THEN 'ضريبة مدخلات غير قابلة للخصم (معفاة أو محملة على التكلفة)'
          ELSE NULL
        END AS exclusion_reason
      FROM purchases p 
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE COALESCE(p.status,'') NOT IN ('ملغي','ملغاة','cancelled','canceled')

      UNION ALL

      SELECT 
        'sale_return' AS doc_type, 
        sr.id, 
        COALESCE(sr.return_no, 'SR-' || sr.id) AS doc_no, 
        NULL::text AS supplier_invoice_number,
        COALESCE(sr.invoice_no, (SELECT si.invoice_no FROM sales_invoices si WHERE si.id::text = sr.invoice_id::text)) AS original_doc_no,
        CASE WHEN sr.invoice_id ~ '^[0-9]+$' THEN sr.invoice_id::integer ELSE NULL END AS original_doc_id,
        sr.date::date AS doc_date, 
        COALESCE(sr.customer_name, (SELECT c.name FROM customers c WHERE c.id = sr.customer_id), '-') AS party,
        sr.customer_id AS party_id,
        COALESCE(sr.items_total, COALESCE(sr.grand_total,0) - COALESCE(sr.tax_total,0)) AS base_amount,
        COALESCE(sr.tax_total, 0) AS tax_amount,
        COALESCE(sr.grand_total, 0) AS total_amount,
        CASE 
          WHEN COALESCE(sr.items_total, COALESCE(sr.grand_total,0) - COALESCE(sr.tax_total,0)) > 0 
          THEN ROUND((COALESCE(sr.tax_total,0) / COALESCE(sr.items_total, COALESCE(sr.grand_total,0) - COALESCE(sr.tax_total,0)) * 100)::numeric, 2)
          ELSE 14.00 
        END AS tax_rate,
        COALESCE(sr.journal_entry_id, (SELECT je.id FROM journal_entries je WHERE je.source_type = 'sales_return' AND je.source_id = sr.id AND je.status = 'posted' LIMIT 1)) AS entry_id,
        (SELECT je.reference FROM journal_entries je WHERE je.id = COALESCE(sr.journal_entry_id, (SELECT j2.id FROM journal_entries j2 WHERE j2.source_type = 'sales_return' AND j2.source_id = sr.id AND j2.status = 'posted' LIMIT 1))) AS entry_number,
        COALESCE(sr.status, 'approved') AS doc_status, 
        sr.branch_id,
        (sr.journal_entry_id IS NOT NULL OR sr.status IN ('approved', 'معتمد', 'completed')) AS is_posted,
        true AS is_deductible,
        CASE 
          WHEN sr.status IN ('ملغى', 'ملغي', 'cancelled') THEN 'مرتجع ملغي'
          WHEN sr.status IN ('draft', 'مسودة') THEN 'مرتجع مسودة غير معتمد'
          ELSE NULL
        END AS exclusion_reason
      FROM sales_returns sr
      WHERE COALESCE(sr.status,'') NOT IN ('ملغي','ملغى','cancelled','canceled')

      UNION ALL

      SELECT 
        'purchase_return' AS doc_type, 
        pr.id, 
        COALESCE(pr.return_number, 'PR-' || pr.id) AS doc_no, 
        (SELECT COALESCE(p.supplier_invoice_number, p.invoice_number) FROM purchases p WHERE p.id = pr.purchase_id) AS supplier_invoice_number,
        (SELECT COALESCE(p.supplier_invoice_number, p.invoice_number) FROM purchases p WHERE p.id = pr.purchase_id) AS original_doc_no,
        pr.purchase_id AS original_doc_id,
        pr.return_date::date AS doc_date, 
        COALESCE(s.name, '-') AS party,
        pr.supplier_id AS party_id,
        COALESCE(pr.subtotal, COALESCE(pr.total_amount,0) - COALESCE(pr.tax_amount,0)) AS base_amount,
        COALESCE(pr.tax_amount, 0) AS tax_amount,
        COALESCE(pr.total_amount, 0) AS total_amount,
        COALESCE(pr.tax_rate, CASE 
          WHEN COALESCE(pr.subtotal, COALESCE(pr.total_amount,0) - COALESCE(pr.tax_amount,0)) > 0 
          THEN ROUND((COALESCE(pr.tax_amount,0) / COALESCE(pr.subtotal, COALESCE(pr.total_amount,0) - COALESCE(pr.tax_amount,0)) * 100)::numeric, 2)
          ELSE 14.00 
        END) AS tax_rate,
        (SELECT je.id FROM journal_entries je WHERE je.source_type = 'purchase_return' AND je.source_id = pr.id AND je.status = 'posted' LIMIT 1) AS entry_id,
        (SELECT je.reference FROM journal_entries je WHERE je.source_type = 'purchase_return' AND je.source_id = pr.id AND je.status = 'posted' LIMIT 1) AS entry_number,
        pr.status AS doc_status, 
        NULL::integer AS branch_id,
        (pr.stock_posted = true OR pr.status IN ('approved', 'معتمد') OR EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_type = 'purchase_return' AND je.source_id = pr.id AND je.status = 'posted')) AS is_posted,
        true AS is_deductible,
        CASE 
          WHEN pr.status IN ('ملغي', 'rejected', 'cancelled') THEN 'مرتجع ملغي / مرفوض'
          WHEN pr.status NOT IN ('approved', 'معتمد') THEN 'مرتجع شراء غير معتمد'
          ELSE NULL
        END AS exclusion_reason
      FROM purchase_returns pr
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE COALESCE(pr.status,'') NOT IN ('ملغي','rejected','cancelled','canceled')
    )
    SELECT * FROM movements
    WHERE doc_date BETWEEN '2026-01-01' AND '2026-12-31'
    ORDER BY doc_date DESC, id DESC
  `;
  const res = await pool.query(q);
  console.log('Query result count:', res.rows.length);
  console.log('Sample rows:', res.rows);
  await pool.end();
}
main();
