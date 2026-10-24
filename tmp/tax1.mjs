import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("sales tax:", await q(`select count(*)::int n, coalesce(sum(net_amount),0)::numeric net, coalesce(sum(tax_total),0)::numeric tax
 from sales_invoices where coalesce(status,'') not in ('ملغي','cancelled','canceled')`));
console.log("sales by month:", await q(`select to_char(date,'YYYY-MM') m, count(*)::int n, coalesce(sum(tax_total),0)::numeric tax
 from sales_invoices group by 1 order by 1`));
console.log("purchases tax:", await q(`select count(*)::int n, coalesce(sum(subtotal),0)::numeric net, coalesce(sum(tax_amount),0)::numeric tax from purchases`));
console.log("returns tax:", await q(`select
 (select coalesce(sum(tax_amount),0) from sales_returns)::numeric sret,
 (select coalesce(sum(tax_amount),0) from purchase_returns)::numeric pret`).catch(e=>e.message));
console.log("tax accounts:", await q(`select a.id,a.code,a.name_ar,a.type, coalesce(sum(ji.debit-ji.credit),0)::numeric net,
 count(ji.id)::int lines from accounts a left join journal_items ji on ji.account_id=a.id
 left join journal_entries je on je.id=ji.journal_entry_id and je.status='posted'
 where a.code in ('1107','2130') or a.name_ar ilike '%ضريب%' group by 1,2,3,4 order by 2`));
await c.end();
