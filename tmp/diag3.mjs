import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s,p) => (await c.query(s,p)).rows;
console.log("unlinked approved vouchers:");
console.table(await q(`
 select id, to_char(created_at,'YYYY-MM-DD') d, transaction_type type, amount::numeric,
        coalesce(client_name,'-') party, coalesce(voucher_number,'-') vno, account_id,
        left(coalesce(notes,''),40) notes
   from treasury_transactions
  where status='approved' and fin_number is null
  order by created_at`));
console.log("sum unlinked by type:", await q(`
 select transaction_type, count(*)::int n, sum(amount)::numeric s
   from treasury_transactions where status='approved' and fin_number is null
  group by 1`));
console.log("dup candidates (JE same amount within 3 days):", await q(`
 select t.id, t.transaction_type, t.amount::numeric, to_char(t.created_at,'YYYY-MM-DD') d,
        je.id je_id, to_char(je.date,'YYYY-MM-DD') jed, je.source_type
   from treasury_transactions t
   join journal_items ji on abs(ji.debit - abs(t.amount)) < 0.01 or abs(ji.credit - abs(t.amount)) < 0.01
   join journal_entries je on je.id = ji.journal_entry_id and je.status='posted'
  where t.status='approved' and t.fin_number is null
    and je.date::date between t.created_at::date - 3 and t.created_at::date + 3
  order by t.id limit 40`));
await c.end();
