import { Router } from "express";
import { ProductionController } from "../controllers/production.controller.js";

const router = Router();
const controller = new ProductionController();

// Production Runs
router.get("/", controller.getProductionRuns);
router.post("/", controller.createProductionRun);
router.get("/runs", controller.getProductionRuns);
router.post("/runs", controller.createProductionRun);

// Production Orders
router.get("/orders", controller.getOrders);
router.post("/orders", controller.saveOrder);
router.put("/orders/:id", controller.saveOrder);
router.delete("/orders/:id", controller.deleteOrder);
router.delete("/orders", controller.clearOrders);
router.post("/orders/:id/execute", controller.executeOrder);
router.post("/execute", controller.executeOrder);

// Shared & Sellable Products across POS, Sales, and Production
router.get("/shared-products", controller.getSharedProducts);
router.get("/products", controller.getSharedProducts);

// Availability & Cost Engine
router.get("/check-availability", controller.checkAvailability);
router.post("/check-availability", controller.checkAvailability);

// Bills of Materials / Recipes
router.get("/boms", controller.getBOMs);
router.post("/boms", controller.saveBOM);
router.put("/boms/:id", controller.saveBOM);
router.delete("/boms/:id", controller.deleteBOM);
router.delete("/boms", controller.clearBOMs);

export default router;
