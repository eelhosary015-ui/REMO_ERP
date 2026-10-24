import { CreateReturnDTO } from "../dto/return.dto.js";

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
  if (!isNonEmptyString(item.itemName)) {
    return `Item #${index + 1} must have an itemName`;
  }

  item.qtyReturned = Number(item.qtyReturned);
  item.qtyInvoiced = item.qtyInvoiced !== undefined ? Number(item.qtyInvoiced) : item.qtyReturned;
  item.price = item.price !== undefined ? Number(item.price) : Number(item.unitPrice || 0);
  item.discount = item.discount !== undefined ? Number(item.discount || 0) : 0;
  item.taxRate = item.taxRate !== undefined ? Number(item.taxRate || 0) : 0;
  item.total = item.total !== undefined ? Number(item.total) : item.qtyReturned * item.price;

  if (isNaN(item.qtyReturned) || item.qtyReturned <= 0) {
    return `Item #${index + 1} must have a positive qtyReturned`;
  }
  if (isNaN(item.qtyInvoiced) || item.qtyInvoiced <= 0) {
    item.qtyInvoiced = item.qtyReturned;
  }
  if (item.remainingQty !== undefined && !isNaN(Number(item.remainingQty))) {
    if (item.qtyReturned > Number(item.remainingQty) + 0.0001) {
      return `Item #${index + 1} (${item.itemName}) qtyReturned (${item.qtyReturned}) cannot exceed remaining returnable quantity (${item.remainingQty})`;
    }
  } else if (item.qtyReturned > item.qtyInvoiced + 0.0001) {
    return `Item #${index + 1} (${item.itemName}) qtyReturned cannot exceed qtyInvoiced`;
  }
  if (isNaN(item.price) || item.price < 0) {
    return `Item #${index + 1} must have a non-negative price`;
  }
  if (isNaN(item.discount) || item.discount < 0) {
    return `Item #${index + 1} discount must be a non-negative number`;
  }
  if (isNaN(item.taxRate) || item.taxRate < 0) {
    return `Item #${index + 1} taxRate must be a non-negative number`;
  }
  return null;
}

export function validateReturn(data: any): { error?: string; value?: CreateReturnDTO } {
  if (!data || typeof data !== "object") {
    return { error: "Request body is required" };
  }
  if (!isNonEmptyString(data.customerName)) {
    return { error: "customerName is required" };
  }
  if (!isValidDate(data.date)) {
    return { error: "A valid date is required" };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Return must contain at least one item" };
  }
  for (let i = 0; i < data.items.length; i++) {
    const itemError = validateItem(data.items[i], i);
    if (itemError) return { error: itemError };
  }

  return { value: data as CreateReturnDTO };
}
