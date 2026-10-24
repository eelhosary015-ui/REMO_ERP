import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
for (const t of ["inventory_settings","sales_general_settings","transaction_reasons"]) {
  const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t]);
  console.log(`\n${t}:`, cols.rows.map(r=>`${r.column_name}`).join(", ") || "(missing)");
  try { const n = await c.query(`SELECT count(*)::int n FROM ${t}`); console.log("  rows:", n.rows[0].n); } catch(e) { console.log("  ", e.message); }
}
await c.end();
