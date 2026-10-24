import { ERPJobQueue } from "../../../server-erp-core.js";

export function initReportJobs() {
  console.log("[Reports Jobs] Registering central overnight financial summary background builders...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "CompileOvernightFinancialSummaries") {
      console.log(`[Job Worker] Reconciling accounting ledgers, cost profiles, and product sales indexes for job #${job.id}...`);
    }
  });
}
