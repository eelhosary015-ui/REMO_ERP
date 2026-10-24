import safeRoutes from "./routes/safe.routes.js";
import { initAccountingEvents } from "./events/safe.events.js";
import { initAccountingJobs } from "./jobs/safe.jobs.js";

export function bootstrapAccountingModule() {
  console.log("⚡ Bootstrapping Accounting Module...");
  initAccountingEvents();
  initAccountingJobs();
}

export { safeRoutes };
export * from "./dto/safe.dto.js";
export * from "./validators/safe.validator.js";
export * from "./services/safe.service.js";
export * from "./controllers/safe.controller.js";
