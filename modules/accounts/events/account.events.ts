/**
 * Account Events — Central ERP Event Hub
 * Listens to ALL module events and triggers automatic GL journal entries.
 * This is the critical integration layer that connects every module to the General Ledger.
 */
import { ERPEventBus } from "../../../server-erp-core.js";
import {
  postSalesEntry,
  postPurchaseEntry,
  postPayrollEntry,
  postTreasuryEntry,
  postRestaurantOrderEntry,
  postCustomerPaymentEntry,
  postCostEntry,
  postReturnEntry,
  postComplaintRefundEntry,
  postInventoryAdjustmentEntry,
  postEmployeeAdvanceEntry,
  postSupplierPaymentEntry,
  postProductionEntry,
  postPurchaseReturnEntry,
  postWastageEntry,
  postWarehouseTransferEntry,
} from "../services/auto-posting.service.js";

export function initAccountEvents() {
  const eventBus = ERPEventBus.getInstance();

  // ═══════════════════════════════════════
  // SALES MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("OrderCreated", async (data: any) => {
    console.log(`[GL AutoPost] Restaurant Order #${data.orderId} — posting to GL...`);
    try {
      const result = await postRestaurantOrderEntry({
        id: data.orderId,
        total: data.total || 0,
        delivery_fee: data.deliveryFee || 0,
        payment_method: data.paymentMethod || 'cash',
        order_type: data.orderType || 'dine_in',
        branch_id: data.branchId,
        customer_name: data.customerName,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Restaurant Order #${data.orderId} posted — Journal Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'restaurant', sourceId: data.orderId, entryId: result.id });
      } else {
        console.log(`[GL AutoPost] ⚠️ Restaurant Order #${data.orderId} — skipped (config incomplete)`);
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Restaurant Order #${data.orderId} error:`, e.message);
    }
  });

  eventBus.on("OrderStatusUpdated", async (data: any) => {
    // Post to GL only when order is completed/paid
    if (data.status === 'completed' || data.status === 'delivered' || data.isPaid) {
      console.log(`[GL AutoPost] Order #${data.orderId} completed — posting to GL...`);
      try {
        const result = await postRestaurantOrderEntry({
          id: data.orderId,
          total: data.total || 0,
          delivery_fee: data.deliveryFee || 0,
          payment_method: data.paymentMethod || 'cash',
          order_type: data.orderType || 'dine_in',
          branch_id: data.branchId,
          customer_name: data.customerName,
        });
        if (result) {
          console.log(`[GL AutoPost] ✅ Order #${data.orderId} completion posted — Entry #${result.id}`);
        }
      } catch (e: any) {
        console.error(`[GL AutoPost] ❌ Order #${data.orderId} completion error:`, e.message);
      }
    }
  });

  eventBus.on("SalesInvoiceCreated", async (data: any) => {
    if (!data.isPosted || data.financiallyIntegrated) return;
    console.log(`[GL AutoPost] Sales Invoice #${data.invoiceId} — posting to GL...`);
    try {
      const invoice = data.invoice || data;
      const result = await postSalesEntry({
        id: invoice.id || data.invoiceId,
        total: invoice.total_amount || invoice.total || 0,
        discount: invoice.discount_amount || 0,
        tax_amount: invoice.tax_amount || 0,
        net_total: invoice.net_amount || invoice.total || 0,
        payment_method: invoice.payment_method || 'cash',
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        branch_id: invoice.branch_id,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Sales Invoice #${data.invoiceId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'sales', sourceId: data.invoiceId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Sales Invoice #${data.invoiceId} error:`, e.message);
    }
  });

  eventBus.on("SalesInvoicePaymentRecorded", async (data: any) => {
    console.log(`[GL AutoPost] Sales Invoice Payment for #${data.invoiceId} — posting to GL...`);
    try {
      const result = await postCustomerPaymentEntry({
        customer_id: data.customerId || 0,
        customer_name: data.customerName || `عميل فاتورة #${data.invoiceId}`,
        amount: data.amount || 0,
        type: 'payment',
        branch_id: data.branchId,
        source_id: data.paymentId || data.invoiceId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Invoice Payment #${data.invoiceId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'sales_payment', sourceId: data.invoiceId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Invoice Payment error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // PURCHASES & SUPPLIERS MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("PurchaseCreated", async (data: any) => {
    console.log(`[GL AutoPost] Purchase #${data.purchaseId} — posting to GL...`);
    try {
      const result = await postPurchaseEntry({
        id: data.purchaseId,
        total: data.totalAmount || 0,
        subtotal: data.subtotal || 0,
        tax_amount: data.taxAmount || 0,
        supplier_id: data.supplierId,
        supplier_name: data.supplierName,
        branch_id: data.branchId,
        cost_center_id: data.costCenterId,
        payment_method: data.paymentMethod,
        paid_amount: data.paidAmount,
        receipt_id: data.receiptId,
        purchase_order_id: data.purchaseOrderId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Purchase #${data.purchaseId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'purchase', sourceId: data.purchaseId, entryId: result.id });
      } else {
        console.log(`[GL AutoPost] ⚠️ Purchase #${data.purchaseId} — skipped (config incomplete or zero amount)`);
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Purchase #${data.purchaseId} error:`, e.message);
    }
  });

  eventBus.on("SupplierPaymentRecorded", async (data: any) => {
    console.log(`[GL AutoPost] Supplier Payment to #${data.supplierId} — posting to GL...`);
    try {
      const result = await postSupplierPaymentEntry({
        supplier_id: data.supplierId,
        supplier_name: data.supplierName,
        amount: data.amount,
        payment_method: data.paymentMethod,
        branch_id: data.branchId,
        transaction_id: data.transactionId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Supplier Payment to #${data.supplierId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'supplier_payment', sourceId: data.supplierId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Supplier Payment error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // PAYROLL MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("PayrollCalculated", async (data: any) => {
    console.log(`[GL AutoPost] Payroll for ${data.month} — posting to GL...`);
    try {
      // Aggregate payroll data from the database
      const { pool } = await import("../../../server-db.js");
      const [year, month] = String(data.month).split('-').map(Number);
      const aggResult = await pool.query(`
        SELECT 
          COALESCE(SUM(basic_salary), 0) as total_salaries,
          COALESCE(SUM(bonuses), 0) as total_bonuses,
          COALESCE(SUM(deductions), 0) as total_deductions,
          COALESCE(SUM(net_salary), 0) as total_net,
          COUNT(*) as employee_count
        FROM payroll_records 
        WHERE EXTRACT(MONTH FROM created_at) = $1 AND EXTRACT(YEAR FROM created_at) = $2
      `, [month || 1, year || new Date().getFullYear()]);

      const agg = aggResult.rows[0];
      if (agg && parseFloat(agg.total_salaries) > 0) {
        const result = await postPayrollEntry({
          id: 0, // Aggregated entry, no single source
          month: month || 1,
          year: year || new Date().getFullYear(),
          total_salaries: parseFloat(agg.total_salaries) + parseFloat(agg.total_bonuses),
          total_deductions: parseFloat(agg.total_deductions),
          total_net: parseFloat(agg.total_net),
          total_bonuses: parseFloat(agg.total_bonuses),
          branch_id: data.branchId,
        });
        if (result) {
          console.log(`[GL AutoPost] ✅ Payroll ${data.month} posted — Entry #${result.id} (${agg.employee_count} employees)`);
          eventBus.emitEvent("GLPosted", { source: 'payroll', sourceId: 0, entryId: result.id });
        }
      } else {
        console.log(`[GL AutoPost] ⚠️ Payroll ${data.month} — no records found to post`);
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Payroll ${data.month} error:`, e.message);
    }
  });

  eventBus.on("EmployeeAdvanceCreated", async (data: any) => {
    console.log(`[GL AutoPost] Employee Advance for #${data.employeeId} — posting to GL...`);
    try {
      const result = await postEmployeeAdvanceEntry({
        id: data.advanceId || 0,
        employee_id: data.employeeId,
        employee_name: data.employeeName,
        amount: data.amount || 0,
        branch_id: data.branchId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Employee Advance #${data.employeeId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'employee_advance', sourceId: data.employeeId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Employee Advance error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // CUSTOMER MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("CustomerTransactionRecorded", async (data: any) => {
    console.log(`[GL AutoPost] Customer #${data.customerId} ${data.type} — posting to GL...`);
    try {
      const result = await postCustomerPaymentEntry({
        customer_id: data.customerId,
        customer_name: data.customerName || `عميل #${data.customerId}`,
        amount: data.amount || 0,
        type: data.type, // 'payment' or 'charge'
        branch_id: data.branchId,
        source_id: data.transactionId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Customer Transaction #${data.customerId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'customer_payment', sourceId: data.customerId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Customer Transaction error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // COSTS MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("CostRecorded", async (data: any) => {
    if (data.approval_status !== 'Approved' || data.link_ledger !== true) return;
    console.log(`[GL AutoPost] Cost ${data.category} — posting to GL...`);
    try {
      const result = await postCostEntry({
        id: data.costId || data.id || 0,
        category: data.category || 'other',
        amount: data.amount || 0,
        branch_id: data.branchId || data.branch_id,
        notes: data.notes,
        date: data.date,
        cost_center_id: data.costCenterId || data.cost_center_id,
        payment_method: data.paymentMethod || data.payment_method,
        cost_item_id: data.costItemId || data.cost_item_id,
        safe: data.safe,
        accounting_account: data.accountingAccount || data.accounting_account,
        created_by: data.createdBy || data.created_by
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Cost posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'cost', sourceId: data.costId || data.id, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Cost posting error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // WAREHOUSE/INVENTORY MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("InventoryAdjusted", async (data: any) => {
    console.log(`[GL AutoPost] Inventory Adjustment in warehouse #${data.warehouseId} — posting to GL...`);
    try {
      const result = await postInventoryAdjustmentEntry({
        id: data.adjustmentId || 0,
        warehouse_id: data.warehouseId,
        ingredient_id: data.ingredientId,
        ingredient_name: data.ingredientName,
        quantity: data.quantity || 0,
        unit_cost: data.unitCost,
        type: data.type, // 'in', 'out', 'adjustment'
        branch_id: data.branchId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Inventory Adjustment posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'inventory_adjustment', sourceId: data.adjustmentId, entryId: result.id });
      } else {
        console.log(`[GL AutoPost] ⚠️ Inventory Adjustment skipped (no unit cost or config incomplete)`);
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Inventory Adjustment error:`, e.message);
    }
  });

  eventBus.on("InventoryAdjustmentApproved", async (data: any) => {
    console.log(`[GL AutoPost] Inventory Adjustment Approval #${data.id || data.adjustmentId} — posting to GL...`);
    try {
      const result = await postInventoryAdjustmentEntry({
        id: data.id || data.adjustmentId,
        warehouse_id: data.warehouse_id || data.warehouseId,
        total_value: data.total_value,
        type: data.type,
        items: data.items,
        branch_id: data.branch_id || data.branchId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Inventory Adjustment Approval posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'inventory_adjustment', sourceId: data.id || data.adjustmentId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Inventory Adjustment Approval error:`, e.message);
    }
  });

  eventBus.on("InventoryWastageApproved", async (data: any) => {
    console.log(`[GL AutoPost] Inventory Wastage Approval #${data.id || data.wastageId} — posting to GL...`);
    try {
      const result = await postWastageEntry({
        id: data.id || data.wastageId,
        wastage_number: data.wastage_number || data.wastageNumber,
        total_cost: data.total_cost || data.totalCost || data.total_value || 0,
        warehouse_id: data.warehouse_id || data.warehouseId,
        branch_id: data.branch_id || data.branchId,
        items: data.items,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Inventory Wastage posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'inventory_wastage', sourceId: data.id || data.wastageId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Inventory Wastage error:`, e.message);
    }
  });

  eventBus.on("PurchaseReturnApproved", async (data: any) => {
    console.log(`[GL AutoPost] Purchase Return Approval #${data.id || data.returnId} — posting to GL...`);
    try {
      const result = await postPurchaseReturnEntry({
        id: data.id || data.returnId,
        return_number: data.return_number || data.returnNumber,
        total: Number(data.total_amount || data.total || 0),
        supplier_id: data.supplier_id || data.supplierId,
        supplier_name: data.supplier_name || data.supplierName,
        warehouse_id: data.warehouse_id || data.warehouseId,
        branch_id: data.branch_id || data.branchId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Purchase Return posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'purchase_return', sourceId: data.id || data.returnId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Purchase Return error:`, e.message);
    }
  });

  eventBus.on("WarehouseTransferCompleted", async (data: any) => {
    console.log(`[GL AutoPost] Warehouse Transfer Completed #${data.id || data.transferId} — posting to GL...`);
    try {
      const result = await postWarehouseTransferEntry({
        id: data.id || data.transferId,
        transfer_number: data.transfer_number || data.transferNumber,
        shipping_cost: Number(data.shipping_cost || data.shippingCost || 0),
        damage_cost: Number(data.damage_cost || data.damageCost || 0),
        from_warehouse_id: data.from_warehouse_id || data.fromWarehouseId,
        to_warehouse_id: data.to_warehouse_id || data.toWarehouseId,
        branch_id: data.branch_id || data.branchId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Warehouse Transfer posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'warehouse_transfer', sourceId: data.id || data.transferId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Warehouse Transfer error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // COMPLAINTS/REFUNDS MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("ComplaintCreated", async (data: any) => {
    // Only post if there's a financial component (refund or compensation)
    if (data.refundAmount > 0 || data.compensationAmount > 0) {
      console.log(`[GL AutoPost] Complaint #${data.complaintId} has financial impact — posting to GL...`);
      try {
        const result = await postComplaintRefundEntry({
          id: data.complaintId,
          customer_name: data.customerName || 'غير محدد',
          refund_amount: data.refundAmount || 0,
          compensation_amount: data.compensationAmount || 0,
          branch_id: data.branchId,
          resolution_text: data.resolutionText,
        });
        if (result) {
          console.log(`[GL AutoPost] ✅ Complaint Refund posted — Entry #${result.id}`);
          eventBus.emitEvent("GLPosted", { source: 'complaint_refund', sourceId: data.complaintId, entryId: result.id });
        }
      } catch (e: any) {
        console.error(`[GL AutoPost] ❌ Complaint Refund error:`, e.message);
      }
    }
  });

  eventBus.on("ComplaintResolved", async (data: any) => {
    // Post refund/compensation when complaint is resolved with financial settlement
    if (data.refundAmount > 0 || data.compensationAmount > 0) {
      console.log(`[GL AutoPost] Complaint #${data.complaintId} resolved with refund — posting to GL...`);
      try {
        const result = await postComplaintRefundEntry({
          id: data.complaintId,
          customer_name: data.customerName || 'غير محدد',
          refund_amount: data.refundAmount || 0,
          compensation_amount: data.compensationAmount || 0,
          branch_id: data.branchId,
          resolution_text: data.resolutionText,
        });
        if (result) {
          console.log(`[GL AutoPost] ✅ Complaint Resolution posted — Entry #${result.id}`);
        }
      } catch (e: any) {
        console.error(`[GL AutoPost] ❌ Complaint Resolution error:`, e.message);
      }
    }
  });

  // ═══════════════════════════════════════
  // SALES RETURNS EVENTS
  // ═══════════════════════════════════════
  eventBus.on("SalesReturnCreated", async (data: any) => {
    // المسودة/الملغى لا يُرحّل لها أي قيد: أثر المرتجع يُسجّل عند الاعتماد فقط.
    const status = String(data.status || "").trim().toLowerCase();
    if (["مسودة", "draft", "draft return", "ملغى", "ملغاة", "cancelled", "canceled"].includes(status)) {
      console.log(`[GL AutoPost] Sales Return #${data.returnId} is ${status} — skipped`);
      return;
    }
    // المرتجع يُرحَّل داخل معاملة خدمة المبيعات نفسها عبر طبقة التكامل المالي
    // (خزينة/بنك + رصيد العميل + قيد اليومية). إعادة الترحيل هنا كانت تنتج
    // قيدًا ثانيًا بمسار قديم منفصل عن حركة الخزينة، لذلك نكتفي بالتسجيل.
    if (data.journalEntryId || data.finNumber) {
      console.log(
        `[GL AutoPost] Sales Return #${data.returnId} already posted with the return transaction (entry #${data.journalEntryId || '-'}) — skipped`
      );
      return;
    }
    console.log(`[GL AutoPost] Sales Return #${data.returnId} — posting to GL...`);
    try {
      const result = await postReturnEntry({
        id: data.returnId,
        grand_total: data.grandTotal || 0,
        refund_method: data.refundMethod || 'إشعار دائن للعميل',
        customer_name: data.customerName || 'غير محدد',
        items_total: data.itemsTotal || 0,
        tax_total: data.taxTotal || 0,
        discount_total: data.discountTotal || 0,
        expenses: data.expenses || 0,
        total_cost: data.totalCost || 0,
        branch_id: data.branchId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Sales Return #${data.returnId} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'sales_return', sourceId: data.returnId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Sales Return error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // TREASURY MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("FinancialTransactionRecorded", async (data: any) => {
    console.log(`[GL AutoPost] Treasury Transaction #${data.transactionId} — posting to GL...`);
    try {
      const result = await postTreasuryEntry({
        id: data.transactionId || data.id || 0,
        amount: data.amount || 0,
        transaction_type: data.transactionType || data.type || 'cash_in',
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        notes: data.notes,
        cost_center_id: data.costCenterId,
        branch_id: data.branchId,
        created_by: data.createdBy || data.userId,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Treasury Transaction posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'treasury', sourceId: data.transactionId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Treasury Transaction error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // PRODUCTION & MANUFACTURING MODULE EVENTS
  // ═══════════════════════════════════════
  eventBus.on("ProductionOrderExecuted", async (data: any) => {
    if (data.journalEntryId || data.entryId) {
      console.log(`[GL AutoPost] ✅ Production Order #${data.orderNumber} already posted in transaction — Entry #${data.journalEntryId || data.entryId}`);
      return;
    }
    console.log(`[GL AutoPost] Production Order #${data.orderNumber} executed — posting to GL...`);
    try {
      const result = await postProductionEntry({
        orderId: data.orderId || data.id,
        orderNumber: data.orderNumber,
        productName: data.productName,
        quantity: data.quantity,
        rawWarehouseId: data.rawWarehouseId,
        finishedWarehouseId: data.finishedWarehouseId,
        totalCost: data.totalCost,
        costPerUnit: data.costPerUnit,
        deductedMaterialsCount: data.deductedMaterialsCount,
        executedBy: data.executedBy,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Production Order #${data.orderNumber} posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'production', sourceId: data.orderNumber, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Production Order #${data.orderNumber} error:`, e.message);
    }
  });

  eventBus.on("ProductionRunCompleted", async (data: any) => {
    console.log(`[GL AutoPost] Production Run for Product #${data.productId} — posting to GL...`);
    try {
      const result = await postProductionEntry({
        orderId: data.runId || data.id,
        orderNumber: data.orderNumber || `RUN-${data.productId}-${Date.now()}`,
        productName: data.productName || `منتج #${data.productId}`,
        quantity: data.producedQuantity || data.quantity || 1,
        totalCost: data.totalCost || (data.producedQuantity * (data.costPerUnit || 0)) || 0,
      });
      if (result) {
        console.log(`[GL AutoPost] ✅ Production Run posted — Entry #${result.id}`);
        eventBus.emitEvent("GLPosted", { source: 'production', sourceId: data.productId, entryId: result.id });
      }
    } catch (e: any) {
      console.error(`[GL AutoPost] ❌ Production Run error:`, e.message);
    }
  });

  // ═══════════════════════════════════════
  // GL INTERNAL EVENTS
  // ═══════════════════════════════════════
  eventBus.on("JournalEntryCreated", (data: any) => {
    console.log(`[GL] Journal Entry #${data.entryId} created — ref: ${data.ref || 'N/A'}`);
  });

  eventBus.on("PeriodClosed", (data: any) => {
    console.log(`[GL] Period ${data.month}/${data.year} closed — Net: ${data.netIncome}`);
  });

  console.log("⚡ [GL AutoPost] Event listeners registered for ALL modules (11 sources)");
}