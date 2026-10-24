import { PoolClient } from "pg";

/**
 * Enterprise Goods Receipt Note (GRN) & Quality Control (QC) Inbound Module
 * 
 * This service handles linking inbound GRNs to confirmed Purchase Orders (POs),
 * validating received quantities against remaining/ordered balances, calculating
 * landed costs, and atomically posting physical/available stock to the warehouse.
 */

export interface GRNItemInput {
  ingredient_id: number;
  po_item_id?: number; // Linked PO item identifier
  ordered_qty?: number;
  previously_received_qty?: number;
  received_qty: number; // Incoming quantity being received
  free_qty?: number; // Free of charge/bonus items
  unit_price: number; // Base purchase price per unit
  discount_rate?: number; // Optional line discount percentage (e.g. 5 for 5%)
  tax_rate?: number; // Optional line tax percentage (e.g. 14 for 14%)
  batch_number?: string;
  expiry_date?: string;
  manufacturing_date?: string;
  serial_numbers?: string[]; // Array of unique serial numbers if tracked
  location_id?: number; // Targeted storage location/shelf in warehouse
  notes?: string; // Optional item-level notes
  uom?: string; // Unit of measure
  unit?: string; // Unit of measure alias
}

export interface GRNCreationPayload {
  warehouse_id: number;
  supplier_id: number;
  purchase_order_id?: number; // Optional PO linkage
  supplier_invoice_no?: string;
  delivery_note_no?: string;
  date?: string; // Receipt date (YYYY-MM-DD)
  posting_date?: string; // Financial posting date
  currency?: string; // e.g. "EGP", "USD"
  exchange_rate?: number;
  receiver_name?: string;
  reference?: string;
  freight_charges?: number; // Landed cost: freight
  customs_charges?: number; // Landed cost: customs
  other_charges?: number;   // Landed cost: other fees
  landed_cost_allocation?: "value" | "quantity"; // Pro-rata distribution method
  items: GRNItemInput[];
  notes?: string;
  user: string;
  status?: "draft" | "qc_pending" | "submitted";
}

