import { CreateOrderDTO, UpdateOrderDTO } from "../dto/order.dto.js";

export function validateCreateOrder(data: any): { error?: string; value?: CreateOrderDTO } {
  if (!data.branch_id || typeof data.branch_id !== "number") {
    return { error: "Branch ID must be a valid number" };
  }
  if (!data.total || typeof data.total !== "number" || data.total < 0) {
    return { error: "Total amount must be a positive number" };
  }
  if (!data.order_type || !["dine_in", "takeaway", "delivery"].includes(data.order_type)) {
    return { error: "Order type must be one of: dine_in, takeaway, delivery" };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Order must contain at least one item" };
  }

  for (const item of data.items) {
    if (!item.product_id || typeof item.product_id !== "number") {
      return { error: "Each item must have a valid product_id" };
    }
    if (!item.quantity || typeof item.quantity !== "number" || item.quantity <= 0) {
      return { error: "Item quantity must be a positive number greater than 0" };
    }
    if (typeof item.price !== "number" || item.price < 0) {
      return { error: "Item price must be a valid non-negative number" };
    }
  }

  return { value: data as CreateOrderDTO };
}

export function validateUpdateOrder(data: any): { error?: string; value?: UpdateOrderDTO } {
  if (data.status && !["pending", "processing", "completed", "cancelled"].includes(data.status)) {
    return { error: "Status must be: pending, processing, completed, or cancelled" };
  }
  if (data.is_paid !== undefined && ![0, 1].includes(data.is_paid)) {
    return { error: "is_paid must be 0 (unpaid) or 1 (paid)" };
  }
  return { value: data as UpdateOrderDTO };
}
