import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const url = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const c = new pg.Client({connectionString: url});
await c.connect();
const r = await c.query("select id,status,payment_method,customer_name from sales_invoices order by id desc limit 5");
console.log(r.rows);
await c.end();
