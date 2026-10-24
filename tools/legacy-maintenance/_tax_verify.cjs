// TEMP verification script for purchase-invoice tax feature (will be deleted).
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");

const BASE = "http://127.0.0.1:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "elhosary", password: "Admin@1234" }),
  });
  const data = await res.json();
  if (!data.token) throw new Error("login failed: " + JSON.stringify(data));
  return data.token;
}

async function snapshot() {
  const suppliers = await pool.query("SELECT id,name,balance FROM suppliers ORDER BY id");
  const ingredients = await pool.query(
    "SELECT id,name,unit,cost,avg_cost,last_purchase_price FROM ingredients ORDER BY id"
  );
  const inventory = await pool.query(
    "SELECT id,warehouse_id,ingredient_id,quantity,avg_cost,last_cost FROM inventory_items ORDER BY id"
  );
  return { suppliers: suppliers.rows, ingredients: ingredients.rows, inventory: inventory.rows };
}

(async () => {
  const token = await login();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const whs = (await pool.query("SELECT id,name,type,is_main FROM warehouses ORDER BY id")).rows;
  const wh = whs.find((w) => w.type === "main" || w.is_main === true || w.is_main === 1 || w.is_main === "1") || whs[0];
  const ing = (await pool.query("SELECT id,name,unit FROM ingredients WHERE id=6")).rows[0];
  const supplier = (await pool.query("SELECT id,name,balance FROM suppliers WHERE id=3")).rows[0];
  console.log("USING warehouse:", wh, "ingredient:", ing, "supplier:", supplier);

  const before = await snapshot();
  fs.writeFileSync("_tax_verify_before.json", JSON.stringify(before, null, 2));

  const stamp = Date.now();
  const mk = (borne, expectedTotal) => ({
    supplier_id: supplier.id,
    warehouse_id: wh.id,
    supplier_invoice_number: `TEST-TAX-${borne}-${stamp}`,
    invoice_number: `TEST-TAX-${borne}-${stamp}`,
    subtotal: 100,
    tax_amount: 14,
    tax_rate: 14,
    tax_borne_by: borne,
    total_amount: expectedTotal,
    paid_amount: 0,
    notes: "TAX-VERIFY-TEMP",
    items: [{ ingredient_id: ing.id, quantity: 1, unit_price: 100, total_price: 100 }],
  });

  const create = async (payload) => {
    const res = await fetch(`${BASE}/api/purchases`, { method: "POST", headers: auth, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  };

  const c1 = await create(mk("company", 114));
  console.log("company-borne create:", c1.status, "id=", c1.body && c1.body.id);
  const c2 = await create(mk("supplier", 86));
  console.log("supplier-borne create:", c2.status, "id=", c2.body && c2.body.id);

  await new Promise((r) => setTimeout(r, 4000)); // let async GL auto-post finish

  const ids = [c1.body && c1.body.id, c2.body && c2.body.id].filter(Boolean);
  console.log("\n=== purchases rows ===");
  console.log((await pool.query(
    `SELECT id,invoice_number,subtotal,tax_amount,tax_rate,tax_borne_by,total_amount,paid_amount,status,receipt_id,supplier_id,warehouse_id FROM purchases WHERE id = ANY($1::int[]) ORDER BY id`, [ids]
  )).rows);

  console.log("\n=== supplier balance + transactions ===");
  console.log((await pool.query("SELECT id,name,balance FROM suppliers WHERE id=$1", [supplier.id])).rows);
  console.log((await pool.query(
    "SELECT id,supplier_id,type,amount,reference_id,reference_type FROM supplier_transactions WHERE reference_id = ANY($1::int[]) ORDER BY id", [ids]
  )).rows);

  console.log("\n=== goods_receipts (inventory value must exclude tax) ===");
  const grs = (await pool.query(
    `SELECT gr.id,gr.receipt_no,gr.purchase_id,gr.total_amount,gr.discount_amount,gr.tax_amount,gr.net_amount,gr.freight_charges,gr.total_landed_cost,gr.journal_entry_id
     FROM goods_receipts gr WHERE gr.purchase_id = ANY($1::int[]) ORDER BY gr.id`, [ids]
  )).rows;
  console.log(grs);

  console.log("\n=== journal entries (source purchase / goods_receipt) ===");
  for (const id of ids) {
    const je = (await pool.query("SELECT id,reference,description,source_type,source_id,total_debit,total_credit,status FROM journal_entries WHERE source_type='purchase' AND source_id=$1 ORDER BY id", [id])).rows;
    console.log("purchase #" + id, je);
    for (const e of je) {
      console.log("  items:", (await pool.query(
        `SELECT ji.account_id,a.code,a.name,ji.debit,ji.credit,ji.notes FROM journal_items ji LEFT JOIN accounts a ON a.id=ji.account_id WHERE ji.journal_entry_id=$1 ORDER BY ji.id`, [e.id]
      )).rows);
    }
  }
  const grJe = (await pool.query(
    "SELECT id,reference,source_type,source_id,total_debit,total_credit FROM journal_entries WHERE source_type='goods_receipt' AND id = ANY($1::int[])",
    [grs.map((g) => g.journal_entry_id).filter(Boolean)]
  )).rows;
  console.log("GRN entries:", grJe);

  console.log("\n=== inventory_items (ingredient 6) & ingredients ===");
  console.log((await pool.query("SELECT id,warehouse_id,ingredient_id,quantity,avg_cost,last_cost FROM inventory_items WHERE ingredient_id=$1 ORDER BY id", [ing.id])).rows);
  console.log((await pool.query("SELECT id,name,cost,avg_cost,last_purchase_price FROM ingredients WHERE id=$1", [ing.id])).rows);
  console.log("\n=== inventory_transactions for these GRNs ===");
  console.log((await pool.query(
    "SELECT id,warehouse_id,ingredient_id,quantity,unit_cost,total_cost,reference_type,reference_id,transaction_number FROM inventory_transactions WHERE reference_type IN ('goods_receipt') AND reference_id = ANY($1::int[]) ORDER BY id",
    [[...grs.map((g) => g.id)]]
  )).rows);

  console.log("\nDONE. created purchase ids:", ids, "grn ids:", grs.map((g) => g.id));
  await pool.end();
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
