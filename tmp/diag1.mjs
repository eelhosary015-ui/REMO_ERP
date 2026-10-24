import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s,p) => (await c.query(s,p)).rows;
console.log("accounts:", await q("select id,name,type,currency,current_balance,opening_balance,status,branch_id,company_id from treasury_accounts order by id"));
console.log("by type/status:", await q(`select account_id, transaction_type, status, count(*)::int n, sum(amount)::numeric total
 from treasury_transactions group by 1,2,3 order by 1,2,3`));
console.log("totals:", await q(`select count(*)::int n, sum(amount)::numeric s from treasury_transactions`));
await c.end();
