import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const r = await c.query("select column_name from information_schema.columns where table_name='purchase_returns' order by ordinal_position");
console.log(r.rows.map(x=>x.column_name).join(", "));
await c.end();
