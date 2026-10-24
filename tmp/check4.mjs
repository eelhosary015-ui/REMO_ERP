import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s, p) => (await c.query(s,p)).rows;
console.log("accounts:", await q("select count(*)::int n from accounts"));
console.table(await q("select id,code,name_ar,type,parent_id,is_leaf,allow_posting,balance from accounts order by code"));
console.log("journal counts:", await q("select status, count(*)::int n from journal_entries group by 1"));
console.log("je date range:", await q("select min(date)::text mn, max(date)::text mx from journal_entries"));
console.log("idempotency idx:", await q("select indexname,indexdef from pg_indexes where tablename='journal_entries'"));
console.log("user_logs exists:", await q("select to_regclass('public.user_logs') t"));
console.log("settings:", await q("select key,value from settings order by key"));
const fk = await q(`select tc.constraint_name, kcu.column_name, ccu.table_name foreign_table from information_schema.table_constraints tc
 join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name
 join information_schema.constraint_column_usage ccu on tc.constraint_name=ccu.constraint_name
 where tc.table_name='financial_periods' and tc.constraint_type='FOREIGN KEY'`);
console.log("fp fks:", fk);
await c.end();
