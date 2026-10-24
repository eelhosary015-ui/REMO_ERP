import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";

const router = Router();
const controller = new OrderController();

// Map route endpoints to controller actions
router.post("/", controller.createOrder);
router.get("/:id", controller.getOrder);
router.put("/:id", controller.updateOrder);

export default router;
