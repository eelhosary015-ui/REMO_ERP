import { ERPJobQueue } from "../../../server-erp-core.js";

export function initKitchenJobs() {
  console.log("[Kitchen Jobs] Registering kitchen efficiency and ticket timers checks...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "VerifyKitchenPreparationTTL") {
      console.log(`[Job Worker] Raising alert for delayed tickets/orders for job #${job.id}...`);
    }
  });
}
