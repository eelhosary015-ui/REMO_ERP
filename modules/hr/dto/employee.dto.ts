export interface CreateEmployeeDTO {
  name: string;
  role: string;
  phone?: string;
  /** Alias kept for backward compatibility; `basic_salary` is canonical. */
  salary?: number;
  branch_id?: number | null;
  // BUG-ERP-012 / PHASE 4 — these were previously accepted by the API layer but
  // silently dropped by the repository INSERT.
  job_title?: string;
  employee_code?: string;
  company_id?: number | null;
  department_id?: number | null;
  email?: string;
  national_id?: string;
  /** Canonical payroll salary column (`employees.basic_salary`). */
  basic_salary?: number;
  hire_date?: string;
  status?: string;
}

export interface ClockInOutDTO {
  employee_id: number;
  type: "in" | "out";
  notes?: string;
}
