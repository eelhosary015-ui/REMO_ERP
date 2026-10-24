import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
console.log("=== العملاء: فواتير vs تحصيلات ===");
for (const r of await q(`
  SELECT cu.id, cu.name,
    (SELECT COALESCE(SUM(net_amount - COALESCE(paid_amount,0)),0) FROM sales_invoices si WHERE si.customer_id=cu.id AND COALESCE(si.status,'') NOT IN ('cancelled','canceled','draft','ملغاة','مسودة'))::numeric open_inv,
    (SELECT COALESCE(SUM(amount),0) FROM treasury_transactions tt WHERE tt.customer_id=cu.id AND tt.amount > 0)::numeric receipts,
    (SELECT COALESCE(SUM(ABS(amount)),0) FROM treasury_transactions tt WHERE tt.customer_id=cu.id AND tt.amount < 0)::numeric payments
  FROM customers cu ORDER BY cu.id`))
  console.log(`  #${r.id} ${r.name}: فواتير مفتوحة=${r.open_inv} | تحصيلات=${r.receipts} | مدفوعات=${r.payments}`);
await c.end();
