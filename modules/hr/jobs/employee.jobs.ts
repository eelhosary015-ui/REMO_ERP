import { ERPJobQueue } from "../../../server-erp-core.js";

export function initHRJobs() {
  console.log("[HR Jobs] Initializing monthly payroll background workers...");
  
  ERPJobQueue.subscribe((job) => {
    if (job.name === "CalculateMonthlyPayroll") {
      console.log(`[Job Worker] Compiling clock sheets and executing deductions for jobId: ${job.id}`);
    }
  });
}
