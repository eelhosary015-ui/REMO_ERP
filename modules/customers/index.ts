import { Router } from "express";
import { CustomerController } from "./controllers/customer.controller.js";
import { initCustomerEvents } from "./events/customer.events.js";
import { initCustomerJobs } from "./jobs/customer.jobs.js";

const customerRoutes = Router();
const controller = new CustomerController();

customerRoutes.get("/", controller.getCustomers);
customerRoutes.post("/", controller.createCustomer);
customerRoutes.get("/:id/transactions", controller.getTransactions);
customerRoutes.post("/transactions", controller.recordTransaction);

export function bootstrapCustomersModule() {
  console.log("⚡ Bootstrapping Customers Module...");
  initCustomerEvents();
  initCustomerJobs();
}

export { customerRoutes };
export * from "./dto/customer.dto.js";
export * from "./validators/customer.validator.js";
export * from "./services/customer.service.js";
export * from "./controllers/customer.controller.js";
