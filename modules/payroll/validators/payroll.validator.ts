import { CreateAdvanceDTO, CalculatePayrollDTO } from "../dto/payroll.dto.js";

export function validateCreateAdvance(data: any): { error?: string; value?: CreateAdvanceDTO } {
  if (!data.employee_id || typeof data.employee_id !== "number") {
    return { error: "Employee ID is required and must be a number" };
  }
  if (typeof data.amount !== "number" || data.amount <= 0) {
    return { error: "Advance amount must be a positive number" };
  }
  return { value: data as CreateAdvanceDTO };
}

export function validateCalculatePayroll(data: any): { error?: string; value?: CalculatePayrollDTO } {
  if (!data.month || !/^\d{4}-\d{2}$/.test(data.month)) {
    return { error: "Month is required in YYYY-MM format" };
  }
  return { value: data as CalculatePayrollDTO };
}
