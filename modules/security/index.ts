import securityRoutes from "./routes/security.routes.js";
import { initSecurityEvents } from "./events/security.events.js";
import { initSecurityJobs } from "./jobs/security.jobs.js";

export function bootstrapSecurityModule() {
  console.log("⚡ Bootstrapping Security Module...");
  initSecurityEvents();
  initSecurityJobs();
}

export { securityRoutes };
export * from "./dto/security.dto.js";
export * from "./validators/security.validator.js";
export * from "./services/security.service.js";
export * from "./controllers/security.controller.js";
