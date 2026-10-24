import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const params = ["2026-10-01", "2026-10-21"];
const queries = {
  monthly: `SELECT TO_CHAR(d::date,'YYYY-MM') month,
        COALESCE((SELECT SUM(p.total_amount) FROM purchases p WHERE p.date::date >= d::date AND p.date::date < (d::date + INTERVAL '1 month') AND p.date::date BETWEEN $1::date AND $2::date),0) purchases,
        COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.type='payment' AND st.timestamp::date >= d::date AND st.timestamp::date < (d::date + INTERVAL '1 month') AND st.timestamp::date BETWEEN $1::date AND $2::date),0) payments,
        COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.return_date >= d::date AND pr.return_date < (d::date + INTERVAL '1 month') AND pr.return_date BETWEEN $1::date AND $2::date),0) returns
        FROM generate_series(date_trunc('month',$1::date),date_trunc('month',$2::date),'1 month') d ORDER BY d`,
  payments: `SELECT COALESCE(st.payment_method,'cash') payment_method, COUNT(*) count, COALESCE(SUM(st.amount),0) amount
        FROM supplier_transactions st WHERE st.type='payment' AND st.timestamp::date BETWEEN $1::date AND $2::date GROUP BY COALESCE(st.payment_method,'cash') ORDER BY amount DESC`,
  returns: `SELECT pr.id,pr.return_number,pr.return_date,pr.total_amount,pr.status,s.name supplier_name,p.invoice_number
        FROM purchase_returns pr LEFT JOIN suppliers s ON s.id=pr.supplier_id LEFT JOIN purchases p ON p.id=pr.purchase_id
        WHERE pr.return_date BETWEEN $1::date AND $2::date ORDER BY pr.return_date DESC,pr.id DESC LIMIT 10`,
  top: `SELECT s.id,s.supplier_code,s.name,s.name_en,s.status,s.rating,s.balance,
        COALESCE(SUM(p.total_amount),0) total_purchases,COUNT(p.id) purchase_count,
        COALESCE(SUM(p.paid_amount),0) paid_amount
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date BETWEEN $1::date AND $2::date
        GROUP BY s.id ORDER BY total_purchases DESC LIMIT 10`,
  overdue: `SELECT s.id,s.supplier_code,s.name,s.name_en,s.balance,s.credit_limit,
        COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) outstanding
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date <= $2::date
        GROUP BY s.id ORDER BY outstanding DESC LIMIT 10`,
  performance: `SELECT s.id,s.supplier_code,s.name,s.name_en,ROUND(AVG(se.overall_score),2) overall_score,COUNT(se.id) evaluations
        FROM suppliers s JOIN supplier_evaluations se ON se.supplier_id=s.id
        WHERE se.evaluation_date BETWEEN $1::date AND $2::date GROUP BY s.id ORDER BY overall_score DESC LIMIT 10`,
  prices: `SELECT i.id,i.name ingredient_name,p.supplier_id,s.name supplier_name,
        ROUND(AVG(pi.unit_price),2) avg_price,MAX(p.date) last_purchase_date
        FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id JOIN suppliers s ON s.id=p.supplier_id
        LEFT JOIN ingredients i ON i.id=pi.ingredient_id
        WHERE p.date::date BETWEEN $1::date AND $2::date GROUP BY i.id,i.name,p.supplier_id,s.name ORDER BY last_purchase_date DESC LIMIT 10`,
};
for (const [k, sql] of Object.entries(queries)) {
  try { await c.query(sql, params); console.log("✓", k); }
  catch (e) { console.log("✗", k, "→", e.message); }
}
await c.end();
