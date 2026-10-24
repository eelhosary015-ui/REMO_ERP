import { Router } from "express";
import { FingerprintController } from "../controllers/fingerprint.controller.js";

const router = Router();
const controller = new FingerprintController();

router.get("/devices", controller.getDevices);
router.post("/devices", controller.registerDevice);
router.post("/devices/:id/sync", controller.syncDevice);

export default router;
