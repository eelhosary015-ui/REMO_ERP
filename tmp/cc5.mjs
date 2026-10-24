import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("expense lines with/without cc:", await q(`
 select count(*)::int total,
        count(ji.cost_center_id)::int with_cc,
        sum(ji.debit-ji.credit)::numeric amount,
        sum(case when ji.cost_center_id is null then ji.debit-ji.credit else 0 end)::numeric without_cc
   from journal_items ji join journal_entries je on je.id=ji.journal_entry_id
   join accounts a on a.id=ji.account_id
  where je.status='posted' and a.type='expense'`));
console.log("by source:", await q(`
 select coalesce(je.source_type,'-') src, count(*)::int n, count(ji.cost_center_id)::int with_cc,
        sum(ji.debit-ji.credit)::numeric amt
   from journal_items ji join journal_entries je on je.id=ji.journal_entry_id
   join accounts a on a.id=ji.account_id
  where je.status='posted' and a.type='expense' group by 1 order by amt desc`));
await c.end();
