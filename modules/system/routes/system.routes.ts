import { Router } from "express";
import { SystemController } from "../controllers/system.controller.js";

const router = Router();
const controller = new SystemController();

router.get("/health", controller.getHealth);
router.get("/settings", controller.getSettings);
router.post("/settings", controller.updateSetting);

export default router;
