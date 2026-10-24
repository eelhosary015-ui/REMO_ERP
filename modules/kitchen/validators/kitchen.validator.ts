import { UpdateKitchenItemStatusDTO } from "../dto/kitchen.dto.js";

export function validateUpdateKitchenItemStatus(data: any): { error?: string; value?: UpdateKitchenItemStatusDTO } {
  if (!data.order_id || typeof data.order_id !== "number") {
    return { error: "Order ID is required and must be a number" };
  }
  if (!data.item_id || typeof data.item_id !== "number") {
    return { error: "Item ID is required and must be a number" };
  }
  if (!["pending", "preparing", "ready", "served"].includes(data.status)) {
    return { error: "Invalid kitchen status value" };
  }
  return { value: data as UpdateKitchenItemStatusDTO };
}
