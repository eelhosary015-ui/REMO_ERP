import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s,p) => (await c.query(s,p)).rows;
console.log("cash 1110 by source:", await q(`
 select coalesce(je.source_type,'-') src, count(*)::int n,
        sum(ji.debit)::numeric dr, sum(ji.credit)::numeric cr,
        sum(ji.debit-ji.credit)::numeric net
   from journal_items ji join journal_entries je on je.id=ji.journal_entry_id
  where ji.account_id=8 and je.status='posted'
  group by 1 order by net`));
console.log("AR/AP subledger vs GL:", await q(`
 select 'AR' k, coalesce((select sum(net_amount-coalesce(paid_amount,0)) from sales_invoices where coalesce(status,'') not in ('cancelled','canceled')),0)::numeric sub,
        coalesce((select sum(ji.debit-ji.credit) from journal_items ji join journal_entries je on je.id=ji.journal_entry_id where ji.account_id=9 and je.status='posted'),0)::numeric gl
 union all
 select 'AP', coalesce((select sum(balance) from suppliers),0)::numeric,
        coalesce(-(select sum(ji.debit-ji.credit) from journal_items ji join journal_entries je on je.id=ji.journal_entry_id where ji.account_id=2 and je.status='posted'),0)::numeric`));
await c.end();
