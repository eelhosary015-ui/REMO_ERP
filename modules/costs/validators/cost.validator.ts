import { CreateCostDTO } from "../dto/cost.dto.js";

export function validateCreateCost(data: any): { error?: string; value?: CreateCostDTO } {
  if (!data.category || typeof data.category !== "string") {
    return { error: "Category is required and must be a string" };
  }
  if (typeof data.amount !== "number" || data.amount <= 0) {
    return { error: "Amount must be a positive number" };
  }
  return { value: data as CreateCostDTO };
}
