import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test")});
await c.connect();
for (const t of ["sales_delivery_note_items","sales_order_items","erp_sales_orders","sales_delivery_notes"]) {
  const r = await c.query("select column_name from information_schema.columns where table_name=$1 order by ordinal_position",[t]);
  console.log(t, "=>", r.rows.map(x=>x.column_name).join(", "));
}
await c.end();
