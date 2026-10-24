import { erpPool } from "../../../server-erp-core.js";

/**
 * Central cost integration layer.
 *
 * Important accounting rule:
 * - A purchase receipt is an inventory/acquisition cost, not an operating expense.
 * - Production consumption/output is a manufacturing cost, not a second purchase expense.
 * - Operating costs remain in operating_costs and are never duplicated here.
 *
 * cost_transactions is an analytical/valuation ledger used by the Costs module.
 * It is deliberately append-only and idempotent by source + transaction type + line.
 */
export async function ensureCostIntegrationSchema(): Promise<void> {
  await erpPool.query(`
    CREATE TABLE IF NOT EXISTS cost_transactions (
      id SERIAL PRIMARY KEY,
      transaction_no TEXT UNIQUE NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      amount NUMERIC(18,4) NOT NULL DEFAULT 0,
      quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
      unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
      ingredient_id INTEGER,
      product_id INTEGER,
      warehouse_id INTEGER,
      supplier_id INTEGER,
      cost_center_id INTEGER,
      notes TEXT,
      line_key TEXT NOT NULL DEFAULT '0',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cost_tx_source_line
      ON cost_transactions(source_type, source_id, transaction_type, line_key);
    CREATE INDEX IF NOT EXISTS idx_cost_tx_date ON cost_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_cost_tx_ingredient ON cost_transactions(ingredient_id, date);
    CREATE INDEX IF NOT EXISTS idx_cost_tx_product ON cost_transactions(product_id, date);
    CREATE INDEX IF NOT EXISTS idx_cost_tx_warehouse ON cost_transactions(warehouse_id, date);
    CREATE INDEX IF NOT EXISTS idx_cost_tx_supplier ON cost_transactions(supplier_id, date);
  `);
}

async function insertOnce(input: {
  sourceType: string;
  sourceId: string | number;
  transactionType: string;
  amount: number;
  quantity?: number;
  unitCost?: number;
  ingredientId?: number | null;
  productId?: number | null;
  warehouseId?: number | null;
  supplierId?: number | null;
  costCenterId?: number | null;
  date?: any;
  notes?: string;
  metadata?: any;
  lineKey?: string | number;
}) {
  const sourceId = String(input.sourceId);
  const lineKey = String(input.lineKey ?? input.ingredientId ?? input.productId ?? "0");
  const transactionNo = `CST-${input.sourceType}-${sourceId}-${input.transactionType}-${lineKey}`;
  const txDate = input.date || new Date().toISOString().split("T")[0];
  const result = await erpPool.query(`
    INSERT INTO cost_transactions (
      transaction_no, source_type, source_id, transaction_type, date, amount, quantity,
      unit_cost, ingredient_id, product_id, warehouse_id, supplier_id, cost_center_id, notes, line_key, metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (source_type, source_id, transaction_type, line_key)
    DO UPDATE SET
      date=EXCLUDED.date,
      amount=EXCLUDED.amount,
      quantity=EXCLUDED.quantity,
      unit_cost=EXCLUDED.unit_cost,
      warehouse_id=EXCLUDED.warehouse_id,
      supplier_id=EXCLUDED.supplier_id,
      cost_center_id=EXCLUDED.cost_center_id,
      notes=EXCLUDED.notes,
      metadata=EXCLUDED.metadata
    RETURNING *
  `, [
    transactionNo, input.sourceType, sourceId, input.transactionType, txDate,
    Number(input.amount || 0), Number(input.quantity || 0), Number(input.unitCost || 0),
    input.ingredientId || null, input.productId || null, input.warehouseId || null,
    input.supplierId || null, input.costCenterId || null, input.notes || null,
    lineKey,
    JSON.stringify(input.metadata || {})
  ]);
  return result.rows[0];
}

