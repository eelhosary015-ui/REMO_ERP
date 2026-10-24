import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("nature casing:", await q(`
 select coalesce(account_nature,'(null)') nature, count(*)::int n from accounts group by 1 order by 1`));
console.log("accounts with lowercase nature:", await q(`
 select id, code, name_ar, account_nature, type from accounts
  where account_nature is not null and account_nature <> upper(account_nature) order by code`));
console.log("4102 opening by range:", await q(`
 select
  coalesce((select sum(case when upper(coalesce(a.account_nature,''))='CREDIT' then ji.credit-ji.debit else ji.debit-ji.credit end)
     from journal_items ji join journal_entries je on je.id=ji.journal_entry_id
    where ji.account_id=a.id and je.date::date < '2026-10-31' and je.status='posted'),0)::numeric fixed_opening,
  coalesce((select sum(case when a.account_nature='CREDIT' then ji.credit-ji.debit else ji.debit-ji.credit end)
     from journal_items ji join journal_entries je on je.id=ji.journal_entry_id
    where ji.account_id=a.id and je.date::date < '2026-10-31' and je.status<>'canceled'),0)::numeric old_opening
 from accounts a where a.code='4102'`));
await c.end();
