import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
console.log("NOW:", (await c.query("select now() as n, current_setting('TimeZone') as tz")).rows[0]);
const fp = await c.query("SELECT id, month, year, status, to_char(start_date,'YYYY-MM-DD') sd, to_char(end_date,'YYYY-MM-DD') ed, closed_at FROM financial_periods WHERE year=2026 ORDER BY month");
console.table(fp.rows);
const je = await c.query(`SELECT status, COUNT(*) n, MIN(date) mn, MAX(date) mx,
   COUNT(*) FILTER (WHERE period_id IS NULL) no_period
   FROM journal_entries WHERE date >= '2026-10-01' AND date < '2026-11-01' GROUP BY status`);
console.table(je.rows);
const after = await c.query(`SELECT id, date, reference, source_type, status, total_debit, period_id, created_at
   FROM journal_entries WHERE date >= '2026-10-01' AND date < '2026-11-01' AND created_at > '2026-10-19 14:27:38' ORDER BY id DESC LIMIT 20`);
console.log("Entries created after Oct-2026 close:", after.rows.length);
console.table(after.rows);
await c.end();