export async function recordPurchaseCost(purchaseId: number): Promise<number> {
  await ensureCostIntegrationSchema();

  const purchase = await erpPool.query(`
    SELECT id, supplier_id, warehouse_id, date, total_amount, shipping_amount,
           cost_center_id, purchase_order_id, receipt_id, branch_id
    FROM purchases WHERE id=$1
  `, [purchaseId]);
  if (!purchase.rows[0]) return 0;
  const p = purchase.rows[0];

  // Use the posted GRN valuation because it contains the landed unit cost actually
  // used to update warehouse average cost.
  const lines = await erpPool.query(`
    SELECT
      gri.id AS receipt_item_id,
      gri.ingredient_id,
      gri.accepted_qty,
      gri.landed_unit_cost,
      gri.total_landed_cost,
      COALESCE(gri.unit_cost, gri.unit_price, 0) AS unit_price,
      gri.uom,
      i.name AS ingredient_name
    FROM goods_receipts gr
    JOIN goods_receipt_items gri ON gri.goods_receipt_id=gr.id
    LEFT JOIN ingredients i ON i.id=gri.ingredient_id
    WHERE (gr.purchase_id=$1 OR gr.purchase_order_id=$1)
    ORDER BY gri.id
  `, [purchaseId]);

  let count = 0;
  for (const line of lines.rows) {
    const qty = Number(line.accepted_qty || 0);
    if (qty <= 0) continue;
    const unitCost = Number(line.landed_unit_cost || line.unit_cost || 0);
    await insertOnce({
      sourceType: "purchase",
      sourceId: purchaseId,
      transactionType: "inventory_acquisition",
      amount: qty * unitCost,
      quantity: qty,
      unitCost,
      ingredientId: Number(line.ingredient_id) || null,
      warehouseId: Number(p.warehouse_id) || null,
      supplierId: Number(p.supplier_id) || null,
      costCenterId: Number(p.cost_center_id) || null,
      date: p.date,
      notes: `تكلفة اقتناء خامة من فاتورة شراء #${purchaseId} - ${line.ingredient_name || ""}`,
      lineKey: line.receipt_item_id,
      metadata: {
        purchase_id: purchaseId,
        receipt_id: p.receipt_id,
        purchase_order_id: p.purchase_order_id,
        unit: line.uom || null,
        branch_id: p.branch_id || null
      }
    });
    count++;
  }

  // Freight/other landed costs are kept separately so reports can reconcile to
  // the purchase without inflating the material line twice.
  const shipping = Number(p.shipping_amount || 0);
  if (shipping > 0) {
    await insertOnce({
      sourceType: "purchase",
      sourceId: purchaseId,
      transactionType: "landed_overhead",
      lineKey: "shipping",
      amount: shipping,
      warehouseId: Number(p.warehouse_id) || null,
      supplierId: Number(p.supplier_id) || null,
      costCenterId: Number(p.cost_center_id) || null,
      date: p.date,
      notes: `تكلفة شحن/تحميل مرتبطة بفاتورة شراء #${purchaseId}`,
      metadata: { purchase_id: purchaseId, receipt_id: p.receipt_id }
    });
  }

  return count;
}

export async function recordGoodsReceiptCost(receiptId: number): Promise<number> {
  await ensureCostIntegrationSchema();
  const receipt = await erpPool.query(`
    SELECT *
    FROM goods_receipts
    WHERE id=$1
  `, [receiptId]);
  if (!receipt.rows[0]) return 0;
  const header = receipt.rows[0];
  const lines = await erpPool.query(`
    SELECT gri.id,
           gri.ingredient_id,
           COALESCE(gri.accepted_qty, gri.received_qty, 0) AS final_qty,
           COALESCE(NULLIF(gri.landed_unit_cost, 0), gri.unit_cost, 0) AS final_unit_cost,
           COALESCE(NULLIF(gri.total_landed_cost, 0), gri.total_cost, 0) AS final_total_cost,
           i.name AS ingredient_name
    FROM goods_receipt_items gri
    LEFT JOIN ingredients i ON i.id=gri.ingredient_id
    WHERE gri.goods_receipt_id=$1
    ORDER BY gri.id
  `, [receiptId]);

  let count = 0;
  for (const line of lines.rows) {
    const quantity = Number(line.final_qty || 0);
    if (quantity <= 0) continue;
    const unitCost = Number(line.final_unit_cost || 0);
    const amount = Number(line.final_total_cost || (quantity * unitCost));
    await insertOnce({
      sourceType: 'goods_receipt',
      sourceId: receiptId,
      transactionType: 'inventory_acquisition',
      amount,
      quantity,
      unitCost,
      ingredientId: Number(line.ingredient_id) || null,
      warehouseId: Number(header.warehouse_id) || null,
      supplierId: Number(header.supplier_id) || null,
      date: header.date || header.receipt_date || header.created_at,
      notes: `تكلفة استلام مخزني #${receiptId} - ${line.ingredient_name || ''}`,
      lineKey: line.id,
      metadata: {
        goods_receipt_id: receiptId,
        purchase_order_id: header.purchase_order_id || header.purchase_id,
        receipt_no: header.receipt_no
      }
    });
    count++;
  }
  return count;
}

