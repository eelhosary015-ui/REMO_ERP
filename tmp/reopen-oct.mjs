import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test")});
await c.connect();
await c.query("UPDATE financial_periods SET status='open', closed_at=NULL, closed_by=NULL, close_reason=NULL WHERE year=2026 AND month=10");
await c.query("DELETE FROM financial_period_events WHERE period_id=10 AND action IN ('close','reopen')");
console.log("reopened");
await c.end();
