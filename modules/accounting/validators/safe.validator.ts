import { CreateSafeDTO, AdjustBalanceDTO } from "../dto/safe.dto.js";

export function validateCreateSafe(data: any): { error?: string; value?: CreateSafeDTO } {
  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    return { error: "Safe name must be a valid non-empty string" };
  }
  return { value: data as CreateSafeDTO };
}

export function validateAdjustBalance(data: any): { error?: string; value?: AdjustBalanceDTO } {
  if (!data.amount || typeof data.amount !== "number" || data.amount <= 0) {
    return { error: "Adjustment amount must be a positive number greater than 0" };
  }
  const allowedTypes = ["in", "out", "transfer", "deficit", "surplus", "cash_drop"];
  if (!data.type || !allowedTypes.includes(data.type)) {
    return { error: `Adjustment type must be one of: ${allowedTypes.join(", ")}` };
  }
  return { value: data as AdjustBalanceDTO };
}
