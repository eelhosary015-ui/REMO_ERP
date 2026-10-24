import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const START = "2026-10-01", END = "2026-10-31";

console.log("======== 4) فواتير مبيعات بلا قيد ========");
for (const r of await q(`SELECT id, invoice_no, date::date d, net_amount, paid_amount, status, journal_entry_id, is_posted
  FROM sales_invoices WHERE date::date BETWEEN $1 AND $2 AND journal_entry_id IS NULL
  AND COALESCE(status,'') NOT IN ('cancelled','canceled','draft','quotation') ORDER BY id`, [START, END]))
  console.log(`  #${r.id} ${r.invoice_no} ${r.d} net=${r.net_amount} paid=${r.paid_amount} status=${r.status} posted=${r.is_posted}`);

console.log("\n======== كل فواتير أكتوبر ========");
for (const r of await q(`SELECT id, invoice_no, date::date d, net_amount, paid_amount, status, journal_entry_id FROM sales_invoices WHERE date::date BETWEEN $1 AND $2 ORDER BY id`, [START, END]))
  console.log(`  #${r.id} ${r.invoice_no} ${r.d} net=${r.net_amount} paid=${r.paid_amount} ${r.status} JE=${r.journal_entry_id}`);

console.log("\n======== 5) الأرصدة ========");
const glBal = async (code, until) => Number((await q(`SELECT COALESCE(SUM(ji.debit - ji.credit),0)::numeric v FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id WHERE a.code=$1 AND je.status='posted' AND je.date::date <= $2`, [code, until]))[0].v);
const apGL = await glBal("2110", END), arGL = await glBal("1130", END), cashGL = await glBal("1110", END);
console.log("  2110 AP GL:", apGL, "| 1130 AR GL:", arGL, "| 1110 CASH GL:", cashGL);
console.log("  suppliers.balance:", (await q(`SELECT COALESCE(SUM(balance),0)::numeric v FROM suppliers`))[0].v);
console.log("  invoices open:", (await q(`SELECT COALESCE(SUM(net_amount-COALESCE(paid_amount,0)),0)::numeric v FROM sales_invoices WHERE COALESCE(status,'') NOT IN ('cancelled','canceled','draft')`))[0].v);
console.log("  treasury sum:", (await q(`SELECT COALESCE(SUM(current_balance),0)::numeric v FROM treasury_accounts WHERE COALESCE(status,'active')='active'`))[0].v);

console.log("\n======== 6) الخزائن ========");
for (const r of await q(`SELECT id, name, current_balance, status FROM treasury_accounts ORDER BY id`)) console.log(`  #${r.id} ${r.name} = ${r.current_balance} (${r.status})`);

console.log("\n======== 7) حركات 1110 المرحّلة ========");
for (const r of await q(`SELECT je.id, je.date::date d, je.source_type, ji.debit, ji.credit, je.description FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id WHERE a.code='1110' AND je.status='posted' ORDER BY je.date, je.id`))
  console.log(`  JE#${r.id} ${r.d} ${r.source_type} | DR ${r.debit} CR ${r.credit} | ${String(r.description).slice(0,40)}`);

console.log("\n======== 8) الموردون ========");
for (const r of await q(`SELECT id, name, balance FROM suppliers ORDER BY id`)) console.log(`  #${r.id} ${r.name} = ${r.balance}`);

console.log("\n======== 9) حركات 2110 المرحّلة ========");
for (const r of await q(`SELECT je.id, je.date::date d, je.source_type, je.source_id, ji.debit, ji.credit FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id WHERE a.code='2110' AND je.status='posted' ORDER BY je.date, je.id`))
  console.log(`  JE#${r.id} ${r.d} ${r.source_type}#${r.source_id} | DR ${r.debit} CR ${r.credit}`);

await c.end();
