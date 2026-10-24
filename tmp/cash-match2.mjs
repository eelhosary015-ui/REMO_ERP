import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

const cash = await q(`SELECT je.id, je.date::date d, je.source_type, je.source_id, je.description, ji.id jid, ji.debit, ji.credit
  FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
  WHERE a.code='1110' AND je.status='posted' ORDER BY je.date, je.id, ji.id`);
const txs = await q(`SELECT id, amount, date::date d, voucher_number FROM treasury_transactions WHERE COALESCE(status,'') <> 'canceled' ORDER BY id`);

const used = new Set();
const unmatched = [];
for (const je of cash) {
  const amt = Number(je.debit) > 0 ? Number(je.debit) : -Number(je.credit);
  const cand = txs.find(t => !used.has(t.id) && Math.abs(Number(t.amount) - amt) < 0.01 &&
    Math.abs((t.d ? t.d.getTime() : 0) - je.d.getTime()) <= 3 * 86400000);
  if (cand) used.add(cand.id); else unmatched.push({ ...je, amt });
}
console.log("قيود غير متطابقة:");
let sum = 0;
for (const u of unmatched) { sum += u.amt; console.log(`  JE#${u.id} ${u.d?.toISOString?.().slice(0,10)} ${u.source_type} | ${u.amt} | ${String(u.description).slice(0,50)}`); }
console.log("  صافي:", sum.toFixed(2));

console.log("\nحركات خزينة غير متطابقة:");
let sum2 = 0;
for (const t of txs) if (!used.has(t.id)) { sum2 += Number(t.amount); console.log(`  TX#${t.id} ${t.d?.toISOString?.().slice(0,10)} ${t.amount} ${t.voucher_number}`); }
console.log("  صافي:", sum2.toFixed(2));

console.log("\n=== رصيد الخزينة المخزّن vs مجموع الحركات ===");
for (const r of await q(`SELECT ta.id, ta.name, ta.current_balance,
  (SELECT COALESCE(SUM(amount),0) FROM treasury_transactions tt WHERE tt.account_id=ta.id AND COALESCE(tt.status,'') <> 'canceled')::numeric sum_tx
  FROM treasury_accounts ta ORDER BY ta.id`))
  console.log(`  #${r.id} ${r.name}: مخزّن=${r.current_balance} مجموع=${r.sum_tx} فرق=${(Number(r.current_balance)-Number(r.sum_tx)).toFixed(2)}`);
await c.end();
