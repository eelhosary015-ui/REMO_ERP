import { ERPJobQueue } from "../../../server-erp-core.js";

export function initWarehouseJobs() {
  console.log("[Warehouse Jobs] Registering warehouse stock audits and deficit triggers...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "AuditInventoryDeficits") {
      console.log(`[Job Worker] Scraping storage shelves and logging deficit indexes for job #${job.id}...`);
    }
  });
}
