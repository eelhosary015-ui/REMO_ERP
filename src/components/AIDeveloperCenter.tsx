import React, { useState, useEffect } from "react";
import { authHeaders } from "../utils/api";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot,
  LayoutGrid,
  FileCode2,
  Bug,
  ShieldAlert,
  Activity,
  Database,
  Sparkles,
  Code2,
  Palette,
  BookOpen,
  TestTube2,
  CheckSquare,
  MessageSquare,
  GitBranch,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  ChevronRight,
  Play,
  Download,
  Copy,
  Check,
  Zap,
  Cpu,
  HardDrive,
  Layers,
  ArrowRight,
  ShieldCheck,
  Send,
  Terminal,
  FileText,
  Clock,
  UserCheck,
  RotateCcw,
  Sliders,
  ExternalLink,
  Code,
  Lock,
  Eye,
  Server
} from "lucide-react";

interface AIDeveloperCenterProps {
  onBack?: () => void;
  user?: any;
  initialTab?: string;
}

export const AIDeveloperCenter: React.FC<AIDeveloperCenterProps> = ({ onBack, user, initialTab }) => {
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "project_analysis"
    | "bug_detector"
    | "security_scanner"
    | "performance_analyzer"
    | "database_optimizer"
    | "feature_generator"
    | "api_generator"
    | "ui_generator"
    | "doc_generator"
    | "test_generator"
    | "code_review"
    | "ai_chat"
    | "sandbox"
    | "audit_log"
  >(() => {
    if (initialTab && initialTab !== "main") {
      return initialTab as any;
    }
    return "dashboard";
  });

  useEffect(() => {
    if (initialTab && initialTab !== "main") {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  // State Variables for Data
  const [loading, setLoading] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [bugData, setBugData] = useState<any>(null);
  const [securityData, setSecurityData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [dbOptimizationData, setDbOptimizationData] = useState<any>(null);
  const [testData, setTestData] = useState<any>(null);
  const [docsData, setDocsData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);

  // Form & Generator States
  const [featurePrompt, setFeaturePrompt] = useState<string>("");
  const [generatedFeature, setGeneratedFeature] = useState<any>(null);
  const [apiEntity, setApiEntity] = useState<string>("");
  const [generatedApi, setGeneratedApi] = useState<any>(null);
  const [reviewCodeInput, setReviewCodeInput] = useState<string>("");
  const [reviewResult, setReviewResult] = useState<any>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string; sources?: string[] }>>([
    {
      sender: "ai",
      text: "مرحباً بك في مركز تطوير الذكاء الاصطناعي REMO PRO AI Developer Center! كيف يمكنني مساعدتك اليوم في تحليل الكود، اكتشاف الأخطاء، أو إضافة ميزة جديدة؟"
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");

  // Staged Sandbox Items
  const [stagedFeature, setStagedFeature] = useState<any>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);

  // Toast Notification
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [fixingBugId, setFixingBugId] = useState<string | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const getHeaders = () => authHeaders({ "Content-Type": "application/json" });

  // 1. Fetch Dashboard
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/dashboard", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      } else {
        showToast("تعذر تحميل لوحة التحكم، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Project Analysis
  const fetchProjectAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/analyze", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAnalysisData(data);
      } else {
        showToast("تعذر إجراء تحليل المشروع، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Bug Detector
  const fetchBugDetector = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/bug-detector", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBugData(data);
      } else {
        showToast("تعذر إكمال فحص الأخطاء، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Bug Detector error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch Security Scanner
  const fetchSecurityScanner = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/security-scanner", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSecurityData(data);
      } else {
        showToast("تعذر إكمال الفحص الأمني، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Security Scanner error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 5. Fetch Performance
  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/performance-analyzer", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPerformanceData(data);
      } else {
        showToast("تعذر إجراء تحليل الأداء، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Performance error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFixBug = async (bug: any) => {
    setFixingBugId(bug.id);
    try {
      const res = await fetch("/api/ai-developer/bug-detector/fix", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          bugId: bug.id,
          file: bug.file,
          line: bug.line,
          type: bug.type,
          fix: bug.fix,
          snippet: bug.snippet
        })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "تم إصلاح الخطأ تلقائياً بنجاح ✨");
        // Refresh list and dashboard
        await fetchBugDetector();
        await fetchDashboard();
      } else {
        const errData = await res.json();
        showToast(errData.error || "فشل إصلاح الخطأ تلقائياً", "error");
      }
    } catch (err) {
      console.error("Auto-fix bug error:", err);
      showToast("حدث خطأ أثناء إجراء الإصلاح التلقائي", "error");
    } finally {
      setFixingBugId(null);
    }
  };

  // 6. Fetch DB Optimizer
  const fetchDbOptimizer = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/database-optimizer", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDbOptimizationData(data);
      } else {
        showToast("تعذر إجراء تحسين قواعد البيانات، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("DB Optimizer error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 7. Fetch Tests
  const fetchRunTests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/test-generator", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTestData(data);
      } else {
        showToast("تعذر تشغيل حزم الاختبارات، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Tests error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 8. Fetch Docs
  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/doc-generator", { method: "POST", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDocsData(data);
      } else {
        showToast("تعذر توليد التوثيق، يرجى إعادة المحاولة", "error");
      }
    } catch (err) {
      console.error("Docs error:", err);
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  // 9. Fetch Audit Log & Backups
  const fetchAuditAndBackups = async () => {
    try {
      const [aRes, bRes] = await Promise.all([
        fetch("/api/ai-developer/audit-log", { headers: getHeaders() }),
        fetch("/api/ai-developer/backups", { headers: getHeaders() })
      ]);
      if (aRes.ok) {
        setAuditLogs(await aRes.json());
      }
      if (bRes.ok) {
        setBackupsList(await bRes.json());
      }
    } catch (err) {
      console.error("Audit fetch error:", err);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAuditAndBackups();
  }, []);

  useEffect(() => {
    if (activeTab === "project_analysis" && !analysisData) fetchProjectAnalysis();
    if (activeTab === "bug_detector" && !bugData) fetchBugDetector();
    if (activeTab === "security_scanner" && !securityData) fetchSecurityScanner();
    if (activeTab === "performance_analyzer" && !performanceData) fetchPerformance();
    if (activeTab === "database_optimizer" && !dbOptimizationData) fetchDbOptimizer();
    if (activeTab === "test_generator" && !testData) fetchRunTests();
    if (activeTab === "doc_generator" && !docsData) fetchDocs();
    if (activeTab === "audit_log" || activeTab === "sandbox") fetchAuditAndBackups();
  }, [activeTab]);

  // Handlers for Generator Actions
  const handleGenerateFeature = async () => {
    if (!featurePrompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/feature-generator", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ prompt: featurePrompt })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedFeature(data);
        showToast("تم توليد كافة ملفات الميزة بالذكاء الاصطناعي بنجاح ✨");
      } else {
        showToast("فشل توليد الميزة، يرجى المحاولة مرة أخرى", "error");
      }
    } catch (err) {
      showToast("حدث خطأ أثناء الاتصال بالموديل", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStageFeatureToSandbox = async () => {
    if (!generatedFeature) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/sandbox/stage", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          feature_name: generatedFeature.featureTitle,
          prompt: generatedFeature.prompt,
          files: generatedFeature.filesToCreate,
          db_changes: [{ action: "CREATE_TABLE", details: generatedFeature.filesToCreate[0]?.content || "" }]
        })
      });
      if (res.ok) {
        const staged = await res.json();
        setStagedFeature(staged);
        showToast("تم إرسال الملفات إلى بيئة التطبيق والتطوير المأمونة (Sandbox) بنجاح 🚀");
        setActiveTab("sandbox");
      }
    } catch (err) {
      showToast("حدث خطأ أثناء التجهيز في الـ Sandbox", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApplySandboxMerge = async () => {
    if (!stagedFeature) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/sandbox/apply", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ sandboxId: stagedFeature.id })
      });
      if (res.ok) {
        const result = await res.json();
        showToast(result.message || "تم دمج التعديلات وإدراجها بسلام ✨");
        setStagedFeature(null);
        fetchDashboard();
        fetchAuditAndBackups();
      } else {
        const errJson = await res.json();
        showToast(errJson.error || "فشل دمج التعديلات", "error");
      }
    } catch (err) {
      showToast("حدث خطأ أثناء دمج التعديلات", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (auditId?: number) => {
    if (!window.confirm("هل أنت أصل ومقتنع بالتراجع عن آخر عملية دمج واستعادة النسخة السابقة؟")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/sandbox/rollback", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ auditId })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "تم التراجع بنجاح ✨");
        fetchDashboard();
        fetchAuditAndBackups();
      } else {
        showToast("فشلت عملية التراجع", "error");
      }
    } catch (err) {
      showToast("خطأ أثناء الاتصال بالنظام للتراجع", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApi = async () => {
    if (!apiEntity.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/api-generator", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ entityName: apiEntity })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedApi(data);
        showToast("تم توليد واجهة REST API كاملة بجميع أطرافها مع Swagger Docs ✨");
      }
    } catch (err) {
      showToast("حدث خطأ في توليد الـ API", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeReview = async () => {
    if (!reviewCodeInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-developer/code-review", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ code: reviewCodeInput })
      });
      if (res.ok) {
        const data = await res.json();
        setReviewResult(data);
        showToast("تمت مراجعة الكود واستخراج النتائج بنجاح ✨");
      }
    } catch (err) {
      showToast("حدث خطأ أثناء مراجعة الكود", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");

    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-developer/chat", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ question: userMsg, history: chatMessages })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { sender: "ai", text: data.answer || "تمت معالجة الطلب.", sources: data.sources }
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "عذراً، حدث خطأ أثناء الاتصال بمساعد الذكاء الاصطناعي." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Nav Items Definitions
  const navTabs = [
    { id: "dashboard", label: "لوحة التحكم", icon: LayoutGrid, color: "text-indigo-400" },
    { id: "project_analysis", label: "تحليل المشروع", icon: FileCode2, color: "text-cyan-400" },
    { id: "bug_detector", label: "كاشف الأخطاء", icon: Bug, color: "text-rose-400" },
    { id: "security_scanner", label: "فاحص الأمان", icon: ShieldAlert, color: "text-amber-400" },
    { id: "performance_analyzer", label: "محلل الأداء", icon: Activity, color: "text-emerald-400" },
    { id: "database_optimizer", label: "تحسين القواعد", icon: Database, color: "text-purple-400" },
    { id: "feature_generator", label: "مولد الميزات", icon: Sparkles, color: "text-indigo-400" },
    { id: "api_generator", label: "مولد APIs", icon: Code2, color: "text-cyan-400" },
    { id: "ui_generator", label: "مولد الواجهات", icon: Palette, color: "text-pink-400" },
    { id: "doc_generator", label: "مولد التوثيق", icon: BookOpen, color: "text-blue-400" },
    { id: "test_generator", label: "الاختبارات", icon: TestTube2, color: "text-emerald-400" },
    { id: "code_review", label: "مراجعة الكود", icon: CheckSquare, color: "text-violet-400" },
    { id: "ai_chat", label: "مساعد AI Chat", icon: MessageSquare, color: "text-amber-400" },
    { id: "sandbox", label: "بيئة Sandbox", icon: GitBranch, color: "text-indigo-400" },
    { id: "audit_log", label: "سجل العمليات", icon: History, color: "text-slate-400" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans dir-rtl" dir="rtl">
      {/* Toast Bar */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 border ${
              toastMsg.type === "error"
                ? "bg-rose-900/90 border-rose-500 text-rose-100"
                : toastMsg.type === "info"
                ? "bg-blue-900/90 border-blue-500 text-blue-100"
                : "bg-emerald-900/90 border-emerald-500 text-emerald-100"
            }`}
          >
            <Sparkles className="w-5 h-5 shrink-0" />
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400 shadow-lg shadow-indigo-500/10">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                AI Developer Center
              </h1>
              <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                REMO PRO ERP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              مركز التطوير الذكي، تحليل المشروع، اكتشاف الأخطاء، بيئة الاختبار المأمونة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            تحديث
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 px-4 py-2 rounded-xl text-xs font-medium border border-rose-500/30 transition"
            >
              العودة للرئيسية
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 bg-slate-900/60 border-l border-slate-800 p-3 flex flex-col gap-1 overflow-y-auto shrink-0">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            وحدات وأدوات التطوير
          </div>
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-right ${
                  isActive
                    ? "bg-indigo-600/20 border border-indigo-500/50 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${tab.color}`} />
                <span className="truncate">{tab.label}</span>
                {isActive && (
                  <motion.div layoutId="activeDot" className="mr-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Content View */}
        <main className="flex-1 bg-slate-950 p-6 overflow-y-auto">
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <LayoutGrid className="w-6 h-6 text-indigo-400" />
                    لوحة تحكم مركز تطوير الذكاء الاصطناعي
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    نظرة شاملة ومؤشرات أداء وهيكلية مشروع REMO PRO ERP
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("feature_generator")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  إنشاء ميزة جديدة عبر AI
                </button>
              </div>

              {/* Stats Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>عدد ملفات المشروع</span>
                    <FileCode2 className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-100">
                    {dashboardData?.totalFiles || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">ملفات مصنفة بالكامل</div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>عدد أسطر الكود</span>
                    <Terminal className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-100">
                    {(dashboardData?.totalLines || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">سطر بررمجي نشط</div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>الأخطاء المحتملة</span>
                    <Bug className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-rose-400">
                    {dashboardData?.potentialBugsCount || 0}
                  </div>
                  <div className="text-[10px] text-rose-500/80 mt-1">تستوجب المراجعة</div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>مستوى الأمان</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-400">
                    {dashboardData?.securityScore || 100}%
                  </div>
                  <div className="text-[10px] text-emerald-500/80 mt-1">حماية عالية</div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>مستوى الأداء</span>
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-amber-400">
                    {dashboardData?.performanceScore || 90}%
                  </div>
                  <div className="text-[10px] text-amber-500/80 mt-1">استجابة سريعة</div>
                </div>
              </div>

              {/* Status Row */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">آخر عملية تحليل</div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      {dashboardData?.lastAnalysisTime || "—"}
                    </div>
                  </div>
                  <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">الاقتراحات الجديدة</div>
                    <div className="text-sm font-semibold text-cyan-400 mt-1">
                      {dashboardData?.newSuggestionsCount || 0} اقتراحات
                    </div>
                  </div>
                  <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">التعديلات المعلقة (Sandbox)</div>
                    <div className="text-sm font-semibold text-amber-400 mt-1">
                      {dashboardData?.pendingChangesCount || 0} تعديلات
                    </div>
                  </div>
                  <GitBranch className="w-5 h-5 text-amber-400 shrink-0" />
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">حالة الاختبارات</div>
                    <div className="text-sm font-semibold text-emerald-400 mt-1">
                      {dashboardData?.testStatus || "ناجحة"}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>
              </div>

              {/* Recent AI Activity Log */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-400" />
                    سجل آخر عمليات الذكاء الاصطناعي والتغييرات
                  </h3>
                  <button
                    onClick={() => setActiveTab("audit_log")}
                    className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    عرض السجل الكامل <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {(dashboardData?.recentActivity || []).length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      لا توجد عمليات سابقة مسجلة. جرب تشغيل تحليل أو توليد ميزة جديدة.
                    </div>
                  ) : (
                    dashboardData?.recentActivity.map((log: any) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action_type === "MERGE"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : log.action_type === "ROLLBACK"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {log.action_type}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-200">{log.title}</div>
                            <div className="text-slate-400 text-[10px] mt-0.5">
                              الملفات المتأثرة: {log.affected_files || "غير محددة"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-slate-500 text-[10px]">
                          <div>{new Date((log.created_at) || 0).toLocaleString("ar-EG")}</div>
                          <div className="text-slate-400">{log.user_name || "المدير"}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECT ANALYSIS */}
          {activeTab === "project_analysis" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <FileCode2 className="w-6 h-6 text-cyan-400" />
                    تحليل المشروع الكامل (Project Analysis)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    فحص الملفات المكررة، الكود القديم، الملفات الضخمة والاستعلامات
                  </p>
                </div>
                <button
                  onClick={fetchProjectAnalysis}
                  disabled={loading}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  إعادة التحليل الكامل
                </button>
              </div>

              {/* AI Summary Banner */}
              {analysisData?.aiSummary && (
                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 text-xs text-indigo-200 leading-relaxed flex gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-indigo-300 mb-1">التقرير التحليلي من الذكاء الاصطناعي:</div>
                    {analysisData.aiSummary}
                  </div>
                </div>
              )}

              {/* Priorities Grid */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  اقتراحات التحسين مرتبة حسب الأولوية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(analysisData?.prioritizedSuggestions || []).map((item: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-200">{item.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.priority === "عالية"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          أولوية {item.priority}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1">الأثر: {item.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Huge Files */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    الملفات الضخمة (&gt; 300 سطر)
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pl-1">
                    {(analysisData?.hugeFiles || []).map((f: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl text-xs border border-slate-800/60"
                      >
                        <span className="truncate text-slate-300 font-mono dir-ltr">{f.path}</span>
                        <span className="text-cyan-400 font-bold shrink-0 ml-2">{f.lines} سطر</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slow Queries & Legacy Code */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    ملاحظات المعمارية والاستعلامات
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pl-1 text-xs">
                    {(analysisData?.architecturalIssues || []).map((iss: string, idx: number) => (
                      <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 text-slate-300">
                        {iss}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BUG DETECTOR */}
          {activeTab === "bug_detector" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <Bug className="w-6 h-6 text-rose-400" />
                    كاشف الأخطاء البرمجية (Bug Detector)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Null Reference, SQL Errors, Infinite Loop, Missing Validation, Unhandled Exceptions
                  </p>
                </div>
                <button
                  onClick={fetchBugDetector}
                  disabled={loading}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  إعادة فحص الكود
                </button>
              </div>

              {/* Bug Detector Results */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-slate-400">
                    تم اكتشاف <strong className="text-rose-400">{bugData?.totalBugsFound || 0}</strong> مشكلة محتملة
                  </span>
                </div>

                <div className="space-y-3">
                  {(bugData?.bugsList || []).map((bug: any) => (
                    <div
                      key={bug.id}
                      className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-rose-400 font-bold">{bug.id}</span>
                          <span className="font-bold text-slate-200">{bug.type}</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            bug.severity === "حرج"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          شدة {bug.severity}
                        </span>
                      </div>

                      <div className="text-slate-400 text-[11px] font-mono dir-ltr">
                        📍 {bug.file} {bug.line ? `: السطر ${bug.line}` : ""}
                      </div>

                      {bug.snippet && (
                        <pre className="bg-slate-900 p-2 rounded text-[11px] text-slate-300 font-mono overflow-x-auto dir-ltr">
                          {bug.snippet}
                        </pre>
                      )}

                      <div className="text-slate-300 mt-1">
                        <strong>السبب:</strong> {bug.cause}
                      </div>

                      <div className="bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-lg text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <strong>الحل المقترح:</strong> {bug.fix}
                        </div>
                        <button
                          onClick={() => handleAutoFixBug(bug)}
                          disabled={fixingBugId !== null}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-2 transition duration-200 shrink-0 self-start sm:self-center"
                        >
                          {fixingBugId === bug.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                          )}
                          {fixingBugId === bug.id ? "جاري الإصلاح..." : "إصلاح تلقائي عبر AI"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY SCANNER */}
          {activeTab === "security_scanner" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-amber-400" />
                    فاحص الأمان والثغرات (Security Scanner)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    SQL Injection, XSS, CSRF, JWT Security, API Security, File Upload Security
                  </p>
                </div>
                <button
                  onClick={fetchSecurityScanner}
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  إعادة فحص الثغرات
                </button>
              </div>

              {/* Security Meter */}
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">مستوى أمان النظام الإجمالي</div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                    {securityData?.securityScore || 94}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    النظام محمي ومطبق لمعايير الأمن السيبراني
                  </div>
                </div>
                <ShieldCheck className="w-16 h-16 text-emerald-400/80" />
              </div>

              {/* Vulnerabilities List */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-4">نتائج الفحص والتوصيات الأمنية</h3>
                <div className="space-y-3">
                  {(securityData?.vulnerabilities || []).map((sec: any) => (
                    <div
                      key={sec.id}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">{sec.category}</span>
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                          {sec.severity}
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-[11px] dir-ltr">
                        {sec.file}
                      </div>
                      <p className="text-slate-300">{sec.description}</p>
                      <div className="bg-indigo-950/30 border border-indigo-500/20 p-2 rounded text-indigo-200">
                        <strong>التأمين المطلوبة:</strong> {sec.remedy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PERFORMANCE ANALYZER */}
          {activeTab === "performance_analyzer" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-emerald-400" />
                    محلل الأداء والاستهلاك (Performance Analyzer)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    سرعة التحميل، زمن استعلامات PostgreSQL، استهلاك RAM/CPU
                  </p>
                </div>
                <button
                  onClick={fetchPerformance}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  تحديث قياس الأداء
                </button>
              </div>

              {/* Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-xs text-slate-400 mb-1">سرعة استجابة الشاشات</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {performanceData?.pageLoadSpeedMs || 320} ms
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">ممتازة (أقل من 500ms)</div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-xs text-slate-400 mb-1">متوسط زمن SQL Query</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {performanceData?.avgDbQueryTimeMs || 4.2} ms
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">استعلامات سريعة جداً</div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-xs text-slate-400 mb-1">استهلاك الذاكرة (RAM)</div>
                  <div className="text-2xl font-bold text-indigo-400">
                    {performanceData?.ramUsageMB || 120} MB
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    من أصل {performanceData?.ramTotalMB || 4096} MB ({performanceData?.ramPercent || 3}%)
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <div className="text-xs text-slate-400 mb-1">أنوية المعالج CPU</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {performanceData?.cpuCores || 4} Cores
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {performanceData?.cpuModel || "Cloud Engine"}
                  </div>
                </div>
              </div>

              {/* Slowest Routes */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-3">أكثر المسارات استهلاكاً للوقت والتوصيات</h3>
                <div className="space-y-2">
                  {(performanceData?.slowestRoutes || []).map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs"
                    >
                      <div className="font-mono text-cyan-300 dir-ltr">{r.route}</div>
                      <div className="text-slate-300">التوصية: {r.recommendation}</div>
                      <span className="text-amber-400 font-bold">{r.avgTimeMs} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DATABASE OPTIMIZER */}
          {activeTab === "database_optimizer" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <Database className="w-6 h-6 text-purple-400" />
                    محلل ومحسن قواعد البيانات (Database Optimizer)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    فهارس جديدة (Indexes)، تحسين العلاقات، أرشفة الجداول الكبيرة
                  </p>
                </div>
                <button
                  onClick={fetchDbOptimizer}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  إعادة تحليل القواعد
                </button>
              </div>

              {/* Missing Indexes */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  الفهارس الموصى بإنشائها (Missing Indexes)
                </h3>
                <div className="space-y-3">
                  {(dbOptimizationData?.missingIndexes || []).map((idx: any, i: number) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-300">
                          الجدول: {idx.table} (العمود: {idx.column})
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(idx.sql);
                            showToast("تم نسخ أمر SQL لإنشاء الفهرس ✨");
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> نسخ SQL
                        </button>
                      </div>
                      <p className="text-slate-400">{idx.reason}</p>
                      <pre className="bg-slate-900 p-2 rounded text-[11px] text-cyan-300 font-mono dir-ltr">
                        {idx.sql}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: FEATURE GENERATOR */}
          {activeTab === "feature_generator" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                  مولد الميزات والخصائص الذكي (Feature Generator)
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  اكتب وصفاً بأي ميزة تريدها (مثل: "أضف نظام إدارة الأصول") ليقوم الذكاء الاصطناعي ببنائها بالكامل
                </p>
              </div>

              {/* Prompt Input Box */}
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                <label className="block text-xs font-bold text-slate-300">وصف الميزة أو المطلوب إضافة للنظام:</label>
                <textarea
                  value={featurePrompt ?? ""}
                  onChange={(e) => setFeaturePrompt(e.target.value)}
                  placeholder="مثال: أضف نظام إدارة الأصول الثابتة والمعدات وإهلاكها السنوي مع الربط بالحسابات العامة"
                  className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />

                <button
                  onClick={handleGenerateFeature}
                  disabled={loading || !featurePrompt.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  <Sparkles className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "جاري التوليد والتحليل بالذكاء الاصطناعي..." : "توليد كود الميزة والهيكل بالكامل"}
                </button>
              </div>

              {/* Generated Files Preview */}
              {generatedFeature && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-indigo-300">{generatedFeature.featureTitle}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{generatedFeature.summary}</p>
                    </div>

                    <button
                      onClick={handleStageFeatureToSandbox}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      <GitBranch className="w-4 h-4" />
                      تجهيز في البيئة المؤقتة (Sandbox)
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-300">الملفات التي سيتم إنشاؤها:</div>
                    {(generatedFeature.filesToCreate || []).map((f: any, i: number) => (
                      <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-cyan-300 dir-ltr">{f.name}</span>
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                            {f.type}
                          </span>
                        </div>
                        <pre className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto dir-ltr">
                          {f.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: API GENERATOR */}
          {activeTab === "api_generator" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Code2 className="w-6 h-6 text-cyan-400" />
                  مولد واجهات البرمجة (API Generator)
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  توليد CRUD Operations كاملة مع Validation و Pagination و Swagger Docs
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex gap-3">
                <input
                  type="text"
                  value={apiEntity ?? ""}
                  onChange={(e) => setApiEntity(e.target.value)}
                  placeholder="اسم الكيان أو الموديول (مثال: inventory_items أو maintenance_requests)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleGenerateApi}
                  disabled={loading || !apiEntity.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Code2 className="w-4 h-4" />
                  توليد REST API
                </button>
              </div>

              {generatedApi && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-base font-bold text-cyan-300">
                    واجهة البرمجة لـ: {generatedApi.entity} ({generatedApi.baseRoute})
                  </h3>

                  <div className="space-y-2">
                    {generatedApi.endpoints.map((ep: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              ep.method === "GET"
                                ? "bg-blue-500/20 text-blue-300"
                                : ep.method === "POST"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {ep.method}
                          </span>
                          <span className="text-slate-200 dir-ltr">{ep.path}</span>
                        </div>
                        <span className="text-slate-400">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 9: UI GENERATOR */}
          {activeTab === "ui_generator" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Palette className="w-6 h-6 text-pink-400" />
                  مولد الواجهات البصرية (UI Generator)
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  إنشاء Data Tables و Forms متناسقة مع أسلوب وتصميم REMO PRO ERP
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl text-center space-y-4">
                <Palette className="w-12 h-12 text-pink-400 mx-auto" />
                <h3 className="text-lg font-bold text-slate-200">مولد واجهات REMO PRO UI</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  تتم الاستعانة بـ Tailwind CSS و Lucide Icons لصياغة الجداول الاستعراضية، الفلاتر المتجاوبة، ونماذج البيانات الداعمة للوضع الداكن Dark Mode.
                </p>
                <button
                  onClick={() => {
                    setActiveTab("feature_generator");
                    setFeaturePrompt("أنشئ واجهة جدول بيانات تفاعلية مع البحث والفلترة والوضع المظلم");
                  }}
                  className="bg-pink-600 hover:bg-pink-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  بدء توليد شاشة تفاعلية
                </button>
              </div>
            </div>
          )}

          {/* TAB 10: DOCUMENTATION */}
          {activeTab === "doc_generator" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-blue-400" />
                    مولد التوثيق (Documentation Generator)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    User Guide, Developer Guide, API Specs, Database Documentation, Change Log
                  </p>
                </div>
                <button
                  onClick={fetchDocs}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  تحديث التوثيق
                </button>
              </div>

              {docsData && (
                <div className="space-y-4">
                  <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl text-xs space-y-2">
                    <h3 className="text-sm font-bold text-blue-300">دليل المستخدم والنظام</h3>
                    <pre className="bg-slate-950 p-3 rounded font-mono text-slate-300 text-[11px] whitespace-pre-wrap">
                      {docsData.userGuide}
                    </pre>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl text-xs space-y-2">
                    <h3 className="text-sm font-bold text-indigo-300">دليل المطور والمعمارية</h3>
                    <pre className="bg-slate-950 p-3 rounded font-mono text-slate-300 text-[11px] whitespace-pre-wrap">
                      {docsData.developerGuide}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 11: TESTS */}
          {activeTab === "test_generator" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <TestTube2 className="w-6 h-6 text-emerald-400" />
                    منصة الاختبارات الأوتوماتيكية (Test Runner)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Unit Tests, Integration Tests, API Tests, UI Component Tests
                  </p>
                </div>
                <button
                  onClick={fetchRunTests}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  تشغيل كافة الاختبارات
                </button>
              </div>

              {testData && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        اختبارات ناجحة: <strong className="text-emerald-400">{testData.passedCount}</strong>
                      </div>
                      <div>
                        اختبارات فاشلة: <strong className="text-rose-400">{testData.failedCount}</strong>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">الزمن المستغرق: {testData.totalDurationMs} ms</span>
                  </div>

                  <div className="space-y-2">
                    {testData.tests.map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-slate-200">{t.name}</span>
                          <span className="text-slate-500">({t.suite})</span>
                        </div>
                        <span className="text-emerald-400 font-mono">{t.durationMs} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 12: CODE REVIEW */}
          {activeTab === "code_review" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <CheckSquare className="w-6 h-6 text-violet-400" />
                  مراجعة الكود البرمجي (Code Review)
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  تقييم جودة الكود، الأداء، الأمان، والتنظيم المعتمد
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                <label className="block text-xs font-bold text-slate-300">الصق الكود البرمجي المراد مراجعته:</label>
                <textarea
                  value={reviewCodeInput ?? ""}
                  onChange={(e) => setReviewCodeInput(e.target.value)}
                  placeholder="// Paste TypeScript or React code here..."
                  className="w-full h-40 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-violet-500 dir-ltr"
                />
                <button
                  onClick={handleCodeReview}
                  disabled={loading || !reviewCodeInput.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  بدء مراجعة الكود
                </button>
              </div>

              {reviewResult && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">النتيجة والتقييم:</span>
                    <span className="text-emerald-400 font-extrabold text-lg">{reviewResult.score} / 100</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{reviewResult.reviewSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 13: AI CHAT */}
          {activeTab === "ai_chat" && (
            <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  المساعد الذكي لبنية الكود وقواعد البيانات
                </h2>
                <p className="text-slate-400 text-xs">
                  اسأل المساعد الذكي عن أي جزء في النظام، الاستعلامات، الجداول، وأسباب البطء
                </p>
              </div>

              {/* Chat Window */}
              <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl p-3.5 text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none"
                      }`}
                    >
                      {msg.text}

                      {msg.sources && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-2">
                          <span>المصادر:</span>
                          {msg.sources.map((s, idx) => (
                            <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Prompt Suggestions Chips */}
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <button
                  onClick={() => setChatInput("لماذا هذه الصفحة بطيئة؟")}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-full text-[11px] shrink-0"
                >
                  لماذا هذه الصفحة بطيئة؟
                </button>
                <button
                  onClick={() => setChatInput("أين يتم استخدام جدول orders؟")}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-full text-[11px] shrink-0"
                >
                  أين يتم استخدام هذا الجدول؟
                </button>
                <button
                  onClick={() => setChatInput("ما تأثير حذف عمود status من hr_job_postings؟")}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-full text-[11px] shrink-0"
                >
                  ما تأثير حذف هذا العمود؟
                </button>
              </div>

              {/* Input Box */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput ?? ""}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                  placeholder="اكتب سؤالك عن الكود أو قاعدة البيانات..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSendChatMessage}
                  disabled={loading || !chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 14: SANDBOX */}
          {activeTab === "sandbox" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <GitBranch className="w-6 h-6 text-indigo-400" />
                  بيئة التطبيق والتطوير المأمونة (Development Sandbox)
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  عرض الفروقات (Diff)، اختبار تأثير قاعدة البيانات، والتطبيق المأمون بعد الموافقة
                </p>
              </div>

              {!stagedFeature ? (
                <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-2xl text-center space-y-3">
                  <GitBranch className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-300">لا توجد ميزة مجهزة حالياً للدمج</h3>
                  <p className="text-xs text-slate-500">
                    يمكنك توليد ميزة عبر "مولد الميزات" ثم الضغط على "تجهيز في البيئة المؤقتة Sandbox" لمراجعتها هنا.
                  </p>
                  <button
                    onClick={() => setActiveTab("feature_generator")}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    الذهاب لمولد الميزات
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-indigo-300">{stagedFeature.feature_name}</h3>
                      <p className="text-xs text-slate-400 mt-1">الحالة: مجهزة للدمج المأمون (Staged)</p>
                    </div>

                    <button
                      onClick={handleApplySandboxMerge}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      تأكيد وموافقة الدمج في المشروع الرئيسي
                    </button>
                  </div>

                  {/* Diff Preview */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300">معاينة الفروقات الكودية (Diff View):</div>
                    <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 max-h-80 overflow-y-auto dir-ltr">
                      {stagedFeature.diff_preview}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 15: AUDIT LOG */}
          {activeTab === "audit_log" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <History className="w-6 h-6 text-slate-400" />
                    سجل العمليات والنسخ الاحتياطية (Audit &amp; Rollback)
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    تاريخ عمليات الذكاء الاصطناعي مع إمكانية استرجاع أي إصدار سابق
                  </p>
                </div>
                <button
                  onClick={() => handleRollback()}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  التراجع عن آخر عملية دمج
                </button>
              </div>

              {/* Logs Table */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{log.title}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          بواسطة: {log.user_name || "المدير"} | الملفات: {log.affected_files || "عامة"}
                        </div>
                      </div>
                      <div className="text-right text-slate-500 text-[11px]">
                        <div>{new Date((log.created_at) || 0).toLocaleString("ar-EG")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
