// TEMP cleanup for the tax verification test invoices (ids 5,6,7,8) — deletes only those rows.
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const ids = [5, 6, 7, 8];
  const before = JSON.parse(fs.readFileSync("_tax_verify_before.json", "utf8"));

  const q = async (sql, p) => (await pool.query(sql, p)).rows;

  await pool.query("BEGIN");
  try {
    const gri = await q("SELECT id FROM goods_receipt_items WHERE goods_receipt_id::int = ANY($1::int[])", [ids]);
    const griIds = gri.map((r) => Number(r.id));
    if (griIds.length) {
      const delInvTx = await pool.query(
        "DELETE FROM inventory_transactions WHERE reference_type='goods_receipt' AND reference_id = ANY($1::bigint[])",
        [griIds]
      );
      console.log("deleted inventory_transactions:", delInvTx.rowCount, "for gri ids:", griIds);
    }
    const delGri = await pool.query("DELETE FROM goods_receipt_items WHERE goods_receipt_id = ANY($1::int[])", [ids]);
    console.log("deleted goods_receipt_items:", delGri.rowCount);
    const delGr = await pool.query("DELETE FROM goods_receipts WHERE id = ANY($1::int[])", [ids]);
    console.log("deleted goods_receipts:", delGr.rowCount);

    const je = await q("SELECT id FROM journal_entries WHERE source_type='purchase' AND source_id = ANY($1::int[])", [ids]);
    if (je.length) {
      const jeIds = je.map((r) => Number(r.id));
      const delJi = await pool.query("DELETE FROM journal_items WHERE journal_entry_id = ANY($1::int[])", [jeIds]);
      const delJe = await pool.query("DELETE FROM journal_entries WHERE id = ANY($1::int[])", [jeIds]);
      console.log("deleted journal_items:", delJi.rowCount, "journal_entries:", delJe.rowCount);
    }
    const delSt = await pool.query(
      "DELETE FROM supplier_transactions WHERE reference_id = ANY($1::int[]) AND reference_type IN ('purchase_invoice','purchase_payment')",
      [ids]
    );
    console.log("deleted supplier_transactions:", delSt.rowCount);
    const delAlloc = await pool.query("DELETE FROM supplier_payment_allocations WHERE purchase_id = ANY($1::int[])", [ids]);
    console.log("deleted supplier_payment_allocations:", delAlloc.rowCount);
    const delPi = await pool.query("DELETE FROM purchase_items WHERE purchase_id = ANY($1::int[])", [ids]);
    console.log("deleted purchase_items:", delPi.rowCount);
    const delP = await pool.query("DELETE FROM purchases WHERE id = ANY($1::int[])", [ids]);
    console.log("deleted purchases:", delP.rowCount);

    // Restore ONLY the rows the test touched, using the captured pre-test values:
    // supplier #3, ingredient #6, and its inventory row in the test warehouse (#1).
    const s0 = before.suppliers.find((s) => s.id === 3);
    if (s0) await pool.query("UPDATE suppliers SET balance=$1 WHERE id=$2", [s0.balance, s0.id]);
    const i0 = before.ingredients.find((i) => i.id === 6);
    if (i0) await pool.query("UPDATE ingredients SET cost=$1, avg_cost=$2, last_purchase_price=$3 WHERE id=$4", [
      i0.cost, i0.avg_cost, i0.last_purchase_price, i0.id,
    ]);
    for (const it of before.inventory.filter((x) => x.ingredient_id === 6 && x.warehouse_id === 1)) {
      await pool.query("UPDATE inventory_items SET quantity=$1, avg_cost=$2, last_cost=$3 WHERE id=$4", [
        it.quantity, it.avg_cost, it.last_cost, it.id,
      ]);
    }
    await pool.query("COMMIT");
    console.log("cleanup committed");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  // Verify restoration
  const suppliers = await q("SELECT id,name,balance FROM suppliers ORDER BY id");
  const ingredients = await q("SELECT id,cost,avg_cost,last_purchase_price FROM ingredients ORDER BY id");
  const inventory = await q("SELECT id,warehouse_id,ingredient_id,quantity,avg_cost,last_cost FROM inventory_items ORDER BY id");
  const cmp = (a, b, keys) => JSON.stringify(a.map((r) => keys.map((k) => String(r[k])))) === JSON.stringify(b.map((r) => keys.map((k) => String(r[k]))));
  console.log("suppliers restored:", cmp(suppliers, before.suppliers, ["id", "name", "balance"]));
  console.log("ingredients restored:", cmp(ingredients, before.ingredients, ["id", "cost", "avg_cost", "last_purchase_price"]));
  console.log("inventory restored:", cmp(inventory, before.inventory, ["id", "warehouse_id", "ingredient_id", "quantity", "avg_cost", "last_cost"]));
  console.log("leftover purchases:", await q("SELECT COUNT(*) c FROM purchases WHERE id = ANY($1::int[])", [ids]));
  console.log("leftover docs mentioning TAX-VERIFY-TEMP:",
    await q("SELECT COUNT(*) c FROM purchases WHERE COALESCE(notes,'') LIKE '%TAX-VERIFY-TEMP%'"));
  await pool.end();
})().catch((e) => { console.error("CLEANUP FAILED:", e); process.exit(1); });
