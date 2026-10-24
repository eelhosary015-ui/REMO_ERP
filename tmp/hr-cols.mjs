import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql) => (await c.query(sql)).rows;
for (const t of ["attendance", "payroll"]) {
  const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`);
  console.log(`${t}:`, cols.map(r=>r.column_name).join(", ") || "(missing)");
}
await c.end();
