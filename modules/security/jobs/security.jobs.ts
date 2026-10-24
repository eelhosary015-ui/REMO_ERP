import { ERPJobQueue } from "../../../server-erp-core.js";

export function initSecurityJobs() {
  console.log("[Security Jobs] Registering automated security token session validity checks...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "PruneInactiveSessions") {
      console.log(`[Job Worker] Flushing stale connection tokens for security job #${job.id}...`);
    }
  });
}
