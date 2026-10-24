import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const cols = await q("SELECT column_name FROM information_schema.columns WHERE table_name='treasury_transactions' ORDER BY ordinal_position");
console.log("treasury_transactions:", cols.map(r=>r.column_name).join(", "));

console.log("\n=== سندات الخزينة / القيود المرتبطة ===");
for (const r of await q(`SELECT je.id, je.date::date d, je.source_type, je.source_id, je.description, je.total_debit, je.status,
  (SELECT SUM(ji.debit) FROM journal_items ji WHERE ji.journal_entry_id=je.id) dr,
  (SELECT SUM(ji.credit) FROM journal_items ji WHERE ji.journal_entry_id=je.id) cr
  FROM journal_entries je WHERE je.source_type IN ('treasury_voucher','treasury','CUSTOMER_RECEIPT','CUSTOMER_REFUND','customer_payment')
  ORDER BY je.id`))
  console.log(`  JE#${r.id} ${r.d} ${r.source_type}#${r.source_id} | ${r.status} | ${String(r.description).slice(0,50)}`);

console.log("\n=== كل حركات الخزينة ===");
for (const r of await q(`SELECT id, transaction_type, amount, transaction_date::date d, treasury_account_id, description FROM treasury_transactions ORDER BY id`))
  console.log(`  #${r.id} ${r.d} ${r.transaction_type} ${r.amount} acc=${r.treasury_account_id} | ${String(r.description||'').slice(0,45)}`);

console.log("\n=== treasury vouchers table? ===");
const t = await q("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%voucher%'");
console.log(t.map(r=>r.table_name).join(", "));
await c.end();
