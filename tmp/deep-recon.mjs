import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const END = "2026-10-31";

console.log("======== AR: كل الفواتير (كل الفترات) ========");
let sumOpen = 0;
for (const r of await q(`SELECT id, invoice_no, date::date d, net_amount, paid_amount, status, journal_entry_id,
  (net_amount - COALESCE(paid_amount,0))::numeric open_amt FROM sales_invoices ORDER BY id`)) {
  sumOpen += Number(r.open_amt);
  console.log(`  #${r.id} ${r.invoice_no} ${r.d} net=${r.net_amount} paid=${r.paid_amount} open=${r.open_amt} ${r.status} JE=${r.journal_entry_id}`);
}
console.log("  Σ open:", sumOpen.toFixed(2));

console.log("\n======== AR: حركات 1130 المرحّلة ========");
let sumAr = 0;
for (const r of await q(`SELECT je.id, je.date::date d, je.source_type, je.source_id, ji.debit, ji.credit
  FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
  WHERE a.code='1130' AND je.status='posted' ORDER BY je.date, je.id`)) {
  sumAr += Number(r.debit) - Number(r.credit);
  console.log(`  JE#${r.id} ${r.d} ${r.source_type}#${r.source_id} DR=${r.debit} CR=${r.credit}`);
}
console.log("  Σ GL AR:", sumAr.toFixed(2));

console.log("\n======== Treasury: الحركات وربطها بالقيد ========");
for (const r of await q(`
  SELECT tt.id, tt.transaction_type, tt.amount, tt.transaction_date::date d, tt.treasury_account_id,
         tt.journal_entry_id, je.id AS je_id, je.status AS je_status
  FROM treasury_transactions tt
  LEFT JOIN journal_entries je ON je.id = tt.journal_entry_id
  ORDER BY tt.id DESC LIMIT 25`)) {
  console.log(`  #${r.id} ${r.d} ${r.transaction_type} ${r.amount} acc=${r.treasury_account_id} JE=${r.je_id || "—"} (${r.je_status || "NO JE"})`);
}

console.log("\n======== Treasury: إجمالي بدون قيد ========");
const noJe = await q(`SELECT count(*)::int n, COALESCE(SUM(amount),0)::numeric total
  FROM treasury_transactions WHERE journal_entry_id IS NULL`);
console.log("  ", JSON.stringify(noJe[0]));

console.log("\n======== AP: مدفوعات الموردين ========");
for (const r of await q(`SELECT sp.id, sp.supplier_id, sp.amount, sp.payment_date::date d, sp.journal_entry_id,
  je.status AS je_status FROM supplier_payments sp LEFT JOIN journal_entries je ON je.id=sp.journal_entry_id ORDER BY sp.id`)) {
  console.log(`  #${r.id} supplier=${r.supplier_id} amount=${r.amount} ${r.d} JE=${r.journal_entry_id}(${r.je_status || "—"})`);
}

console.log("\n======== AP: سندات الاستلام ========");
for (const r of await q(`SELECT id, supplier_id, total_cost, received_date::date d, journal_entry_id FROM goods_receipts ORDER BY id`).catch(async () => await q(`SELECT * FROM goods_receipts LIMIT 1`))) {
  console.log("  ", JSON.stringify(r));
}

await c.end();
