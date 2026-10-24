import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("op:", await q(`select id, amount, total, cost_center_id, journal_entry_id, to_char(date,'YYYY-MM-DD') d, status from operating_costs order by id`));
console.log("ct:", await q(`select id, amount, cost_center_id, source_type, source_id, to_char(date,'YYYY-MM-DD') d from cost_transactions order by id`));
console.log("je for costs:", await q(`select je.id, je.source_type, je.source_id, sum(ji.debit)::numeric d, sum(ji.credit)::numeric cr,
   array_agg(distinct coalesce(ji.cost_center_id::text,'null')) ccs
 from journal_entries je join journal_items ji on ji.journal_entry_id=je.id
 where je.source_type in ('cost','operating_cost') group by 1,2,3 order by 1`));
await c.end();
