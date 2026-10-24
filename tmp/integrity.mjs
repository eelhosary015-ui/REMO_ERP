import pg from "pg";
const DB = process.env.DB || "erp_round2_test";
const c = new pg.Client({ connectionString: `postgres://postgres:Aa017217*@127.0.0.1:5432/${DB}` });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const section = (t) => console.log(`\n===== ${t} =====`);

section("1) قيود غير متوازنة (مدين ≠ دائن)");
console.log(await q(`
  SELECT je.id, je.date::date d, je.status, je.total_debit,
         COALESCE(SUM(ji.debit),0)::numeric dr, COALESCE(SUM(ji.credit),0)::numeric cr
    FROM journal_entries je LEFT JOIN journal_items ji ON ji.journal_entry_id = je.id
   GROUP BY je.id
  HAVING ABS(COALESCE(SUM(ji.debit),0) - COALESCE(SUM(ji.credit),0)) > 0.005
      OR ABS(je.total_debit - COALESCE(SUM(ji.debit),0)) > 0.005
  ORDER BY je.id LIMIT 20`));

section("2) بنود تشير إلى حسابات غير موجودة");
console.log(await q(`
  SELECT COUNT(*)::int n FROM journal_items ji
   WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = ji.account_id)`));

section("3) قيود بلا period_id");
console.log(await q(`SELECT COUNT(*)::int n FROM journal_entries WHERE period_id IS NULL`));
console.log(await q(`SELECT status, COUNT(*)::int n FROM journal_entries GROUP BY 1`));

section("4) فواتير بلا قيد / بلا بنود");
console.log("invoices no JE:", await q(`SELECT COUNT(*)::int n FROM sales_invoices WHERE journal_entry_id IS NULL AND COALESCE(status,'') NOT IN ('ملغاة','cancelled','canceled','draft')`));
console.log("invoices no items:", await q(`SELECT COUNT(*)::int n FROM sales_invoices si WHERE NOT EXISTS (SELECT 1 FROM sales_invoice_items i WHERE i.invoice_id=si.id) AND COALESCE(si.status,'') NOT IN ('ملغاة','cancelled')`));
console.log("invoice items w/o invoice:", await q(`SELECT COUNT(*)::int n FROM sales_invoice_items i WHERE NOT EXISTS (SELECT 1 FROM sales_invoices s WHERE s.id=i.invoice_id)`));

section("5) مبالغ مدفوعة أكبر من صافي الفاتورة");
console.log(await q(`SELECT id, invoice_no, net_amount, paid_amount FROM sales_invoices WHERE COALESCE(paid_amount,0) > COALESCE(net_amount,0) + 0.01 LIMIT 20`));

section("6) حركات خزينة بلا ترحيل (fin_number NULL)");
console.log(await q(`SELECT COUNT(*)::int n FROM treasury_transactions WHERE fin_number IS NULL`));
console.log(await q(`SELECT COUNT(*)::int n FROM treasury_transactions WHERE journal_entry_id IS NOT NULL`).catch(()=>"no col"));

section("7) مخزون سالب");
console.log(await q(`SELECT COUNT(*)::int n FROM inventory_items WHERE quantity < 0`));
console.log(await q(`SELECT id, warehouse_id, ingredient_id, quantity FROM inventory_items WHERE quantity < 0 LIMIT 10`));

section("8) تكرار أرقام المستندات");
console.log("dup invoice_no:", await q(`SELECT invoice_no, COUNT(*)::int n FROM sales_invoices GROUP BY 1 HAVING COUNT(*)>1 LIMIT 10`));
console.log("dup voucher:", await q(`SELECT voucher_no, COUNT(*)::int n FROM operating_costs GROUP BY 1 HAVING COUNT(*)>1 LIMIT 10`));

section("9) أرصدة الموردين/العملاء مقابل الدفاتر");
console.log("suppliers sum:", await q(`SELECT COALESCE(SUM(balance),0)::numeric v FROM suppliers`));
console.log("customers sum:", await q(`SELECT COALESCE(SUM(balance),0)::numeric v FROM customers`).catch(e=>e.message));

section("10) مستخدمون بكلمات مرور ضعيفة/علم تغيير");
console.log(await q(`SELECT id, username, must_change_password FROM users ORDER BY id`));

section("11) جداول مذكورة في الكود وغير موجودة (عينة)");
for (const t of ["stock_batches","stock_balances","inventory_notifications","supplier_ratings","customer_ratings","workflow_definitions","sales_general_settings","inventory_settings"]) {
  const r = await q("SELECT to_regclass($1) AS x", ["public." + t]);
  console.log((r[0].x ? "✓" : "✗"), t);
}

section("12) تكرار قيود لنفس المصدر (source_type/source_id)");
console.log(await q(`
  SELECT source_type, source_id, COUNT(*)::int n
    FROM journal_entries WHERE source_type IS NOT NULL AND source_id IS NOT NULL
   GROUP BY 1,2 HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 15`));

await c.end();
