import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('products','sales_products','ingredients')");
console.log("tables:", t.rows.map(r=>r.table_name).join(", "));
for (const n of ["products","sales_products"]) {
  try {
    const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [n]);
    console.log(n, ":", cols.rows.map(r=>r.column_name).slice(0,18).join(", "));
  } catch {}
}
await c.end();
