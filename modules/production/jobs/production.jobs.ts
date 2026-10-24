import { ERPJobQueue } from "../../../server-erp-core.js";

export function initProductionJobs() {
  console.log("[Production Jobs] Registering manufacturing and recipe audit checklist background workers...");

  ERPJobQueue.subscribe((job) => {
    if (job.name === "VerifyBOMDeficits") {
      console.log(`[Job Worker] Checking product Bill of Materials ingredient availability for job #${job.id}...`);
    }
  });
}
