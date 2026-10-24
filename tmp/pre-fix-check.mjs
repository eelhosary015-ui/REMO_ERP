import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("=== القيود المطابقة: هل لها fin_number؟ ===");
for (const r of await q(`SELECT id, entry_number, fin_number, source_type, source_id, date::date d, status, total_debit FROM journal_entries WHERE id IN (3,4,20,28,30,33,55,61,62,69) ORDER BY id`))
  console.log(`  JE#${r.id} ${r.entry_number || "-"} fin=${r.fin_number || "-"} ${r.source_type}#${r.source_id} ${r.d} ${r.status} ${r.total_debit}`);

console.log("\n=== indexes على treasury_transactions ===");
for (const r of await q(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='treasury_transactions'`))
  console.log("  " + r.indexdef);

console.log("\n=== account_config equity ===");
for (const r of await q(`SELECT key, account_id FROM account_config WHERE account_id IN (SELECT id FROM accounts WHERE type ILIKE '%equity%') OR key ILIKE '%capital%'`))
  console.log("  ", JSON.stringify(r));

console.log("\n=== دليل الحسابات: هل فيه حساب رأس مال؟ ===");
for (const r of await q(`SELECT id, code, name, type FROM accounts WHERE type ILIKE '%equity%' OR code LIKE '3%' ORDER BY code`))
  console.log(`  ${r.id} ${r.code} ${r.name} (${r.type})`);

console.log("\n=== فاتورة 28 + تحصيل 1500 ===");
for (const r of await q(`SELECT id, invoice_no, net_amount, paid_amount, status FROM sales_invoices WHERE id=28`)) console.log("  ", JSON.stringify(r));

console.log("\n=== المورد 3 ===");
for (const r of await q(`SELECT id, name, balance FROM suppliers WHERE id=3`)) console.log("  ", JSON.stringify(r));
await c.end();
