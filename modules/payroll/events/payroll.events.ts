import { ERPEventBus } from "../../../server-erp-core.js";

export function initPayrollEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("EmployeeAdvanceCreated", (data: any) => {
    console.log(`[Payroll Event] Advance of ${data.amount} EGP requested/granted for employee ID: ${data.employeeId}`);
  });

  eventBus.on("PayrollCalculated", (data: any) => {
    console.log(`[Payroll Event] Completed payroll generation across all employees for month: ${data.month}`);
  });
}
