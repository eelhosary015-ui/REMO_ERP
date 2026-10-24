import costRoutes from "./routes/cost.routes.js";
import { initCostEvents } from "./events/cost.events.js";
import { initCostJobs } from "./jobs/cost.jobs.js";

export function bootstrapCostsModule() {
  console.log("⚡ Bootstrapping Costs Module...");
  initCostEvents();
  initCostJobs();
}

export { costRoutes };
export * from "./dto/cost.dto.js";
export * from "./validators/cost.validator.js";
export * from "./services/cost.service.js";
export * from "./controllers/cost.controller.js";
export * from "./repositories/cost.repository.js";
export * from "./domain/cost.types.js";
