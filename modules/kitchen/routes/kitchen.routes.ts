import { Router } from "express";
import { KitchenController } from "../controllers/kitchen.controller.js";

const router = Router();
const controller = new KitchenController();

router.get("/active", controller.getActiveOrders);
router.post("/item-status", controller.updateItemStatus);

export default router;
