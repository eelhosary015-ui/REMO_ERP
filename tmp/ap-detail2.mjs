import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("=== جداول الموردين/العملاء ===");
const t = await q("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%supplier%payment%' OR table_name ILIKE '%voucher%'");
console.log("  ", t.map(r=>r.table_name).join(", "));

console.log("\n=== سندات الصرف (vouchers) المرتبطة بالموردين ===");
for (const r of await q(`SELECT id, voucher_number, voucher_type, amount, date::date d, supplier_id, customer_id, fin_number, status FROM vouchers ORDER BY id DESC LIMIT 12`).catch(()=>[]))
  console.log(`  #${r.id} ${r.voucher_number} ${r.voucher_type} ${r.amount} ${r.d} supplier=${r.supplier_id} customer=${r.customer_id} fin=${r.fin_number} ${r.status}`);

console.log("\n=== JE#5 و JE#6 ===");
for (const r of await q(`SELECT je.id, je.status, je.description, je.source_type, je.source_id, a.code, a.name, ji.debit, ji.credit
  FROM journal_entries je JOIN journal_items ji ON ji.journal_entry_id=je.id JOIN accounts a ON a.id=ji.account_id
  WHERE je.id IN (5,6) ORDER BY je.id, ji.debit DESC`))
  console.log(`  JE#${r.id} ${r.status} ${r.code} ${r.name} DR=${r.debit} CR=${r.credit}`);

console.log("\n=== JE#32 ===");
for (const r of await q(`SELECT je.status, a.code, a.name, ji.debit, ji.credit
  FROM journal_entries je JOIN journal_items ji ON ji.journal_entry_id=je.id JOIN accounts a ON a.id=ji.account_id WHERE je.id=32 ORDER BY ji.debit DESC`))
  console.log(`  ${r.code} ${r.name} DR=${r.debit} CR=${r.credit}`);

console.log("\n=== حركات 2110 vs أرصدة الموردين (من 2110 فقط) ===");
for (const r of await q(`SELECT a.code, a.name, SUM(ji.debit)::numeric dr, SUM(ji.credit)::numeric cr
  FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
  WHERE a.code IN ('2110','1130','1110') AND je.status='posted' GROUP BY 1,2 ORDER BY 1`))
  console.log(`  ${r.code} ${r.name}: DR=${r.dr} CR=${r.cr} net=${(Number(r.dr)-Number(r.cr)).toFixed(2)}`);
await c.end();
