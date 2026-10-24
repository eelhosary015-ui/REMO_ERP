import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system1" });
await c.connect();
const need = ["users","companies","settings","treasury_accounts","purchase_orders","purchase_returns","employees","bom_items","orders","enterprise_audit_log","journal_entries","accounts","treasury_transactions","fixed_assets","financial_periods"];
for (const t of need) {
  const r = await c.query("SELECT to_regclass($1) AS t", ["public." + t]);
  console.log(`${r.rows[0].t ? "✓" : "✗"} ${t}`);
}
const last = await c.query("SELECT max(created_at) AS last_je FROM journal_entries");
console.log("آخر قيد:", last.rows[0].last_je);
await c.end();
