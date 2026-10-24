import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
for (const t of ["sales_returns","purchase_returns","sales_invoice_items","purchase_items"]) {
  const r = await c.query("select column_name from information_schema.columns where table_name=$1 and (column_name ilike '%tax%' or column_name ilike '%total%' or column_name ilike '%net%' or column_name = 'date' or column_name ilike '%invoice%')",[t]);
  console.log(t, "=>", r.rows.map(x=>x.column_name).join(", "));
}
await c.end();
