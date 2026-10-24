import { randomUUID } from "crypto";

export type StockField = "quantity" | "reserved" | "in_transit";

export interface StockMoveOptions {
  warehouse_id: number;
  ingredient_id: number;
  delta: number;
  field?: StockField;
  ref_type: string;
  ref_id: number;
  user?: string;
  notes?: string;
  unit_cost?: number;
  /**
   * Unique key for the stock-ledger event. Defaults to ref_type:ref_id:warehouse:item:field,
   * which is the right key for documents that move an item exactly once. Documents that can
   * move the same item several times (partial issue / partial receipt) must pass their own
   * token, otherwise the second movement is rejected as a replay.
   */
  event_key?: string;
  /** Human readable document number stored on the report ledger row (e.g. MR-2026-0007). */
  reference_no?: string;
}

/**
 * Maps a canonical stock-ledger reference to the movement type used by the
 * legacy `inventory_transactions` report ledger (item card, KPIs, aging, ABC).
 * The sign of the delta always decides the in/out direction; ref_type only
 * refines the wording so reports stay readable.
 */
function reportTransactionType(refType: string, delta: number): string {
  const inflow = delta > 0;
  switch (refType) {
    case "goods_receipt": return "receipt";
    case "production_receipt": return "receive";
    case "production_consumption": return "issue";
    case "purchase_return": return "return";
    case "sales_invoice":
    case "sales_delivery":
    case "pos_sale": return "out";
    case "sales_return": return "return";
    case "pos_sale_cancel": return "in";
    case "transfer": return inflow ? "transfer_in" : "transfer_out";
    case "material_issue": return "material_issue";
    case "wastage": return "wastage";
    case "adjustment":
    default: return inflow ? "adjustment_in" : "adjustment_out";
  }
}

function finiteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function resolveUnitCost(client: any, ingredientId: number, warehouseId: number, inventoryRow?: any) {
  const inventoryCosts = [
    inventoryRow?.avg_cost,
    inventoryRow?.unit_cost,
    inventoryRow?.last_cost,
    inventoryRow?.cost,
  ];
  for (const value of inventoryCosts) {
    const cost = finiteNumber(value);
    if (cost > 0) return cost;
  }

  const ingredient = await client.query(
    `SELECT avg_cost, cost_price, last_purchase_price, cost
       FROM ingredients WHERE id=$1 LIMIT 1`,
    [ingredientId]
  );
  for (const value of [
    ingredient.rows[0]?.avg_cost,
    ingredient.rows[0]?.cost_price,
    ingredient.rows[0]?.last_purchase_price,
    ingredient.rows[0]?.cost,
  ]) {
    const cost = finiteNumber(value);
    if (cost > 0) return cost;
  }

  return 0;
}

/**
 * Single source of truth for inventory balance changes.
 * Must be called inside an already-open DB transaction.
 */
