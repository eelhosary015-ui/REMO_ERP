import orderRoutes from "./routes/order.routes.js";
import { initRestaurantEvents } from "./events/order.events.js";
import { initRestaurantJobs } from "./jobs/order.jobs.js";

export function bootstrapRestaurantModule() {
  console.log("⚡ Bootstrapping Restaurant Module...");
  initRestaurantEvents();
  initRestaurantJobs();
}

export { orderRoutes };
export * from "./dto/order.dto.js";
export * from "./validators/order.validator.js";
export * from "./services/order.service.js";
export * from "./controllers/order.controller.js";
