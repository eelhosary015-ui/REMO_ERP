import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const rows = (await c.query(`
WITH movements AS (
  SELECT 'sale' AS doc_type, si.id, si.invoice_no AS doc_no, si.date::date AS doc_date,
         COALESCE(si.customer_name,'-') AS party,
         COALESCE(si.net_amount,0) - COALESCE(si.tax_total,0) AS base_amount,
         COALESCE(si.tax_total,0) AS tax_amount,
         si.journal_entry_id AS entry_id, si.status AS doc_status, si.branch_id
    FROM sales_invoices si WHERE COALESCE(si.status,'') NOT IN ('ملغي','cancelled','canceled')
  UNION ALL
  SELECT 'purchase', p.id, p.invoice_number, p.date::date, COALESCE(s.name,'-'),
         COALESCE(p.subtotal, COALESCE(p.total_amount,0) - COALESCE(p.tax_amount,0)),
         COALESCE(p.tax_amount,0), p.posted_journal_entry_id, p.status, p.branch_id
    FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
  UNION ALL
  SELECT 'sale_return', sr.id, COALESCE(sr.invoice_no,'SR-'||sr.id), sr.date::date, '-',
         COALESCE(sr.items_total, COALESCE(sr.grand_total,0)-COALESCE(sr.tax_total,0)),
         COALESCE(sr.tax_total,0), NULL, 'مرتجع', NULL
    FROM sales_returns sr
  UNION ALL
  SELECT 'purchase_return', pr.id, pr.return_number, pr.return_date::date, '-',
         COALESCE(pr.subtotal, COALESCE(pr.total_amount,0)-COALESCE(pr.tax_amount,0)),
         COALESCE(pr.tax_amount,0), NULL, pr.status, NULL
    FROM purchase_returns pr
)
SELECT doc_type, count(*)::int n, sum(tax_amount)::numeric tax, sum(base_amount)::numeric base
FROM movements WHERE doc_date BETWEEN '2000-01-01' AND '2100-12-31' GROUP BY 1 ORDER BY 1`)).rows;
console.table(rows);
const gl = (await c.query(`select a.code, a.name_ar,
  sum(case when a.id=12 then ji.credit-ji.debit else ji.debit-ji.credit end)::numeric net
 from journal_items ji join journal_entries je on je.id=ji.journal_entry_id join accounts a on a.id=ji.account_id
 where je.status='posted' and a.id in (12,3) group by 1,2`)).rows;
console.table(gl);
await c.end();
