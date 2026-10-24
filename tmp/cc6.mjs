import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const rows = (await c.query(`
WITH RECURSIVE tree AS (
  SELECT id AS root_id, id FROM cost_centers
  UNION ALL
  SELECT t.root_id, c.id FROM cost_centers c JOIN tree t ON c.parent_id = t.id
),
gl AS (
  SELECT ji.cost_center_id AS cc,
         SUM(CASE WHEN LOWER(COALESCE(a.type,''))='expense' THEN ji.debit-ji.credit ELSE 0 END) AS expenses,
         SUM(CASE WHEN LOWER(COALESCE(a.type,''))='revenue' THEN ji.credit-ji.debit ELSE 0 END) AS revenues
    FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id JOIN accounts a ON a.id=ji.account_id
   WHERE je.status='posted' AND ji.cost_center_id IS NOT NULL
     AND ($1::date IS NULL OR je.date::date >= $1::date) AND ($2::date IS NULL OR je.date::date <= $2::date)
   GROUP BY 1
),
unposted AS (
  SELECT cost_center_id AS cc, SUM(COALESCE(NULLIF(total,0), amount, 0)) AS expenses
    FROM operating_costs
   WHERE cost_center_id IS NOT NULL AND journal_entry_id IS NULL
     AND COALESCE(status,'') NOT IN ('ملغي','cancelled','canceled')
   GROUP BY 1
),
totals AS (
  SELECT t.root_id AS cc, COALESCE(SUM(g.expenses),0)+COALESCE(SUM(u.expenses),0) AS expenses, COALESCE(SUM(g.revenues),0) AS revenues
    FROM tree t LEFT JOIN gl g ON g.cc=t.id LEFT JOIN unposted u ON u.cc=t.id GROUP BY 1
)
SELECT cc.id, cc.code, cc.name,
  COALESCE(tot.expenses,0)::numeric expenses, COALESCE(tot.revenues,0)::numeric revenues,
  (COALESCE(tot.revenues,0)-COALESCE(tot.expenses,0))::numeric profit
 FROM cost_centers cc LEFT JOIN totals tot ON tot.cc=cc.id ORDER BY cc.code`,[null,null])).rows;
console.table(rows);
await c.end();
