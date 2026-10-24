import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("=== كل حركات الخزينة ===");
let sumIn = 0, sumOut = 0;
for (const r of await q(`SELECT id, transaction_type, amount, date::date d, account_id, voucher_number, description, fin_number
  FROM treasury_transactions ORDER BY id`)) {
  const amt = Number(r.amount);
  const isIn = ['إيداع','قبض','deposit','receipt','in'].includes(String(r.transaction_type).toLowerCase()) || String(r.transaction_type).includes('قبض');
  console.log(`  #${r.id} ${r.d} ${r.transaction_type} ${amt} acc=${r.account_id} v=${r.voucher_number||'-'} fin=${r.fin_number||'-'} | ${String(r.description||'').slice(0,40)}`);
}
console.log("\n=== مجموع الحركات حسب النوع ===");
for (const r of await q(`SELECT transaction_type, count(*)::int n, SUM(amount)::numeric total FROM treasury_transactions GROUP BY 1 ORDER BY 2 DESC`))
  console.log(`  ${r.transaction_type}: n=${r.n} total=${r.total}`);

console.log("\n=== الخزائن ===");
for (const r of await q(`SELECT id, name, current_balance, opening_balance, status FROM treasury_accounts ORDER BY id`))
  console.log(`  #${r.id} ${r.name} = ${r.current_balance} (opening ${r.opening_balance}) ${r.status}`);

console.log("\n=== سندات بدون fin_number (غير مرحّلة) ===");
for (const r of await q(`SELECT id, transaction_type, amount, date::date d, voucher_number FROM treasury_transactions WHERE fin_number IS NULL ORDER BY id`))
  console.log(`  #${r.id} ${r.d} ${r.transaction_type} ${r.amount} v=${r.voucher_number}`);
await c.end();
