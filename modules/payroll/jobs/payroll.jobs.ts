import { ERPJobQueue } from "../../../server-erp-core.js";

export function initPayrollJobs() {
  console.log("[Payroll Jobs] Registering payroll automated salary runs and tax audits...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "AutoRunEndOfMonthPayroll") {
      console.log(`[Job Worker] Calculating final monthly earnings/deductions for job #${job.id}...`);
    }
  });
}
