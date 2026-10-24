import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
console.log("=== القيود الجديدة (treasury_voucher) ===");
for (const r of await q(`SELECT je.id, je.date::date d, je.description, je.total_debit, je.total_credit, je.fin_number,
  (SELECT count(*) FROM journal_items ji WHERE ji.journal_entry_id=je.id)::int items,
  (SELECT COALESCE(SUM(debit),0) FROM journal_items ji WHERE ji.journal_entry_id=je.id)::numeric dr,
  (SELECT COALESCE(SUM(credit),0) FROM journal_items ji WHERE ji.journal_entry_id=je.id)::numeric cr
  FROM journal_entries je WHERE je.id > 69 ORDER BY je.id`))
  console.log(`  JE#${r.id} ${r.d} ${r.description.slice(0,45)} | total=${r.total_debit} items=${r.items} DR=${r.dr} CR=${r.cr} fin=${r.fin_number}`);
console.log("\n=== الأرصدة النهائية ===");
for (const code of ["1110","1130","2110","3100"]) {
  const r = await q(`SELECT a.code, a.name, COALESCE(SUM(ji.debit-ji.credit),0)::numeric net
    FROM accounts a LEFT JOIN journal_items ji ON ji.account_id=a.id
    LEFT JOIN journal_entries je ON je.id=ji.journal_entry_id AND je.status='posted'
    WHERE a.code=$1 GROUP BY 1,2`, [code]);
  console.log(`  ${r[0].code} ${r[0].name}: ${r[0].net}`);
}
console.log("\n=== حالات القيود ===");
for (const r of await q(`SELECT status, count(*)::int n FROM journal_entries GROUP BY 1`)) console.log(`  ${r.status}: ${r.n}`);
console.log("\n=== الفواتير الملغاة ===");
for (const r of await q(`SELECT id, invoice_no, status FROM sales_invoices WHERE id IN (14,15)`)) console.log("  ", JSON.stringify(r));
await c.end();
