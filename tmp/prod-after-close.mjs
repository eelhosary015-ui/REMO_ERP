import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log(await q(`select count(*)::int n from journal_entries je join financial_periods fp on fp.id=je.period_id
 where je.status='posted' and fp.status='closed' and fp.closed_at is not null and je.created_at > fp.closed_at
 and coalesce(je.source_type,'') not in ('year_end_closing','closing','opening_balance')`));
console.log(await q(`select je.id, je.created_at, to_char(je.date,'YYYY-MM-DD') d, je.source_type, je.reference from journal_entries je
 where je.status='posted' and je.date::date between '2026-10-01' and '2026-10-31' and je.created_at > '2026-10-19 14:27:38' order by je.id`));
await c.end();
