import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const rows = await c.query(`
  SELECT oc.id, oc.voucher_no, oc.date, oc.category, oc.amount, oc.cost_item_id, ci.name AS item_name,
         oc.journal_entry_id, je.entry_number, je.status AS je_status,
         (SELECT a.code || ' ' || a.name FROM journal_items ji JOIN accounts a ON a.id=ji.account_id
          WHERE ji.journal_entry_id = je.id AND ji.debit > 0 LIMIT 1) AS debit_account
  FROM operating_costs oc
  LEFT JOIN cost_items ci ON ci.id = oc.cost_item_id
  LEFT JOIN journal_entries je ON je.id = oc.journal_entry_id
  ORDER BY oc.id
`);
for (const r of rows.rows) console.log(`${r.id}\t${r.voucher_no}\t${r.date?.toISOString?.().slice(0,10)}\t${r.category}\t${r.amount}\titem=${String(r.item_name).trim()}\tJE=${r.entry_number}(${r.je_status})\tDR=${r.debit_account}`);
await c.end();
