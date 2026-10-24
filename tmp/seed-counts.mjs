import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system1" });
await c.connect();
const tables = ["users","accounts","account_config","settings","financial_periods","branches","warehouses","cost_centers","treasury_accounts","roles","companies","currencies","taxes"];
for (const t of tables) {
  try {
    const r = await c.query(`SELECT count(*)::int n FROM "${t}"`);
    console.log(`${t}: ${r.rows[0].n}`);
  } catch { console.log(`${t}: (not found)`); }
}
await c.end();
