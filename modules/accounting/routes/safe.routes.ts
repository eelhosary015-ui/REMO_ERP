import { Router } from "express";
import { SafeController } from "../controllers/safe.controller.js";

const router = Router();
const controller = new SafeController();

router.get("/", controller.getSafes);
router.post("/", controller.createSafe);
router.post("/:id/transactions", controller.adjustBalance);

export default router;
