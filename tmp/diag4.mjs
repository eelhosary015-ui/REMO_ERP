import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s,p) => (await c.query(s,p)).rows;
console.log("JEs at 10000/100000/150:", await q(`
 select je.id, to_char(je.date,'YYYY-MM-DD') d, je.source_type, je.total_debit::numeric, je.reference
   from journal_entries je
  where je.status='posted' and je.total_debit::numeric in (10000,100000,150,1000)
  order by je.id`));
console.log("cash lines in those:", await q(`
 select je.id, a.code, ji.debit::numeric d, ji.credit::numeric c, left(coalesce(ji.notes,''),40) n
   from journal_entries je join journal_items ji on ji.journal_entry_id=je.id join accounts a on a.id=ji.account_id
  where je.id in (select id from journal_entries where total_debit::numeric in (10000,100000,150,1000) and status='posted')
    and a.code in ('1110','1120')
  order by je.id`));
console.log("vouchers with JE by description:", await q(`
 select t.id, t.amount::numeric, t.transaction_type, je.id je_id, je.source_type
   from treasury_transactions t
   left join journal_entries je on je.status='posted' and abs(je.total_debit - abs(t.amount)) < 0.01
  where t.id in (1,3,10,11,20,21,28,32,33,34) and t.status='approved'
  order by t.id, je.id`));
await c.end();
