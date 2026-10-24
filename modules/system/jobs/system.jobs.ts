import { ERPJobQueue } from "../../../server-erp-core.js";

export function initSystemJobs() {
  console.log("[System Jobs] Registering system-wide backup and maintenance tasks...");

  ERPJobQueue.subscribe((job) => {
    if (job.name === "AutoDBBackup") {
      console.log(`[Job Worker] Triggering automated PostgreSQL backups to /backups directory for job: ${job.id}`);
    }
  });
}
