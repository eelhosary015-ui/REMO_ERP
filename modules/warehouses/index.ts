import warehouseRoutes from "./routes/warehouse.routes.js";
import { initWarehouseEvents } from "./events/warehouse.events.js";
import { initWarehouseJobs } from "./jobs/warehouse.jobs.js";

export function bootstrapWarehousesModule() {
  console.log("⚡ Bootstrapping Warehouses Module...");
  initWarehouseEvents();
  initWarehouseJobs();
}

export { warehouseRoutes };
export * from "./dto/warehouse.dto.js";
export * from "./validators/warehouse.validator.js";
export * from "./services/warehouse.service.js";
export * from "./controllers/warehouse.controller.js";
