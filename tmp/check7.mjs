import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const cols = async (t) => (await c.query("select column_name,data_type from information_schema.columns where table_name=$1 order by ordinal_position",[t])).rows.map(r=>r.column_name).join(", ");
for (const t of ["customers","suppliers","treasury_accounts","safes","bank_accounts","warehouses","products","ingredients","inventory","stock_movements"]) {
  try { console.log(t, "=>", await cols(t)); } catch(e) { console.log(t, "ERR"); }
}
await c.end();
