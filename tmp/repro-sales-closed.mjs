/** إعادة إنتاج عطل «البيع داخل فترة مغلقة» عبر HTTP. */
import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });
const BASE = "http://127.0.0.1:3100";
const URL = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const ST_APPROVED = "\u0645\u0639\u062a\u0645\u062f\u0629"; // معتمدة

const db = new pg.Client({ connectionString: URL });
await db.connect();
const one = async (s, p) => (await db.query(s, p)).rows[0];

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

// تنظيف فواتير المحاولات السابقة
const old = await db.query("SELECT id FROM sales_invoices WHERE customer_name='REPRO-CUST'");
for (const row of old.rows) {
  await db.query("DELETE FROM sales_invoice_items WHERE invoice_id=$1", [row.id]);
  await db.query("DELETE FROM sales_invoices WHERE id=$1", [row.id]);
}

const period = await one("SELECT id, status FROM financial_periods WHERE year=2026 AND month=10");
console.log("period 10/2026:", period);
if (period.status !== "closed") {
  const close = await api("POST", `/api/financial-periods/${period.id}/close`, { reason: "repro partial sale" });
  console.log("close:", close.status, close.data?.message || close.data?.error);
}

const before = await one("SELECT COALESCE(quantity,0)::numeric q FROM inventory_items WHERE warehouse_id=190 AND ingredient_id=194");
console.log("stock before:", before.q);

const payload = {
  customerName: "REPRO-CUST",
  customerId: 241,
  warehouseId: 190,
  date: "2026-10-15",
  status: ST_APPROVED,
  paymentMethod: "\u0622\u062c\u0644", // آجل
  paidAmount: 0,
  items: [{ name: "REPRO-ITEM", qty: 2, price: 100, ingredientId: 194 }],
};
const created = await api("POST", "/api/v2/sales/invoices", payload);
console.log("create invoice:", created.status, JSON.stringify(created.data).slice(0, 300));

const inv = await one("SELECT id, invoice_no, is_posted, journal_entry_id, status, net_amount, total_cost FROM sales_invoices WHERE customer_name='REPRO-CUST' ORDER BY id DESC LIMIT 1");
console.log("invoice row:", inv);

const after = await one("SELECT COALESCE(quantity,0)::numeric q FROM inventory_items WHERE warehouse_id=190 AND ingredient_id=194");
console.log("stock after:", after.q);

const je = inv?.journal_entry_id ? await one("SELECT id, date::text, status FROM journal_entries WHERE id=$1", [inv.journal_entry_id]) : null;
console.log("journal entry:", je);

console.log("\n--- SUMMARY ---");
console.log(JSON.stringify({
  http_status: created.status,
  error: created.data?.error || null,
  invoice_saved: !!inv,
  is_posted: inv?.is_posted ?? null,
  stock_deducted: inv ? Number(before.q) - Number(after.q) : null,
  journal_entry: inv?.journal_entry_id ?? null,
}, null, 2));

await db.end();
