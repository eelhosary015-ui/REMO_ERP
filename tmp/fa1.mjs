import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const t = await c.query("select table_name from information_schema.tables where table_schema='public' and (table_name like '%asset%') order by 1");
console.log(t.rows.map(r=>r.table_name).join(", "));
for (const tn of ["fixed_assets","assets"]) {
  try {
    const cols = await c.query("select column_name,data_type from information_schema.columns where table_name=$1 order by ordinal_position",[tn]);
    if (cols.rows.length) console.log("\n"+tn+":", cols.rows.map(r=>r.column_name+":"+r.data_type).join(", "));
    const cnt = await c.query(`select count(*)::int n from ${tn}`);
    console.log("rows:", cnt.rows[0].n);
  } catch(e) { console.log(tn, "ERR", e.message); }
}
await c.end();
