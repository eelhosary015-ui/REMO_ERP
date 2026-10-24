import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("invoices with tax:", await q(`select id, invoice_no, net_amount::numeric net, tax_total::numeric tax, total_amount::numeric total, journal_entry_id, is_posted from sales_invoices where tax_total > 0 order by id limit 6`).catch(async()=>await q(`select id, invoice_no, net_amount::numeric net, tax_total::numeric tax, journal_entry_id from sales_invoices where tax_total>0 limit 6`)));
console.log("JE lines for tax invoices:", await q(`
 select je.id je, a.code, a.name_ar, ji.debit::numeric d, ji.credit::numeric cr
   from journal_entries je join journal_items ji on ji.journal_entry_id=je.id join accounts a on a.id=ji.account_id
  where je.source_type='SALES_INVOICE' and je.id in (
    select journal_entry_id from sales_invoices where tax_total>0 and journal_entry_id is not null limit 3)
  order by je.id, ji.id`));
console.log("invoice total col?", await q(`select column_name from information_schema.columns where table_name='sales_invoices' and column_name in ('total_amount','tax_total','net_amount','total')`));
await c.end();
