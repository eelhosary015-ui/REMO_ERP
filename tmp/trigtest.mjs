import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const url = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const c = new pg.Client({connectionString: url});
await c.connect();
async function tryIt(label, sql, params) {
  await c.query("BEGIN");
  try { const r = await c.query(sql, params); console.log(label, "=> OK", r.rows[0]); }
  catch (e) { console.log(label, "=> BLOCKED:", e.message, "| detail:", e.detail); }
  await c.query("ROLLBACK");
}
await c.query("BEGIN");
await c.query("UPDATE financial_periods SET status='closed', closed_at=NOW() WHERE month=10 AND year=2026");
await c.query("COMMIT");
await tryIt("insert 15/10 posted", `INSERT INTO journal_entries (date,description,status,total_debit,total_credit) VALUES ('2026-10-15','test','posted',100,100) RETURNING id`);
await tryIt("insert 15/11 posted", `INSERT INTO journal_entries (date,description,status,total_debit,total_credit) VALUES ('2026-11-15','test','posted',100,100) RETURNING id, period_id`);
await tryIt("insert 31/10 posted", `INSERT INTO journal_entries (date,description,status,total_debit,total_credit) VALUES ('2026-10-31','test','posted',100,100) RETURNING id, period_id`);
// bypass
await c.query("BEGIN"); await c.query("SET LOCAL app.period_lock_bypass='on'");
try { const r = await c.query(`INSERT INTO journal_entries (date,description,status,total_debit,total_credit) VALUES ('2026-10-16','closing','posted',100,100) RETURNING id, period_id`); console.log("bypass insert => OK", r.rows[0]); } catch(e){ console.log("bypass => FAIL", e.message); }
await c.query("ROLLBACK");
await c.query("UPDATE financial_periods SET status='open', closed_at=NULL WHERE month=10 AND year=2026");
await c.end();
