import { CreateWarehouseDTO, AdjustStockDTO } from "../dto/warehouse.dto.js";

export function validateCreateWarehouse(data: any): { error?: string; value?: CreateWarehouseDTO } {
  if (!data.name || typeof data.name !== "string") {
    return { error: "Warehouse name is required and must be a string" };
  }
  return { value: data as CreateWarehouseDTO };
}

export function validateAdjustStock(data: any): { error?: string; value?: AdjustStockDTO } {
  if (!data.warehouse_id || typeof data.warehouse_id !== "number") {
    return { error: "Warehouse ID is required and must be a number" };
  }
  if (!data.ingredient_id || typeof data.ingredient_id !== "number") {
    return { error: "Ingredient ID is required and must be a number" };
  }
  if (typeof data.quantity !== "number" || data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }
  if (!["addition", "deduction"].includes(data.type)) {
    return { error: "Adjustment type must be either 'addition' or 'deduction'" };
  }
  return { value: data as AdjustStockDTO };
}
