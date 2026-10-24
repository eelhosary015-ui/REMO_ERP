export interface CreateAdvanceDTO {
  employee_id: number;
  amount: number;
  notes?: string;
  date?: string;
}

export interface CalculatePayrollDTO {
  month: string; // "YYYY-MM"
}
