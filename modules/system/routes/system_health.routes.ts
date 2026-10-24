import { Router } from "express";
import { authenticateToken } from "../system_api.routes.js";
import databaseHealthRouter from "../database_health_api.routes.js";
import {
  SCHEMA_CONTRACTS,
  formatSchemaGuardFailures,
  getLastSchemaGuardReport,
  runSchemaGuard,
} from "../services/schema-guard.service.js";
import { getSettingsHealth, scanSettingsUsage } from "../services/settings-health.service.js";
import { getPrintJobs, getPrintJobsSummary } from "../services/print-log.service.js";

const router = Router();

const ADMIN_ROLES = ["admin", "super_admin", "owner", "manager"];

function requireAdmin(req: any, res: any, next: any) {
  const role = String(req.user?.role || "").toLowerCase();
  if (!ADMIN_ROLES.includes(role)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "هذا الفحص متاح لمدير النظام فقط",
    });
  }
  next();
}

// revive the existing (previously unregistered) database health endpoint
router.use(databaseHealthRouter);

/** Column contract used by the schema guard (read-only). */
router.get("/api/system/health/contracts", authenticateToken, requireAdmin, (req: any, res) => {
  res.json({
    contracts: SCHEMA_CONTRACTS,
    totals: {
      tables: SCHEMA_CONTRACTS.length,
      columns: SCHEMA_CONTRACTS.reduce((sum, contract) => sum + contract.columns.length, 0),
    },
  });
});

/** Last boot report, or run a fresh read-only check when none exists yet. */
router.get("/api/system/health/schema-guard", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const report =
      (req.query.rerun === "1" ? null : getLastSchemaGuardReport()) ||
      (await runSchemaGuard({ fix: false }));
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("Schema guard check failed:", error);
    res.status(500).json({ success: false, error: error?.message || "فشل فحص المخطط" });
  }
});

/** Re-run the guard and auto-add any missing column. */
router.post("/api/system/health/schema-guard/run", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const fix = req.body?.fix !== false;
    const report = await runSchemaGuard({ fix });
    if (!report.ok) {
      console.warn(`[SchemaGuard] ${report.totals.missing} عمود لسه ناقص:\n${formatSchemaGuardFailures(report)}`);
    }
    res.json({ success: report.ok, report });
  } catch (error: any) {
    console.error("Schema guard run failed:", error);
    res.status(500).json({ success: false, error: error?.message || "فشل تشغيل حارس المخطط" });
  }
});

/** Which settings are read by the code vs. stored in the database. */
router.get("/api/system/health/settings", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    if (req.query.rerun === "1") scanSettingsUsage(true);
    const report = await getSettingsHealth();
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("Settings health check failed:", error);
    res.status(500).json({ success: false, error: error?.message || "فشل فحص الإعدادات" });
  }
});

/** Print log: every receipt/kitchen/test print with its outcome. */
router.get("/api/system/health/print-logs", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const [jobs, summary] = await Promise.all([
      getPrintJobs({
        limit: req.query.limit ? Number(req.query.limit) : 100,
        status: req.query.status ? String(req.query.status) : undefined,
        orderId: req.query.order_id ? Number(req.query.order_id) : undefined,
      }),
      getPrintJobsSummary(),
    ]);
    res.json({ success: true, jobs, summary });
  } catch (error: any) {
    console.error("Print log fetch failed:", error);
    res.status(500).json({ success: false, error: error?.message || "تعذر تحميل سجل الطباعة" });
  }
});

/** Retry every failed print from the last hour right now. */
router.post("/api/system/health/print-logs/retry", authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { retryFailedPrintJobs } = await import("../../../server.js");
    const result = await retryFailedPrintJobs();
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("Print retry failed:", error);
    res.status(500).json({ success: false, error: error?.message || "فشلت إعادة محاولة الطباعة" });
  }
});

export default router;
