import { Router } from "express";
import { SupplierController } from "../controllers/supplier.controller.js";

const router = Router();
const controller = new SupplierController();

router.get("/top", controller.getTopSuppliers);
router.get("/:id/statement", controller.getStatement);
router.get("/:id/transactions", controller.getTransactions);
router.get("/:id/purchases", controller.getSupplierPurchases);
router.get("/:id", controller.getSupplierById);
router.get("/", controller.getSuppliers);
router.post("/:id/payments", controller.recordPayment);
router.put("/:id", controller.updateSupplier);
router.post("/", controller.createSupplier);
router.delete("/:id", controller.deleteSupplier);

export default router;