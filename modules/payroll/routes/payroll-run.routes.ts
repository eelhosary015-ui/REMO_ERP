import { Router } from "express";
import { PayrollRunController } from "../controllers/payroll-run.controller.js";
import { authenticateToken } from "../../system/system_api.routes.js";

/**
 * مسارات مسير المرتبات — تُركَّب على /api/v2/payroll (الوحدات) و /api/payroll (الواجهة).
 */
const router = Router();
const controller = new PayrollRunController();

// محمّل لاحقًا لتجنب أي مشكلة في ترتيب تقييم الوحدات (استيراد دائري).
const requireAuth = (req: any, res: any, next: any) => authenticateToken(req, res, next);

// ملاحظة: period-status قبل :id حتى لا يُفسَّر "period-status" كمعرف.
router.get("/runs/period-status", requireAuth, controller.periodStatus);
// تقرير صرف المرتبات الشهري (لكل موظف) — قبل :id لنفس السبب.
router.get("/runs/disbursement-report", requireAuth, controller.disbursementReport);
router.get("/runs", requireAuth, controller.list);
router.post("/runs/draft", requireAuth, controller.buildDraft);
router.get("/runs/:id", requireAuth, controller.getOne);
router.post("/runs/:id/close", requireAuth, controller.close);
router.post("/runs/:id/pay", requireAuth, controller.pay);
router.post("/runs/:id/reverse", requireAuth, controller.reverseAccrual);
router.post("/runs/:id/payments/:paymentId/reverse", requireAuth, controller.reversePayment);

export default router;
