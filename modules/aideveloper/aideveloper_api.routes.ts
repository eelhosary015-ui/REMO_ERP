import { Router } from "express";
import {
  getAIDeveloperDashboard,
  analyzeProjectFull,
  detectBugs,
  scanSecurity,
  analyzePerformance,
  optimizeDatabase,
  generateFeature,
  generateApiSpec,
  generateDocs,
  runTestSuites,
  reviewCode,
  askAIChat,
  stageInSandbox,
  applySandboxMerge,
  rollbackLastMerge,
  getAuditLogs,
  getBackupsList,
  autoFixBug
} from "./aideveloper.service.js";

const router = Router();

// 1. Dashboard Metrics
router.get("/api/ai-developer/dashboard", async (req: any, res: any) => {
  try {
    const data = await getAIDeveloperDashboard();
    res.json(data);
  } catch (err: any) {
    console.error("AI Developer Dashboard error:", err);
    res.status(500).json({ error: err.message || "فشل استرجاع إحصائيات لوحة التحكم" });
  }
});

// 2. Full Project Analysis
router.post("/api/ai-developer/analyze", async (req: any, res: any) => {
  try {
    const report = await analyzeProjectFull();
    res.json(report);
  } catch (err: any) {
    console.error("Project Analysis error:", err);
    res.status(500).json({ error: err.message || "فشل إجراء تحليل المشروع" });
  }
});

// 3. Bug Detector
router.post("/api/ai-developer/bug-detector", async (req: any, res: any) => {
  try {
    const result = await detectBugs();
    res.json(result);
  } catch (err: any) {
    console.error("Bug Detector error:", err);
    res.status(500).json({ error: err.message || "فشل فحص الأخطاء" });
  }
});

// 4. Security Scanner
router.post("/api/ai-developer/security-scanner", async (req: any, res: any) => {
  try {
    const result = await scanSecurity();
    res.json(result);
  } catch (err: any) {
    console.error("Security Scanner error:", err);
    res.status(500).json({ error: err.message || "فشل الفحص الأمني" });
  }
});

// 5. Performance Analyzer
router.post("/api/ai-developer/performance-analyzer", async (req: any, res: any) => {
  try {
    const result = await analyzePerformance();
    res.json(result);
  } catch (err: any) {
    console.error("Performance Analyzer error:", err);
    res.status(500).json({ error: err.message || "فشل تحليل الأداء" });
  }
});

// 6. Database Optimizer
router.post("/api/ai-developer/database-optimizer", async (req: any, res: any) => {
  try {
    const result = await optimizeDatabase();
    res.json(result);
  } catch (err: any) {
    console.error("Database Optimizer error:", err);
    res.status(500).json({ error: err.message || "فشل تحليل قاعدة البيانات" });
  }
});

// 7. Feature Generator
router.post("/api/ai-developer/feature-generator", async (req: any, res: any) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "يرجى تقديم وصف الميزة أو طلب التعديل" });
    }
    const result = await generateFeature(prompt);
    res.json(result);
  } catch (err: any) {
    console.error("Feature Generator error:", err);
    res.status(500).json({ error: err.message || "فشل توليد الميزة" });
  }
});

// 8. API Generator
router.post("/api/ai-developer/api-generator", async (req: any, res: any) => {
  try {
    const { entityName } = req.body || {};
    const result = await generateApiSpec(entityName || "Resource");
    res.json(result);
  } catch (err: any) {
    console.error("API Generator error:", err);
    res.status(500).json({ error: err.message || "فشل توليد الـ API" });
  }
});

// 9. Documentation Generator
router.post("/api/ai-developer/doc-generator", async (req: any, res: any) => {
  try {
    const docs = await generateDocs();
    res.json(docs);
  } catch (err: any) {
    console.error("Doc Generator error:", err);
    res.status(500).json({ error: err.message || "فشل إنشاء التوثيق" });
  }
});

