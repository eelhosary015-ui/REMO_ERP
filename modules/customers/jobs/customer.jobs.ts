import { ERPJobQueue } from "../../../server-erp-core.js";

export function initCustomerJobs() {
  console.log("[Customers Jobs] Registering customer balance audit and credit limit warning jobs...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "AuditCustomerBalances") {
      console.log(`[Job Worker] Re-calculating transaction history for and verifying current indexes for job #${job.id}...`);
    }
  });
}
