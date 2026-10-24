import { SalesOrderRepository } from "../repositories/sales_order.repository.js";
import { CreateSalesOrderDTO, UpdateSalesOrderDTO } from "../dto/sales_order.dto.js";
import { ERPCache, ERPEventBus, erpPool } from "../../../server-erp-core.js";
import { DeliveryService } from "./delivery.service.js";
import { DeliveryRepository } from "../repositories/delivery.repository.js";
import { InvoiceService } from "./invoice.service.js";
import { SalesAuditService } from "./audit.service.js";
import { isCreditPaymentMethod } from "../utils/payment-method.js";
import { assertPeriodOpen } from "../../accounts/services/period-lock.service.js";

const LIST_CACHE_KEY = "sales:orders:all";

export class SalesOrderService {
  private repository: SalesOrderRepository;
  private deliveryService: DeliveryService;
  private deliveryRepository: DeliveryRepository;
  private invoiceService: InvoiceService;

  constructor() {
    this.repository = new SalesOrderRepository();
    this.deliveryService = new DeliveryService();
    this.deliveryRepository = new DeliveryRepository();
    this.invoiceService = new InvoiceService();
  }

  async getSalesOrders(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const orders = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, orders, 60);
    return orders;
  }

  async createSalesOrder(dto: CreateSalesOrderDTO): Promise<any> {
    const order = await this.repository.create(dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesOrderCreated", {
      orderId: order.id,
      orderNo: order.order_no || order.orderNo,
      customerName: order.customer_name || order.customerName,
      totalAmount: order.total_amount || order.totalAmount,
      warehouse: order.warehouse,
      timestamp: new Date()
    });

    await SalesAuditService.log({
      entityType: 'sales_order',
      entityId: order.id,
      entityNumber: order.orderNo || order.order_no,
      action: 'إنشاء أمر بيع',
      newStatus: order.status || 'مفتوح',
      userName: (dto as any).userName || (dto as any).salesRep || 'المبيعات',
      details: {
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        quotationId: dto.quotationId,
        itemsCount: order.items?.length || 0
      }
    });

    // If order was created with status 'مؤكد', prepare draft delivery note (NEVER auto-deduct stock here)
    if (dto.status === "مؤكد" || dto.status === "جاهز للتسليم") {
      try {
        await this.confirmAndDeliverOrder(order.id, {
          autoDispatch: false, // Strict ERP Rule: NO stock deduction on order creation
          salesRep: dto.salesRep
        });
      } catch (e: any) {
        console.warn("[SalesOrderService] Auto draft delivery note creation:", e.message);
      }
    }

    return this.repository.getById(order.id);
  }

  async updateSalesOrder(id: number, dto: UpdateSalesOrderDTO): Promise<any> {
    let found = await this.repository.getById(id);
    if (!found && dto.orderNo) {
      found = await this.repository.getByOrderNo(dto.orderNo);
      if (found) {
        id = found.id;
      }
    }

    if (!found) {
      // Fallback: If not found, create as new order gracefully
      return this.createSalesOrder(dto as CreateSalesOrderDTO);
    }

    if (found.status === "ملغي") {
      const err: any = new Error("لا يمكن تعديل أمر بيع ملغي");
      err.statusCode = 409;
      throw err;
    }

    const previousStatus = found.status;
    const order = await this.repository.update(id, dto);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesOrderUpdated", {
      orderId: id,
      timestamp: new Date()
    });

    await SalesAuditService.log({
      entityType: 'sales_order',
      entityId: id,
      entityNumber: found.orderNo,
      action: 'تعديل أمر بيع',
      oldStatus: previousStatus,
      newStatus: dto.status || previousStatus,
      userName: (dto as any).userName || dto.salesRep || found.salesRep || 'المبيعات',
      details: {
        previousStatus,
        newStatus: dto.status,
        customerName: order.customerName
      }
    });

    // If status transitioned to 'مؤكد', prepare draft delivery note (NEVER deduct stock)
    if ((dto.status === "مؤكد" || dto.status === "جاهز للتسليم") && previousStatus !== dto.status) {
      try {
        await this.confirmAndDeliverOrder(id, {
          autoDispatch: false, // Strict ERP Rule: Stock deduction happens only on Delivery Note confirmation
          salesRep: dto.salesRep || found.salesRep
        });
      } catch (e: any) {
        console.warn("[SalesOrderService] Auto delivery on status update note:", e.message);
      }
    }

    return this.repository.getById(id);
  }

  /**
   * Confirms a Sales Order and generates a linked Delivery Note.
   * NOTE: Stock deduction does NOT occur here unless autoDispatch is explicitly true!
   * Normal ERP flow: Order Confirmed -> Draft Delivery Note -> Warehouse Manager confirms & dispatches.
   */
  async confirmAndDeliverOrder(id: number, options?: {
    autoDispatch?: boolean;
    warehouseId?: number;
    warehouse?: string;
    driver?: string;
    carNumber?: string;
    salesRep?: string;
    notes?: string;
    postedBy?: string;
  }): Promise<{
    success: boolean;
    order: any;
    delivery: any;
    invoice?: any;
    integrationWarnings: string[];
    message: string;
  }> {
    const order = await this.repository.getById(id);
    if (!order) {
      const err: any = new Error("أمر البيع غير موجود");
      err.statusCode = 404;
      throw err;
    }

    // 1. Resolve the warehouse the user selected on the order.
    //    The numeric id sent by the UI is authoritative; the name is only a fallback
    //    for legacy orders that were saved with a warehouse name but no id.
    const requestedWarehouseId = Number(options?.warehouseId) || Number(order.warehouseId) || 0;
    const whName = options?.warehouse || order.warehouse || "";
    let warehouseId = 0;

    if (requestedWarehouseId > 0) {
      const byId = await erpPool.query("SELECT id FROM warehouses WHERE id = $1 LIMIT 1", [requestedWarehouseId]);
      if (byId.rows[0]) warehouseId = Number(byId.rows[0].id);
    }
    if (!warehouseId && whName) {
      const byName = await erpPool.query(
        "SELECT id FROM warehouses WHERE TRIM(name) ILIKE TRIM($1) OR code = $1 OR id::text = $1 ORDER BY id LIMIT 1",
        [String(whName)]
      );
      if (byName.rows[0]) warehouseId = Number(byName.rows[0].id);
    }
    if (!warehouseId) {
      const err: any = new Error("المخزن المحدد لأمر البيع غير موجود — اختر المخزن مرة أخرى قبل الترحيل");
      err.statusCode = 400;
      throw err;
    }
    const warehouseRow = await erpPool.query("SELECT id, name FROM warehouses WHERE id = $1 LIMIT 1", [warehouseId]);
    const warehouseName = warehouseRow.rows[0]?.name || whName || `مخزن ${warehouseId}`;

    // 2. Check if an active delivery note already exists for this order
    const existingDeliveries = await erpPool.query(
      "SELECT id, is_posted, status FROM sales_delivery_notes WHERE order_id = $1 OR order_no = $2 ORDER BY id DESC LIMIT 1",
      [order.id, order.orderNo]
    );

    let deliveryNoteId: number;

    if (existingDeliveries.rows.length > 0) {
      deliveryNoteId = existingDeliveries.rows[0].id;
      // The note may have been drafted earlier against a different warehouse. When the
      // user picks another warehouse and re-confirms, the draft note must follow the
      // order instead of silently dispatching from the old warehouse.
      if (!existingDeliveries.rows[0].is_posted) {
        await erpPool.query(
          `UPDATE sales_delivery_notes
              SET warehouse = $1, warehouse_id = $2
            WHERE id = $3 AND COALESCE(is_posted, false) = false`,
          [warehouseName, warehouseId, deliveryNoteId]
        );
      }
    } else {
      // Calculate remaining quantity to deliver
      const items = (order.items || []).map((it: any) => {
        const reqQty = Number(it.qtyRequired || it.qty || 0);
        const delQty = Number(it.qtyDelivered || 0);
        const remQty = Math.max(0, reqQty - delQty);
        return {
          ingredientId: it.ingredientId || null,
          productId: it.productId || null,
          itemCode: it.itemCode || "ITEM",
          itemName: it.itemName,
          unit: it.unit || "قطعة",
          qtyRequired: reqQty,
          qtyDelivered: remQty > 0 ? remQty : reqQty, // quantity proposed for this delivery note
          price: Number(it.price) || 0,
          unitCost: Number(it.unitCost) || 0,
          discountPercent: Number(it.discountPercent) || 0,
          total: Number(it.total) || 0
        };
      });

      const deliveryData = await this.deliveryRepository.create({
        orderId: order.id,
        orderNo: order.orderNo,
        customerName: order.customerName,
        customerId: order.customerId || null,
        // تاريخ المستند هو تاريخ أمر البيع، لا تاريخ اليوم: الترحيل يتبع فترة المستند.
        date: order.date || new Date().toISOString().split("T")[0],
        driver: options?.driver || order.driver || "سائق التوصيل",
        carNumber: options?.carNumber || order.carNumber || "سيارة 1",
        salesRep: options?.salesRep || order.salesRep || "المبيعات",
        transportation: "نقل داخلي",
        deliveryMethod: "تسليم بواسطة الشركة",
        warehouse: warehouseName,
        warehouseId,
        notes: options?.notes || `تم الترحيل آلياً من أمر البيع #${order.orderNo}`,
        status: "مسودة",
        items
      });

      deliveryNoteId = deliveryData.id;
    }

    // 3. Only dispatch if explicitly requested
    const shouldDispatch = options?.autoDispatch === true;
    let finalDelivery: any;
    let finalInvoice: any = null;
    const integrationWarnings: string[] = [];

    if (shouldDispatch) {
      // العملية كلها (صرف المخزون + الفاتورة + القيد) داخل معاملة واحدة:
      // إذا رُفضت الفترة أو فشل القيد، يُردّ خصم المخزون ولا يُعتمد أمر البيع.
      const tx = await erpPool.connect();
      try {
        await tx.query("BEGIN");
        await assertPeriodOpen(tx, order.date || new Date(), "اعتماد وصرف أمر بيع");

        finalDelivery = await this.deliveryService.confirmAndDispatchDelivery(
          deliveryNoteId,
          options?.postedBy || options?.salesRep || order.salesRep || "sales_module",
          { deferCogsEntry: true, client: tx }
        );

        // Check if invoice already exists
        const existingInvoices = await tx.query(
          "SELECT id FROM sales_invoices WHERE order_id = $1 LIMIT 1",
          [order.id]
        );

        const isCredit = isCreditPaymentMethod(order.paymentMethod);

        let defaultVatRate = 0;
        try {
          const setRes = await tx.query(
            "SELECT value FROM settings WHERE key = 'sales_settings_config' LIMIT 1"
          );
          if (setRes.rows.length > 0 && setRes.rows[0].value) {
            const parsed = typeof setRes.rows[0].value === "string"
              ? JSON.parse(setRes.rows[0].value)
              : setRes.rows[0].value;
            if (parsed && parsed.defaultVatRate !== undefined && parsed.defaultVatRate !== null) {
              defaultVatRate = Number(parsed.defaultVatRate) || 0;
            }
          }
        } catch (_) {}

        const invoiceItems = (order.items || []).map((it: any) => {
          const deliveredItems = Array.isArray(finalDelivery?.items) ? finalDelivery.items : [];
          const deliveredItem = deliveredItems.find((item: any) =>
            (it.ingredientId && Number(item.ingredientId) === Number(it.ingredientId)) ||
            (it.productId && Number(item.productId) === Number(it.productId)) ||
            (it.itemCode && item.itemCode === it.itemCode)
          );
          const qty = Number(it.qtyRequired || it.qty || 1);
          const price = Number(it.price || 0);
          const discountPercent = Number(it.discountPercent || 0);
          const vatPercent = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : defaultVatRate;
          const taxable = Math.max(0, qty * price * (1 - discountPercent / 100));
          const itemTax = (taxable * vatPercent) / 100;
          const total = taxable + itemTax;

          return {
            itemId: it.productId || it.ingredientId,
            ingredientId: it.ingredientId || deliveredItem?.ingredientId || null,
            productId: it.productId || deliveredItem?.productId || null,
            itemCode: it.itemCode || "ITEM",
            itemName: it.itemName,
            name: it.itemName,
            code: it.itemCode || "ITEM",
            unit: it.unit || "قطعة",
            qty,
            price,
            unitCost: Number(deliveredItem?.unitCost ?? it.unitCost) || 0,
            discountPercent,
            vatPercent,
            total
          };
        });

        const computedInvoiceNet = invoiceItems.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
        const totalAmount = computedInvoiceNet > 0 ? computedInvoiceNet : Number(order.totalAmount || 0);
        const paidAmount = isCredit ? 0 : totalAmount;

        if (existingInvoices.rows.length === 0) {
          // لا نبتلع فشل الفاتورة/القيد: الاستثناء يُلغي المعاملة كلها
          finalInvoice = await this.invoiceService.createInvoice({
            orderId: order.id,
            orderNo: order.orderNo,
            deliveryNoteId,
            deliveryNoteNo: finalDelivery.deliveryNo,
            customerId: order.customerId || null,
            customerName: order.customerName,
            // تاريخ المستند = تاريخ أمر البيع، لا تاريخ اليوم
            date: order.date || new Date().toISOString().split("T")[0],
            paymentMethod: order.paymentMethod || "نقدي",
            branchId: order.branchId || 1,
            warehouseId,
            warehouse: warehouseName,
            salesRep: options?.salesRep || order.salesRep || "المبيعات",
            notes: `فاتورة مبيعات مرحلة آلياً من أمر البيع #${order.orderNo}`,
            status: paidAmount >= totalAmount ? "مدفوعة" : "معتمدة",
            isPosted: true,
            stockAlreadyDeducted: true,
            paidAmount,
            items: invoiceItems
          }, tx);
        } else {
          finalInvoice = await this.invoiceService.ensureFinancialPosting(Number(existingInvoices.rows[0].id));
        }

        await tx.query(`
          UPDATE erp_sales_orders
          SET delivered_qty = total_qty,
              remaining_qty = 0,
              status = 'مكتمل',
              delivery_status = 'تم التسليم',
              invoice_status = 'مفوتر',
              payment_status = $1,
              warehouse = $3,
              warehouse_id = $4
          WHERE id = $2
        `, [paidAmount >= totalAmount ? 'مسدد' : 'غير مسدد', order.id, warehouseName, warehouseId]);

        await tx.query("COMMIT");
        integrationWarnings.push(...(finalInvoice?.integrationWarnings || []));
      } catch (dispatchError: any) {
        try { await tx.query("ROLLBACK"); } catch { /* المعاملة منتهية */ }
        throw dispatchError;
      } finally {
        tx.release();
      }
    } else {
      // Mark order as 'مؤكد' without stock movement
      await erpPool.query(`
        UPDATE erp_sales_orders
        SET status = 'مؤكد',
            delivery_status = COALESCE(delivery_status, 'قيد التجهيز')
        WHERE id = $1
      `, [order.id]);
      finalDelivery = await this.deliveryRepository.getById(deliveryNoteId);
    }

    ERPCache.delete(LIST_CACHE_KEY);
    ERPCache.delete("sales:deliveries:all");
    ERPCache.delete("sales:invoices:all");

    await SalesAuditService.log({
      entityType: 'sales_order',
      entityId: order.id,
      entityNumber: order.orderNo,
      action: shouldDispatch ? 'اعتماد وصرف أمر بيع وترحيل الحسابات' : 'تأكيد أمر البيع وإصدار إذن تسليم مسودة',
      newStatus: shouldDispatch ? 'مكتمل' : 'مؤكد',
      userName: options?.postedBy || options?.salesRep || order.salesRep || 'المبيعات',
      details: {
        deliveryNoteId,
        deliveryNo: finalDelivery?.deliveryNo,
        invoiceNo: finalInvoice?.invoiceNo,
        shouldDispatch
      }
    });

    const updatedOrder = await this.repository.getById(order.id);

    return {
      success: true,
      order: updatedOrder,
      delivery: finalDelivery,
      invoice: finalInvoice,
      integrationWarnings,
      message: shouldDispatch
        ? integrationWarnings.length > 0
          ? `تم اعتماد وصرف أمر البيع #${order.orderNo}، لكن توجد مشكلة في ترحيل القيد المالي: ${integrationWarnings.join("؛ ")}`
          : `تم اعتماد وصرف أمر البيع #${order.orderNo} بنجاح: خصم المخزون، إصدار إذن التسليم، وترحيل القيد المحاسبي!`
        : `تم تأكيد أمر البيع #${order.orderNo} وإنشاء إذن التسليم بنجاح (المخزون لم يخصم - الصرف يتم عند اعتماد إذن التسليم).`
    };
  }

  async deleteSalesOrder(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("Sales order not found");
      err.statusCode = 404;
      throw err;
    }

    if (found.deliveredQty && found.deliveredQty > 0) {
      const err: any = new Error("لا يمكن حذف أمر بيع تم تسليم كميات منه بالفعل");
      err.statusCode = 409;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    ERPEventBus.getInstance().emitEvent("SalesOrderDeleted", {
      orderId: id,
      timestamp: new Date()
    });

    await SalesAuditService.log({
      entityType: 'sales_order',
      entityId: id,
      entityNumber: found.orderNo,
      action: 'حذف أمر بيع',
      oldStatus: found.status,
      newStatus: 'محذوف',
      userName: 'المبيعات'
    });
  }
}
