import { ReturnRepository } from "../repositories/return.repository.js";
import { CreateReturnDTO, UpdateReturnDTO } from "../dto/return.dto.js";
import { ERPCache, ERPEventBus, erpPool } from "../../../server-erp-core.js";
import { moveStock } from "../../warehouses/services/inventory.service.js";
import { financialIntegrationService } from "../../accounting/services/financial_integration.service.js";
import { toDateOnly } from "../../common/dateOnly.js";

/** كيف يخرج المبلغ من الشركة: نقدًا من الخزينة، من البنك، أو تخفيض ذمة العميل. */
type RefundChannel = "cash" | "bank" | "credit";

const LIST_CACHE_KEY = "sales:returns:all";

export class ReturnService {
  private repository: ReturnRepository;

  constructor() {
    this.repository = new ReturnRepository();
  }

  async getReturns(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const returns = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, returns, 60);
    return returns;
  }

  async getReturnById(id: number): Promise<any> {
    const returnDoc = await this.repository.getById(id);
    if (!returnDoc) {
      const err: any = new Error("Sales return not found");
      err.statusCode = 404;
      throw err;
    }
    return returnDoc;
  }

  /**
   * Fetches all sales invoices eligible for return, calculating line-by-line
   * previously returned quantities and remaining returnable quantities.
   */
  async getEligibleInvoices(options?: { branchId?: number; includeInvoiceId?: number | string }): Promise<any[]> {
    let sql = `
      SELECT i.id, i.invoice_no, i.customer_id, i.customer_name, i.date, i.due_date,
             i.status, i.is_posted, i.warehouse, i.warehouse_id, i.branch_id,
             i.sales_rep, i.subtotal, i.discount_total, i.tax_total, i.net_amount, i.paid_amount,
             i.created_at, i.order_id, o.order_no AS source_order_no
        FROM sales_invoices i
        LEFT JOIN erp_sales_orders o ON o.id = i.order_id
       WHERE (
         i.status NOT IN ('ملغاة', 'cancelled', 'ملغى', 'draft', 'مسودة')
         OR i.is_posted = true
       )
    `;
    const params: any[] = [];
    if (options?.branchId) {
      params.push(options.branchId);
      sql += ` AND (i.branch_id = $${params.length} OR i.branch_id IS NULL)`;
    }
    sql += ` ORDER BY i.id DESC`;

    const invoicesRes = await erpPool.query(sql, params);
    const invoices = invoicesRes.rows;
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((inv: any) => inv.id);

    const itemsRes = await erpPool.query(
      `SELECT id, invoice_id, item_id, item_type, ingredient_id, product_id,
              barcode, code, name, unit, qty, price, unit_cost, total_cost,
              discount_percent, vat_percent, total
         FROM sales_invoice_items
        WHERE invoice_id = ANY($1::int[])
        ORDER BY id ASC`,
      [invoiceIds]
    );
    const itemsByInvoiceId = new Map<number, any[]>();
    for (const row of itemsRes.rows) {
      const arr = itemsByInvoiceId.get(row.invoice_id) || [];
      arr.push(row);
      itemsByInvoiceId.set(row.invoice_id, arr);
    }

    const returnsRes = await erpPool.query(
      `SELECT sri.id, sri.return_id, sri.invoice_item_id, sri.item_code, sri.item_name,
              sri.ingredient_id, sri.product_id, sri.qty_returned,
              sr.invoice_id, sr.status as return_status
         FROM sales_return_items sri
         JOIN sales_returns sr ON sri.return_id = sr.id
        WHERE sr.status NOT IN ('ملغى', 'ملغاة', 'cancelled')
          AND NOT (sr.status IN ('مسودة', 'draft') AND sr.journal_entry_id IS NULL)
        ORDER BY sri.id ASC`
    );
    const returnItems = returnsRes.rows;

    const includeInvStr = options?.includeInvoiceId ? String(options.includeInvoiceId).trim().toLowerCase() : null;
    const eligibleInvoices: any[] = [];

    for (const inv of invoices) {
      const invItems = itemsByInvoiceId.get(inv.id) || [];
      if (invItems.length === 0) continue;

      const invIdStr = String(inv.id);
      const invNoStr = String(inv.invoice_no || "").toLowerCase();
      const linkedReturnItems = returnItems.filter((ri: any) => {
        const raw = String(ri.invoice_id || "").trim().toLowerCase();
        const stripped = raw.replace(/^inv-0*/i, "");
        return (
          raw === invIdStr ||
          stripped === invIdStr ||
          raw === `inv-${invIdStr}` ||
          (invNoStr && raw === invNoStr)
        );
      });

      const matchedReturnIds = new Set<number>();
      let totalQtyInvoiced = 0;
      let totalQtyPreviouslyReturned = 0;
      let totalQtyRemaining = 0;

      const enrichedItems = invItems.map((line: any) => {
        const lineQty = Number(line.qty) || 0;
        totalQtyInvoiced += lineQty;

        let returnedForThisLine = 0;
        for (const ri of linkedReturnItems) {
          if (matchedReturnIds.has(ri.id)) continue;

          let matches = false;
          if (ri.invoice_item_id && Number(ri.invoice_item_id) === Number(line.id)) {
            matches = true;
          } else if (!ri.invoice_item_id) {
            if (line.code && ri.item_code && String(line.code).trim().toLowerCase() === String(ri.item_code).trim().toLowerCase()) {
              matches = true;
            } else if (line.name && ri.item_name && String(line.name).trim().toLowerCase() === String(ri.item_name).trim().toLowerCase()) {
              matches = true;
            } else if (line.ingredient_id && ri.ingredient_id && Number(line.ingredient_id) === Number(ri.ingredient_id)) {
              matches = true;
            } else if (line.product_id && ri.product_id && Number(line.product_id) === Number(ri.product_id)) {
              matches = true;
            }
          }

          if (matches) {
            matchedReturnIds.add(ri.id);
            returnedForThisLine += Number(ri.qty_returned) || 0;
          }
        }

        totalQtyPreviouslyReturned += returnedForThisLine;
        const lineRemaining = Math.max(0, lineQty - returnedForThisLine);
        totalQtyRemaining += lineRemaining;

        return {
          id: line.id,
          invoiceItemId: line.id,
          itemId: line.item_id,
          itemType: line.item_type,
          ingredientId: line.ingredient_id,
          productId: line.product_id,
          barcode: line.barcode,
          code: line.code,
          name: line.name,
          unit: line.unit || "قطعة",
          qtyInvoiced: lineQty,
          qtyPreviouslyReturned: returnedForThisLine,
          remainingQty: lineRemaining,
          price: Number(line.price) || 0,
          unitCost: Number(line.unit_cost) || 0,
          totalCost: Number(line.total_cost) || 0,
          discountPercent: Number(line.discount_percent) || 0,
          vatPercent: Number(line.vat_percent) || 0,
          total: Number(line.total) || 0,
        };
      });

      const isCurrentIncluded = includeInvStr && (
        String(inv.id) === includeInvStr ||
        String(inv.invoice_no).toLowerCase() === includeInvStr ||
        `inv-${inv.id}` === includeInvStr
      );

      if (totalQtyRemaining <= 0 && !isCurrentIncluded) {
        continue;
      }

      eligibleInvoices.push({
        id: inv.id,
        invoiceNo: inv.invoice_no,
        orderId: inv.order_id || null,
        orderNo: inv.source_order_no || null,
        customerId: inv.customer_id,
        customerName: inv.customer_name,
        date: toDateOnly(inv.date),
        dueDate: toDateOnly(inv.due_date),
        status: inv.status,
        isPosted: Boolean(inv.is_posted),
        warehouse: inv.warehouse || "المخزن الرئيسي",
        warehouseId: inv.warehouse_id || 1,
        branchId: inv.branch_id || 1,
        salesRep: inv.sales_rep,
        subtotal: Number(inv.subtotal) || 0,
        discountTotal: Number(inv.discount_total) || 0,
        taxTotal: Number(inv.tax_total) || 0,
        netAmount: Number(inv.net_amount) || 0,
        paidAmount: Number(inv.paid_amount) || 0,
        totalQtyInvoiced,
        totalQtyPreviouslyReturned,
        totalQtyRemaining,
        returnableItemsCount: enrichedItems.filter((i: any) => i.remainingQty > 0).length,
        totalItemsCount: enrichedItems.length,
        items: enrichedItems
      });
    }

    return eligibleInvoices;
  }

  /**
   * Fetches full returnable details for a single invoice including remaining quantities per line item.
   */
  async getInvoiceReturnDetails(invId: string | number): Promise<any> {
    const rawInvId = String(invId).trim();
    const strippedInvId = rawInvId.replace(/^INV-0*/i, "");

    const invoiceRes = await erpPool.query(
      `SELECT i.*, o.order_no AS source_order_no
         FROM sales_invoices i
         LEFT JOIN erp_sales_orders o ON o.id = i.order_id
        WHERE i.id::text = $1
           OR i.id::text = $2
           OR i.invoice_no ILIKE $1
           OR i.invoice_no ILIKE $2
           OR REPLACE(UPPER(i.invoice_no), 'INV-', '') = $2
        ORDER BY CASE WHEN i.id::text = $2 THEN 0 WHEN i.invoice_no ILIKE $1 THEN 1 ELSE 2 END
        LIMIT 1`,
      [rawInvId, strippedInvId]
    );

    if (invoiceRes.rows.length === 0) {
      const err: any = new Error("فاتورة المبيعات الأصلية غير موجودة");
      err.statusCode = 404;
      throw err;
    }

    const inv = invoiceRes.rows[0];

    const linesRes = await erpPool.query(
      `SELECT id, invoice_id, item_id, item_type, ingredient_id, product_id,
              barcode, code, name, unit, qty, price, unit_cost, total_cost,
              discount_percent, vat_percent, total
         FROM sales_invoice_items
        WHERE invoice_id = $1
        ORDER BY id ASC`,
      [inv.id]
    );
    const invoiceLines = linesRes.rows;

    const returnsRes = await erpPool.query(
      `SELECT sri.id, sri.return_id, sri.invoice_item_id, sri.item_code, sri.item_name,
              sri.ingredient_id, sri.product_id, sri.qty_returned,
              sr.invoice_id, sr.return_no, sr.date, sr.status as return_status
         FROM sales_return_items sri
         JOIN sales_returns sr ON sri.return_id = sr.id
        WHERE (
          sr.invoice_id = $1::text
          OR sr.invoice_id = ('INV-' || $1::text)
          OR sr.invoice_id = $2
          OR REPLACE(UPPER(sr.invoice_id), 'INV-', '') = $3
        )
        AND sr.status NOT IN ('ملغى', 'ملغاة', 'cancelled')
        AND NOT (sr.status IN ('مسودة', 'draft') AND sr.journal_entry_id IS NULL)
        ORDER BY sri.id ASC`,
      [String(inv.id), inv.invoice_no, String(inv.id)]
    );
    const returnItems = returnsRes.rows;

    const matchedReturnIds = new Set<number>();
    let totalQtyInvoiced = 0;
    let totalQtyPreviouslyReturned = 0;
    let totalQtyRemaining = 0;

    const enrichedItems = invoiceLines.map((line: any) => {
      const lineQty = Number(line.qty) || 0;
      totalQtyInvoiced += lineQty;

      let returnedForThisLine = 0;
      for (const ri of returnItems) {
        if (matchedReturnIds.has(ri.id)) continue;

        let matches = false;
        if (ri.invoice_item_id && Number(ri.invoice_item_id) === Number(line.id)) {
          matches = true;
        } else if (!ri.invoice_item_id) {
          if (line.code && ri.item_code && String(line.code).trim().toLowerCase() === String(ri.item_code).trim().toLowerCase()) {
            matches = true;
          } else if (line.name && ri.item_name && String(line.name).trim().toLowerCase() === String(ri.item_name).trim().toLowerCase()) {
            matches = true;
          } else if (line.ingredient_id && ri.ingredient_id && Number(line.ingredient_id) === Number(ri.ingredient_id)) {
            matches = true;
          } else if (line.product_id && ri.product_id && Number(line.product_id) === Number(ri.product_id)) {
            matches = true;
          }
        }

        if (matches) {
          matchedReturnIds.add(ri.id);
          returnedForThisLine += Number(ri.qty_returned) || 0;
        }
      }

      totalQtyPreviouslyReturned += returnedForThisLine;
      const lineRemaining = Math.max(0, lineQty - returnedForThisLine);
      totalQtyRemaining += lineRemaining;

      return {
        id: line.id,
        invoiceItemId: line.id,
        itemId: line.item_id,
        itemType: line.item_type,
        ingredientId: line.ingredient_id,
        productId: line.product_id,
        barcode: line.barcode,
        itemCode: line.code || "ITEM",
        code: line.code || "ITEM",
        itemName: line.name || "صنف",
        name: line.name || "صنف",
        unit: line.unit || "قطعة",
        qtyInvoiced: lineQty,
        qtyPreviouslyReturned: returnedForThisLine,
        remainingQty: lineRemaining,
        qtyReturned: lineRemaining,
        price: Number(line.price) || 0,
        unitCost: Number(line.unit_cost) || 0,
        totalCost: Number(line.total_cost) || 0,
        discountPercent: Number(line.discount_percent) || 0,
        vatPercent: Number(line.vat_percent) || 0,
        total: Number(line.total) || 0,
      };
    });

    return {
      invoice: {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        orderId: inv.order_id || null,
        orderNo: inv.source_order_no || null,
        customerId: inv.customer_id,
        customerName: inv.customer_name,
        date: toDateOnly(inv.date),
        dueDate: toDateOnly(inv.due_date),
        status: inv.status,
        isPosted: Boolean(inv.is_posted),
        warehouse: inv.warehouse || "المخزن الرئيسي",
        warehouseId: inv.warehouse_id || 1,
        branchId: inv.branch_id || 1,
        paymentMethod: inv.payment_method || "نقدي",
        salesRep: inv.sales_rep || "",
        subtotal: Number(inv.subtotal) || 0,
        discountTotal: Number(inv.discount_total) || 0,
        taxTotal: Number(inv.tax_total) || 0,
        netAmount: Number(inv.net_amount) || 0,
        paidAmount: Number(inv.paid_amount) || 0,
      },
      items: enrichedItems,
      summary: {
        totalQtyInvoiced,
        totalQtyPreviouslyReturned,
        totalQtyRemaining,
        isFullyReturned: totalQtyRemaining <= 0,
      }
    };
  }

  /**
   * Creates a sales return and fully integrates it with:
   * 1. Warehouses: restocks items back into the inventory
   * 2. Customers: adjusts balance (credit note) or refunds cash
   * 3. Treasury / Safe: withdraws cash if cash refund
   * 4. Accounting: double-entry GL auto-posting for sales returns
   */
  async createReturn(dto: CreateReturnDTO): Promise<any> {
    // الجداول والترحيلات تُنفذ قبل فتح المعاملة حتى لا تتعارض أوامر ALTER
    // (التي تحتاج قفلًا حصريًا) مع القفل الذي تحمله المعاملة نفسها.
    await this.repository.ensureTablesExist();
    const integrationWarnings: string[] = [];
    const client = await erpPool.connect();
    let returnDoc: any;
    let totalCost = 0;
    let warehouseId = Number(dto.warehouseId) || 1;
    try {
      await client.query("BEGIN");

      let sourceInvoice: any = null;
      let sourceInvoiceItems: any[] = [];
      let priorReturnItems: any[] = [];

      if (dto.invoiceId) {
        const rawInvId = String(dto.invoiceId).trim();
        const strippedInvId = rawInvId.replace(/^INV-0*/i, "");
        // تُجلب الفاتورة بمعرّفها الداخلي أولاً ثم برقمها، ومعها رقم أمر البيع
        // المصدر حتى يظهر في مستند المرتجع نفس الرقم الذي يراه المستخدم في
        // الفاتورة وأمر البيع معاً.
        const sourceInvoiceRes = await client.query(
          `SELECT si.*, so.order_no AS source_order_no
             FROM sales_invoices si
             LEFT JOIN erp_sales_orders so ON so.id = si.order_id
            WHERE si.id::text = $1
               OR si.id::text = $2
               OR si.invoice_no ILIKE $1
               OR si.invoice_no ILIKE $2
               OR REPLACE(UPPER(si.invoice_no), 'INV-', '') = $2
            ORDER BY CASE WHEN si.id::text = $2 THEN 0 WHEN si.invoice_no ILIKE $1 THEN 1 ELSE 2 END, si.id
            LIMIT 1`,
          [rawInvId, strippedInvId]
        );
        if (sourceInvoiceRes.rows.length > 0) {
          sourceInvoice = sourceInvoiceRes.rows[0];
          const sourceLines = await client.query(
            `SELECT id, ingredient_id, product_id, code, name, unit_cost, qty, price, discount_percent, vat_percent
               FROM sales_invoice_items WHERE invoice_id = $1 ORDER BY id`,
            [sourceInvoice.id]
          );
          sourceInvoiceItems = sourceLines.rows;

          const priorReturnsRes = await client.query(
            `SELECT sri.id, sri.invoice_item_id, sri.item_code, sri.item_name, sri.ingredient_id, sri.product_id, sri.qty_returned
               FROM sales_return_items sri
               JOIN sales_returns sr ON sri.return_id = sr.id
              WHERE (sr.invoice_id = $1::text OR sr.invoice_id = ('INV-' || $1::text) OR sr.invoice_id = $2)
                AND sr.status NOT IN ('ملغى', 'ملغاة', 'cancelled')
                AND NOT (sr.status IN ('مسودة', 'draft') AND sr.journal_entry_id IS NULL)
              ORDER BY sri.id ASC`,
            [String(sourceInvoice.id), sourceInvoice.invoice_no]
          );
          priorReturnItems = priorReturnsRes.rows;
        }
      }

      if (!dto.warehouseId && sourceInvoice?.warehouse_id) {
        warehouseId = Number(sourceInvoice.warehouse_id);
      } else if (!dto.warehouseId && dto.warehouse) {
        const warehouse = await client.query(
          "SELECT id FROM warehouses WHERE name ILIKE $1 OR id::text = $1 LIMIT 1",
          [dto.warehouse]
        );
        if (warehouse.rows.length) warehouseId = Number(warehouse.rows[0].id);
      }

      const matchedPriorItemIds = new Set<number>();
      const costedItems = [];

      for (const item of dto.items || []) {
        const qty = Number(item.qtyReturned) || 0;
        if (qty <= 0) throw new Error(`كمية المرتجع غير صحيحة للصنف "${item.itemName}"`);

        const sourceItem = sourceInvoiceItems.find((line: any) =>
          (item.invoiceItemId && Number(line.id) === Number(item.invoiceItemId)) ||
          (item.ingredientId && Number(line.ingredient_id) === Number(item.ingredientId)) ||
          (item.productId && Number(line.product_id) === Number(item.productId)) ||
          (item.itemCode && line.code && String(line.code).trim().toLowerCase() === String(item.itemCode).trim().toLowerCase()) ||
          (item.itemName && line.name && String(line.name).trim().toLowerCase() === String(item.itemName).trim().toLowerCase())
        );

        if (sourceItem) {
          let previouslyReturned = 0;
          for (const pri of priorReturnItems) {
            if (matchedPriorItemIds.has(pri.id)) continue;
            let m = false;
            if (pri.invoice_item_id && Number(pri.invoice_item_id) === Number(sourceItem.id)) {
              m = true;
            } else if (!pri.invoice_item_id) {
              if (sourceItem.code && pri.item_code && String(sourceItem.code).trim().toLowerCase() === String(pri.item_code).trim().toLowerCase()) {
                m = true;
              } else if (sourceItem.name && pri.item_name && String(sourceItem.name).trim().toLowerCase() === String(pri.item_name).trim().toLowerCase()) {
                m = true;
              } else if (sourceItem.ingredient_id && pri.ingredient_id && Number(sourceItem.ingredient_id) === Number(pri.ingredient_id)) {
                m = true;
              } else if (sourceItem.product_id && pri.product_id && Number(sourceItem.product_id) === Number(pri.product_id)) {
                m = true;
              }
            }
            if (m) {
              matchedPriorItemIds.add(pri.id);
              previouslyReturned += Number(pri.qty_returned) || 0;
            }
          }

          const originalQty = Number(sourceItem.qty) || 0;
          const remainingQty = Math.max(0, originalQty - previouslyReturned);
          if (qty > remainingQty + 0.0001) {
            throw new Error(`لا يمكن إرجاع كمية (${qty}) تتجاوز الكمية المتبقية القابلة للإرجاع (${remainingQty}) للصنف "${item.itemName}" (الكمية الأصلية: ${originalQty}، المرتجع سابقاً: ${previouslyReturned})`);
          }
        }

        let invoiceItemId = Number(item.invoiceItemId || sourceItem?.id) || null;
        let productId = Number(item.productId || sourceItem?.product_id) || null;
        let ingredientId = Number(item.ingredientId || sourceItem?.ingredient_id) || null;

        if (!ingredientId) {
          const ingredient = await client.query(
            `SELECT id FROM ingredients
              WHERE (code = $1 AND $1 <> '') OR name ILIKE $2
              ORDER BY CASE WHEN code = $1 THEN 0 ELSE 1 END
              LIMIT 1`,
            [item.itemCode || "", item.itemName || ""]
          );
          ingredientId = Number(ingredient.rows[0]?.id) || null;
        }

        let unitCost = Number(sourceItem?.unit_cost) || 0;
        if (!unitCost && ingredientId) {
          const stock = await client.query(
            `SELECT avg_cost, unit_cost, last_cost, cost
               FROM inventory_items
              WHERE warehouse_id = $1 AND ingredient_id = $2
              ORDER BY id
              LIMIT 1
              FOR UPDATE`,
            [warehouseId, ingredientId]
          );
          const stockRow = stock.rows[0];
          unitCost = [
            stockRow?.avg_cost,
            stockRow?.unit_cost,
            stockRow?.last_cost,
            stockRow?.cost,
          ].map((value) => Number(value) || 0).find((value) => value > 0) || 0;
          if (!unitCost) {
            const ingredient = await client.query(
              "SELECT avg_cost, cost_price, last_purchase_price, cost FROM ingredients WHERE id = $1",
              [ingredientId]
            );
            const ingredientRow = ingredient.rows[0];
            unitCost = [
              ingredientRow?.avg_cost,
              ingredientRow?.cost_price,
              ingredientRow?.last_purchase_price,
              ingredientRow?.cost,
            ].map((value) => Number(value) || 0).find((value) => value > 0) || 0;
          }
        }

        if (!ingredientId) unitCost = 0;
        const totalItemCost = qty * unitCost;
        totalCost += totalItemCost;
        costedItems.push({
          ...item,
          invoiceItemId,
          productId,
          ingredientId,
          unitCost,
          totalCost: totalItemCost
        });
      }

      const computedItemsTotal = costedItems.reduce(
        (sum, it) => sum + (Number(it.total) || (Number(it.qtyReturned || 0) * Number(it.price || 0))),
        0
      );
      const itemsTotal = Number(dto.itemsTotal) > 0 ? Number(dto.itemsTotal) : computedItemsTotal;
      const taxTotal = Number(dto.taxTotal) || 0;
      const discountTotal = Number(dto.discountTotal) || 0;
      const expenses = Number(dto.expenses) || 0;
      const computedGrandTotal = Math.max(0, itemsTotal + taxTotal - discountTotal + expenses);
      const grandTotal = Number(dto.grandTotal) > 0 ? Number(dto.grandTotal) : computedGrandTotal;

      const customerId = dto.customerId || Number(sourceInvoice?.customer_id) || null;
      const branchId = dto.branchId || Number(sourceInvoice?.branch_id) || 1;

      returnDoc = await this.repository.create({
        ...dto,
        invoiceId: sourceInvoice ? String(sourceInvoice.id) : (dto.invoiceId || null),
        invoiceNo: sourceInvoice?.invoice_no || dto.invoiceNo || null,
        orderId: Number(sourceInvoice?.order_id) || null,
        orderNo: sourceInvoice?.source_order_no || null,
        customerId,
        warehouseId,
        branchId,
        itemsTotal,
        taxTotal,
        discountTotal,
        expenses,
        grandTotal,
        totalCost: this.isCommittedStatus(dto.status) ? totalCost : 0,
        items: costedItems
      }, client);

      // المسودة لا تمس المخزون ولا الحسابات: ترحيل الأثر يتم عند الاعتماد فقط.
      if (this.isCommittedStatus(returnDoc.status || dto.status)) {
        const posted = await this.postReturnEffects(Number(returnDoc.id), client);
        totalCost = posted.totalCost;
      } else {
        totalCost = 0;
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    ERPCache.delete(LIST_CACHE_KEY);
    ERPCache.delete("sales:invoices:all");
    returnDoc = await this.repository.getById(Number(returnDoc.id));

    const grandTotal = parseFloat(returnDoc.grandTotal || 0);

    ERPEventBus.getInstance().emitEvent("SalesReturnCreated", {
      returnId: returnDoc.id,
      returnNo: returnDoc.return_no || returnDoc.returnNo,
      customerName: returnDoc.customer_name || returnDoc.customerName,
      grandTotal,
      status: returnDoc.status,
      refundMethod: returnDoc.refundMethod,
      itemsTotal: returnDoc.itemsTotal,
      taxTotal: returnDoc.taxTotal,
      discountTotal: returnDoc.discountTotal,
      expenses: returnDoc.expenses,
      totalCost,
      journalEntryId: returnDoc.journalEntryId || null,
      treasuryTransactionId: returnDoc.treasuryTransactionId || null,
      finNumber: returnDoc.finNumber || null,
      branchId: returnDoc.branchId,
      timestamp: new Date()
    });

    return { ...returnDoc, totalCost, integrationWarnings };
  }

  /**
   * حالة المرتجع «مرحّل» تعني أنه أثّر فعليًا في المخزون والحسابات.
   * أي حالة أخرى (مسودة/ملغى) لا يجب أن تُخصم من الكميات القابلة للإرجاع
   * ولا أن تُرحّل حركة مخزنية أو قيدًا محاسبيًا.
   */
  private isCommittedStatus(status: any): boolean {
    const value = String(status || "").trim().toLowerCase();
    if (!value) return false;
    return !["مسودة", "draft", "draft return", "ملغى", "ملغاة", "cancelled", "canceled"].includes(value);
  }

  /**
   * يرحّل أثر المرتجع مرة واحدة فقط: إعادة الكمية للمخزن + قيد محاسبي عكسي.
   * يُستدعى عند الإنشاء بحالة معتمدة أو عند تحويل مسودة إلى معتمد.
   */
  private async postReturnEffects(
    returnId: number,
    client: any,
  ): Promise<{ totalCost: number; journalEntryId: number | null }> {
    const retRes = await client.query("SELECT * FROM sales_returns WHERE id = $1 FOR UPDATE", [returnId]);
    const ret = retRes.rows[0];
    if (!ret) throw new Error("مرتجع المبيعات غير موجود");

    if (ret.journal_entry_id) {
      return { totalCost: Number(ret.total_cost) || 0, journalEntryId: Number(ret.journal_entry_id) };
    }

    let warehouseId = Number(ret.warehouse_id) || 0;
    if (!warehouseId && ret.warehouse) {
      const wh = await client.query(
        "SELECT id FROM warehouses WHERE TRIM(name) ILIKE TRIM($1) OR code = $1 OR id::text = $1 LIMIT 1",
        [String(ret.warehouse)]
      );
      warehouseId = Number(wh.rows[0]?.id) || 0;
    }
    if (!warehouseId) warehouseId = 1;

    const itemsRes = await client.query(
      "SELECT * FROM sales_return_items WHERE return_id = $1 ORDER BY id",
      [returnId]
    );

    let totalCost = 0;
    for (const item of itemsRes.rows) {
      const qty = Number(item.qty_returned) || 0;
      if (qty <= 0) continue;

      let ingredientId = Number(item.ingredient_id) || null;
      if (!ingredientId) {
        const ingredient = await client.query(
          `SELECT id FROM ingredients
            WHERE (code = $1 AND $1 <> '') OR name ILIKE $2
            ORDER BY CASE WHEN code = $1 THEN 0 ELSE 1 END
            LIMIT 1`,
          [item.item_code || "", item.item_name || ""]
        );
        ingredientId = Number(ingredient.rows[0]?.id) || null;
        if (ingredientId) {
          await client.query(
            "UPDATE sales_return_items SET ingredient_id = $1 WHERE id = $2 AND ingredient_id IS NULL",
            [ingredientId, item.id]
          );
        }
      }
      if (!ingredientId) continue;

      let unitCost = Number(item.unit_cost) || 0;
      if (!unitCost) {
        const stock = await client.query(
          `SELECT avg_cost, unit_cost, last_cost, cost
             FROM inventory_items
            WHERE warehouse_id = $1 AND ingredient_id = $2
            ORDER BY id LIMIT 1`,
          [warehouseId, ingredientId]
        );
        const stockRow = stock.rows[0];
        unitCost = [stockRow?.avg_cost, stockRow?.unit_cost, stockRow?.last_cost, stockRow?.cost]
          .map((value) => Number(value) || 0)
          .find((value) => value > 0) || 0;
      }

      const movement = await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: qty,
        ref_type: "sales_return",
        ref_id: returnId,
        unit_cost: unitCost > 0 ? unitCost : undefined,
        user: ret.sales_rep || "sales_module",
        notes: `مرتجع مبيعات ${ret.return_no || returnId} — ${item.item_name}`
      });
      const lineCost = Number(movement.total_cost) || 0;
      totalCost += lineCost;
      await client.query(
        "UPDATE sales_return_items SET unit_cost = $1, total_cost = $2 WHERE id = $3",
        [Number(movement.unit_cost) || 0, lineCost, item.id]
      );
    }

    const financial = await this.postReturnFinancials({ ret, totalCost }, client);

    await client.query(
      "UPDATE sales_returns SET total_cost = $1, journal_entry_id = $2, treasury_transaction_id = $3, financial_transaction_id = $4, fin_number = $5 WHERE id = $6",
      [
        totalCost,
        financial.journalEntryId,
        financial.treasuryTransactionId,
        financial.transactionId,
        financial.finNumber,
        returnId,
      ]
    );

    return { totalCost, journalEntryId: financial.journalEntryId };
  }

  /**
   * يترجم طريقة الاسترداد المختارة في المستند إلى قناة صرف مالية واحدة.
   * «إشعار دائن للعميل» يخفّض ذمة العميل، «رد نقدي» يخرج من الخزينة،
   * و«تحويل بنكي» يخرج من حساب البنك.
   */
  private resolveRefundChannel(refundMethod: unknown): RefundChannel {
    const value = String(refundMethod || "").trim().toLowerCase();
    if (!value || value.includes("دائن") || value.includes("حساب") || value.includes("آجل") || value.includes("اجل")) {
      return "credit";
    }
    if (["بنك", "تحويل", "شبكة", "شيك", "فيزا", "bank", "transfer", "cheque", "card"].some((token) => value.includes(token))) {
      return "bank";
    }
    return "cash";
  }

  /**
   * الترحيل المالي الموحّد للمرتجع: يمر بنفس طبقة التكامل المالي التي تستخدمها
   * فاتورة المبيعات، وبالتالي يسجّل حركة الخزينة/البنك، ويخفّض ذمة العميل،
   * ويُنشئ قيد اليومية المتوازن، ويسجّل المرجع المركزي FIN — كل ذلك داخل
   * نفس معاملة المرتجع حتى لا يبقى أثر جزئي عند أي فشل.
   */
  private async postReturnFinancials(
    input: { ret: any; totalCost: number },
    client: any,
  ): Promise<{
    journalEntryId: number | null;
    treasuryTransactionId: number | null;
    transactionId: number | null;
    finNumber: string | null;
  }> {
    const ret = input.ret;
    const itemsTotal = Math.max(0, Number(ret.items_total) || 0);
    const taxTotal = Math.max(0, Number(ret.tax_total) || 0);
    const discountTotal = Math.max(0, Number(ret.discount_total) || 0);
    const expenses = Math.max(0, Number(ret.expenses) || 0);
    const grandTotal = Number(
      Math.max(0, Number(ret.grand_total) || 0 || itemsTotal + taxTotal - discountTotal + expenses).toFixed(2)
    );
    const totalCost = Number(Math.max(0, Number(input.totalCost) || 0).toFixed(2));

    if (grandTotal <= 0 && totalCost <= 0) {
      return { journalEntryId: null, treasuryTransactionId: null, transactionId: null, finNumber: null };
    }

    const returnNo = String(ret.return_no || ret.id);
    const customerName = ret.customer_name || "غير محدد";
    let customerId = Number(ret.customer_id) || null;
    if (!customerId && customerName && customerName !== "غير محدد") {
      // مرتجعات قديمة/مُنشأة يدويًا قد لا تحمل معرّف العميل: يُحل بالاسم حتى لا
      // يُرحّل إشعار دائن دون تخفيض رصيد العميل المستحق.
      const byName = await client.query(
        "SELECT id FROM customers WHERE name ILIKE $1 ORDER BY id LIMIT 1",
        [customerName],
      );
      customerId = Number(byName.rows[0]?.id) || null;
      if (customerId) {
        await client.query(
          "UPDATE sales_returns SET customer_id = $1 WHERE id = $2 AND customer_id IS NULL",
          [customerId, ret.id],
        );
      }
    }
    const branchId = Number(ret.branch_id) || 1;
    const channel = this.resolveRefundChannel(ret.refund_method);

    if (channel === "credit" && grandTotal > 0 && !customerId) {
      const err: any = new Error(
        `تعذر ترحيل إشعار مرتجع المبيعات ${returnNo}: لا يوجد عميل مرتبط بالمرتجع أو بالفاتورة الأصلية`
      );
      err.statusCode = 400;
      throw err;
    }

    const accountMap = await financialIntegrationService.getAccountMap(client);
    const findAccount = (...keys: string[]): number | undefined => {
      for (const key of keys) {
        const id = Number(accountMap[key]);
        if (Number.isInteger(id) && id > 0) return id;
      }
      return undefined;
    };

    const cashAccount = findAccount("cash", "cash_account", "1110", "1101", "111");
    let bankAccount = findAccount("bank", "bank_account", "1120", "1102", "112");
    if (!bankAccount) {
      // بعض الأدلة لا تربط حساب البنك في account_config، فيُبحث عنه بالاسم.
      const bankFallback = await client.query(
        `SELECT id FROM accounts
          WHERE (name ILIKE '%بنك%' OR name ILIKE '%bank%') AND allow_posting = true
          ORDER BY id LIMIT 1`
      );
      bankAccount = Number(bankFallback.rows[0]?.id) || undefined;
    }
    const receivableAccount = findAccount("accounts_receivable", "accounts_receivable_account", "1130", "1103", "113");
    const returnsAccount = findAccount(
      "sales_returns",
      "sales_returns_account",
      "sales_discount",
      "sales_revenue",
      "4202",
      "4201",
      "4102",
      "4101",
      "4000"
    );
    const discountAccount = findAccount("sales_discount", "sales_discount_account");
    const taxAccount = findAccount("tax_payable", "tax_payable_account", "vat_payable", "2130", "2103");
    const cogsAccount = findAccount("cost_of_goods_sold", "cost_of_goods_sold_account", "5100", "5101", "51");
    const inventoryAccount = findAccount(
      "inventory_asset",
      "inventory_asset_account",
      "raw_materials_inventory",
      "finished_goods_inventory",
      "1140",
      "1141",
      "1142",
      "114"
    );

    const glLines: Array<{ accountId: number; debit: number; credit: number; description: string; costCenterId?: number | null }> = [];

    if (grandTotal > 0) {
      if (!returnsAccount) {
        throw new Error("إعدادات حساب مردودات المبيعات غير مكتملة؛ لم يتم ترحيل المرتجع");
      }
      const settlementAccount =
        channel === "cash" ? cashAccount : channel === "bank" ? bankAccount : receivableAccount;
      if (!settlementAccount) {
        const label = channel === "cash" ? "حساب الصندوق/الخزينة" : channel === "bank" ? "الحساب البنكي" : "حساب ذمم العملاء";
        throw new Error(`تعذر ترحيل مرتجع المبيعات ${returnNo}: لا يوجد ${label} مضبوط في دليل الحسابات`);
      }

      // عكس قيد فاتورة المبيعات: الإيراد يُخفَّض (مدين مردودات) والدفع يُعكس (دائن الخزينة/البنك/الذمم).
      glLines.push({
        accountId: settlementAccount,
        debit: 0,
        credit: grandTotal,
        description:
          channel === "cash"
            ? `مردود نقدي للعميل — مرتجع ${returnNo}`
            : channel === "bank"
              ? `مردود بنكي للعميل — مرتجع ${returnNo}`
              : `تخفيض ذمم العميل — مرتجع ${returnNo}`,
      });

      if (discountTotal > 0 && discountAccount) {
        glLines.push({
          accountId: discountAccount,
          debit: 0,
          credit: discountTotal,
          description: `عكس خصم المبيعات — مرتجع ${returnNo}`,
        });
      }

      const revenueDebit = Number(
        Math.max(0, itemsTotal + expenses + (taxAccount ? 0 : taxTotal) - (discountAccount ? 0 : discountTotal)).toFixed(2)
      );
      if (revenueDebit > 0) {
        glLines.push({
          accountId: returnsAccount,
          debit: revenueDebit,
          credit: 0,
          description: `مردودات مبيعات — مرتجع ${returnNo} — ${customerName}`,
        });
      }

      if (taxTotal > 0 && taxAccount) {
        glLines.push({
          accountId: taxAccount,
          debit: Number(taxTotal.toFixed(2)),
          credit: 0,
          description: `ضريبة مستردة — مرتجع ${returnNo}`,
        });
      }
    }

    // إعادة البضاعة للمخزن: يعود أصل المخزون ويُعكس مصروف تكلفة المبيعات.
    if (totalCost > 0) {
      if (!cogsAccount || !inventoryAccount) {
        throw new Error("إعدادات حساب تكلفة المبيعات أو المخزون غير مكتملة؛ لم يتم ترحيل قيد المرتجع");
      }
      glLines.push({
        accountId: inventoryAccount,
        debit: totalCost,
        credit: 0,
        description: `إرجاع بضاعة للمخزن — مرتجع ${returnNo}`,
      });
      glLines.push({
        accountId: cogsAccount,
        debit: 0,
        credit: totalCost,
        description: `تخفيض تكلفة البضاعة المباعة — مرتجع ${returnNo}`,
      });
    }

    const result = await financialIntegrationService.processFinancialTransaction({
      sourceType: "SALES_RETURN",
      sourceId: Number(ret.id),
      sourceDocumentNumber: returnNo,
      // قيود المرتجعات تُقرأ في شاشة اليومية وفي تقارير الحسابات بالمعرّف
      // 'sales_return'، لذا يُسجّل القيد بهذا النوع مع بقاء نوع المصدر الموحّد
      // SALES_RETURN في الحركة المالية المركزية.
      journalSourceType: "sales_return",
      eventType: "RETURN_POSTED",
      totalAmount: grandTotal,
      paymentMethod: channel,
      paymentSplits: grandTotal > 0 ? [{ method: channel, amount: grandTotal }] : [],
      customerId,
      branchId,
      description: `مرتجع مبيعات #${returnNo} — ${customerName}`,
      notes: ret.reason || "",
      date: ret.date,
      idempotencyKey: `SALES_RETURN_${ret.id}_RETURN_POSTED`,
      metadata: {
        returnNo,
        voucherNumber: returnNo,
        invoiceId: Number(ret.invoice_id) || null,
        invoiceNo: ret.invoice_no || null,
        itemsTotal,
        taxTotal,
        discountTotal,
        expenses,
        totalCost,
      },
      glLines,
      transactionClient: client,
    });

    if (!result.success) {
      throw new Error(result.message || `فشل ترحيل القيد المالي لمرتجع المبيعات ${returnNo}`);
    }

    const journalEntryId = result.journalEntryId ? Number(result.journalEntryId) : null;
    if (grandTotal > 0 || totalCost > 0) {
      if (!journalEntryId) {
        throw new Error(`لم يُنشأ قيد يومية لمرتجع المبيعات ${returnNo}`);
      }
    }
    if (grandTotal > 0 && channel === "cash" && !result.treasuryTransactionId) {
      throw new Error(`لم تُسجّل حركة الاسترداد النقدي في الخزينة لمرتجع المبيعات ${returnNo}`);
    }
    if (grandTotal > 0 && channel === "bank" && !result.bankTransactionId) {
      throw new Error(`لم تُسجّل حركة الاسترداد البنكي لمرتجع المبيعات ${returnNo}`);
    }
    if (grandTotal > 0 && channel === "credit" && !result.customerTransactionId) {
      throw new Error(`لم يُسجّل تخفيض رصيد العميل لمرتجع المبيعات ${returnNo}`);
    }

    return {
      journalEntryId,
      treasuryTransactionId: result.treasuryTransactionId ? Number(result.treasuryTransactionId) : null,
      transactionId: result.transactionId ? Number(result.transactionId) : null,
      finNumber: result.finNumber || null,
    };
  }

  async updateReturn(id: number, dto: UpdateReturnDTO): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Return not found");
      err.statusCode = 404;
      throw err;
    }

    if (found.status === "تم التأكيد والمحاسبة") {
      const err: any = new Error("Cannot edit a return that has already been confirmed and posted");
      err.statusCode = 409;
      throw err;
    }

    const wasCommitted = this.isCommittedStatus(found.status);
    const willCommit = this.isCommittedStatus(dto.status || found.status);
    if (wasCommitted && !willCommit) {
      const err: any = new Error("لا يمكن إرجاع مرتجع معتمد إلى مسودة بعد ترحيل مخزونه وقيده المحاسبي");
      err.statusCode = 409;
      throw err;
    }

    await this.repository.ensureTablesExist();
    const integrationWarnings: string[] = [];
    let returnDoc: any;
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");
      returnDoc = await this.repository.update(id, dto, client);

      if (!wasCommitted && willCommit) {
        await this.postReturnEffects(id, client);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    ERPCache.delete(LIST_CACHE_KEY);
    ERPCache.delete("sales:invoices:all");
    returnDoc = await this.repository.getById(id);

    ERPEventBus.getInstance().emitEvent("SalesReturnUpdated", {
      returnId: id,
      timestamp: new Date()
    });

    return { ...returnDoc, integrationWarnings };
  }

  async deleteReturn(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Return not found");
      err.statusCode = 404;
      throw err;
    }

    if (found.status === "تم التأكيد والمحاسبة") {
      const err: any = new Error("Cannot delete a return that has already been confirmed and posted");
      err.statusCode = 409;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesReturnDeleted", {
      returnId: id,
      timestamp: new Date()
    });
  }
}
