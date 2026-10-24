import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
await c.query("UPDATE suppliers SET balance = 0.00 WHERE id = 3");
console.log("supplier #3 → 0.00");
for (const r of (await c.query(`SELECT id, invoice_no, status, net_amount, paid_amount, journal_entry_id FROM sales_invoices WHERE id IN (14,15,28)`)).rows)
  console.log(JSON.stringify(r));
await c.end();
