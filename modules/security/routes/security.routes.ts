import { Router } from "express";
import { SecurityController } from "../controllers/security.controller.js";

const router = Router();
const controller = new SecurityController();

router.get("/users/:id/permissions", controller.getUserPermissions);
router.post("/permissions/update", controller.updateUserPermissions);

export default router;
