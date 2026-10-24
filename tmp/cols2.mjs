import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test")});
await c.connect();
const cols = async (t) => (await c.query("select column_name from information_schema.columns where table_name=$1 order by ordinal_position",[t])).rows.map(r=>r.column_name).join(", ");
for (const t of ["purchases","goods_receipts","inventory_transactions","treasury_transactions","customer_transactions","supplier_transactions"]) {
  console.log(t, "=>", await cols(t));
}
await c.end();
