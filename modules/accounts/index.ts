import accountRoutes from "./routes/account.routes.js";
import erpGlRoutes from "./routes/erp-gl.routes.js";
import { initAccountEvents } from "./events/account.events.js";
import { initAccountJobs } from "./jobs/account.jobs.js";

export function bootstrapAccountsModule() {
  console.log("⚡ Bootstrapping Accounts Module...");
  initAccountEvents();
  initAccountJobs();
}

export { accountRoutes, erpGlRoutes };
export * from "./dto/account.dto.js";
export * from "./validators/account.validator.js";
export * from "./services/account.service.js";
export * from "./controllers/account.controller.js";
export * from "./services/auto-posting.service.js";