import { CreateProductionRunDTO } from "../dto/production.dto.js";

export function validateCreateProductionRun(data: any): { error?: string; value?: CreateProductionRunDTO } {
  if (!data.product_id || typeof data.product_id !== "number") {
    return { error: "Product ID is required and must be a valid number" };
  }
  if (!data.warehouse_id || typeof data.warehouse_id !== "number") {
    return { error: "Warehouse ID is required and must be a valid number" };
  }
  if (!data.quantity || typeof data.quantity !== "number" || data.quantity <= 0) {
    return { error: "Quantity must be a positive number greater than 0" };
  }

  return { value: data as CreateProductionRunDTO };
}
