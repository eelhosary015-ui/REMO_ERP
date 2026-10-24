import { ERPJobQueue } from "../../../server-erp-core.js";

export function initRestaurantJobs() {
  console.log("[Restaurant Jobs] Registering restaurant background workers...");
  
  // A service job example to clean up stale pending orders
  ERPJobQueue.subscribe((job) => {
    if (job.name === "CleanupStaleOrders") {
      console.log(`[Job Worker] Executing order cleanup job ${job.id} for queue ${job.queue}...`);
      // Simulating cleanup logic
    }
  });
}
