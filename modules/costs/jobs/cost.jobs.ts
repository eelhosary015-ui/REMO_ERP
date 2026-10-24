import { ERPJobQueue } from "../../../server-erp-core.js";

export function initCostJobs() {
  console.log("[Costs Jobs] Registering cost audit workers...");
  ERPJobQueue.subscribe((job) => {
    if (job.name === "AuditFoodSpillageCosts") {
      console.log(`[Job Worker] Calibrating food waste costs/formulas for job #${job.id}...`);
    }
  });
}
