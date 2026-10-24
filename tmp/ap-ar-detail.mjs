import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("=== supplier_payments ===");
for (const r of await q(`SELECT id, supplier_id, amount, payment_date::date d, journal_entry_id, notes FROM supplier_payments ORDER BY id`))
  console.log(`  #${r.id} supplier=${r.supplier_id} ${r.amount} ${r.d} JE=${r.journal_entry_id} | ${String(r.notes||'').slice(0,40)}`);

console.log("\n=== supplier_transactions (آخر 10) ===");
const st = await q("SELECT * FROM supplier_transactions ORDER BY id DESC LIMIT 10").catch(() => []);
for (const r of st) console.log("  ", JSON.stringify(r).slice(0, 260));

console.log("\n=== customer payments / receipts ===");
const t = await q("SELECT table_name FROM information_schema.tables WHERE table_name IN ('customer_payments','customer_transactions','payments')");
console.log("  tables:", t.map(r=>r.table_name).join(", "));
for (const r of await q(`SELECT id, customer_id, amount, payment_date::date d, journal_entry_id FROM customer_payments ORDER BY id`).catch(()=>[]))
  console.log(`  CP#${r.id} cust=${r.customer_id} ${r.amount} ${r.d} JE=${r.journal_entry_id}`);

console.log("\n=== JE#5 و JE#6 ===");
for (const r of await q(`SELECT je.id, je.status, je.description, je.source_type, je.source_id, a.code, a.name, ji.debit, ji.credit
  FROM journal_entries je JOIN journal_items ji ON ji.journal_entry_id=je.id JOIN accounts a ON a.id=ji.account_id
  WHERE je.id IN (5,6) ORDER BY je.id, ji.debit DESC`))
  console.log(`  JE#${r.id} ${r.status} ${r.code} ${r.name} DR=${r.debit} CR=${r.credit} | ${String(r.description).slice(0,40)}`);

console.log("\n=== JE#32 (استحقاق المرتبات) ===");
for (const r of await q(`SELECT je.id, je.status, je.description, a.code, a.name, ji.debit, ji.credit
  FROM journal_entries je JOIN journal_items ji ON ji.journal_entry_id=je.id JOIN accounts a ON a.id=ji.account_id
  WHERE je.id=32 ORDER BY ji.debit DESC`))
  console.log(`  ${r.code} ${r.name} DR=${r.debit} CR=${r.credit}`);
await c.end();
