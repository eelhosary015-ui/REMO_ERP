import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const url = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const c = new pg.Client({connectionString: url});
await c.connect();
const cols = await c.query("select column_name,data_type from information_schema.columns where table_name='inventory_items' order by ordinal_position");
console.log(cols.rows.map(r=>r.column_name+":"+r.data_type).join(", "));
await c.end();
