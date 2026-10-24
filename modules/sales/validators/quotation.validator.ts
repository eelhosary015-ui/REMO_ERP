import { CreateQuotationDTO, QuotationItemDTO } from "../dto/quotation.dto.js";

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
  if (!isNonEmptyString(item.name)) {
    return `Item #${index + 1} must have a name`;
  }
  if (typeof item.qty !== "number" || item.qty <= 0) {
    return `Item #${index + 1} must have a positive qty`;
  }
  if (typeof item.price !== "number" || item.price < 0) {
    return `Item #${index + 1} must have a non-negative price`;
  }
  if (item.discountPercent !== undefined) {
    if (typeof item.discountPercent !== "number" || item.discountPercent < 0 || item.discountPercent > 100) {
      return `Item #${index + 1} discountPercent must be between 0 and 100`;
    }
  }
  if (item.vatPercent !== undefined) {
    if (typeof item.vatPercent !== "number" || item.vatPercent < 0) {
      return `Item #${index + 1} vatPercent must be a non-negative number`;
    }
  }
  return null;
}

export function validateQuotation(data: any): { error?: string; value?: CreateQuotationDTO } {
  if (!data || typeof data !== "object") {
    return { error: "Request body is required" };
  }
  if (!isNonEmptyString(data.customerName)) {
    return { error: "customerName is required" };
  }
  if (!isValidDate(data.date)) {
    return { error: "A valid date is required" };
  }
  if (data.validityDate && !isValidDate(data.validityDate)) {
    return { error: "validityDate is not a valid date" };
  }
  if (data.validityDate && new Date(data.validityDate).getTime() < new Date(data.date).getTime()) {
    return { error: "validityDate cannot be earlier than date" };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Quotation must contain at least one item" };
  }
  for (let i = 0; i < data.items.length; i++) {
    const itemError = validateItem(data.items[i], i);
    if (itemError) return { error: itemError };
  }

  return { value: data as CreateQuotationDTO };
}
