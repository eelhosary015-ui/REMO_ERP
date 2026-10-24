/** تحقق: أمر بيع داخل فترة مغلقة لا يخصم مخزونًا ولا ينشئ فاتورة/قيدًا. */
import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });
const BASE = "http://127.0.0.1:3100";
const URL = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const ST_CONFIRMED = "\u0645\u0624\u0643\u062f"; // مؤكد
const ST_APPROVED = "\u0645\u0639\u062a\u0645\u062f\u0629"; // معتمدة
const ST_DRAFT = "\u0645\u0633\u0648\u062f\u0629"; // مسودة
const CASH = "\u0646\u0642\u062f\u064a"; // نقدي

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

const period = await one("SELECT id,status FROM financial_periods WHERE year=2026 AND month=10");
if (period.status !== "closed") {
  await api("POST", `/api/financial-periods/${period.id}/close`, { reason: "repro" });
}

const stock0 = await one("SELECT COALESCE(quantity,0)::numeric q FROM inventory_items WHERE warehouse_id=190 AND ingredient_id=194");
console.log("stock before:", stock0.q);

// 1) أمر بيع داخل فترة مغلقة
const order = await api("POST", "/api/v2/sales/orders", {
  customerId: 241,
  customerName: "REPRO-CUST",
  date: "2026-10-15",
  status: ST_CONFIRMED,
  paymentMethod: CASH,
  warehouseId: 190,
  warehouse: "REPRO-WH",
  items: [
    { ingredientId: 194, itemName: "REPRO-ITEM", name: "REPRO-ITEM", qty: 3, qtyRequired: 3, price: 100, unit: "\u0642\u0637\u0639\u0629" },
  ],
});
console.log("create order:", order.status, JSON.stringify(order.data).slice(0, 200));
const orderId = order.data?.data?.id || order.data?.id;

let confirm = { status: 0, data: null };
if (orderId) {
  confirm = await api("POST", `/api/v2/sales/orders/${orderId}/confirm-and-deliver`, {
    autoDispatch: true,
    warehouseId: 190,
    postedBy: "repro",
  });
  console.log("confirm+dispatch:", confirm.status, JSON.stringify(confirm.data).slice(0, 240));
}

const stock1 = await one("SELECT COALESCE(quantity,0)::numeric q FROM inventory_items WHERE warehouse_id=190 AND ingredient_id=194");
const deliveries = await one("SELECT COUNT(*)::int n FROM sales_delivery_notes WHERE order_id=$1 AND COALESCE(is_posted,false)=true", [orderId || -1]);
const invoices = await one("SELECT COUNT(*)::int n FROM sales_invoices WHERE order_id=$1", [orderId || -1]);

console.log("stock after closed-order attempt:", stock1.q);
console.log("posted deliveries:", deliveries.n, "invoices:", invoices.n);
console.log("RESULT closed order =>", JSON.stringify({
  http: confirm.status,
  error: confirm.data?.error?.slice?.(0, 120) || confirm.data?.error || null,
  stock_delta: Number(stock1.q) - Number(stock0.q),
  posted_deliveries: deliveries.n,
  invoices: invoices.n,
}));

// 2) نفس العملية في فترة مفتوحة (نوفمبر) — يجب أن تنجح بالكامل
const nov = await one("SELECT id,status FROM financial_periods WHERE year=2026 AND month=11");
const stock2 = await one("SELECT COALESCE(quantity,0)::numeric q FROM inventory_items WHERE warehouse_id=190 AND ingredient_id=194");

const order2 = await api("POST", "/api/v2/sales/orders", {
  customerId: 241,
  customerName: "REPRO-CUST",
  date: "2026-11-10",
  status: ST_CONFIRMED,
  paymentMethod: CASH,
  warehouseId: 190,
  warehouse: "REPRO-WH",
  items: [
    { ingredientId: 194, itemName: "REPRO-ITEM", name: "REPRO-ITEM", qty: 2, qtyRequired: 2, price: 100, unit: "\u0642\u0637\u0639\u0629" },
  ],
});
const order2Id = order2.data?.data?.id || order2.data?.id;
let confirm2 = { status: 0, data: null };
if (order2Id) {
  confirm2 = await api("POST", `/api/v2/sales/orders/${order2Id}/confirm-and-deliver`, {
    autoDispatch: true, warehouseId: 190, postedBy: "repro",
  });
}
const stock3 = await one("SELECT COALESCE(quantity,0)::numeric q FROM inventory_items WHERE warehouse_id=190 AND ingredient_id=194");
const inv2 = await one("SELECT id, is_posted, journal_entry_id FROM sales_invoices WHERE order_id=$1 ORDER BY id DESC LIMIT 1", [order2Id || -1]);
console.log("RESULT open order =>", JSON.stringify({
  create_http: order2.status,
  confirm_http: confirm2.status,
  error: confirm2.data?.error || null,
  stock_delta: Number(stock3.q) - Number(stock2.q),
  invoice: inv2?.id ?? null,
  invoice_posted: inv2?.is_posted ?? null,
  journal_entry: inv2?.journal_entry_id ?? null,
}));

await db.end();
