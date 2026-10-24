import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const r = await c.query(`
  SELECT oc.id, oc.voucher_no, oc.date, oc.status, oc.amount, oc.journal_entry_id,
         je.status AS je_status, je.date AS je_date
  FROM operating_costs oc LEFT JOIN journal_entries je ON je.id = oc.journal_entry_id
  WHERE oc.journal_entry_id IS NOT NULL ORDER BY oc.id`);
let total = 0;
for (const x of r.rows) { total += Number(x.amount); console.log(`cost#${x.id} ${x.voucher_no} ${x.date?.toISOString().slice(0,10)} ${x.amount} → JE#${x.journal_entry_id} (${x.je_status}) cost_status=${x.status}`); }
console.log("TOTAL to reclassify:", total);
const draft = await c.query("SELECT id, voucher_no, amount, status FROM operating_costs WHERE journal_entry_id IS NULL ORDER BY id");
console.log("بدون قيد:", JSON.stringify(draft.rows));
await c.end();
