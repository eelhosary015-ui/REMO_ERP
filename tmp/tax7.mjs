import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const r = await c.query(`select count(*) filter (where doc_type='sale' and entry_id is null and tax_amount>0)::int unposted_sales,
 count(*) filter (where doc_type='purchase' and entry_id is null and tax_amount>0)::int unposted_purch
 from (
  select 'sale' doc_type, si.journal_entry_id entry_id, coalesce(si.tax_total,0) tax_amount from sales_invoices si
  union all
  select 'purchase', p.posted_journal_entry_id, coalesce(p.tax_amount,0) from purchases p
 ) x`);
console.log("unposted:", r.rows[0]);
await c.end();
