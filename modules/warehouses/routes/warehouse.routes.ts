import { Router } from "express";
import { WarehouseController } from "../controllers/warehouse.controller.js";

const router = Router();
const controller = new WarehouseController();

router.get("/", controller.getWarehouses);
router.post("/", controller.createWarehouse);
router.get("/:id/inventory", controller.getInventory);
router.post("/adjust", controller.adjustStock);

export default router;
