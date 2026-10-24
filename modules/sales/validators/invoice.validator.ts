import { CreateInvoiceDTO } from "../dto/invoice.dto.js";

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidDate(v: any): boolean {
  if (!isNonEmptyString(v)) return false;
  return !isNaN(new Date(v).getTime());
}

function validateItem(item: any, index: number): string | null {
  if (!item || typeof item !== "object") {
    return `Item #${index + 1} is invalid`;
  }
  item.name = item.name || item.itemName || item.productName;
  if (!isNonEmptyString(item.name)) {
    return `Item #${index + 1} must have a name`;
  }
  item.qty = item.qty !== undefined ? Number(item.qty) : (item.quantity !== undefined ? Number(item.quantity) : 1);
  if (typeof item.qty !== "number" || item.qty <= 0) {
    return `Item #${index + 1} must have a positive qty`;
  }
  item.price = item.price !== undefined ? Number(item.price) : (item.unitPrice !== undefined ? Number(item.unitPrice) : 0);
  if (typeof item.price !== "number" || item.price < 0) {
    return `Item #${index + 1} must have a non-negative price`;
  }
  item.total = item.total !== undefined ? Number(item.total) : (item.subtotal !== undefined ? Number(item.subtotal) : (item.qty * item.price));
  if (typeof item.total !== "number" || item.total < 0) {
    return `Item #${index + 1} must have a non-negative total`;
  }
  if (item.discountPercent !== undefined) {
    item.discountPercent = Number(item.discountPercent);
    if (typeof item.discountPercent !== "number" || item.discountPercent < 0 || item.discountPercent > 100) {
      return `Item #${index + 1} discountPercent must be between 0 and 100`;
    }
  }
  if (item.vatPercent !== undefined) {
    item.vatPercent = Number(item.vatPercent);
    if (typeof item.vatPercent !== "number" || item.vatPercent < 0) {
      return `Item #${index + 1} vatPercent must be a non-negative number`;
    }
  }
  if (item.ingredientId !== undefined && typeof item.ingredientId !== "number") {
    item.ingredientId = Number(item.ingredientId);
  }
  if (item.itemId !== undefined && typeof item.itemId !== "number") {
    item.itemId = Number(item.itemId);
  }
  if (item.productId !== undefined && typeof item.productId !== "number") {
    item.productId = Number(item.productId);
  }
  if (item.unitCost !== undefined) {
    item.unitCost = Number(item.unitCost);
  }
  if (item.totalCost !== undefined) {
    item.totalCost = Number(item.totalCost);
  }
  return null;
}

export function validateInvoice(data: any): { error?: string; value?: CreateInvoiceDTO } {
  if (!data || typeof data !== "object") {
    return { error: "Request body is required" };
  }
  if (!isNonEmptyString(data.customerName)) {
    return { error: "customerName is required" };
  }
  if (data.customerId === null || data.customerId === "") {
    data.customerId = undefined;
  } else if (data.customerId !== undefined) {
    data.customerId = Number(data.customerId);
    if (!Number.isInteger(data.customerId) || data.customerId <= 0) {
      return { error: "customerId must be a positive integer" };
    }
  }
  if (data.warehouseId !== undefined) {
    data.warehouseId = Number(data.warehouseId);
  }
  data.date = data.date || data.invoiceDate || new Date().toISOString().split("T")[0];
  if (!isValidDate(data.date)) {
    return { error: "A valid date is required" };
  }
  if (data.dueDate) {
    data.dueDate = String(data.dueDate);
    if (!isValidDate(data.dueDate)) {
      return { error: "dueDate is not a valid date" };
    }
  }
  if (data.paidAmount !== undefined) {
    data.paidAmount = Number(data.paidAmount);
    if (typeof data.paidAmount !== "number" || data.paidAmount < 0) {
      return { error: "paidAmount must be a non-negative number" };
    }
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Invoice must contain at least one item" };
  }
  for (let i = 0; i < data.items.length; i++) {
    const itemError = validateItem(data.items[i], i);
    if (itemError) return { error: itemError };
  }

  return { value: data as CreateInvoiceDTO };
}

export function validateInvoicePayment(data: any): { error?: string; value?: { amount: number; method?: string; notes?: string; safeId?: number } } {
  if (!data || typeof data !== "object") {
    return { error: "Request body is required" };
  }
  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    return { error: "amount must be a positive number" };
  }
  const method = data.method || data.paymentMethod || "نقد";
  const notes = data.notes;
  const safeId = data.safeId || data.treasuryId;
  return { value: { amount, method, notes, safeId: safeId ? Number(safeId) : undefined } };
}
