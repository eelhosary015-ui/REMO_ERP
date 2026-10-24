import { ERPJobQueue } from "../../../server-erp-core.js";

export function initAccountJobs() {
  console.log("[Accounts Jobs] Registering general ledger trial balance recalculation workers...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "RecalculateTrialBalance") {
      console.log(`[Job Worker] Recalculating balances across trial ledger sheets for job #${job.id}...`);
    }
  });
}