export async function recordProductionCost(orderNumber: string): Promise<boolean> {
  await ensureCostIntegrationSchema();

  const order = await erpPool.query(`
    SELECT id, order_number, product_id, product_name, quantity, total_cost, cost_per_unit,
           raw_warehouse_id, finished_warehouse_id, start_date, end_date, work_center_id
    FROM production_orders
    WHERE order_number=$1
    LIMIT 1
  `, [String(orderNumber)]);
  if (!order.rows[0]) return false;
  const o = order.rows[0];

  const qty = Number(o.quantity || 0);
  const total = Number(o.total_cost || 0);
  const unit = qty > 0 ? Number(o.cost_per_unit || total / qty) : 0;
  const numericProductId = Number(o.product_id);

  await insertOnce({
    sourceType: "production_order",
    sourceId: o.order_number,
    transactionType: "manufacturing_output",
    amount: total,
    quantity: qty,
    unitCost: unit,
    productId: Number.isFinite(numericProductId) && numericProductId > 0 ? numericProductId : null,
    warehouseId: Number(o.finished_warehouse_id) || null,
    date: o.end_date || o.start_date,
    notes: `تكلفة تصنيع وترحيل أمر الإنتاج ${o.order_number}`,
    metadata: {
      production_order_id: o.id,
      raw_warehouse_id: o.raw_warehouse_id,
      finished_warehouse_id: o.finished_warehouse_id,
      work_center_id: o.work_center_id,
      product_name: o.product_name
    }
  });

  return true;
}

export async function recordPurchaseReturnCost(returnId: number): Promise<number> {
  await ensureCostIntegrationSchema();
  const retRes = await erpPool.query(`
    SELECT * FROM purchase_returns WHERE id = $1
  `, [returnId]);
  if (retRes.rows.length === 0) return 0;
  const ret = retRes.rows[0];

  const itemsRes = await erpPool.query(`
    SELECT * FROM purchase_return_items WHERE return_id = $1
  `, [returnId]);

  let count = 0;
  if (itemsRes.rows.length > 0) {
    for (const item of itemsRes.rows) {
      const lineCost = Number(item.total_cost || (Number(item.quantity || 0) * Number(item.unit_cost || item.unit_price || 0)));
      await insertOnce({
        sourceType: "purchase_return",
        sourceId: ret.id,
        transactionType: "return_reduction",
        amount: -Math.abs(lineCost),
        quantity: -Math.abs(Number(item.quantity || 0)),
        unitCost: Number(item.unit_cost || item.unit_price || 0),
        ingredientId: item.ingredient_id || null,
        productId: item.product_id || null,
        warehouseId: ret.warehouse_id || null,
        supplierId: ret.supplier_id || null,
        date: ret.return_date || ret.created_at,
        notes: `تخفيض تكلفة مخزون ومشتريات — مرتجع #${ret.return_number || ret.id}`,
        lineKey: item.id || `item-${item.ingredient_id || item.product_id}`,
        metadata: {
          return_number: ret.return_number,
          supplier_id: ret.supplier_id
        }
      });
      count++;
    }
  } else if (Number(ret.total_amount || 0) > 0) {
    await insertOnce({
      sourceType: "purchase_return",
      sourceId: ret.id,
      transactionType: "return_reduction",
      amount: -Math.abs(Number(ret.total_amount)),
      quantity: 1,
      unitCost: -Math.abs(Number(ret.total_amount)),
      warehouseId: ret.warehouse_id || null,
      supplierId: ret.supplier_id || null,
      date: ret.return_date || ret.created_at,
      notes: `تخفيض تكلفة مرتجع مشتريات إجمالي #${ret.return_number || ret.id}`,
      lineKey: "total",
      metadata: { return_number: ret.return_number }
    });
    count++;
  }
  return count;
}

export async function recordInventoryAdjustmentCost(adjustmentId: number): Promise<number> {
  await ensureCostIntegrationSchema();
  const adjRes = await erpPool.query(`
    SELECT * FROM inventory_adjustments WHERE id = $1
  `, [adjustmentId]);
  if (adjRes.rows.length === 0) return 0;
  const adj = adjRes.rows[0];

  const itemsRes = await erpPool.query(`
    SELECT * FROM inventory_adjustment_items WHERE adjustment_id = $1
  `, [adjustmentId]);

  let count = 0;
  for (const item of itemsRes.rows) {
    const qty = Number(item.adjustment_qty || 0);
    const unitCost = Number(item.unit_cost || 0);
    const totalCost = Number(item.total_cost || (qty * unitCost));

    await insertOnce({
      sourceType: "inventory_adjustment",
      sourceId: adj.id,
      transactionType: qty >= 0 ? "inventory_surplus" : "inventory_deficit",
      amount: totalCost,
      quantity: qty,
      unitCost: unitCost,
      productId: item.product_id || null,
      warehouseId: adj.warehouse_id || null,
      date: adj.approved_at || adj.created_at,
      notes: `تسوية مخزنية (${qty >= 0 ? 'زيادة' : 'عجز'}) إذن #${adj.adjustment_number || adj.id}`,
      lineKey: item.id || `item-${item.product_id}`,
      metadata: {
        adjustment_number: adj.adjustment_number,
        type: adj.type
      }
    });
    count++;
  }
  return count;
}

