import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
for (const t of ["journal_entries","journal_items"]) {
  const r = await c.query("SELECT tgname FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal", [t]);
  console.log(`triggers ${t}:`, r.rows.map(x=>x.tgname).join(", ") || "(none)");
}
await c.end();
