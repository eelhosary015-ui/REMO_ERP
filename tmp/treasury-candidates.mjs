import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("======== 17 حركة خزينة غير مرحّلة — كل البيانات ========");
const rows = await q(`
  SELECT tt.*, ta.name AS acc_name
  FROM treasury_transactions tt LEFT JOIN treasury_accounts ta ON ta.id = tt.account_id
  WHERE tt.fin_number IS NULL ORDER BY tt.id`);
for (const r of rows) {
  console.log(`\n#${r.id} | ${r.transaction_type} | amount=${r.amount} | acc=${r.account_id}(${r.acc_name}) | date=${r.date} | created=${r.created_at?.toISOString?.().slice(0,16)}`);
  console.log(`   voucher=${r.voucher_number} type=${r.voucher_type} ref=${r.reference_type}/${r.reference_id} client=${r.client_type}/${r.client_name} supplier=${r.supplier_id} customer=${r.customer_id}`);
  console.log(`   desc="${r.description || ""}" notes="${r.notes || ""}" category="${r.category || ""}" status=${r.status} pm=${r.payment_method}`);
}

console.log("\n\n======== مرشحون من القيود المرحّلة (1110) لكل حركة ========");
for (const r of rows) {
  const amt = Math.abs(Number(r.amount));
  const isIn = Number(r.amount) > 0;
  const cands = await q(`
    SELECT je.id, je.date::date d, je.source_type, je.source_id, je.description,
           ji.debit, ji.credit
    FROM journal_entries je JOIN journal_items ji ON ji.journal_entry_id = je.id
    JOIN accounts a ON a.id = ji.account_id
    WHERE a.code='1110' AND je.status='posted'
      AND ${isIn ? "ji.debit" : "ji.credit"} BETWEEN $1 - 0.01 AND $1 + 0.01
    ORDER BY ABS(EXTRACT(EPOCH FROM (je.date::date - COALESCE($2::date, je.date::date)))), je.id
    LIMIT 4`, [amt, r.date]);
  console.log(`\n#${r.id} ${isIn ? "IN " : "OUT"} ${amt} (${r.voucher_number || "-"})`);
  if (!cands.length) console.log("   → لا يوجد قيد مطابق");
  for (const x of cands) console.log(`   ↳ JE#${x.id} ${x.d} ${x.source_type}#${x.source_id} DR=${x.debit} CR=${x.credit} | ${String(x.description).slice(0,50)}`);
}

console.log("\n======== JE#5 source ========");
for (const r of await q(`SELECT id, status, source_type, source_id, description, date::date d FROM journal_entries WHERE id IN (5,32)`))
  console.log(JSON.stringify(r));

console.log("\n======== goods_receipts (الموردون) ========");
for (const r of await q(`SELECT id, supplier_id, total_cost, received_date::date d, journal_entry_id FROM goods_receipts ORDER BY id`))
  console.log(`  GR#${r.id} supplier=${r.supplier_id} ${r.total_cost} ${r.d} JE=${r.journal_entry_id}`);

console.log("\n======== فواتير العميل + التحصيل 1500 ========");
for (const r of await q(`SELECT id, invoice_no, customer_id, net_amount, paid_amount, status, journal_entry_id FROM sales_invoices WHERE id IN (28)`))
  console.log("  ", JSON.stringify(r));
await c.end();