export async function recordWastageCost(wastageId: number): Promise<number> {
  await ensureCostIntegrationSchema();
  const wstRes = await erpPool.query(`
    SELECT * FROM inventory_wastage WHERE id = $1
  `, [wastageId]);
  if (wstRes.rows.length === 0) return 0;
  const wst = wstRes.rows[0];

  const itemsRes = await erpPool.query(`
    SELECT * FROM inventory_wastage_items WHERE wastage_id = $1
  `, [wastageId]);

  let count = 0;
  for (const item of itemsRes.rows) {
    const qty = Number(item.wastage_qty || 0);
    const unitCost = Number(item.unit_cost || 0);
    const totalCost = Number(item.total_cost || (qty * unitCost));

    await insertOnce({
      sourceType: "inventory_wastage",
      sourceId: wst.id,
      transactionType: "spoilage_expense",
      amount: totalCost,
      quantity: qty,
      unitCost: unitCost,
      productId: item.product_id || null,
      warehouseId: wst.warehouse_id || null,
      date: wst.approved_at || wst.created_at,
      notes: `تكلفة هالك وتالف مخزني إذن #${wst.wastage_number || wst.id}`,
      lineKey: item.id || `item-${item.product_id}`,
      metadata: {
        wastage_number: wst.wastage_number,
        reason: item.reason || wst.notes
      }
    });
    count++;
  }
  return count;
}

export async function recordWarehouseTransferCost(transferId: number): Promise<number> {
  await ensureCostIntegrationSchema();
  const trfRes = await erpPool.query(`
    SELECT * FROM warehouse_transfers WHERE id = $1
  `, [transferId]);
  if (trfRes.rows.length === 0) return 0;
  const trf = trfRes.rows[0];

  let count = 0;
  const shippingCost = Number(trf.shipping_cost || 0);
  if (shippingCost > 0) {
    await insertOnce({
      sourceType: "warehouse_transfer",
      sourceId: trf.id,
      transactionType: "transfer_freight",
      amount: shippingCost,
      quantity: 1,
      unitCost: shippingCost,
      warehouseId: trf.to_warehouse_id || trf.from_warehouse_id || null,
      date: trf.received_at || trf.created_at,
      notes: `تكاليف شحن ونقل تحويل مخزني #${trf.transfer_number || trf.id}`,
      lineKey: "freight",
      metadata: {
        transfer_number: trf.transfer_number,
        from_warehouse_id: trf.from_warehouse_id,
        to_warehouse_id: trf.to_warehouse_id
      }
    });
    count++;
  }
  return count;
}

export async function getCostIntegrationSummary(filters: {
  from?: string;
  to?: string;
  warehouseId?: number;
  productId?: number;
  supplierId?: number;
}) {
  await ensureCostIntegrationSchema();
  const where: string[] = ["1=1"];
  const params: any[] = [];
  const add = (sql: string, value: any) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };

  if (filters.from) add("ct.date >= ?::timestamp", filters.from);
  if (filters.to) add("ct.date < (?::date + INTERVAL '1 day')", filters.to);
  if (filters.warehouseId) add("ct.warehouse_id = ?", filters.warehouseId);
  if (filters.productId) add("ct.product_id = ?", filters.productId);
  if (filters.supplierId) add("ct.supplier_id = ?", filters.supplierId);

  const [summary, bySource, byProduct] = await Promise.all([
    erpPool.query(`
      SELECT COUNT(*)::int AS transactions,
             COALESCE(SUM(amount),0) AS total_amount,
             COALESCE(SUM(CASE WHEN transaction_type='inventory_acquisition' THEN amount ELSE 0 END),0) AS purchases,
             COALESCE(SUM(CASE WHEN transaction_type='landed_overhead' THEN amount ELSE 0 END),0) AS landed_overhead,
             COALESCE(SUM(CASE WHEN transaction_type='manufacturing_output' THEN amount ELSE 0 END),0) AS production
      FROM cost_transactions ct WHERE ${where.join(" AND ")}
    `, params),
    erpPool.query(`
      SELECT source_type, transaction_type, COUNT(*)::int AS transactions, COALESCE(SUM(amount),0) AS amount
      FROM cost_transactions ct WHERE ${where.join(" AND ")}
      GROUP BY source_type, transaction_type
      ORDER BY amount DESC
    `, params),
    erpPool.query(`
      SELECT ct.product_id, COALESCE(p.name, 'غير مرتبط') AS product_name,
             COALESCE(SUM(ct.amount),0) AS amount
      FROM cost_transactions ct
      LEFT JOIN products p ON p.id=ct.product_id
      WHERE ${where.join(" AND ")} AND ct.product_id IS NOT NULL
      GROUP BY ct.product_id, p.name
      ORDER BY amount DESC
      LIMIT 100
    `, params)
  ]);

  return {
    summary: summary.rows[0],
    by_source: bySource.rows,
    by_product: byProduct.rows
  };
}

