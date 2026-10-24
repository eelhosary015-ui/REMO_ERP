import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const START = "2026-10-01", END = "2026-10-31";

console.log("======== 1) القيود حسب الحالة في أكتوبر ========");
for (const r of await q(`SELECT COALESCE(status,'draft') st, count(*)::int n, COALESCE(SUM(total_debit),0)::numeric total
  FROM journal_entries WHERE date::date BETWEEN $1 AND $2 OR period_id=(SELECT id FROM financial_periods WHERE year=2026 AND month=10)
  GROUP BY 1 ORDER BY 1`, [START, END])) console.log(`  ${r.st}\t${r.n}\t${r.total}`);

console.log("\n======== 2) القيود المانعة (approved) ========");
for (const r of await q(`SELECT je.id, je.date::date d, je.description, je.reference, je.source_type, je.total_debit, je.total_credit,
   (SELECT count(*) FROM journal_items ji WHERE ji.journal_entry_id=je.id)::int items
   FROM journal_entries je WHERE je.status='approved' AND (je.date::date BETWEEN $1 AND $2) ORDER BY je.id`, [START, END]))
  console.log(`  #${r.id} ${r.d} ${r.description} | ${r.source_type} | DR ${r.total_debit} | items=${r.items}`);

console.log("\n======== 3) قيود بلا period_id ========");
const mp = await q(`SELECT count(*)::int n FROM journal_entries WHERE date::date BETWEEN $1 AND $2 AND period_id IS NULL`, [START, END]);
console.log("  count:", mp[0].n);
for (const r of await q(`SELECT source_type, count(*)::int n FROM journal_entries WHERE date::date BETWEEN $1 AND $2 AND period_id IS NULL GROUP BY 1 ORDER BY 2 DESC`, [START, END]))
  console.log(`  ${r.source_type || "(null)"}: ${r.n}`);

console.log("\n======== 4) فواتير مبيعات بلا قيد ========");
for (const r of await q(`SELECT id, invoice_number, date::date d, net_amount, paid_amount, status, journal_entry_id
  FROM sales_invoices WHERE date::date BETWEEN $1 AND $2 AND journal_entry_id IS NULL
  AND COALESCE(status,'') NOT IN ('cancelled','canceled','draft','quotation') ORDER BY id`, [START, END]))
  console.log(`  #${r.id} ${r.invoice_number} ${r.d} net=${r.net_amount} paid=${r.paid_amount} status=${r.status}`);

console.log("\n======== 5) الأرصدة ========");
const glBal = async (code, until) => {
  const rows = await q(`SELECT COALESCE(SUM(ji.debit - ji.credit),0)::numeric v
    FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id
    JOIN accounts a ON a.id=ji.account_id
    WHERE a.code=$1 AND je.status='posted' AND je.date::date <= $2`, [code, until]);
  return Number(rows[0].v);
};
console.log("  2110 AP GL:", await glBal("2110", END));
console.log("  1130 AR GL:", await glBal("1130", END));
console.log("  1110 CASH GL:", await glBal("1110", END));

const sup = await q(`SELECT COALESCE(SUM(balance),0)::numeric v FROM suppliers`);
console.log("  suppliers.balance SUM:", sup[0].v);
const inv = await q(`SELECT COALESCE(SUM(net_amount - COALESCE(paid_amount,0)),0)::numeric v FROM sales_invoices WHERE COALESCE(status,'') NOT IN ('cancelled','canceled','draft')`);
console.log("  sales_invoices open SUM:", inv[0].v);
const tr = await q(`SELECT COALESCE(SUM(current_balance),0)::numeric v FROM treasury_accounts WHERE COALESCE(status,'active')='active'`);
console.log("  treasury_accounts SUM:", tr[0].v);

console.log("\n======== 6) تفصيل الخزائن ========");
for (const r of await q(`SELECT id, name, current_balance, status FROM treasury_accounts ORDER BY id`))
  console.log(`  #${r.id} ${r.name} = ${r.current_balance} (${r.status})`);

console.log("\n======== 7) القيود المرحّلة على 1110 ========");
for (const r of await q(`SELECT je.id, je.date::date d, je.description, je.source_type, ji.debit, ji.credit
  FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
  WHERE a.code='1110' AND je.status='posted' ORDER BY je.date, je.id`))
  console.log(`  JE#${r.id} ${r.d} ${r.source_type} | DR ${r.debit} CR ${r.credit} | ${String(r.description).slice(0,45)}`);

console.log("\n======== 8) الموردون (فرق 50) ========");
for (const r of await q(`SELECT id, name, balance FROM suppliers ORDER BY id`))
  console.log(`  #${r.id} ${r.name} = ${r.balance}`);

console.log("\n======== 9) حركات الموردين المرحّلة على 2110 ========");
for (const r of await q(`SELECT je.id, je.date::date d, je.description, je.source_type, ji.debit, ji.credit, je.source_id
  FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
  WHERE a.code='2110' AND je.status='posted' ORDER BY je.date, je.id`))
  console.log(`  JE#${r.id} ${r.d} ${r.source_type}#${r.source_id} | DR ${r.debit} CR ${r.credit} | ${String(r.description).slice(0,40)}`);

await c.end();
