import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system4" });
await c.connect();
for (const [label, sql] of [
  ["users", "SELECT count(*)::int n FROM users"],
  ["accounts", "SELECT count(*)::int n FROM accounts"],
  ["account_config", "SELECT count(*)::int n FROM account_config"],
  ["settings", "SELECT count(*)::int n FROM settings"],
  ["financial_periods", "SELECT count(*)::int n FROM financial_periods"],
  ["treasury_accounts", "SELECT count(*)::int n FROM treasury_accounts"],
  ["roles", "SELECT count(*)::int n FROM roles"],
  ["triggers", "SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal"],
  ["users sample", "SELECT username, is_active FROM users ORDER BY id LIMIT 3"],
]) {
  try {
    const r = await c.query(sql);
    console.log(label + ":", JSON.stringify(r.rows));
  } catch (e) { console.log(label + ": ERR " + e.message); }
}
await c.end();
