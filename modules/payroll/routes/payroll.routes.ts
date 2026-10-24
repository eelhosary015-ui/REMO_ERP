import { Router } from "express";
import { PayrollController } from "../controllers/payroll.controller.js";

const router = Router();
const controller = new PayrollController();

router.get("/advances", controller.getAdvances);
router.post("/advances", controller.createAdvance);
router.get("/", controller.getPayroll);
router.post("/calculate", controller.calculatePayroll);

export default router;
