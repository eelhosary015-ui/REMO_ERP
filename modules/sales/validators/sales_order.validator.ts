import { CreateSalesOrderDTO } from "../dto/sales_order.dto.js";

function isNonEmptyString(v: any): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeDate(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export function validateSalesOrder(data: any): { error?: string; value?: CreateSalesOrderDTO } {
  if (!data || typeof data !== "object") {
    return { error: "بيانات أمر البيع مطلوبة" };
  }

  // Normalize customer name
  const rawCustomer = data.customerName || data.customer_name;
  const customerName = isNonEmptyString(rawCustomer) ? rawCustomer.trim() : "عميل عام";

  // Normalize dates
  const date = normalizeDate(data.date) || new Date().toISOString().split("T")[0];
  let deliveryDate = normalizeDate(data.deliveryDate || data.delivery_date);
  if (!deliveryDate) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    deliveryDate = d.toISOString().split("T")[0];
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length === 0) {
    return { error: "يجب أن يحتوي أمر البيع على صنف واحد على الأقل" };
  }

  const normalizedItems: any[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== "object") continue;

    const itemName = (raw.itemName || raw.name || raw.item_name || `صنف ${i + 1}`).trim();
    const itemCode = (raw.itemCode || raw.code || raw.item_code || "").trim();
    const qtyRequired = Math.max(1, parseFloat(raw.qtyRequired ?? raw.qty ?? raw.quantity ?? 1) || 1);
    const price = Math.max(0, parseFloat(raw.price ?? raw.unitPrice ?? 0) || 0);
    const unitCost = Math.max(0, parseFloat(raw.unitCost ?? raw.cost ?? 0) || 0);
    const discountPercent = Math.max(0, Math.min(100, parseFloat(raw.discountPercent ?? raw.discount ?? 0) || 0));
    const vatPercent = raw.vatPercent !== undefined && raw.vatPercent !== null ? parseFloat(raw.vatPercent) : 0;
    const qtyDelivered = Math.max(0, parseFloat(raw.qtyDelivered ?? 0) || 0);
    const qtyAvailable = Math.max(0, parseFloat(raw.qtyAvailable ?? 0) || 0);
    const qtyReserved = Math.max(0, parseFloat(raw.qtyReserved ?? 0) || 0);

    const subtotal = price * qtyRequired * (1 - discountPercent / 100);
    const total = raw.total !== undefined ? parseFloat(raw.total) : subtotal * (1 + vatPercent / 100);

    normalizedItems.push({
      ingredientId: raw.ingredientId || raw.ingredient_id || null,
      productId: raw.productId || raw.product_id || null,
      itemCode,
      itemName,
      unit: raw.unit || "قطعة",
      qtyRequired,
      qtyAvailable,
      qtyReserved,
      qtyDelivered,
      price,
      unitCost,
      discountPercent,
      vatPercent,
      total: isNaN(total) ? subtotal : total
    });
  }

  if (normalizedItems.length === 0) {
    return { error: "يجب إضافة صنف واحد على الأقل في أمر البيع" };
  }

  const totalQty = normalizedItems.reduce((sum, it) => sum + it.qtyRequired, 0);
  const totalAmount = normalizedItems.reduce((sum, it) => sum + it.total, 0);

  const normalizedOrder: CreateSalesOrderDTO = {
    orderNo: data.orderNo || data.order_no,
    quotationId: data.quotationId || data.quotation_id || data.source_quotation_id,
    quotationNo: data.quotationNo || data.quotation_no || data.source_quotation_no,
    customerId: data.customerId || data.customer_id,
    customerName,
    date,
    deliveryDate,
    salesRep: data.salesRep || data.sales_rep || "",
    paymentMethod: data.paymentMethod || data.payment_method || "أجل",
    branch: data.branch || "الفرع الرئيسي",
    branchId: data.branchId || data.branch_id || 1,
    warehouse: data.warehouse || "المخزن الرئيسي",
    warehouseId: data.warehouseId || data.warehouse_id || 1,
    currency: data.currency || "جنيه مصري",
    notes: data.notes || "",
    status: data.status || "مفتوح",
    totalQty,
    totalAmount,
    deliveredQty: parseFloat(data.deliveredQty ?? 0) || 0,
    remainingQty: parseFloat(data.remainingQty ?? totalQty) || totalQty,
    items: normalizedItems
  };

  return { value: normalizedOrder };
}

