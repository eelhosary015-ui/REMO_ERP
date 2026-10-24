import { Router } from "express";
import { PurchaseController } from "../controllers/purchase.controller.js";

const router = Router();
const controller = new PurchaseController();

router.get("/", controller.getPurchases);
router.get("/:id", controller.getPurchaseDetails);
router.post("/", controller.createPurchase);

export default router;
