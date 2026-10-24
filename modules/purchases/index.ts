import purchaseRoutes from "./routes/purchase.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";
import { initPurchaseEvents } from "./events/purchase.events.js";
import { initPurchaseJobs } from "./jobs/purchase.jobs.js";

export function bootstrapPurchasesModule() {
  console.log("⚡ Bootstrapping Purchases Module...");
  initPurchaseEvents();
  initPurchaseJobs();
}

export { purchaseRoutes, supplierRoutes };
export * from "./dto/purchase.dto.js";
export * from "./dto/supplier.dto.js";
export * from "./validators/purchase.validator.js";
export * from "./validators/supplier.validator.js";
export * from "./services/purchase.service.js";
export * from "./services/supplier.service.js";
export * from "./controllers/purchase.controller.js";
export * from "./controllers/supplier.controller.js";
