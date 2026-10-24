import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
const cols = async (t) => (await c.query("select column_name from information_schema.columns where table_name=$1 order by ordinal_position",[t])).rows.map(r=>r.column_name).join(", ");
console.log("operating_costs:", await cols("operating_costs"));
console.log("cost_transactions:", await cols("cost_transactions"));
console.log("counts:", await q(`select
 (select count(*) from operating_costs) op,
 (select count(*) from cost_transactions) ct,
 (select count(*) from operating_costs where cost_center_id is not null) op_cc`).catch(e=>({err:e.message})));
console.log("op rows:", await q(`select id,total_amount,cost_center_id,to_char(date,'YYYY-MM-DD') d,status from operating_costs order by id limit 10`).catch(e=>({err:e.message})));
console.log("cost tx rows:", await q(`select id,amount,cost_center_id,to_char(date,'YYYY-MM-DD') d,status from cost_transactions order by id limit 10`).catch(e=>({err:e.message})));
await c.end();
