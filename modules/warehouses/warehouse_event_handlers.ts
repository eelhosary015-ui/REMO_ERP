// ═══════════════════════════════════════════════════════════════
// Warehouse Event Handlers — Integration Hub
// Connects Warehouse module with Sales, Purchases, Production, Accounting
// ═══════════════════════════════════════════════════════════════
import { ERPEventBus } from "../../server-erp-core.js";
import { pool } from "../../server-db.js";

let initialized = false;

export function initWarehouseEventHandlers() {
  if (initialized) return;
  initialized = true;
  const eventBus = ERPEventBus.getInstance();

  // ═══════════════════════════════════════════════════════════════
  // 1. AUTO-ISSUE ON SALE COMPLETION (Sales → Warehouse)
  // When a restaurant order is completed, auto-issue ingredients from default warehouse
  // ═══════════════════════════════════════════════════════════════
  eventBus.on("OrderStatusUpdated", async (data: any) => {
    if (data.status !== "completed" && data.status !== "delivered" && !data.isPaid) return;
    try {
      // Guard against double stock deductions and duplicate accounting events if order was already deducted
      const orderCheck = (await pool.query("SELECT is_deducted FROM orders WHERE id = $1", [data.orderId])).rows[0];
      if (orderCheck?.is_deducted === 1) {
        return; // Already deducted canonically on POS order creation
      }
      console.log(`[WH Integration] Order #${data.orderId} completed — auto-issuing ingredients...`);
      // Find order items + their ingredients
      const orderItems = (await pool.query(`
        SELECT oi.product_id, oi.quantity
        FROM order_items oi WHERE oi.order_id = $1
      `, [data.orderId])).rows;
      if (orderItems.length === 0) {
        console.log(`[WH Integration] No items found for order #${data.orderId}`);
        return;
      }
      // Aggregate ingredient quantities needed
      const neededMap = new Map<number, number>();
      for (const item of orderItems) {
        const ings = (await pool.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id])).rows;
        for (const ing of ings) {
          const need = Number(ing.quantity) * Number(item.quantity);
          neededMap.set(Number(ing.ingredient_id), (neededMap.get(Number(ing.ingredient_id)) || 0) + need);
        }
      }
      if (neededMap.size === 0) return;
      // Find default warehouse
      const defWh = (await pool.query("SELECT id FROM warehouses WHERE is_default = true LIMIT 1")).rows[0] ||
                    (await pool.query("SELECT id FROM warehouses WHERE status = 'active' ORDER BY id LIMIT 1")).rows[0];
      if (!defWh) { console.log("[WH Integration] No active warehouse found"); return; }
      const whId = defWh.id;
      // Create issue transaction
      const txNumber = `SL-${data.orderId}-${Date.now().toString().slice(-6)}`;
      const itemsArr: any[] = [];
      for (const [ingId, qty] of neededMap.entries()) {
        const ing = (await pool.query("SELECT name, unit, avg_cost FROM ingredients WHERE id=$1", [ingId])).rows[0];
        if (ing) itemsArr.push({ ingredient_id: ingId, name: ing.name, unit: ing.unit, quantity: qty, price: Number(ing.avg_cost) || 0 });
      }
      if (itemsArr.length === 0) return;
      const totalSaleQty = itemsArr.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      await pool.query(
        `INSERT INTO inventory_transactions (transaction_number, date, warehouse_id, quantity, type, reason, reference, user, status, notes, items)
         VALUES ($1,$2,$3,$4,'issue','بيع','ORD-${data.orderId}','system','approved','صرف تلقائي لأمر بيع مكتمل',$5)`,
        [txNumber, new Date().toISOString().split("T")[0], whId, totalSaleQty, JSON.stringify(itemsArr)]
      );
      // Apply stock movements (decrement inventory_items)
      for (const item of itemsArr) {
        const existing = (await pool.query("SELECT id, quantity FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2", [whId, item.ingredient_id])).rows[0];
        if (existing) {
          const newQty = Math.max(0, Number(existing.quantity) - Number(item.quantity));
          await pool.query("UPDATE inventory_items SET quantity=$1, available=GREATEST($2::numeric - COALESCE(reserved,0),0) WHERE id=$3", [newQty, newQty, existing.id]);
        }
        // Audit log
        await pool.query(
          `INSERT INTO inventory_movements (warehouse_id, ingredient_id, field, before_qty, delta, after_qty, ref_type, ref_id, "user", notes, created_at)
           VALUES ($1,$2,'quantity',$3,$4,$5,'transaction',0,'system',$6,NOW())`,
          [whId, item.ingredient_id, Number(existing?.quantity || 0), -item.quantity, Number(existing?.quantity || 0) - item.quantity, `صرف تلقائي لأمر بيع #${data.orderId}`]
        );
        // Emit event for accounting
        eventBus.emitEvent("InventoryAdjusted", {
          adjustmentId: 0,
          warehouseId: whId,
          ingredientId: item.ingredient_id,
          ingredientName: item.name,
          quantity: -item.quantity,
          unitCost: item.price,
          type: "out",
          branchId: data.branchId,
        });
      }
      console.log(`[WH Integration] ✅ Auto-issued ${itemsArr.length} ingredients for order #${data.orderId}`);
    } catch (e: any) {
      console.error(`[WH Integration] ❌ Order #${data.orderId} auto-issue error:`, e.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. PURCHASE -> WAREHOUSE
  // Stock is now mutated ONLY by the canonical goods_receipts flow.
  // This listener intentionally performs no inventory writes, preventing
  // the historical double-receive bug.
  // ═══════════════════════════════════════════════════════════════
  eventBus.on("PurchaseCreated", async (data: any) => {
    try {
      console.log(`[WH Integration] Purchase #${data.purchaseId} linked to GRN #${data.receiptId || 'pending'} — no duplicate stock movement.`);
    } catch (e: any) {
      console.error(`[WH Integration] Purchase link audit error:`, e.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. AUTO-CONSUME ON PRODUCTION COMPLETION (Production → Warehouse)
  // When a production run is completed, consume raw materials and produce finished goods
  // ═══════════════════════════════════════════════════════════════
  eventBus.on("ProductionRunCompleted", async (data: any) => {
    try {
      console.log(`[WH Integration] Production Run #${data.runId} — consuming materials + producing finished goods...`);
      const whId = data.warehouseId;
      if (!whId) { console.log("[WH Integration] No warehouseId provided"); return; }
      // Fetch production run details
      const run = (await pool.query("SELECT * FROM production_runs WHERE id = $1", [data.runId])).rows[0];
      if (!run) { console.log(`[WH Integration] Production run #${data.runId} not found`); return; }

      // Check if canonical inventory posting has already processed this run/order
      if (run.order_number) {
        const canonicalExists = (await pool.query(
          "SELECT 1 FROM inventory_transactions WHERE reference = $1 LIMIT 1",
          [run.order_number]
        )).rows.length > 0;
        
        if (canonicalExists) {
          console.log(`[WH Integration] Production Run #${data.runId} (Order: ${run.order_number}) is already posted canonically. Skipping duplicate event posting.`);
          return;
        }
      }

      // Consume raw materials (recipe ingredients)
      const recipeItems = (await pool.query(`
        SELECT ri.ingredient_id, ri.quantity, i.name, i.unit, i.avg_cost
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.product_id = $1
      `, [data.productId])).rows;
      const producedQty = Number(data.producedQuantity || run.quantity || 0);
      const itemsConsumed: any[] = [];
      for (const ri of recipeItems) {
        const need = Number(ri.quantity) * producedQty;
        itemsConsumed.push({ ingredient_id: ri.ingredient_id, name: ri.name, unit: ri.unit, quantity: need, price: Number(ri.avg_cost) || 0 });
      }
      if (itemsConsumed.length > 0) {
        const txNumber = `MO-CONS-${data.runId}-${Date.now().toString().slice(-6)}`;
        const totalConsQty = itemsConsumed.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        await pool.query(
          `INSERT INTO inventory_transactions (transaction_number, date, warehouse_id, quantity, type, reason, reference, user, status, notes, items)
           VALUES ($1,$2,$3,$4,'issue','إنتاج','MO-${data.runId}','system','approved','صرف خامات لأمر إنتاج',$5)`,
          [txNumber, new Date().toISOString().split("T")[0], whId, totalConsQty, JSON.stringify(itemsConsumed)]
        );
        for (const item of itemsConsumed) {
          const existing = (await pool.query("SELECT id, quantity FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2", [whId, item.ingredient_id])).rows[0];
          if (existing) {
            const newQty = Math.max(0, Number(existing.quantity) - Number(item.quantity));
            await pool.query("UPDATE inventory_items SET quantity=$1, available=GREATEST($2::numeric - COALESCE(reserved,0),0) WHERE id=$3", [newQty, newQty, existing.id]);
          }
          await pool.query(
            `INSERT INTO inventory_movements (warehouse_id, ingredient_id, field, before_qty, delta, after_qty, ref_type, ref_id, "user", notes, created_at)
             VALUES ($1,$2,'quantity',$3,$4,$5,'transaction',0,'system',$6,NOW())`,
            [whId, item.ingredient_id, Number(existing?.quantity || 0), -item.quantity, Number(existing?.quantity || 0) - item.quantity, `صرف خامات لأمر إنتاج #${data.runId}`]
          );
          eventBus.emitEvent("InventoryAdjusted", {
            adjustmentId: 0, warehouseId: whId, ingredientId: item.ingredient_id,
            ingredientName: item.name, quantity: -item.quantity, unitCost: item.price,
            type: "out", branchId: data.branchId,
          });
        }
      }

      // Produce finished good — find finished product as ingredient (if exists)
      const product = (await pool.query("SELECT name FROM products WHERE id = $1", [data.productId])).rows[0];
      if (product) {
        // Try to find a matching ingredient (by name) — if found, add stock; otherwise skip
        const finIng = (await pool.query("SELECT id FROM ingredients WHERE name = $1 LIMIT 1", [product.name])).rows[0];
        if (finIng) {
          const existing = (await pool.query("SELECT id, quantity, avg_cost, cost FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2", [whId, finIng.id])).rows[0];
          const costPerUnit = itemsConsumed.reduce((s, i) => s + i.quantity * i.price, 0) / Math.max(1, producedQty);
          let finalAvgCost = costPerUnit;

          if (existing) {
            const beforeQty = Number(existing.quantity || 0);
            const afterQty = beforeQty + producedQty;
            const existingAvg = Number(existing.avg_cost || existing.cost || 0);
            if (beforeQty > 0 && existingAvg > 0) {
              finalAvgCost = Math.round((((beforeQty * existingAvg) + (producedQty * costPerUnit)) / afterQty) * 10000) / 10000;
            }
            const newQty = beforeQty + producedQty;
            await pool.query(
              `UPDATE inventory_items 
               SET quantity=$1, 
                   available=GREATEST($2::numeric - COALESCE(reserved,0),0),
                   avg_cost=$3,
                   cost=$3,
                   last_cost=$4,
                   updated_at=NOW() 
               WHERE id=$5`, 
              [newQty, newQty, finalAvgCost, costPerUnit, existing.id]
            );
          } else {
            await pool.query(
              `INSERT INTO inventory_items 
               (warehouse_id, ingredient_id, quantity, reserved, in_transit, available, avg_cost, last_cost, cost, updated_at) 
               VALUES ($1,$2,$3,0,0,$4,$5,$6,$5,NOW())`,
              [whId, finIng.id, producedQty, producedQty, finalAvgCost, costPerUnit]
            );
          }

          // Update ingredients table for global average
          const totalRes = await pool.query(
            "SELECT COALESCE(SUM(quantity),0) AS total, COALESCE(SUM(quantity * COALESCE(avg_cost, cost, 0)), 0) AS total_val FROM inventory_items WHERE ingredient_id=$1",
            [finIng.id]
          );
          const totalStock = Number(totalRes.rows[0]?.total || 0);
          const totalVal = Number(totalRes.rows[0]?.total_val || 0);
          const globalAvgCost = totalStock > 0 ? (totalVal / totalStock) : finalAvgCost;

          await pool.query(
            `UPDATE ingredients 
             SET current_stock=$1,
                 avg_cost=CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE avg_cost END,
                 cost=CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE cost END,
                 last_purchase_price=CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE last_purchase_price END
             WHERE id=$4`,
            [totalStock, globalAvgCost, costPerUnit, finIng.id]
          );

          const txNumber = `MO-PROD-${data.runId}-${Date.now().toString().slice(-6)}`;
          await pool.query(
            `INSERT INTO inventory_transactions (transaction_number, date, warehouse_id, ingredient_id, quantity, unit_cost, type, reason, reference, user, status, notes, items)
             VALUES ($1,$2,$3,$4,$5,$6,'receive','إنتاج','MO-${data.runId}','system','approved','استلام منتج تام من أمر إنتاج',$7)`,
            [txNumber, new Date().toISOString().split("T")[0], whId, finIng.id, producedQty, costPerUnit, JSON.stringify([{ ingredient_id: finIng.id, name: product.name, unit: "قطعة", quantity: producedQty, price: costPerUnit }])]
          );
          await pool.query(
            `INSERT INTO inventory_movements (warehouse_id, ingredient_id, field, before_qty, delta, after_qty, ref_type, ref_id, "user", notes, created_at)
             VALUES ($1,$2,'quantity',$3,$4,$5,'transaction',0,'system',$6,NOW())`,
            [whId, finIng.id, Number(existing?.quantity || 0), producedQty, Number(existing?.quantity || 0) + producedQty, `استلام منتج تام من أمر إنتاج #${data.runId}`]
          );
          eventBus.emitEvent("InventoryAdjusted", {
            adjustmentId: 0, warehouseId: whId, ingredientId: finIng.id,
            ingredientName: product.name, quantity: producedQty, unitCost: costPerUnit,
            type: "in", branchId: data.branchId,
          });
        }
      }
      console.log(`[WH Integration] ✅ Production Run #${data.runId} — consumed ${itemsConsumed.length} materials, produced ${producedQty} units`);
    } catch (e: any) {
      console.error(`[WH Integration] ❌ Production Run #${data.runId} error:`, e.message);
    }
  });

  console.log("✅ Warehouse event handlers registered (Sales/Purchases/Production/Accounting integration)");
}
