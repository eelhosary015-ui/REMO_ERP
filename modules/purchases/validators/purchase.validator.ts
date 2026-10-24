import { CreatePurchaseDTO } from "../dto/purchase.dto.js";

export function validateCreatePurchase(data: any): { error?: string; value?: CreatePurchaseDTO } {
  if (!data.supplier_id || typeof data.supplier_id !== "number") {
    return { error: "Supplier ID must be a positive number" };
  }
  if (!data.warehouse_id || typeof data.warehouse_id !== "number") {
    return { error: "Warehouse ID must be a positive number" };
  }
  if (typeof data.total_amount !== "number" || data.total_amount < 0) {
    return { error: "Total amount must be a non-negative number" };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Purchase must contain at least one item" };
  }

  for (const item of data.items) {
    if (!item.ingredient_id || typeof item.ingredient_id !== "number") {
      return { error: "Each purchase item must have a valid ingredient_id" };
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return { error: "Each purchase item must have a positive quantity" };
    }
    if (typeof item.unit_price !== "number" || item.unit_price < 0) {
      return { error: "Each purchase item must have a non-negative unit_price" };
    }
  }

  return { value: data as CreatePurchaseDTO };
}
