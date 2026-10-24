import kitchenRoutes from "./routes/kitchen.routes.js";
import { initKitchenEvents } from "./events/kitchen.events.js";
import { initKitchenJobs } from "./jobs/kitchen.jobs.js";

export function bootstrapKitchenModule() {
  console.log("⚡ Bootstrapping Kitchen Module...");
  initKitchenEvents();
  initKitchenJobs();
}

export { kitchenRoutes };
export * from "./dto/kitchen.dto.js";
export * from "./validators/kitchen.validator.js";
export * from "./services/kitchen.service.js";
export * from "./controllers/kitchen.controller.js";