export async function moveStock(client: any, opts: StockMoveOptions) {
  const warehouseId = finiteNumber(opts.warehouse_id);
  const ingredientId = finiteNumber(opts.ingredient_id);
  const delta = finiteNumber(opts.delta);
  const field: StockField = opts.field || "quantity";
  if (!warehouseId || !ingredientId) throw new Error("بيانات المخزن أو الصنف غير صحيحة");
  if (!Number.isFinite(delta) || delta === 0) throw new Error("كمية الحركة غير صحيحة");

  const wh = await client.query(
    `SELECT id, COALESCE(allow_negative_stock,false) AS allow_negative_stock
       FROM warehouses WHERE id=$1 FOR UPDATE`,
    [warehouseId]
  );
  if (!wh.rows.length) throw new Error(`المخزن غير موجود: ${warehouseId}`);

  const item = await client.query(
    `SELECT id, quantity, reserved, in_transit, avg_cost, last_cost, cost
       FROM inventory_items
      WHERE warehouse_id=$1 AND ingredient_id=$2
      FOR UPDATE`,
    [warehouseId, ingredientId]
  );

  let rowId: number;
  let before = 0;
  if (item.rows.length > 1) {
    // Consolidate duplicate rows for (warehouseId, ingredientId) into item.rows[0]
    let totalQty = 0;
    let totalRes = 0;
    let totalTransit = 0;
    const idsToDelete: number[] = [];
    item.rows.forEach((r: any, idx: number) => {
      totalQty += finiteNumber(r.quantity);
      totalRes += finiteNumber(r.reserved);
      totalTransit += finiteNumber(r.in_transit);
      if (idx > 0) idsToDelete.push(Number(r.id));
    });
    rowId = Number(item.rows[0].id);
    await client.query(
      `UPDATE inventory_items 
       SET quantity=$1, reserved=$2, in_transit=$3, available=GREATEST($4::numeric - $5::numeric, 0), updated_at=NOW() 
       WHERE id=$6`,
      [totalQty, totalRes, totalTransit, totalQty, totalRes, rowId]
    );
    if (idsToDelete.length > 0) {
      await client.query(`DELETE FROM inventory_items WHERE id = ANY($1::int[])`, [idsToDelete]);
    }
    item.rows[0].quantity = totalQty;
    item.rows[0].reserved = totalRes;
    item.rows[0].in_transit = totalTransit;
    before = field === "quantity" ? totalQty : (field === "reserved" ? totalRes : totalTransit);
  } else if (item.rows.length === 1) {
    rowId = Number(item.rows[0].id);
    before = finiteNumber(item.rows[0][field]);
  } else {
    rowId = 0;
  }

  // Re-check after acquiring the row locks. This closes the race where a retry
  // waits on a lock while the original request commits the ledger event.
  const eventKey = opts.event_key || `${opts.ref_type}:${opts.ref_id}:${warehouseId}:${ingredientId}:${field}`;
  const replay = await client.query(`SELECT before_qty, delta, after_qty, id FROM inventory_stock_ledger WHERE event_key=$1`, [eventKey]);
  if (replay.rows.length) {
    const r = replay.rows[0];
    const historicalCost = await client.query(
      `SELECT unit_cost, total_cost FROM inventory_transactions
        WHERE transaction_number=$1 LIMIT 1`,
      [`TX-${opts.ref_type}-${opts.ref_id}-${warehouseId}-${ingredientId}`.slice(0, 120)]
    );
    const unitCost = finiteNumber(historicalCost.rows[0]?.unit_cost);
    const totalCost = finiteNumber(historicalCost.rows[0]?.total_cost);
    return { inventory_item_id: rowId, warehouse_id: warehouseId, ingredient_id: ingredientId, field, before: finiteNumber(r.before_qty), delta: finiteNumber(r.delta), after: finiteNumber(r.after_qty), unit_cost: unitCost, total_cost: totalCost, replayed: true, ledger_id: Number(r.id) };
  }

  const requestedUnitCost = finiteNumber(opts.unit_cost);
  const unitCost = requestedUnitCost > 0
    ? requestedUnitCost
    : await resolveUnitCost(client, ingredientId, warehouseId, item.rows[0]);
  const totalCost = field === "quantity" ? Math.abs(delta) * unitCost : 0;

  const after = before + delta;
  if (field === "quantity" && delta < 0 && !Boolean(wh.rows[0].allow_negative_stock) && after < 0) {
    const error: any = new Error(`الرصيد غير كافٍ للصنف #${ingredientId}. المتاح: ${before}، المطلوب: ${Math.abs(delta)}`);
    error.code = "INSUFFICIENT_STOCK";
    error.statusCode = 409;
    error.available = before;
    error.requested = Math.abs(delta);
    throw error;
  }
  if ((field === "reserved" || field === "in_transit") && after < 0) {
    throw new Error(`الرصيد المحجوز/قيد النقل لا يمكن أن يكون سالباً للصنف #${ingredientId}`);
  }

  // Calculate weighted average cost on receipts
  let finalAvgCost = 0;
  let finalLastCost = 0;

  if (field === "quantity") {
    const existingAvgCost = item.rows[0] ? finiteNumber(item.rows[0].avg_cost || item.rows[0].cost || item.rows[0].last_cost || 0) : 0;
    const existingLastCost = item.rows[0] ? finiteNumber(item.rows[0].last_cost || item.rows[0].cost || item.rows[0].avg_cost || 0) : 0;

    if (delta > 0) {
      const currentTotalVal = before > 0 ? (before * existingAvgCost) : 0;
      const incomingVal = delta * unitCost;
      finalAvgCost = after > 0 ? Math.round(((currentTotalVal + incomingVal) / after) * 10000) / 10000 : unitCost;
      finalLastCost = unitCost;
    } else {
      finalAvgCost = existingAvgCost > 0 ? existingAvgCost : unitCost;
      finalLastCost = existingLastCost > 0 ? existingLastCost : unitCost;
    }
  } else {
    finalAvgCost = item.rows[0] ? finiteNumber(item.rows[0].avg_cost || item.rows[0].cost || 0) : 0;
    finalLastCost = item.rows[0] ? finiteNumber(item.rows[0].last_cost || 0) : 0;
  }

  if (rowId) {
    const itemCheck = await client.query("SELECT avg_cost, cost, last_cost FROM inventory_items WHERE id = $1", [rowId]);
    const existingItemAvg = itemCheck.rows[0] ? finiteNumber(itemCheck.rows[0].avg_cost || itemCheck.rows[0].cost) : 0;
    const existingItemLast = itemCheck.rows[0] ? finiteNumber(itemCheck.rows[0].last_cost) : 0;

    const itemAvgToSave = finalAvgCost > 0 ? finalAvgCost : existingItemAvg;
    const itemLastToSave = finalLastCost > 0 ? finalLastCost : existingItemLast;

    await client.query(
      `UPDATE inventory_items
          SET ${field}=$1,
              avg_cost=$3,
              cost=$3,
              last_cost=$4,
              updated_at=NOW()
        WHERE id=$2`,
      [after, rowId, itemAvgToSave, itemLastToSave]
    );
    // `available` must be derived from the NEW quantity/reserved values: SET
    // expressions read the old row, so it is normalised in a second statement.
    await client.query(
      `UPDATE inventory_items
          SET available = GREATEST(COALESCE(quantity,0)-COALESCE(reserved,0),0)
        WHERE id=$1`,
      [rowId]
    );
  } else {
    const q = field === "quantity" ? delta : 0;
    const r = field === "reserved" ? delta : 0;
    const t = field === "in_transit" ? delta : 0;
    const ins = await client.query(
      `INSERT INTO inventory_items
        (warehouse_id, ingredient_id, quantity, reserved, in_transit, available, avg_cost, last_cost, cost, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       RETURNING id`,
      [warehouseId, ingredientId, q, r, t, Math.max(q - r, 0), finalAvgCost, finalLastCost, finalAvgCost]
    );
    rowId = Number(ins.rows[0].id);
  }

  // Keep the legacy item-master aggregate in sync with the authoritative
  // warehouse balances. This is intentionally derived, never used as the
  // source of truth for availability decisions.
  try {
    const totalRes = await client.query(
      `SELECT COALESCE(SUM(quantity),0) AS total, COALESCE(SUM(quantity * COALESCE(avg_cost, cost, 0)), 0) AS total_val FROM inventory_items WHERE ingredient_id=$1`,
      [ingredientId]
    );
    const totalStock = finiteNumber(totalRes.rows[0]?.total);
    const totalVal = finiteNumber(totalRes.rows[0]?.total_val);
    
    // Get existing ingredient values safely
    const ingCheck = await client.query("SELECT avg_cost, cost, last_purchase_price FROM ingredients WHERE id = $1", [ingredientId]);
    const existingIngAvg = ingCheck.rows[0] ? finiteNumber(ingCheck.rows[0].avg_cost || ingCheck.rows[0].cost) : 0;
    const existingIngLast = ingCheck.rows[0] ? finiteNumber(ingCheck.rows[0].last_purchase_price) : 0;

    const globalAvgCost = totalStock > 0 ? (totalVal / totalStock) : (finalAvgCost > 0 ? finalAvgCost : existingIngAvg);
    const ingAvgToSave = globalAvgCost > 0 ? globalAvgCost : existingIngAvg;
    const ingLastToSave = finalLastCost > 0 ? finalLastCost : existingIngLast;

    await client.query(
      `UPDATE ingredients 
       SET current_stock=$1,
           avg_cost=$2,
           cost=$2,
           last_purchase_price=$3
       WHERE id=$4`,
      [totalStock, ingAvgToSave, ingLastToSave, ingredientId]
    );
  } catch (syncError: any) {
    throw new Error(`تعذر مزامنة إجمالي رصيد الصنف: ${syncError.message}`);
  }

  const movementAfter = after;
  let ledgerId: number;
  try {
    const ledger = await client.query(
      `INSERT INTO inventory_stock_ledger
       (event_key, warehouse_id, ingredient_id, field, before_qty, delta, after_qty, ref_type, ref_id, user_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (event_key) DO NOTHING
       RETURNING id`,
      [eventKey, warehouseId, ingredientId, field, before, delta, movementAfter, opts.ref_type, opts.ref_id, opts.user || "system", opts.notes || ""]
    );
    if (!ledger.rows.length) {
      const existing = await client.query(`SELECT before_qty, delta, after_qty, id FROM inventory_stock_ledger WHERE event_key=$1`, [eventKey]);
      if (existing.rows.length) {
        const r = existing.rows[0];
        return { inventory_item_id: rowId, warehouse_id: warehouseId, ingredient_id: ingredientId, field, before: finiteNumber(r.before_qty), delta: finiteNumber(r.delta), after: finiteNumber(r.after_qty), replayed: true, ledger_id: Number(r.id) };
      }
      throw new Error("تعذر تثبيت حركة المخزون بشكل آمن");
    }
    ledgerId = Number(ledger.rows[0].id);
    await client.query(
      `INSERT INTO inventory_movements
       (warehouse_id, ingredient_id, field, before_qty, delta, after_qty, ref_type, ref_id, "user", notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
      [warehouseId, ingredientId, field, before, delta, movementAfter, opts.ref_type, opts.ref_id, opts.user || "system", opts.notes || ""]
    );
    // Mirror the movement into `inventory_transactions`, the ledger every warehouse
    // report (item card, KPIs/COGS, aging, ABC) reads. Without this row, stock
    // changes made through the canonical engine never reach those reports.
    await client.query(
      `INSERT INTO inventory_transactions
         (transaction_number, date, warehouse_id, ingredient_id, quantity, type,
          unit_cost, total_cost, balance_before, balance_after, reference_type,
          reference_id, reference_no, "user", status, notes, created_at)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'approved', $14, NOW())`,
      [
        `TX-${opts.ref_type}-${opts.ref_id}-${warehouseId}-${ingredientId}`.slice(0, 120),
        warehouseId,
        ingredientId,
        field === "quantity" ? Math.abs(delta) : 0,
        reportTransactionType(opts.ref_type, delta),
        unitCost,
        (field === "quantity" ? Math.abs(delta) : 0) * unitCost,
        before,
        movementAfter,
        opts.ref_type,
        finiteNumber(opts.ref_id, 0),
        opts.reference_no || opts.notes || opts.ref_type,
        opts.user || "system",
        opts.notes || "",
      ]
    );
  } catch (e: any) {
    // If the audit table is unavailable, fail the transaction rather than silently losing stock history.
    throw new Error(`تعذر تسجيل حركة المخزون: ${e.message}`);
  }

  return { inventory_item_id: rowId, warehouse_id: warehouseId, ingredient_id: ingredientId, field, before, delta, after, unit_cost: unitCost, total_cost: totalCost, replayed: false, ledger_id: ledgerId };
}

export async function transferStock(client: any, opts: {
  fromWarehouseId: number;
  toWarehouseId: number;
  ingredientId: number;
  quantity: number;
  refId: number;
  user?: string;
  notes?: string;
}) {
  if (Number(opts.fromWarehouseId) === Number(opts.toWarehouseId)) throw new Error("لا يمكن التحويل لنفس المخزن");
  const qty = finiteNumber(opts.quantity);
  if (qty <= 0) throw new Error("كمية التحويل يجب أن تكون أكبر من صفر");

  const out = await moveStock(client, {
    warehouse_id: Number(opts.fromWarehouseId), ingredient_id: Number(opts.ingredientId), delta: -qty,
    ref_type: "transfer", ref_id: opts.refId, user: opts.user, notes: opts.notes || "تحويل صادر"
  });
  const incoming = await moveStock(client, {
    warehouse_id: Number(opts.toWarehouseId), ingredient_id: Number(opts.ingredientId), delta: qty,
    ref_type: "transfer", ref_id: opts.refId, user: opts.user, notes: opts.notes || "تحويل وارد"
  });
  return { out, incoming, quantity: qty };
}

export function createMovementReference(prefix: string, id: number | string) {
  return `${prefix}-${id}-${randomUUID().slice(0, 8)}`;
}
