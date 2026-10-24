import React, { useState, useEffect } from "react";
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Zap,
  ShieldCheck,
  DollarSign,
  ShoppingCart,
  Users,
  Cog,
  TrendingUp,
  Building2,
  Eye,
  Database,
  FileText,
  Clock,
  Check,
  AlertCircle,
  Link as LinkIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { authFetch as apiFetch } from "../utils/api";

interface ERPIntegrationHubViewProps {
  onNavigateModule?: (moduleName: string) => void;
  onNavigateTab?: (tabId: string) => void;
}

export const ERPIntegrationHubView: React.FC<ERPIntegrationHubViewProps> = ({
  onNavigateModule,
  onNavigateTab,
}) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/accounting/integration-hub/status");
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      }
    } catch (err: any) {
      console.error("Failed to load ERP integration status:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (mod: string) => {
    if (mod === "all") {
      setRecords([]);
      return;
    }
    try {
      setLoadingRecords(true);
      const res = await apiFetch(`/api/accounting/integration-hub/records/${mod}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }
    } catch (err: any) {
      console.error("Failed to load module records:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (selectedModule !== "all") {
      fetchRecords(selectedModule);
    }
  }, [selectedModule]);

  const handleSyncAll = async () => {
    try {
      setSyncing("all");
      const res = await apiFetch("/api/accounting/integration-hub/sync-all", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: `تمت المزامنة بنجاح! تم إنشاء ${data.totalEntriesCreated} قيد محاسبي جديد في الدفتر العام.`,
        });
        await fetchStatus();
        if (selectedModule !== "all") {
          await fetchRecords(selectedModule);
        }
      } else {
        setNotification({
          type: "error",
          message: data.error || "فشلت المزامنة",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "حدث خطأ أثناء الاتصال بالخادم",
      });
    } finally {
      setSyncing(null);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleSyncModule = async (moduleName: string) => {
    try {
      setSyncing(moduleName);
      const res = await apiFetch("/api/accounting/integration-hub/sync-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleName }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: `تمت مزامنة مديول ${getModuleName(moduleName)} بنجاح (${data.totalEntriesCreated} قيد جديد).`,
        });
        await fetchStatus();
        if (selectedModule === moduleName) {
          await fetchRecords(moduleName);
        }
      } else {
        setNotification({
          type: "error",
          message: data.error || "فشلت المزامنة",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "حدث خطأ أثناء الاتصال",
      });
    } finally {
      setSyncing(null);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const getModuleName = (mod: string) => {
    switch (mod) {
      case "treasury": return "الخزينة";
      case "purchases": return "المشتريات";
      case "suppliers": return "الموردين";
      case "production": return "الإنتاج والتصنيع";
      case "sales": return "المبيعات والكاشير";
      default: return mod;
    }
  };

  const pillars = statusData?.pillars || {};
  const totalUnposted = statusData?.total_unposted || 0;

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Banner & Control Center */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    مركز الربط المحاسبي الشامل (ERP Financial Hub)
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ربط آلي نشط
                  </span>
                </div>
                <p className="text-slate-300 text-sm mt-1">
                  التكامل المالي الفوري والمباشر بين الحسابات العامة و(الخزينة، المشتريات، الموردين، الإنتاج، والمبيعات) عبر القيود المزدوجة الآلية
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={fetchStatus}
              disabled={loading || syncing !== null}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-slate-600/60 transition-all flex items-center gap-2 shadow-sm"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              <span>تحديث الحالة</span>
            </button>

            <button
              onClick={handleSyncAll}
              disabled={syncing !== null}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30"
            >
              {syncing === "all" ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              )}
              <span>مزامنة وترحيل كافة المديولات للدفاتر</span>
            </button>
          </div>
        </div>

        {/* Global Key Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60 text-sm">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
            <div className="text-slate-400 text-xs font-medium">المديولات المتكاملة</div>
            <div className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
              <span>5 / 5</span>
              <span className="text-xs font-normal text-slate-400">(ربط كامل 100%)</span>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
            <div className="text-slate-400 text-xs font-medium">إجمالي القيود الآلية المسجلة</div>
            <div className="text-xl font-black text-white mt-1">
              {statusData?.gl_stats?.automated_entries || 0} <span className="text-xs text-slate-400">قيد</span>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
            <div className="text-slate-400 text-xs font-medium">حجم الحركة المحاسبية</div>
            <div className="text-xl font-black text-white mt-1">
              {Number(statusData?.gl_stats?.total_turnover || 0).toLocaleString("ar-EG")} <span className="text-xs text-slate-400">ج.م</span>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
            <div className="text-slate-400 text-xs font-medium">حركات بانتظار الترحيل</div>
            <div className={`text-xl font-black mt-1 ${totalUnposted > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {totalUnposted} <span className="text-xs text-slate-400">حركة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center justify-between border ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <span className="text-sm font-bold">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The 5 Main Integrated Pillars Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>محاور الربط المحاسبي الخمسة</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            انقر على أي مديول للاطلاع على قيوده وحركاته أو الانتقال لإدارته
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* 1. TREASURY */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  pillars.treasury?.unposted_transactions > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {pillars.treasury?.unposted_transactions > 0 ? "بحاجة ترحيل" : "مرحل بالكامل"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">الخزينة والمقبوضات</h3>
                <p className="text-xs text-slate-500 mt-0.5">حساب الصندوق الرئيسي (111)</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>رصيد الخزن الفعلي:</span>
                  <span className="font-bold text-slate-800">
                    {Number(pillars.treasury?.total_safe_balance || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رصيد الأستاذ (111):</span>
                  <span className="font-bold text-blue-700">
                    {Number(pillars.treasury?.gl_cash_balance || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>الحركات المرحلة:</span>
                  <span className="font-semibold text-emerald-700">
                    {pillars.treasury?.posted_transactions || 0} / {pillars.treasury?.total_transactions || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleSyncModule("treasury")}
                disabled={syncing !== null}
                className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ترحيل الخزينة</span>
              </button>
              {onNavigateModule && (
                <button
                  onClick={() => onNavigateModule("treasury")}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  title="الانتقال لمديول الخزينة"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. PURCHASES */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  pillars.purchases?.unposted_count > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {pillars.purchases?.unposted_count > 0 ? "بحاجة ترحيل" : "مرحل بالكامل"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">المشتريات والتوريد</h3>
                <p className="text-xs text-slate-500 mt-0.5">من ح/ المخزون (114) إلى ح/ الموردين (211)</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي المشتريات:</span>
                  <span className="font-bold text-slate-800">
                    {Number(pillars.purchases?.total_amount || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رصيد المخزون (114):</span>
                  <span className="font-bold text-amber-700">
                    {Number(pillars.purchases?.gl_inventory_balance || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>الفواتير المرحلة:</span>
                  <span className="font-semibold text-emerald-700">
                    {pillars.purchases?.posted_count || 0} / {pillars.purchases?.total_purchases_count || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleSyncModule("purchases")}
                disabled={syncing !== null}
                className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ترحيل المشتريات</span>
              </button>
              {onNavigateModule && (
                <button
                  onClick={() => onNavigateModule("purchases")}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  title="الانتقال لمديول المشتريات"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 3. SUPPLIERS */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
                  <Users className="w-5 h-5" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  pillars.suppliers?.unposted_payments > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {pillars.suppliers?.unposted_payments > 0 ? "بحاجة ترحيل" : "مرحل بالكامل"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">الموردين والسدادات</h3>
                <p className="text-xs text-slate-500 mt-0.5">حساب ذمم الموردين (211)</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي ذمم الموردين:</span>
                  <span className="font-bold text-slate-800">
                    {Number(pillars.suppliers?.subledger_debt || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رصيد ح/ الموردين (211):</span>
                  <span className="font-bold text-purple-700">
                    {Number(pillars.suppliers?.gl_ap_balance || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>سدادات مرحلة:</span>
                  <span className="font-semibold text-emerald-700">
                    {pillars.suppliers?.posted_payments || 0} / {pillars.suppliers?.payments_total || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleSyncModule("suppliers")}
                disabled={syncing !== null}
                className="flex-1 py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ترحيل سدادات</span>
              </button>
              {onNavigateModule && (
                <button
                  onClick={() => onNavigateModule("suppliers")}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  title="الانتقال لإدارة الموردين"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 4. PRODUCTION */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
                  <Cog className="w-5 h-5" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  pillars.production?.unposted_count > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {pillars.production?.unposted_count > 0 ? "بحاجة ترحيل" : "مرحل بالكامل"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">الإنتاج والتصنيع</h3>
                <p className="text-xs text-slate-500 mt-0.5">من ح/ تام (114) إلى ح/ خامات (114)</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>تكلفة الإنتاج المنفذ:</span>
                  <span className="font-bold text-slate-800">
                    {Number(pillars.production?.total_manufactured_cost || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>أوامر الإنتاج المنفذة:</span>
                  <span className="font-bold text-orange-700">
                    {pillars.production?.production_runs_count || 0} أمر تشغيل
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>الأوامر المرحلة:</span>
                  <span className="font-semibold text-emerald-700">
                    {pillars.production?.posted_count || 0} / {pillars.production?.production_runs_count || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleSyncModule("production")}
                disabled={syncing !== null}
                className="flex-1 py-1.5 px-2 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ترحيل الإنتاج</span>
              </button>
              {onNavigateModule && (
                <button
                  onClick={() => onNavigateModule("production")}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  title="الانتقال لمديول الإنتاج"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 5. SALES */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  pillars.sales?.unposted_count > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                  {pillars.sales?.unposted_count > 0 ? "بحاجة ترحيل" : "مرحل بالكامل"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">المبيعات والكاشير</h3>
                <p className="text-xs text-slate-500 mt-0.5">من ح/ الصندوق/العملاء إلى ح/ المبيعات (41)</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إيرادات المبيعات:</span>
                  <span className="font-bold text-slate-800">
                    {Number(pillars.sales?.total_sales_revenue || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رصيد المبيعات (41):</span>
                  <span className="font-bold text-emerald-700">
                    {Number(pillars.sales?.gl_revenue_balance || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>العمليات المرحلة:</span>
                  <span className="font-semibold text-emerald-700">
                    {pillars.sales?.posted_count || 0} / {(pillars.sales?.invoices_count || 0) + (pillars.sales?.orders_count || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleSyncModule("sales")}
                disabled={syncing !== null}
                className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ترحيل المبيعات</span>
              </button>
              {onNavigateModule && (
                <button
                  onClick={() => onNavigateModule("sales")}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  title="الانتقال لمديول المبيعات"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Module Transaction Explorer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>مستكشف القيود وحركات المديولات التفصيلية</span>
            </h3>
            <p className="text-xs text-slate-500">
              استعراض الحركات المسجلة في المديولات الفرعية وحالة ربطها بالدفتر العام وقيد اليومية
            </p>
          </div>

          {/* Module Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedModule("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedModule === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              دليل الربط
            </button>
            <button
              onClick={() => setSelectedModule("treasury")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedModule === "treasury" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              الخزينة
            </button>
            <button
              onClick={() => setSelectedModule("purchases")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedModule === "purchases" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              المشتريات
            </button>
            <button
              onClick={() => setSelectedModule("suppliers")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedModule === "suppliers" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              الموردين
            </button>
            <button
              onClick={() => setSelectedModule("production")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedModule === "production" ? "bg-white text-orange-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              الإنتاج
            </button>
            <button
              onClick={() => setSelectedModule("sales")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedModule === "sales" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              المبيعات
            </button>
          </div>
        </div>

        {/* Content Area */}
        {selectedModule === "all" ? (
          /* Integration Guide & Double-Entry Schema Map */
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>دورة قيود الخزينة (Treasury Flow)</span>
                </div>
                <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-lg border border-blue-100 font-mono">
                  <div className="text-emerald-700 font-bold">● الإيداع والمقبوضات:</div>
                  <div>من ح/ الصندوق الرئيسي (111) [مدين]</div>
                  <div>إلى ح/ الإيراد أو العميل (41 / 113) [دائن]</div>
                  <div className="text-rose-700 font-bold mt-2">● الصرف والمدفوعات:</div>
                  <div>من ح/ المصروف أو المورد (51 / 211) [مدين]</div>
                  <div>إلى ح/ الصندوق الرئيسي (111) [دائن]</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  <span>دورة قيود المشتريات والموردين</span>
                </div>
                <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-lg border border-amber-100 font-mono">
                  <div className="text-amber-800 font-bold">● فاتورة الشراء والتوريد:</div>
                  <div>من ح/ المخزون (114) [مدين]</div>
                  <div>إلى ح/ ذمم الموردين (211) [دائن]</div>
                  <div className="text-emerald-700 font-bold mt-2">● سداد دفعة للمورد:</div>
                  <div>من ح/ ذمم الموردين (211) [مدين]</div>
                  <div>إلى ح/ الصندوق أو البنك (111 / 112) [دائن]</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-orange-900 text-sm">
                  <Cog className="w-4 h-4 text-orange-600" />
                  <span>دورة قيود الإنتاج والتصنيع (Manufacturing)</span>
                </div>
                <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-lg border border-orange-100 font-mono">
                  <div className="text-orange-800 font-bold">● تنفيذ أمر تشغيل إنتاج:</div>
                  <div>من ح/ مخزون الإنتاج التام (114) [مدين]</div>
                  <div>إلى ح/ مخزون الخامات والمواد الأولية (114) [دائن]</div>
                  <div className="text-slate-500 text-[11px] mt-1 italic">
                    (يتم حساب تكلفة الخامات بدقة من وصفة التصنيع BOM ورسملتها كمنتج تام جاهز للبيع)
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>
                  تتم كافة القيود بدقة المحاسبة المالية المزدوجة المتوازنة (Double-Entry Balance Check: Debit = Credit)، وترتبط كل حركة بمعرف العملية الأصلي لمنع التكرار.
                </span>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab("journal")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors"
                >
                  <span>عرض دفتر القيود اليومية</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Live Records Table */
          <div className="overflow-x-auto">
            {loadingRecords ? (
              <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري تحميل بيانات حركات مديول {getModuleName(selectedModule)}...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-bold text-sm">لا توجد حركات مسجلة حالياً في مديول {getModuleName(selectedModule)}</p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200/80">
                    <th className="p-3">المعرف / المرجع</th>
                    <th className="p-3">البيان / الوصف</th>
                    <th className="p-3">القيمة (ج.م)</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">حالة الدفتر العام (GL Status)</th>
                    <th className="p-3">رقم القيد اليومي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {records.map((r, idx) => {
                    const isPosted = !!r.journal_entry_id;
                    const refCode = r.invoice_number || r.order_number || r.safe_name || `#${r.id}`;
                    const amount = r.total || r.total_cost || r.amount || 0;
                    const desc = r.description || r.notes || r.product_name || r.customer_name || r.supplier_name || "-";
                    const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString("ar-EG") : "-";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {refCode}
                        </td>
                        <td className="p-3 text-slate-700 max-w-xs truncate">
                          {desc}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {Number(amount).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">
                          {dateStr}
                        </td>
                        <td className="p-3">
                          {isPosted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" />
                              <span>مرحل ومقيد</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" />
                              <span>جاهز للترحيل</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {isPosted ? (
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {r.journal_reference || `#${r.journal_entry_id}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">قيد الإنشاء</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
