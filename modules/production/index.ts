import productionRoutes from "./routes/production.routes.js";
import { initProductionEvents } from "./events/production.events.js";
import { initProductionJobs } from "./jobs/production.jobs.js";

export function bootstrapProductionModule() {
  console.log("⚡ Bootstrapping Production Module...");
  initProductionEvents();
  initProductionJobs();
}

export { productionRoutes };
export * from "./dto/production.dto.js";
export * from "./validators/production.validator.js";
export * from "./services/production.service.js";
export * from "./controllers/production.controller.js";
