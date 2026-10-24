import { CreateEmployeeDTO, ClockInOutDTO } from "../dto/employee.dto.js";

export function validateCreateEmployee(data: any): { error?: string; value?: CreateEmployeeDTO } {
  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    return { error: "Employee name must be a valid non-empty string" };
  }
  if (!data.role || typeof data.role !== "string" || data.role.trim() === "") {
    return { error: "Role is required and must be a valid string" };
  }
  if (data.salary !== undefined && (typeof data.salary !== "number" || data.salary < 0)) {
    return { error: "Salary must be a positive non-negative number" };
  }
  return { value: data as CreateEmployeeDTO };
}

export function validateClockInOut(data: any): { error?: string; value?: ClockInOutDTO } {
  if (!data.employee_id || typeof data.employee_id !== "number") {
    return { error: "Employee ID is required and must be a number" };
  }
  if (!data.type || !["in", "out"].includes(data.type)) {
    return { error: "Clocking type must be: in or out" };
  }
  return { value: data as ClockInOutDTO };
}
