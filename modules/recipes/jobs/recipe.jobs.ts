import { ERPJobQueue } from "../../../server-erp-core.js";

export function initRecipeJobs() {
  console.log("[Recipes Jobs] Registering recipe cost audits and ingredient footprint calculations...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "AuditProductCostMargins") {
      console.log(`[Job Worker] Scraping raw ingredient prices against recipe quantity requirements for job #${job.id}...`);
    }
  });
}
