import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
const sales = await q("select count(*)::int n from sales_invoices where is_posted=true and journal_entry_id is null");
const purch = await q("select count(*)::int n from purchases where posted_journal_entry_id is null and coalesce(status,'') not in ('مسودة','draft','ملغي','cancelled','canceled','')");
const grn = await q("select count(*)::int n from goods_receipts where is_posted=true and journal_entry_id is null");
const inside = await q(`select count(*)::int n from journal_entries je join financial_periods fp on fp.id=je.period_id
 where je.status='posted' and fp.status in ('closed','frozen') and coalesce(je.source_type,'') not in ('year_end_closing','closing','opening_balance')`);
const nullp = await q("select count(*)::int n from journal_entries where period_id is null");
const unbal = await q(`select count(*)::int n from (select je.id from journal_entries je left join journal_items ji on ji.journal_entry_id=je.id
 where je.status='posted' group by je.id having abs(coalesce(sum(ji.debit),0)-coalesce(sum(ji.credit),0))>0.01) t`);
console.log(JSON.stringify({sales_posted_without_je: sales[0].n, purchases_without_je: purch[0].n, grn_without_je: grn[0].n, posted_inside_closed: inside[0].n, entries_without_period: nullp[0].n, unbalanced: unbal[0].n}, null, 2));
const sample = await q(`select je.id, to_char(je.date,'YYYY-MM-DD') d, je.reference, je.source_type, fp.month, fp.year
 from journal_entries je join financial_periods fp on fp.id=je.period_id
 where je.status='posted' and fp.status in ('closed','frozen') and coalesce(je.source_type,'') not in ('year_end_closing','closing','opening_balance')
 order by je.date desc limit 8`);
console.log(sample);
await c.end();
