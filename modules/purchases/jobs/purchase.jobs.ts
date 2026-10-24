import { ERPJobQueue } from "../../../server-erp-core.js";

export function initPurchaseJobs() {
  console.log("[Purchases Jobs] Registering background check workers for inventory and stock levels...");

  ERPJobQueue.subscribe((job) => {
    if (job.name === "AuditSupplierLedger") {
      console.log(`[Job Worker] Recalculating supplier outstanding balances for job #${job.id}...`);
    }
  });
}
