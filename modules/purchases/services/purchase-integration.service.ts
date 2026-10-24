import type { PoolClient } from "pg";
import { moveStock } from "../../warehouses/services/inventory.service.js";
import { UnitConversionService } from "../../common/services/unit_conversion.service.js";

/**
 * Single source of truth for Purchase -> Warehouse receiving.
 * A purchase invoice is never allowed to mutate inventory directly outside
 * this function.  The canonical warehouse document is goods_receipts.
 */
export async function createPostedGoodsReceiptForPurchase(
  client: PoolClient,
  purchase: any,
  purchaseId: number,
  items: any[],
  options: { markInvoiced?: boolean } = {}
): Promise<{ id: number; receipt_no: string; journal_entry_id: number | null }> {
  const existing = purchase.idempotency_key
    ? await client.query(
        `SELECT id, receipt_no, journal_entry_id FROM goods_receipts WHERE idempotency_key = $1 ORDER BY id DESC LIMIT 1`,
        [purchase.idempotency_key]
      )
    : await client.query(
        `SELECT id, receipt_no, journal_entry_id FROM goods_receipts WHERE purchase_order_id = $1 AND supplier_invoice_no = $2 ORDER BY id DESC LIMIT 1`,
        [purchase.purchase_order_id || null, purchase.invoice_number || null]
      );
  if (existing.rows[0]) return existing.rows[0];

  const date = new Date().toISOString().split("T")[0];
  const prefix = `GRN-${date.replace(/-/g, "").slice(0, 6)}`;
  const seqRes = await client.query(
    `SELECT COALESCE(MAX((regexp_match(receipt_no, '-([0-9]+)$'))[1]::int),0)+1 AS seq FROM goods_receipts WHERE receipt_no LIKE $1`,
    [`${prefix}-%`]
  );
  const receiptNo = `${prefix}-${String(Number(seqRes.rows[0]?.seq || 1)).padStart(4, "0")}`;

  let gross = 0;
  let totalQty = 0;
  for (const it of items) {
    const qty = Number(it.accepted_quantity ?? it.quantity ?? 0);
    const price = Number(it.unit_price || 0);
    gross += qty * price;
    totalQty += qty;
  }
  const tax = Number(purchase.tax_amount || 0);
  const discount = Number(purchase.discount_amount || 0);
  const shipping = Number(purchase.shipping_amount || 0);
  // Net inventory value excludes recoverable VAT:
  const net = Math.max(0, gross - discount);
  const landed = net + shipping;
  const totalWithTax = net + tax + shipping;

  const gr = await client.query(`
    INSERT INTO goods_receipts (
      receipt_no, date, posting_date, warehouse_id, supplier_id, purchase_order_id,
      supplier_invoice_no, idempotency_key, status, qc_status, currency, exchange_rate, receiver_name,
      reference, total_amount, discount_amount, tax_amount, net_amount,
      freight_charges, customs_charges, other_charges, total_landed_cost,
      landed_cost_allocation, is_posted, posted_at, notes, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'posted','passed',$9,1,$10,$11,$12,$13,$14,$15,$16,0,0,$17,'value',true,CURRENT_TIMESTAMP,$18,CURRENT_TIMESTAMP)
    RETURNING id, receipt_no
  `, [
    receiptNo, date, date, purchase.warehouse_id, purchase.supplier_id,
    purchase.purchase_order_id || null, purchase.invoice_number || null, purchase.idempotency_key || null,
    purchase.currency || "EGP", String(purchase.created_by || "system"),
    `PUR-${purchaseId}`, totalWithTax, discount, tax, net, shipping, landed,
    purchase.notes || `استلام تلقائي موحد لفاتورة شراء #${purchaseId}`
  ]);
  const grId = Number(gr.rows[0].id);

  for (const it of items) {
    const receivedQty = Number(it.received_quantity ?? it.quantity ?? 0);
    const acceptedQty = Math.max(0, Math.min(receivedQty, Number(it.accepted_quantity ?? receivedQty)));
    const rejectedQty = Math.max(0, Math.min(receivedQty - acceptedQty, Number(it.rejected_quantity ?? (receivedQty - acceptedQty))));
    const qty = acceptedQty;
    const unit = Number(it.unit_price || 0);
    const line = qty * unit;
    const unitLanded = qty > 0 ? unit + (totalQty > 0 ? shipping * (qty / totalQty) / qty : 0) : unit;
    const poItemId = it.purchase_order_item_id || it.po_item_id || null;

    const gri = await client.query(`
      INSERT INTO goods_receipt_items (
        goods_receipt_id, ingredient_id, po_item_id, ordered_qty, previously_received_qty,
        expected_qty, received_qty, free_qty, accepted_qty, rejected_qty, quarantine_qty,
        damaged_qty, unit_price, unit_cost, discount_rate, tax_rate, net_price, total_cost,
        landed_unit_cost, total_landed_cost, uom, qc_status, putaway_status, notes, rejection_reason
      ) VALUES ($1,$2,$3,$4,COALESCE((SELECT received_quantity FROM purchase_order_items WHERE id=$5),0),$6,$7,0,$8,$9,0,0,$10,$11,0,0,$12,$13,$14,$15,$16,'passed','pending',$17,$18)
      RETURNING id
    `, [
      grId, it.ingredient_id, poItemId, Number(it.ordered_quantity || it.quantity || 0),
      poItemId, Number(it.ordered_quantity || it.quantity || 0),
      receivedQty, acceptedQty, rejectedQty, unit, unit, unit, line, unitLanded, qty * unitLanded, it.unit || null,
      `فاتورة شراء #${purchaseId}`, it.rejection_reason || null
    ]);
    const griId = Number(gri.rows[0].id);

    // Unit Conversion: Convert purchase unit to warehouse base unit if different
    const ingRes = await client.query("SELECT id, name, unit FROM ingredients WHERE id = $1", [it.ingredient_id]);
    const ingBaseUnit = ingRes.rows[0]?.unit || it.unit || "وحدة";
    const conversion = await UnitConversionService.convertItemQuantity(client, {
      ingredientId: Number(it.ingredient_id),
      quantity: qty,
      fromUnit: it.unit || ingBaseUnit,
      toUnit: ingBaseUnit,
      context: 'purchase'
    });

    const baseQty = conversion.success ? conversion.toQuantity : qty;
    const baseUnitLanded = baseQty > 0 ? (qty * unitLanded) / baseQty : unitLanded;
    const conversionNote = conversion.success && conversion.ruleType !== "identical"
      ? ` (شراء: ${qty} ${it.unit || ingBaseUnit} = ${baseQty} ${ingBaseUnit} بالمخزن)`
      : "";

    // IMPORTANT: use the same lock order as the central engine (warehouse -> item).
    // Never lock inventory_items before moveStock, otherwise concurrent receiving
    // and transfer operations could acquire locks in opposite order.
    const movement = await moveStock(client, {
      warehouse_id: Number(purchase.warehouse_id),
      ingredient_id: Number(it.ingredient_id),
      delta: baseQty,
      field: "quantity",
      ref_type: "goods_receipt",
      ref_id: griId,
      user: String(purchase.created_by || "system"),
      notes: `استلام موحد لفاتورة شراء #${purchaseId} - ${receiptNo}${conversionNote}`,
      unit_cost: baseUnitLanded
    });

    const stockAfter = await client.query(
      `SELECT avg_cost FROM inventory_items WHERE id=$1 FOR UPDATE`,
      [movement.inventory_item_id]
    );
    const beforeAvg = Number(stockAfter.rows[0]?.avg_cost || 0);
    const beforeQty = Number(movement.before || 0);
    const afterQty = Number(movement.after || 0);
    const newAvg = (afterQty > 0 && beforeQty > 0 && beforeAvg > 0)
      ? ((beforeQty * beforeAvg) + (baseQty * baseUnitLanded)) / afterQty
      : baseUnitLanded;

    await client.query(
      `UPDATE inventory_items SET avg_cost=$1, last_cost=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
      [newAvg, baseUnitLanded, movement.inventory_item_id]
    );

    // moveStock already wrote the inventory_transactions mirror; attach the
    // goods-receipt reference so the row links back to the receipt document.
    await client.query(`
      UPDATE inventory_transactions
         SET transaction_number=$1, reference_no=$2, notes=$3
       WHERE reference_type='goods_receipt' AND reference_id=$4 AND ingredient_id=$5
    `, [
      `TXN-PUR-${purchaseId}-${it.ingredient_id}-${griId}`, receiptNo,
      `استلام موحد لفاتورة شراء #${purchaseId}${conversionNote}`,
      griId, it.ingredient_id
    ]);

    if (poItemId) {
      if (options.markInvoiced) {
        await client.query(`UPDATE purchase_order_items SET received_quantity=GREATEST(COALESCE(received_quantity,0),COALESCE(received_quantity,0)+$1), invoiced_quantity=COALESCE(invoiced_quantity,0)+$2 WHERE id=$3`, [acceptedQty, acceptedQty, poItemId]);
      } else {
        await client.query(`UPDATE purchase_order_items SET received_quantity=COALESCE(received_quantity,0)+$1 WHERE id=$2`, [acceptedQty, poItemId]);
      }
    }

    await client.query(`
      UPDATE ingredients 
      SET last_purchase_price = $1, 
          avg_cost = COALESCE(
            (SELECT SUM(COALESCE(ii.quantity, 0) * COALESCE(NULLIF(ii.avg_cost, 0), $2::numeric)) / NULLIF(SUM(COALESCE(ii.quantity, 0)), 0) FROM inventory_items ii WHERE ii.ingredient_id = $3),
            $4::numeric
          )
      WHERE id = $5
    `, [unitLanded, unitLanded, it.ingredient_id, unitLanded, it.ingredient_id]);
    void griId;
  }

  if (purchase.purchase_order_id) {
    const po = await client.query(`SELECT COALESCE(SUM(quantity),0) ordered, COALESCE(SUM(received_quantity),0) received FROM purchase_order_items WHERE purchase_order_id=$1`, [purchase.purchase_order_id]);
    const ordered = Number(po.rows[0]?.ordered || 0);
    const received = Number(po.rows[0]?.received || 0);
    await client.query(`UPDATE purchase_orders SET status=$1, received_amount=COALESCE(received_amount,0)+$2 WHERE id=$3`, [received >= ordered ? 'received' : 'partially_received', landed, purchase.purchase_order_id]);
  }

  // GRNI entry: inventory is recognized when the warehouse receipt is posted.
  // This is an optional accounting enhancement. It MUST NOT poison the main
  // receiving transaction if an older accounting schema is missing a column.
  let journalEntryId: number | null = null;
  try {
    await client.query('SAVEPOINT purchase_grni_sp');
    const inv = await client.query(`SELECT id FROM accounts WHERE COALESCE(status, true)=true AND (code LIKE '120%' OR name LIKE '%مخزون%' OR name_en ILIKE '%inventory%') ORDER BY id LIMIT 1`);
    const grni = await client.query(`SELECT id FROM accounts WHERE COALESCE(status, true)=true AND (name LIKE '%بضاعة غير مفوترة%' OR name_en ILIKE '%GRNI%' OR code LIKE '210%') ORDER BY id LIMIT 1`);
    if (inv.rows[0] && grni.rows[0] && landed > 0) {
      // Resolve the open financial period for the receipt date so the entry is included
      // in period-filtered trial balance / P&L reports (it was previously left NULL).
      let grnPeriodId: number | null = null;
      try {
        const d = new Date(date);
        const pr = await client.query(
          `SELECT id FROM financial_periods WHERE status = 'open' AND year = $1 AND month = $2 ORDER BY id DESC LIMIT 1`,
          [d.getFullYear(), d.getMonth() + 1]
        );
        grnPeriodId = pr.rows[0]?.id || null;
      } catch (_) {}
      const je = await client.query(`INSERT INTO journal_entries (date,reference,description,source_type,source_id,total_debit,total_credit,status,period_id) VALUES ($1,$2,$3,'goods_receipt',$4,$5,$6,'posted',$7) RETURNING id`, [date,receiptNo,`ترحيل استلام موحد ${receiptNo}`,grId,landed,landed,grnPeriodId]);
      journalEntryId = Number(je.rows[0].id);
      await client.query(`INSERT INTO journal_items (journal_entry_id,account_id,debit,credit,notes) VALUES ($1,$2,$3,0,$4),($5,$6,0,$7,$8)`, [journalEntryId,inv.rows[0].id,landed,`مدين مخزون - ${receiptNo}`,journalEntryId,grni.rows[0].id,landed,`دائن GRNI - ${receiptNo}`]);
    }
    await client.query('RELEASE SAVEPOINT purchase_grni_sp');
  } catch (accountingError: any) {
    // Roll back ONLY the optional GRNI work. The receiving/stock changes stay valid.
    await client.query('ROLLBACK TO SAVEPOINT purchase_grni_sp').catch(() => {});
    await client.query('RELEASE SAVEPOINT purchase_grni_sp').catch(() => {});
    journalEntryId = null;
    console.warn('[Purchases Receiving] Optional GRNI posting skipped:', accountingError?.message || accountingError);
  }

  await client.query(`UPDATE goods_receipts SET journal_entry_id=$1 WHERE id=$2`, [journalEntryId, grId]);
  return { id: grId, receipt_no: receiptNo, journal_entry_id: journalEntryId };
}
