import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test")});
await c.connect();
const q = async (s,p) => (await c.query(s,p)).rows;
const cust = await q("SELECT id FROM customers WHERE name='REPRO-CUST'");
const custId = cust[0]?.id;
async function tx(fn) { await c.query("BEGIN"); try { await fn(); await c.query("COMMIT"); } catch(e){ await c.query("ROLLBACK"); throw e; } }
if (custId) {
  await tx(async () => {
    const orders = (await q("SELECT id FROM erp_sales_orders WHERE customer_id=$1", [custId])).map(r=>r.id);
    const invoices = (await q("SELECT id FROM sales_invoices WHERE customer_id=$1", [custId])).map(r=>r.id);
    const deliveries = (await q("SELECT id FROM sales_delivery_notes WHERE customer_id=$1", [custId])).map(r=>r.id);
    if (invoices.length) {
      await c.query("DELETE FROM sales_invoice_items WHERE invoice_id = ANY($1::int[])", [invoices]);
      await c.query("DELETE FROM sales_invoices WHERE id = ANY($1::int[])", [invoices]);
    }
    if (deliveries.length) {
      await c.query("DELETE FROM sales_delivery_note_items WHERE delivery_id = ANY($1::int[])", [deliveries]);
      await c.query("DELETE FROM sales_delivery_notes WHERE id = ANY($1::int[])", [deliveries]);
    }
    if (orders.length) {
      await c.query("DELETE FROM sales_order_items WHERE sales_order_id = ANY($1::int[])", [orders]);
      await c.query("DELETE FROM erp_sales_orders WHERE id = ANY($1::int[])", [orders]);
    }
    const je = (await q("SELECT id FROM journal_entries WHERE source_type IN ('sales','pos') AND source_id = ANY($1::int[])", [invoices])).map(r=>r.id);
    if (je.length) {
      await c.query("UPDATE accounts a SET balance = a.balance - d.delta FROM (SELECT account_id, SUM(debit-credit) delta FROM journal_items WHERE journal_entry_id=ANY($1::int[]) GROUP BY 1) d WHERE a.id=d.account_id", [je]);
      await c.query("DELETE FROM journal_items WHERE journal_entry_id = ANY($1::int[])", [je]);
      await c.query("DELETE FROM journal_entries WHERE id = ANY($1::int[])", [je]);
    }
    await c.query("DELETE FROM customers WHERE id=$1", [custId]);
  });
}
await tx(async () => {
  await c.query("DELETE FROM inventory_items WHERE ingredient_id IN (SELECT id FROM ingredients WHERE name='REPRO-ITEM')");
  await c.query("DELETE FROM ingredients WHERE name='REPRO-ITEM'");
  await c.query("DELETE FROM warehouses WHERE name='REPRO-WH'");
});
console.log("cleaned");
await c.end();
