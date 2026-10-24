import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("=== قيود 1110 المرحّلة بدون حركة خزينة مقابلة (نفس المبلغ) ===");
const cash = await q(`
  SELECT je.id, je.date::date d, je.source_type, je.source_id, je.description, ji.debit, ji.credit
  FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
  WHERE a.code='1110' AND je.status='posted' ORDER BY je.date, je.id`);
const txs = await q(`SELECT id, amount, date::date d, voucher_number, fin_number, transaction_type FROM treasury_transactions ORDER BY id`);
const amtMatch = (je) => {
  const amt = Number(je.debit) > 0 ? Number(je.debit) : Number(je.credit);
  return txs.some(t => Math.abs(Math.abs(Number(t.amount)) - amt) < 0.01);
};
let unmatchedSum = 0;
for (const je of cash) {
  if (!amtMatch(je)) {
    unmatchedSum += Number(je.debit) - Number(je.credit);
    console.log(`  JE#${je.id} ${je.d} ${je.source_type}#${je.source_id} DR=${je.debit} CR=${je.credit} | ${String(je.description).slice(0,55)}`);
  }
}
console.log("  صافي غير المتطابق:", unmatchedSum.toFixed(2));

console.log("\n=== حركات خزينة بقيمة غير موجودة في 1110 ===");
for (const t of txs) {
  const amt = Math.abs(Number(t.amount));
  const hit = cash.some(je => Math.abs((Number(je.debit) > 0 ? Number(je.debit) : Number(je.credit)) - amt) < 0.01);
  if (!hit) console.log(`  TX#${t.id} ${t.transaction_type} ${t.amount} v=${t.voucher_number} fin=${t.fin_number}`);
}
await c.end();
