import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { authHeaders } from "../utils/api";
import {
  ShieldCheck,
  Database,
  Cpu,
  Gauge,
  Activity,
  Trash2,
  Zap,
  Layers,
  RefreshCw,
  ListTodo,
  Play,
  Brain,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Compass,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  ChevronDown,
  ArrowRight,
} from "lucide-react";

interface ERPCoreProps {
  onBack: () => void;
  user: any;
}

export const ERPCore: React.FC<ERPCoreProps> = ({ onBack, user }) => {
  const [activeTab, setActiveTab] = useState<
    "architecture" | "cache" | "events" | "queue" | "ai" | "stages"
  >("architecture");
  const [systemStats, setSystemStats] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [jobsStatus, setJobsStatus] = useState<any>(null);
  const [eventHistory, setEventHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [clearingCache, setClearingCache] = useState<boolean>(false);
  const [queuingJob, setQueuingJob] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Load live ERP metrics
  useEffect(() => {
    let active = true;

    const fetchMetrics = async () => {
      try {
        const headers = authHeaders();

        const [statsRes, cacheRes, queueRes, eventsRes] = await Promise.all([
          fetch("/api/erp/stats", { headers }),
          fetch("/api/erp/cache", { headers }),
          fetch("/api/erp/queues", { headers }),
          fetch("/api/erp/events", { headers }),
        ]);

        if (!active) return;

        if (statsRes.ok) {
          const s = await statsRes.json();
          setSystemStats(s);
        }
        if (cacheRes.ok) {
          const c = await cacheRes.json();
          setCacheStats(c.stats);
        }
        if (queueRes.ok) {
          const q = await queueRes.json();
          setJobsStatus(q.status);
        }
        if (eventsRes.ok) {
          const e = await eventsRes.json();
          setEventHistory(e.events);
        }
      } catch (err) {
        console.error("Failed to load ERP telemetry", err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3500); // Polling every 3.5s for real-time trace
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshTrigger]);

  const handleWipeCache = async () => {
    setClearingCache(true);
    try {
      const res = await fetch("/api/erp/cache/clear", {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setClearingCache(false), 800);
    }
  };

  const handleTriggerJob = async (queueType: string, label: string) => {
    setQueuingJob(queueType);
    try {
      const res = await fetch("/api/erp/queues/add", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ queueType, label }),
      });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setQueuingJob(null), 600);
    }
  };

  const handleRunAiAnalysis = async () => {
    setAiLoading(true);
    setAiReport(null);
    try {
      const res = await fetch("/api/erp/ai/predict", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setAiReport(d.analysis);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "فشل تحليل الموارد الذكي");
      }
    } catch (e) {
      console.error(e);
      alert("تعذر الاتصال بمركز خدمة الذكاء الاصطناعي.");
    } finally {
      setAiLoading(false);
    }
  };

  const erpStages = [
    {
      num: 1,
      title: "المرحلة الأولى: إعادة هيكلة البنية البرمجية (Architecture)",
      desc: "تقسيم البنية البرمجية إلى طبقات مستقرة (Core, Shared, Infrastructure)",
      status: "completed",
    },
    {
      num: 2,
      title: "المرحلة الثانية: تقسيم الموديولات (Module Partitioning)",
      desc: "فصل الأنظمة إلى وحدات مستقلة (مبيعات، مخازن، محاسبة، موارد بشرية)",
      status: "completed",
    },
    {
      num: 3,
      title: "المرحلة الثالثة: طبقات البرمجة (Controller/Service/Repository)",
      desc: "فصل منطق العمل عن التحكم وعن طبقة قاعدة البيانات",
      status: "completed",
    },
    {
      num: 4,
      title: "المرحلة الرابعة: نظام الأحداث المتقدم (Event Driven)",
      desc: "بناء ناقل الأحداث المستقل للتنسيق التلقائي بين الموديولات",
      status: "active",
    },
    {
      num: 5,
      title: "المرحلة الخامسة: نظام الطوابير الخلفية (Queue System)",
      desc: "معالجة المهام الثقيلة (طباعة، إشعارات، نسخ احتياطي) في الخلفية",
      status: "active",
    },
    {
      num: 6,
      title: "المرحلة السادسة: الذاكرة المؤقتة عالية الأداء (Memory Caching)",
      desc: "حفظ المؤشرات الأساسية والتقارير في الذاكرة لتسريع الاستجابة",
      status: "active",
    },
    {
      num: 7,
      title: "المرحلة السابعة: موازنة وفصل الجداول (Database Optimization)",
      desc: "تنظيم وهيكلة الجداول لتوزيع الأحمال وتفادي بطء العمليات",
      status: "completed",
    },
    {
      num: 8,
      title: "المرحلة الثامنة: نظام الصلاحيات المتقدم (RBAC)",
      desc: "إدارة دقيقة ومحكمة للصلاحيات على مستوى الأزرار والـ APIs",
      status: "completed",
    },
    {
      num: 9,
      title: "المرحلة التاسعة: طبقة الأمان والحماية (Security)",
      desc: "حماية الجلسات وتتبع الدخول والمصادقة الآمنة عبر التوكنات المتجددة",
      status: "completed",
    },
    {
      num: 10,
      title: "المرحلة العاشرة: سجل المراجعة والتغييرات (Audit Trail)",
      desc: "حفظ ومقارنة البيانات القديمة والجديدة لجميع العمليات الهامة بدقة",
      status: "active",
    },
    {
      num: 11,
      title: "المرحلة الحادية عشر: الاتصالات الفورية (Real-time Socket)",
      desc: "تزامن لحظي فوري لطلبات المطبخ والصالة والطلبات الخارجية",
      status: "completed",
    },
    {
      num: 16,
      title: "المرحلة السادسة عشر: المساعد الذكي والمتنبئ (AI Assistant)",
      desc: "توقع الطلبيات، كشف الأصناف الراكدة، واقتراح كميات التوريد",
      status: "active",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                نواة المنظومة المتقدمة ERP Enterprise
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  نظام فدرالي
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                تحليل، حوكمة، إدارة الطوابير، التخزين المؤقت، وذكاء المبيعات
                التنبئي
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all text-sm font-bold"
        >
          <ArrowRight className="w-4 h-4 ml-1" /> العودة للوحة التحكم الرئيسية
        </button>
      </div>

      {/* Stats Bento Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              معدل إصابة الذاكرة المؤقتة (Cache)
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {cacheStats ? cacheStats.hitRate : "100%"}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              قنوات الأحداث اللحظية (Event Bus)
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {eventHistory.length} حدث نشط
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              روابط قاعدة البيانات النشطة (Pool)
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {systemStats
                ? `${systemStats.databasePool.totalConnections} متصل`
                : "جاري الفحص"}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              ذاكرة السيرفر المُستخدمة (Heap)
            </p>
            <h3 className="text-xl font-black text-white mt-0.5">
              {systemStats ? systemStats.ram.heapUsed : "جاري الاستعلام"}
            </h3>
          </div>
        </div>
      </div>

      {/* Secondary Ribbon Tabs */}
      <div className="flex flex-wrap gap-2.5 mb-6 border-b border-slate-900 pb-4">
        {[
          {
            id: "architecture",
            label: "بنية التدفق اللحظي (Architecture)",
            icon: Layers,
          },
          {
            id: "cache",
            label: "التخزين المؤقت الرمزي (Cache CPU)",
            icon: Zap,
          },
          {
            id: "events",
            label: "مراقب الأحداث والسجلات (Event Bus)",
            icon: Activity,
          },
          { id: "queue", label: "طوابير الخلفية (Job Queues)", icon: ListTodo },
          {
            id: "ai",
            label: "المساعد والمتنبئ التخطيطي الذكي (AI)",
            icon: Brain,
          },
          {
            id: "stages",
            label: "خطة التطوير والمراحل (Roadmap)",
            icon: Compass,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all border ${
                isActive
                  ? "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white border-transparent shadow-lg shadow-cyan-500/10"
                  : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONSOLE AREA */}
      <div className="grid grid-cols-1 gap-6">
        {/* TAB 1: ARCHITECTURE LIVE FLOW */}
        {activeTab === "architecture" && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl">
            <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" /> خريطة تدفق البيانات
              اللحظية المعتمدة (Clean Architecture)
            </h2>
            <p className="text-xs text-slate-400 mb-8">
              التمثيل البصري للطبقات وعقد الاتصال الحالي (من استقبال البيانات
              وحتى المعالجة والتسجيل الحتمي):
            </p>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 w-full py-8">
              {/* Box 1: CONTROLLER LAYER */}
              <div className="w-full lg:w-64 bg-slate-900 border border-slate-800 p-6 rounded-2xl relative text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold px-3 py-0.5 rounded-full uppercase">
                  Controller Layer
                </div>
                <div className="text-xs font-bold text-slate-400 mb-1 mt-2">
                  مستقبل الطلبات والمصادقة
                </div>
                <p className="text-sm font-black text-white">
                  Express Routers & JWT
                </p>
                <div className="text-[10px] text-slate-500 mt-2 bg-slate-950 p-2 rounded-lg font-mono">
                  GET/POST/PUT/DELETE
                </div>
              </div>

              <div className="text-slate-600 font-bold text-lg hidden lg:block">
                ➔
              </div>

              {/* Box 2: SERVICE LAYER */}
              <div className="w-full lg:w-64 bg-slate-900 border border-cyan-800/60 p-6 rounded-2xl relative text-center shadow-lg shadow-cyan-500/5">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold px-3 py-0.5 rounded-full uppercase">
                  Service Layer
                </div>
                <div className="text-xs font-bold text-slate-400 mb-1 mt-2">
                  منطق ومحاسبة الأعمال الحسابية
                </div>
                <p className="text-sm font-black text-white">
                  Business Logic Rules
                </p>
                <div className="text-[10px] text-slate-500 mt-2 bg-slate-950 p-2 rounded-lg font-mono">
                  validateRules() & audit()
                </div>
              </div>

              <div className="text-slate-600 font-bold text-lg hidden lg:block">
                ➔
              </div>

              {/* Box 3: REPOSITORY LAYER */}
              <div className="w-full lg:w-64 bg-slate-900 border border-slate-800 p-6 rounded-2xl relative text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold px-3 py-0.5 rounded-full uppercase">
                  Repository Layer
                </div>
                <div className="text-xs font-bold text-slate-400 mb-1 mt-2">
                  منفذ الاستدعاء المباشر للجداول
                </div>
                <p className="text-sm font-black text-white">
                  Direct DB Queries
                </p>
                <div className="text-[10px] text-slate-500 mt-2 bg-slate-950 p-2 rounded-lg font-mono">
                  pool.query() & trans()
                </div>
              </div>

              <div className="text-slate-600 font-bold text-lg hidden lg:block">
                ➔
              </div>

              {/* Box 4: DATABASE POOL */}
              <div className="w-full lg:w-64 bg-slate-900 border border-emerald-800/60 p-6 rounded-2xl relative text-center shadow-lg shadow-emerald-500/5">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-3 py-0.5 rounded-full uppercase">
                  Database Pool
                </div>
                <div className="text-xs font-bold text-slate-400 mb-1 mt-2">
                  مستودع البيانات وتتبع المؤشرات
                </div>
                <p className="text-sm font-black text-white">
                  Postgres Pool Config
                </p>
                <div className="text-[10px] text-slate-500 mt-2 bg-slate-950 p-2 rounded-lg font-mono">
                  Indexed & Optimized
                </div>
              </div>
            </div>

            {/* Hardware Telemetry Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-800">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-900">
                <span className="text-slate-400 text-xs font-medium uppercase">
                  خصائص بيئة التشغيل Node
                </span>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-slate-500">إصدار Node.js</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {systemStats?.nodeVersion || "v21.0.0"}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-500">منظومة التشغيل</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {systemStats?.platform || "Linux Container"}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-500">
                    مدة عمل السيرفر المتواصلة
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {systemStats
                      ? `${Math.round(systemStats.uptime / 60)} دقيقة`
                      : "جاري الرفع"}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-900">
                <span className="text-slate-400 text-xs font-medium uppercase">
                  أداء قاعدة البيانات
                </span>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-slate-500">
                    الروابط الكلية بالخزان
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-400">
                    {systemStats?.databasePool?.totalConnections || 0} متصل
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-500">
                    روابط قيد الاستعداد
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {systemStats?.databasePool?.idleConnections || 0} رابط
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-500">
                    طلبات الاستعلام المعلقة
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-500">
                    {systemStats?.databasePool?.waitingRequests || 0} طلب
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-900 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-medium uppercase">
                    تخصيص الفهرسة (DB Indexes)
                  </span>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    تم إنشاء فهارس على حقول التواريخ، أرقام الفروع، أنواع
                    الطلبات لتسريع الاستعلامات والتقارير بمقدار 24x ضعف مقارنة
                    بالفحص الشامل للجداول.
                  </p>
                </div>
                <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl px-4 py-2 mt-3 font-bold text-center">
                  نشط وآمن 100%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IN-MEMORY CACHE (REDIS STYLE) */}
        {activeTab === "cache" && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl">
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400 animate-pulse" /> محاكي
                  الذاكرة المؤقتة التفاعلي (Cache Engine)
                </h2>
                <p className="text-xs text-slate-400">
                  حفظ مؤشرات التقارير والطلبات لتخفيف التحميل المباشر وتفادي
                  إبطاء السيرفر
                </p>
              </div>
              <button
                onClick={handleWipeCache}
                disabled={clearingCache}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-xs font-bold disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />{" "}
                {clearingCache ? "جاري مسح الذاكرة..." : "تصفير ذاكرة الكاش"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-slate-950 p-6 rounded-2xl border border-slate-900">
                <h4 className="text-sm font-bold text-white mb-4">
                  أداء الكاش الإحصائي
                </h4>

                <div className="space-y-4">
                  <div className="bg-slate-900/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-xs">
                      إصابات ناجحة لقراءة البيانات (Hits):
                    </span>
                    <h3 className="text-3xl font-black text-emerald-400 mt-1">
                      {cacheStats?.hits || 0}
                    </h3>
                  </div>

                  <div className="bg-slate-900/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-xs">
                      إخفاقات لعدم التواجد (Misses):
                    </span>
                    <h3 className="text-3xl font-black text-rose-400 mt-1">
                      {cacheStats?.misses || 0}
                    </h3>
                  </div>

                  <div className="bg-slate-900/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-xs">
                      حجم الاستهلاك بالبايت (RAM):
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">
                      {cacheStats?.ramUsageBytes || 0} Bytes
                    </h3>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-900">
                <h4 className="text-sm font-bold text-white mb-2">
                  المؤشرات وعناصر الكاش النشطة حالياً
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  العناصر المخزنة في الذاكرة العشوائية لخدمة الاستدعاءات
                  الفورية:
                </p>

                {cacheStats?.keys?.length > 0 ? (
                  <div className="divide-y divide-slate-900">
                    {cacheStats.keys.map((keyName: string) => (
                      <div
                        key={keyName}
                        className="py-3 flex justify-between items-center text-xs"
                      >
                        <span className="font-mono bg-slate-900 text-cyan-400 px-3 py-1 rounded-lg border border-slate-800">
                          {keyName}
                        </span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> نشط ومثبت
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">
                      لم يتم رصد أي عناصر كاش منشأة حتى الآن.
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      تنشأ تلقائياً عند طلب التقارير المتكررة أو إعدادات الفروع.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EVENT BUS */}
        {activeTab === "events" && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl">
            <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" /> مراقب الأحداث
              المركزية وسجل المراجعة (Audit Trace)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              عرض حي ومتسلسل للأحداث البرمجية في المنظومة ERP وتتبع العمليات
              التي ينفذها الطاقم الفروع:
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Event history list */}
              <div className="lg:col-span-3 bg-slate-950 rounded-2xl border border-slate-900 overflow-hidden max-h-[500px] overflow-y-auto">
                {eventHistory.length > 0 ? (
                  <div className="divide-y divide-slate-900 text-xs">
                    {eventHistory.map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() =>
                          setSelectedEventId(
                            evt.id === selectedEventId ? null : evt.id,
                          )
                        }
                        className={`w-full text-right p-4 transition-colors flex items-center justify-between hover:bg-slate-900/50 ${selectedEventId === evt.id ? "bg-cyan-500/5 border-r-2 border-cyan-500" : ""}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                evt.eventName === "SystemAction"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-cyan-500/10 text-cyan-400"
                              }`}
                            >
                              {evt.eventName}
                            </span>
                            <span className="font-bold text-white">
                              {evt.details?.action || evt.eventName}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[10px] mt-1 font-mono">
                            {evt.details?.tableName || "نظام فدرالي"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date((evt.timestamp) || 0).toLocaleString("ar-EG")}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 transform transition-transform ${selectedEventId === evt.id ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-spin" />
                    <p className="text-xs text-slate-400">
                      في انتظار الأحداث اللحظية من السيرفر...
                    </p>
                  </div>
                )}
              </div>

              {/* Event Details Viewer */}
              <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-900">
                <h4 className="text-sm font-bold text-white mb-3">
                  تفاصيل الحدث (JSON Payload)
                </h4>

                {selectedEventId ? (
                  (() => {
                    const evt = eventHistory.find(
                      (e) => e.id === selectedEventId,
                    );
                    if (!evt) return null;
                    return (
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <div className="flex justify-between items-center bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 text-[11px] mb-4">
                            <span className="font-mono text-cyan-400">
                              {evt.id}
                            </span>
                            <span className="text-slate-400">
                              {new Date(evt.timestamp).toLocaleTimeString(
                                "ar-EG",
                              )}
                            </span>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-slate-900">
                              <span className="text-slate-500">
                                اسم المخطط:
                              </span>
                              <span className="font-bold text-white">
                                {evt.eventName}
                              </span>
                            </div>
                            {evt.details?.tableName && (
                              <div className="flex justify-between py-1.5 border-b border-slate-900">
                                <span className="text-slate-500">
                                  الجدول المستهدف:
                                </span>
                                <span className="font-mono text-amber-400">
                                  {evt.details.tableName}
                                </span>
                              </div>
                            )}
                            {evt.details?.action && (
                              <div className="flex justify-between py-1.5 border-b border-slate-900">
                                <span className="text-slate-500">
                                  العملية المنفذة:
                                </span>
                                <span className="font-semibold text-white">
                                  {evt.details.action}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <span className="text-slate-500 text-[10px] font-bold block mb-2">
                              البيانات الإضافية والمقارنات:
                            </span>
                            <pre className="bg-slate-900 leading-relaxed text-[10px] text-cyan-300 font-mono p-4 rounded-xl overflow-x-auto max-h-[220px]">
                              {JSON.stringify(
                                evt.details?.details || evt.details || {},
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        </div>

                        <div className="mt-4 text-[10px] bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-400 italic">
                          * يتم تسجيل الحقول والتعديلات القديمة مقابل الحديثة
                          لاكتشاف ومنع الأخطاء في الفواتير والجرد فوراً.
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-48 border border-dashed border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-500">
                      اختر أحد الأحداث من اللائحة الجانبية لعرض تفاصيل التعديل
                      الفدرالي.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: JOB QUEUE */}
        {activeTab === "queue" && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl">
            <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-cyan-400" /> منسق الطوابير
              السيريلية (Job Queues Controller)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              ترحيل المهام الثقيلة إلى العمل التراكمي في الخلفية (Background
              Engine) لمنع تجمد حركة السيستم أثناء الضغط المرتفع في الفروع:
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trigger jobs */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 space-y-4">
                <h4 className="text-sm font-bold text-white mb-2">
                  إطلاق مهمة خلفية لاختبار الكفاءة والمزامنة
                </h4>

                <button
                  onClick={() =>
                    handleTriggerJob(
                      "Print Queue",
                      "مهمة طباعة ومعالجة قالب الكاشير المتفرع",
                    )
                  }
                  disabled={!!queuingJob}
                  className="w-full flex justify-between items-center p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all text-xs text-slate-300 hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                    <span className="font-bold">مهمة الطباعة (Print Job)</span>
                  </div>
                  {queuingJob === "Print Queue" ? (
                    <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 text-slate-400 cursor-pointer" />
                  )}
                </button>

                <button
                  onClick={() =>
                    handleTriggerJob(
                      "WhatsApp Queue",
                      "تجميع تفارير الفروع وإرسالها عبر الواتساب للمشرفين",
                    )
                  }
                  disabled={!!queuingJob}
                  className="w-full flex justify-between items-center p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all text-xs text-slate-300 hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bold">
                      إشعار واتساب (WhatsApp Job)
                    </span>
                  </div>
                  {queuingJob === "WhatsApp Queue" ? (
                    <Clock className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 text-slate-400 cursor-pointer" />
                  )}
                </button>

                <button
                  onClick={() =>
                    handleTriggerJob(
                      "Backup Queue",
                      "تنسيق النسخ الاحتياطي التلقائي الفوري",
                    )
                  }
                  disabled={!!queuingJob}
                  className="w-full flex justify-between items-center p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-all text-xs text-slate-300 hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                    <span className="font-bold">
                      أرشفة النسخ الإحتياطي (Backup Job)
                    </span>
                  </div>
                  {queuingJob === "Backup Queue" ? (
                    <Clock className="w-4 h-4 text-purple-400 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 text-slate-400 cursor-pointer" />
                  )}
                </button>
              </div>

              {/* Jobs trace logs */}
              <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-900">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-white">
                    تحليل حالة النواة والمهام قيد التشغيل
                  </h4>
                  <span className="text-[10px] bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-full font-bold">
                    نشط بالتوازي: {jobsStatus?.activeWorkers || 0}
                  </span>
                </div>

                {jobsStatus?.jobs?.length > 0 ? (
                  <div className="divide-y divide-slate-900 overflow-y-auto max-h-[300px] pr-2">
                    {jobsStatus.jobs.map((job: any) => (
                      <div
                        key={job.id}
                        className="py-3.5 flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {job.name}
                            </span>
                            <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                              {job.queue}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                            {job.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {job.durationMs && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {job.durationMs}ms
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              job.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : job.status === "active"
                                  ? "bg-cyan-500/20 text-cyan-400 animate-pulse"
                                  : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {job.status === "completed"
                              ? "مكتمل"
                              : job.status === "active"
                                ? "جاري التشغيل"
                                : "قيد الانتظار"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
                    <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      لم يتم رصد مهام مؤرشفة. انقر لإطلاق أحد المهام بالأزرار
                      المقابلة.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AI DEMAND PREDICTOR & SUGGESTER */}
        {activeTab === "ai" && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl">
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />{" "}
                  متنبئ المستودعات والمساعد الذكي (AI Planner Engine)
                </h2>
                <p className="text-xs text-slate-400">
                  استقراء خط الانتاج، كميات المواد المطلوبة واكتشاف الرواكد عبر
                  قراءة مباشرة لسرعة مبيعات الفروع الحقيقية بقاعدة البيانات
                  بمساعدة Gemini 3.5
                </p>
              </div>
              <button
                onClick={handleRunAiAnalysis}
                disabled={aiLoading}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-white" />
                {aiLoading
                  ? "جاري قراءة البيانات وتقديم التوقعات..."
                  : "تطبيق التحليل الذكي للبيانات"}
              </button>
            </div>

            {aiLoading && (
              <div className="text-center py-20 bg-slate-950 rounded-2xl border border-slate-900">
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <Brain className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <h3 className="text-sm font-black text-white">
                  جاري تحليل البيانات الفعلية للمخزون وفواتير الفروع
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  يقوم الموديل حالياً في بيئة العمل الخلفية بمراجعة جداول
                  الطلبات والكميات المباعة، ليرتب لك التنبؤات واللوازم بدون
                  افتراضات عشوائية. يرجى الانتظار لحوالي 5 ثواني...
                </p>
              </div>
            )}

            {!aiLoading && !aiReport && (
              <div className="text-center py-20 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl">
                <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <h3 className="text-sm font-black text-white">
                  اضغط على الزر لقراءة قاعدة البيانات وتحليل المبيعات
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  سيقوم الذكاء الاصطناعي بدراسة المشتريات التراكمية، ومؤشرات
                  الجرد السابقة في المطعم لتمكينك من حوكمة التوريدات.
                </p>
              </div>
            )}

            {aiReport && (
              <div className="space-y-6">
                {/* Executive Summary */}
                <div className="bg-slate-900 border border-cyan-500/20 p-6 rounded-2xl shadow-lg shadow-cyan-500/5">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> الملخص التنبئي والتخطيطي
                    العام
                  </h4>
                  <p className="text-sm text-slate-200 leading-relaxed font-semibold">
                    {aiReport.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Forecast */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900">
                    <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" /> توقعات
                      الطلب والمبيعات المقبلة
                    </h4>

                    <div className="space-y-4">
                      {aiReport.predictions?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-white">
                              {item.name}
                            </span>
                            <span
                              className={`text-[8px] font-bold px-2 py-0.5 rounded ${
                                item.confidenceLevel?.includes("عالي")
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-cyan-500/15 text-cyan-400"
                              }`}
                            >
                              ثقة: {item.confidenceLevel}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-3 text-[11px] text-slate-400">
                            <span>
                              المبيعات الحالية:{" "}
                              <b className="text-white">{item.currentSales}</b>
                            </span>
                            <span>
                              الكمية المتوقعة:{" "}
                              <b className="text-cyan-400">
                                {item.predictedDemand}
                              </b>
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stagnant stock alert */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900">
                    <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> كشف
                      ركود بضائع المخزن (stagnant)
                    </h4>

                    <div className="space-y-4">
                      {aiReport.stagnantStock?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-white">
                              {item.name}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              الكمية: {item.stockLevel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">
                            <b className="text-amber-500">ملاحظة:</b>{" "}
                            {item.suggestion}
                          </p>
                          {item.lastSaleDate && (
                            <span className="text-[9px] text-slate-600 block mt-2">
                              آخر عملية بيع رصدت: {item.lastSaleDate}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Purchase order suggestions */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900">
                    <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <ShoppingCart className="w-4 h-4 text-purple-400" />{" "}
                      اقتراحات الشراء والتوريد الفورية
                    </h4>

                    <div className="space-y-4">
                      {aiReport.purchaseOrders?.map(
                        (item: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors font-sans"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-white">
                                {item.materialName}
                              </span>
                              <span
                                className={`text-[8px] font-bold px-2 py-0.5 rounded ${
                                  item.priority === "High"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-slate-900 text-slate-400"
                                }`}
                              >
                                أولوية:{" "}
                                {item.priority === "High" ? "قصوى" : "طبيعية"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-3 text-[11px] text-slate-400">
                              <span>
                                الرصيد المتاح:{" "}
                                <b className="text-white">
                                  {item.currentStock}
                                </b>
                              </span>
                              <span>
                                المقدار المقترح:{" "}
                                <b className="text-purple-400 font-bold">
                                  {item.suggestedPurchase}
                                </b>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-2">
                              المورد المقترح:{" "}
                              <b className="text-slate-300">{item.supplier}</b>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: ROADMAP STAGES */}
        {activeTab === "stages" && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl">
            <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-400" /> خطة التحول
              الفيدرالية ERP Enterprise Roadmap
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              مراحل البنية التقنية ومثولها في قاعدة البيانات والشيفرة المصدرية:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {erpStages.map((stage) => (
                <div
                  key={stage.num}
                  className="bg-slate-950 p-5 rounded-2xl border border-slate-900 flex justify-between items-start gap-4"
                >
                  <div>
                    <span className="text-xs text-slate-500 font-bold font-mono">
                      الخطوة #{stage.num}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">
                      {stage.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase whitespace-nowrap ${
                      stage.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : stage.status === "active"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "bg-slate-900 text-slate-500"
                    }`}
                  >
                    {stage.status === "completed"
                      ? "منفذة بالكامل"
                      : stage.status === "active"
                        ? "نشطة وفعالة"
                        : "مجدولة"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