export async function getCostIntegrationLedger(filters: {
  from?: string;
  to?: string;
  sourceType?: string;
  transactionType?: string;
  limit?: number;
}) {
  await ensureCostIntegrationSchema();
  const where: string[] = ["1=1"];
  const params: any[] = [];
  const add = (sql: string, value: any) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (filters.from) add("ct.date >= ?::timestamp", filters.from);
  if (filters.to) add("ct.date < (?::date + INTERVAL '1 day')", filters.to);
  if (filters.sourceType) add("ct.source_type = ?", filters.sourceType);
  if (filters.transactionType) add("ct.transaction_type = ?", filters.transactionType);

  const limit = Math.min(Math.max(Number(filters.limit || 200), 1), 1000);
  params.push(limit);
  const result = await erpPool.query(`
    SELECT ct.*, COALESCE(i.name, p.name) AS item_name,
           s.name AS supplier_name, w.name AS warehouse_name
    FROM cost_transactions ct
    LEFT JOIN ingredients i ON i.id=ct.ingredient_id
    LEFT JOIN products p ON p.id=ct.product_id
    LEFT JOIN suppliers s ON s.id=ct.supplier_id
    LEFT JOIN warehouses w ON w.id=ct.warehouse_id
    WHERE ${where.join(" AND ")}
    ORDER BY ct.date DESC, ct.id DESC
    LIMIT $${params.length}
  `, params);
  return result.rows;
}

export async function rebuildAllCostIntegrations() {
  await ensureCostIntegrationSchema();
  const purchases = await erpPool.query(`
    SELECT DISTINCT p.id
    FROM purchases p
    JOIN goods_receipts gr ON gr.purchase_id=p.id
    WHERE COALESCE(gr.is_posted, false)=true
    ORDER BY p.id
  `);
  const production = await erpPool.query(`
    SELECT order_number
    FROM production_orders
    WHERE status='completed' OR is_executed=true
    ORDER BY id
  `);

  let purchaseTransactions = 0;
  for (const row of purchases.rows) purchaseTransactions += await recordPurchaseCost(Number(row.id));
  let productionOrders = 0;
  for (const row of production.rows) {
    if (await recordProductionCost(String(row.order_number))) productionOrders++;
  }

  // Also rebuild returns, adjustments, wastage, transfers
  let returnTransactions = 0;
  try {
    const returns = await erpPool.query(`SELECT id FROM purchase_returns WHERE status = 'approved' ORDER BY id`);
    for (const r of returns.rows) returnTransactions += await recordPurchaseReturnCost(Number(r.id));
  } catch (_) {}

  let adjustmentTransactions = 0;
  try {
    const adjustments = await erpPool.query(`SELECT id FROM inventory_adjustments WHERE status = 'approved' ORDER BY id`);
    for (const a of adjustments.rows) adjustmentTransactions += await recordInventoryAdjustmentCost(Number(a.id));
  } catch (_) {}

  let wastageTransactions = 0;
  try {
    const wastage = await erpPool.query(`SELECT id FROM inventory_wastage WHERE status = 'approved' ORDER BY id`);
    for (const w of wastage.rows) wastageTransactions += await recordWastageCost(Number(w.id));
  } catch (_) {}

  let transferTransactions = 0;
  try {
    const transfers = await erpPool.query(`SELECT id FROM warehouse_transfers WHERE status = 'completed' ORDER BY id`);
    for (const t of transfers.rows) transferTransactions += await recordWarehouseTransferCost(Number(t.id));
  } catch (_) {}

  return {
    purchases: purchases.rowCount || 0,
    purchaseTransactions,
    productionOrders,
    returnTransactions,
    adjustmentTransactions,
    wastageTransactions,
    transferTransactions
  };
}