// 10. Test Generator & Runner
router.post("/api/ai-developer/test-generator", async (req: any, res: any) => {
  try {
    const testResults = await runTestSuites();
    res.json(testResults);
  } catch (err: any) {
    console.error("Test Generator error:", err);
    res.status(500).json({ error: err.message || "فشل تشغيل الاختبارات" });
  }
});

// 11. Code Reviewer
router.post("/api/ai-developer/code-review", async (req: any, res: any) => {
  try {
    const { code } = req.body || {};
    const review = await reviewCode(code || "");
    res.json(review);
  } catch (err: any) {
    console.error("Code Review error:", err);
    res.status(500).json({ error: err.message || "فشل مراجعة الكود" });
  }
});

// 12. AI Chat
router.post("/api/ai-developer/chat", async (req: any, res: any) => {
  try {
    const { question, history } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "يرجى كتابة السؤال المطلوب" });
    }
    const response = await askAIChat(question, history || []);
    res.json(response);
  } catch (err: any) {
    console.error("AI Chat error:", err);
    res.status(500).json({ error: err.message || "فشل الإجابة عبر AI Chat" });
  }
});

// 13. Sandbox - Stage Modifications
router.post("/api/ai-developer/sandbox/stage", async (req: any, res: any) => {
  try {
    const stagedData = await stageInSandbox(req.body || {});
    res.json(stagedData);
  } catch (err: any) {
    console.error("Sandbox Stage error:", err);
    res.status(500).json({ error: err.message || "فشل إعداد التجهيز في البيئة المؤقتة" });
  }
});

// 14. Sandbox - Apply Merge
router.post("/api/ai-developer/sandbox/apply", async (req: any, res: any) => {
  try {
    const { sandboxId } = req.body || {};
    if (!sandboxId) {
      return res.status(400).json({ error: "معرف البيئة المؤقتة مطلوب" });
    }
    const userName = req.user?.username || "المدير";
    const result = await applySandboxMerge(Number(sandboxId), userName);
    res.json(result);
  } catch (err: any) {
    console.error("Sandbox Merge error:", err);
    res.status(500).json({ error: err.message || "فشل تدميج التعديلات" });
  }
});

// 15. Sandbox - Rollback
router.post("/api/ai-developer/sandbox/rollback", async (req: any, res: any) => {
  try {
    const { auditId } = req.body || {};
    const result = await rollbackLastMerge(auditId ? Number(auditId) : undefined);
    res.json(result);
  } catch (err: any) {
    console.error("Sandbox Rollback error:", err);
    res.status(500).json({ error: err.message || "فشل عملية التراجع" });
  }
});

// 16. Audit Logs
router.get("/api/ai-developer/audit-log", async (req: any, res: any) => {
  try {
    const logs = await getAuditLogs();
    res.json(logs);
  } catch (err: any) {
    console.error("Audit Log error:", err);
    res.status(500).json({ error: err.message || "فشل استرجاع سجل العمليات" });
  }
});

// 17. Backups
router.get("/api/ai-developer/backups", async (req: any, res: any) => {
  try {
    const backups = await getBackupsList();
    res.json(backups);
  } catch (err: any) {
    console.error("Backups list error:", err);
    res.status(500).json({ error: err.message || "فشل استرجاع قائمة النسخ الاحتياطية" });
  }
});

// 18. Auto-Fix Bug
router.post("/api/ai-developer/bug-detector/fix", async (req: any, res: any) => {
  try {
    const { bugId, file, line, type, fix, snippet } = req.body || {};
    if (!file) {
      return res.status(400).json({ error: "مسار الملف مطلوب" });
    }
    const result = await autoFixBug(
      bugId || "BUG-X",
      file,
      Number(line || 0),
      type || "General Bug",
      fix || "",
      snippet || ""
    );
    res.json(result);
  } catch (err: any) {
    console.error("Auto-Fix Bug error:", err);
    res.status(500).json({ error: err.message || "فشل إصلاح الخطأ تلقائياً" });
  }
});

export default router;
