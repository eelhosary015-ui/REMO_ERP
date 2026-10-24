import pg from "pg";
for (const name of ["erp_system1", "erp_system2"]) {
  const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/" + name });
  await c.connect();
  const t = await c.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const v = await c.query("SELECT count(*)::int AS n FROM information_schema.views WHERE table_schema='public'");
  const checks = {};
  for (const q of [
    ["users", "SELECT count(*)::int n FROM users"],
    ["companies", "SELECT count(*)::int n FROM companies"],
    ["journal_entries", "SELECT count(*)::int n FROM journal_entries"],
    ["treasury_tx", "SELECT count(*)::int n FROM treasury_transactions"],
    ["accounts", "SELECT count(*)::int n FROM accounts"],
    ["settings", "SELECT count(*)::int n FROM settings"],
    ["financial_periods", "SELECT count(*)::int n FROM financial_periods"],
    ["fixed_assets", "SELECT count(*)::int n FROM fixed_assets"],
  ]) {
    try { checks[q[0]] = (await c.query(q[1])).rows[0].n; } catch { checks[q[0]] = "ERR"; }
  }
  console.log(`${name}: tables=${t.rows[0].n} views=${v.rows[0].n}`, JSON.stringify(checks));
  await c.end();
}
