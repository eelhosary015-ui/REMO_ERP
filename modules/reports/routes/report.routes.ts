import { Router } from "express";
import { ReportController } from "../controllers/report.controller.js";

const router = Router();
const controller = new ReportController();

router.get("/sales", controller.getSalesReport);
router.get("/profitability", controller.getProfitabilityReport);

export default router;
