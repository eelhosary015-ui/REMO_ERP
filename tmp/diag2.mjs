import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s,p) => (await c.query(s,p)).rows;
console.log("has fin_number?", await q(`select column_name from information_schema.columns where table_name='treasury_transactions' and column_name in ('fin_number','idempotency_key','journal_entry_id')`));
console.log("vouchers by fin linkage:", await q(`
 select status, transaction_type,
        count(*)::int n,
        count(fin_number)::int with_fin,
        sum(amount)::numeric total
   from treasury_transactions group by 1,2 order by 1,2`));
console.log("financial_transactions by source:", await q(`
 select source_type, count(*)::int n, count(journal_entry_id)::int with_je, sum(total_amount)::numeric total
   from financial_transactions group by 1 order by 1`));
console.log("JE by source_type:", await q(`
 select source_type, count(*)::int n, sum(total_debit)::numeric d
   from journal_entries group by 1 order by 2 desc`));
console.log("cash GL:", await q(`
 select a.id,a.code,coalesce(sum(ji.debit-ji.credit),0)::numeric net
   from accounts a left join journal_items ji on ji.account_id=a.id
   left join journal_entries je on je.id=ji.journal_entry_id and je.status='posted'
  where a.code in ('1110','1120') group by 1,2 order by 2`));
await c.end();