export class GRNQCService {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  /**
   * 1. FETCH & LINK PURCHASE ORDER
   * Fetches an active, approved Purchase Order and validates its state for receiving.
   * Returns PO header info alongside each item's remaining quantity to receive.
   */
  async fetchAndLinkPurchaseOrder(purchaseOrderId: number) {
    const client: PoolClient = await this.pool.connect();
    try {
      // Fetch PO Header (Must be active/approved for receiving)
      const poRes = await client.query(
        `SELECT id, order_number, supplier_id, status, total_amount, currency
         FROM purchase_orders 
         WHERE id = $1`,
         [purchaseOrderId]
      );

      if (poRes.rows.length === 0) {
        throw new Error(`أمر الشراء رقم #${purchaseOrderId} غير موجود بالنظام`);
      }

      const po = poRes.rows[0];
      const allowedStatuses = ["approved", "partially_received"];
      if (!allowedStatuses.includes(po.status)) {
        throw new Error(`حالة أمر الشراء (${po.status}) لا تسمح بالاستلام. يجب أن يكون معتمداً أو مستلماً جزئياً.`);
      }

      // Fetch PO Line Items with remaining receiving balance calculation
      const itemsRes = await client.query(
        `SELECT poi.id, poi.ingredient_id, poi.quantity as ordered_qty, 
                COALESCE(poi.received_quantity, 0) as previously_received_qty,
                (poi.quantity - COALESCE(poi.received_quantity, 0)) as remaining_qty,
                poi.unit_price, i.name as ingredient_name, i.unit as uom
         FROM purchase_order_items poi
         JOIN ingredients i ON poi.ingredient_id = i.id
         WHERE poi.purchase_order_id = $1`,
         [purchaseOrderId]
      );

      return {
        success: true,
        purchase_order: {
          id: po.id,
          order_number: po.order_number,
          supplier_id: po.supplier_id,
          status: po.status,
          currency: po.currency,
          total_amount: Number(po.total_amount)
        },
        items: itemsRes.rows.map(item => ({
          id: item.id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          uom: item.uom,
          ordered_qty: Number(item.ordered_qty),
          previously_received_qty: Number(item.previously_received_qty),
          remaining_qty: Math.max(0, Number(item.remaining_qty)),
          unit_price: Number(item.unit_price)
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * 2. CREATE GRN WITH QUANTITY VALIDATION & LANDED COSTS ALLOCATION
   * Validates incoming quantities against remaining PO balances, calculates line totals,
   * distributes landed costs, and saves the GRN as a draft/pending document.
   */
  async createGRN(payload: GRNCreationPayload) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const {
        warehouse_id, supplier_id, purchase_order_id, supplier_invoice_no, delivery_note_no,
        date, posting_date, currency = "EGP", exchange_rate = 1.0, receiver_name, reference,
        freight_charges = 0, customs_charges = 0, other_charges = 0, landed_cost_allocation = "value",
        items, notes, user, status = "draft"
      } = payload;

      // Ensure warehouse exists
      const whCheck = await client.query("SELECT id, name FROM warehouses WHERE id = $1", [warehouse_id]);
      if (whCheck.rows.length === 0) {
        throw new Error(`مخزن الاستلام المحدد رقم #${warehouse_id} غير موجود`);
      }

      // Generate a unique sequential receipt number: GRN-YYYYMM-XXXX
      const dateString = (date || new Date().toISOString().split("T")[0]).replace(/-/g, "").slice(0, 6);
      const seqRes = await client.query(
        "SELECT COUNT(*) FROM goods_receipts WHERE receipt_no LIKE $1",
        [`GRN-${dateString}%`]
      );
      const nextSeq = (parseInt(seqRes.rows[0].count) + 1).toString().padStart(4, "0");
      const receiptNo = `GRN-${dateString}-${nextSeq}`;

      // Quantitative & Financial Calculations
      let grossTotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let totalQty = 0;

      // Pre-validate quantities if tied to a PO
      if (purchase_order_id) {
        const poDetails = await this.fetchAndLinkPurchaseOrder(purchase_order_id);
        const poItemsMap = new Map(poDetails.items.map(i => [i.id, i]));

        for (const it of items) {
          if (!it.po_item_id) {
            throw new Error(`يجب ربط الصنف #${it.ingredient_id} بسطر صنف في أمر الشراء المختار`);
          }

          const poLine = poItemsMap.get(it.po_item_id);
          if (!poLine) {
            throw new Error(`سطر صنف أمر الشراء #${it.po_item_id} غير متطابق مع أمر الشراء المحدد`);
          }

          // Strict Quantity Validation: Allow maximum of 5% tolerance for over-receipt if permitted
          const maxAllowedQty = poLine.remaining_qty * 1.05;
          if (it.received_qty > maxAllowedQty) {
            throw new Error(
              `الكمية المستلمة للصنف "${poLine.ingredient_name}" (${it.received_qty}) تتجاوز الكمية المتبقية بأمر الشراء (${poLine.remaining_qty}) متضمنة نسبة السماحية.`
            );
          }
        }
      }

      // Compute line items totals
      for (const it of items) {
        const rQty = Number(it.received_qty || 0);
        const uPrice = Number(it.unit_price || 0);
        const discRate = Number(it.discount_rate || 0);
        const taxRate = Number(it.tax_rate || 0);

        const lineGross = rQty * uPrice;
        const lineDisc = lineGross * (discRate / 100);
        const lineTaxable = lineGross - lineDisc;
        const lineTax = lineTaxable * (taxRate / 100);

        grossTotal += lineGross;
        totalDiscount += lineDisc;
        totalTax += lineTax;
        totalQty += rQty;
      }

      const netAmount = grossTotal - totalDiscount;
      const totalExtraCharges = Number(freight_charges) + Number(customs_charges) + Number(other_charges);
      const totalLandedCost = netAmount + totalExtraCharges;
      const totalPayableWithTax = totalLandedCost + totalTax;

      // Insert Goods Receipt Note (GRN) Header
      const grRes = await client.query(`
        INSERT INTO goods_receipts (
          receipt_no, date, posting_date, warehouse_id, supplier_id, purchase_order_id,
          supplier_invoice_no, delivery_note_no, status, qc_status, currency, exchange_rate,
          receiver_name, reference, total_amount, discount_amount, tax_amount, net_amount,
          freight_charges, customs_charges, other_charges, total_landed_cost, landed_cost_allocation,
          is_posted, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP)
        RETURNING id, receipt_no
      `, [
        receiptNo, date || new Date().toISOString().split("T")[0], posting_date || date || new Date().toISOString().split("T")[0],
        Number(warehouse_id), supplier_id ? Number(supplier_id) : null, purchase_order_id ? Number(purchase_order_id) : null,
        supplier_invoice_no || null, delivery_note_no || null, status, "pending",
        currency, exchange_rate, receiver_name || user, reference || null,
        totalPayableWithTax, totalDiscount, totalTax, netAmount,
        Number(freight_charges), Number(customs_charges), Number(other_charges),
        totalLandedCost, landed_cost_allocation, false, notes || null
      ]);

      const grId = grRes.rows[0].id;

      // Insert GRN Items & Distribute Landed Costs (Recoverable VAT excluded from inventory cost)
      for (const it of items) {
        const rQty = Number(it.received_qty || 0);
        const freeQty = Number(it.free_qty || 0);
        const totalRecvQty = rQty + freeQty;
        const uPrice = Number(it.unit_price || 0);
        const discRate = Number(it.discount_rate || 0);
        const taxRate = Number(it.tax_rate || 0);

        const lineGross = rQty * uPrice;
        const lineDisc = lineGross * (discRate / 100);
        const lineNet = lineGross - lineDisc; // Net inventory value before VAT
        const lineTax = lineNet * (taxRate / 100);

        // Pro-rata landed cost distribution
        let lineExtraLanded = 0;
        if (totalExtraCharges > 0) {
          if (landed_cost_allocation === "quantity" && totalQty > 0) {
            lineExtraLanded = (rQty / totalQty) * totalExtraCharges;
          } else if (netAmount > 0) {
            lineExtraLanded = (lineNet / netAmount) * totalExtraCharges;
          }
        }

        const itemTotalLanded = lineNet + lineExtraLanded;
        const itemUnitLandedCost = rQty > 0 ? (itemTotalLanded / rQty) : uPrice;

        await client.query(`
          INSERT INTO goods_receipt_items (
            goods_receipt_id, ingredient_id, po_item_id, ordered_qty, previously_received_qty,
            expected_qty, received_qty, free_qty, accepted_qty, rejected_qty, quarantine_qty,
            damaged_qty, unit_price, unit_cost, discount_rate, tax_rate, net_price, total_cost,
            landed_unit_cost, total_landed_cost, batch_number, expiry_date, manufacturing_date,
            serial_numbers, location_id, qc_status, putaway_status, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, 0, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'pending', 'pending', $22)
        `, [
          grId, it.ingredient_id, it.po_item_id || null, Number(it.ordered_qty || 0),
          Number(it.previously_received_qty || 0), Number(it.ordered_qty || rQty),
          rQty, freeQty, uPrice, uPrice, discRate, taxRate,
          (rQty > 0 ? lineNet / rQty : uPrice), lineNet,
          itemUnitLandedCost, itemTotalLanded, it.batch_number || null,
          it.expiry_date || null, it.manufacturing_date || null,
          it.serial_numbers ? it.serial_numbers.join(",") : null,
          it.location_id || null, it.notes || null
        ]);
      }

      await client.query("COMMIT");
      return {
        success: true,
        goods_receipt_id: grId,
        receipt_no: receiptNo,
        total_amount: totalLandedCost,
        status
      };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 3. APPROVE & POST GRN (ATOMIC STOCK INVENTORY POSTING)
   * Transitions GRN status from Draft/QC Pending to Approved.
   * Atomically locks and increments stock balances (physicalQty and availableQty),
   * records stock transactions to ledger, logs batch tracking, and updates PO fulfillment.
   */
  async approveGRN(grnId: number, user: string, postingDate?: string) {
    const client: PoolClient = await this.pool.connect();
    try {
      // Begin Database Transaction to guarantee atomicity and avoid race-conditions
      await client.query("BEGIN");

      // Select GRN header with row-level lock (SELECT FOR UPDATE)
      const grRes = await client.query(
        "SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE",
        [grnId]
      );

      if (grRes.rows.length === 0) {
        throw new Error(`سند الاستلام رقم #${grnId} غير موجود بالنظام`);
      }

      const gr = grRes.rows[0];
      if (gr.is_posted || gr.status === "posted" || gr.status === "completed") {
        throw new Error("سند الاستلام مرحل بالفعل مسبقاً ولا يمكن تعديله أو تكرار اعتماده");
      }

      // Fetch GRN items
      const itemsRes = await client.query(
        "SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1",
        [grnId]
      );

      if (itemsRes.rows.length === 0) {
        throw new Error("سند الاستلام فارغ ولا يحتوي على بنود أو خامات للاستلام");
      }

      const effectiveDate = postingDate || gr.posting_date || gr.date || new Date().toISOString().split("T")[0];
      let totalValue = 0;

      for (const it of itemsRes.rows) {
        // Fallback to received quantity if quality control (QC) wasn't finalized separately
        const accQty = Number(it.accepted_qty > 0 ? it.accepted_qty : (it.qc_status === "passed" ? it.received_qty : it.received_qty));
        if (accQty <= 0) continue;

        const unitCost = Number(it.landed_unit_cost > 0 ? it.landed_unit_cost : (it.unit_cost || it.unit_price || 0));
        const lineCost = accQty * unitCost;
        totalValue += lineCost;

        // A. LOCK AND UPDATE STOCK BALANCE (availableQty & physicalQty increment)
        const curStockRes = await client.query(
          "SELECT id, quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
          [gr.warehouse_id, it.ingredient_id]
        );

        let beforeQty = 0;
        let beforeAvg = 0;

        if (curStockRes.rows.length > 0) {
          // Existing record: increment balances
          const stockRow = curStockRes.rows[0];
          beforeQty = Number(stockRow.quantity || 0);
          beforeAvg = Number(stockRow.avg_cost || 0);

          const newQty = beforeQty + accQty;
          // Calculate Moving Weighted Average: (Existing Qty * Old Cost + Incoming Qty * Landed Cost) / New Qty
          const newAvgCost = (newQty > 0 && beforeQty > 0 && beforeAvg > 0)
            ? ((beforeQty * beforeAvg) + (accQty * unitCost)) / newQty
            : unitCost;

          await client.query(`
            UPDATE inventory_items SET
              quantity = $1, avg_cost = $2, last_cost = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
          `, [newQty, newAvgCost, unitCost, stockRow.id]);
        } else {
          // No prior stock record: insert a new one
          await client.query(`
            INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, avg_cost, last_cost)
            VALUES ($1, $2, $3, $4, $5)
          `, [gr.warehouse_id, it.ingredient_id, accQty, unitCost, unitCost]);
        }

        // B. Update average costs on ingredient master-data
        await client.query(`
          UPDATE ingredients 
          SET last_purchase_price = $1, 
              avg_cost = COALESCE(
                (SELECT SUM(COALESCE(ii.quantity, 0) * COALESCE(NULLIF(ii.avg_cost, 0), $2::numeric)) / NULLIF(SUM(COALESCE(ii.quantity, 0)), 0) FROM inventory_items ii WHERE ii.ingredient_id = $3),
                $4::numeric
              )
          WHERE id = $5
        `, [unitCost, unitCost, it.ingredient_id, unitCost, it.ingredient_id]);

        // C. Record Stock Ledger Transaction
        await client.query(`
          INSERT INTO inventory_transactions (
            transaction_number, warehouse_id, ingredient_id, quantity, type,
            unit_cost, total_cost, balance_before, balance_after, batch_number,
            expiry_date, location_id, reference_type, reference_id, reference_no,
            status, notes, date
          ) VALUES ($1, $2, $3, $4, 'receipt', $5, $6, $7, $8, $9, $10, $11, 'goods_receipt', $12, $13, 'posted', $14, $15)
        `, [
          `TXN-GRN-${Date.now().toString().slice(-6)}-${it.ingredient_id}`,
          gr.warehouse_id, it.ingredient_id, accQty, unitCost, lineCost,
          beforeQty, beforeQty + accQty, it.batch_number || null,
          it.expiry_date || null, it.location_id || null, grnId, gr.receipt_no,
          `اعتماد وتأكيد سند الاستلام الوارد رقم ${gr.receipt_no}`, effectiveDate
        ]);

        // D. Batch Tracking registration
        if (it.batch_number) {
          await client.query(`
            INSERT INTO batch_tracking (
              ingredient_id, warehouse_id, batch_number, quantity, remaining_quantity,
              unit_cost, expiry_date, manufacturing_date, supplier_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (ingredient_id, warehouse_id, batch_number)
            DO UPDATE SET remaining_quantity = batch_tracking.remaining_quantity + EXCLUDED.remaining_quantity
          `, [
            it.ingredient_id, gr.warehouse_id, it.batch_number, accQty, accQty,
            unitCost, it.expiry_date || null, it.manufacturing_date || null,
            gr.supplier_id, `استلام GRN ${gr.receipt_no}`
          ]);
        }

        // E. Cost Layer tracking (FIFO)
        await client.query(`
          INSERT INTO stock_cost_layers (
            ingredient_id, warehouse_id, batch_number, quantity_received, quantity_remaining,
            unit_cost, total_cost, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
        `, [
          it.ingredient_id, gr.warehouse_id, it.batch_number || null,
          accQty, accQty, unitCost, lineCost
        ]);

        // F. Update PO line items received balances
        if (gr.purchase_order_id && it.po_item_id) {
          await client.query(`
            UPDATE purchase_order_items
            SET received_quantity = COALESCE(received_quantity, 0) + $1
            WHERE id = $2
          `, [accQty, it.po_item_id]);
        }
      }

      // G. Update Purchase Order Status
      if (gr.purchase_order_id) {
        const poStatusRes = await client.query(`
          SELECT 
            SUM(quantity) as total_ordered,
            SUM(COALESCE(received_quantity, 0)) as total_received
          FROM purchase_order_items
          WHERE purchase_order_id = $1
        `, [gr.purchase_order_id]);

        const totalOrdered = Number(poStatusRes.rows[0]?.total_ordered || 0);
        const totalReceived = Number(poStatusRes.rows[0]?.total_received || 0);

        const updatedPoStatus = totalReceived >= totalOrdered 
          ? "received" 
          : (totalReceived > 0 ? "partially_received" : "approved");

        await client.query(
          "UPDATE purchase_orders SET status = $1 WHERE id = $2",
          [updatedPoStatus, gr.purchase_order_id]
        );
      }

      // H. Finalize GRN header status to "posted"
      await client.query(`
        UPDATE goods_receipts SET
          status = 'posted',
          is_posted = true,
          posted_at = CURRENT_TIMESTAMP,
          posting_date = $1,
          receiver_name = COALESCE(receiver_name, $2)
        WHERE id = $3
      `, [effectiveDate, user, grnId]);

      // Commit changes atomically
      await client.query("COMMIT");

      return {
        success: true,
        message: "تم ترحيل سند الاستلام وتحديث كميات المخزن والمشتريات بنجاح",
        goods_receipt_id: grnId,
        receipt_no: gr.receipt_no,
        total_value: totalValue,
        status: "posted"
      };
    } catch (err: any) {
      // Rollback completely in case of any failure
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
