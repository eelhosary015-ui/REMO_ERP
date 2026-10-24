import systemRoutes from "./routes/system.routes.js";
import { initSystemEvents } from "./events/system.events.js";
import { initSystemJobs } from "./jobs/system.jobs.js";

export function bootstrapSystemModule() {
  console.log("⚡ Bootstrapping System Module...");
  initSystemEvents();
  initSystemJobs();
}

export { systemRoutes };
export * from "./dto/system.dto.js";
export * from "./validators/system.validator.js";
export * from "./services/system.service.js";
export * from "./controllers/system.controller.js";
