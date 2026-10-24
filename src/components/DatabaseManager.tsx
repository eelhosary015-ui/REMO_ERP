import React, { useState, useEffect } from "react";
import {
  Database,
  ChevronLeft,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Table,
  RefreshCw,
  HardDrive,
  Clock,
  FileJson,
  RotateCcw,
  Plus,
  Cloud,
  CloudUpload,
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "../utils/api";

interface DatabaseManagerProps {
  onBack: () => void;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  status: string;
}

export const DatabaseManager: React.FC<DatabaseManagerProps> = ({
  onBack,
  onBackup,
  onRestore,
  status,
}) => {
  const [dbStats, setDbStats] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupInterval, setBackupInterval] = useState<number>(6);
  const [loading, setLoading] = useState(true);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<{ ip: string; ips: string[]; port: number; url: string } | null>(null);

  const fetchNetworkInfo = async () => {
    try {
      const res = await api.get("/api/network/ip");
      const data = await res.json();
      setNetworkInfo(data);
    } catch (e) {
      console.error("Failed to fetch network info");
    }
  };

  const fetchBackupInterval = async () => {
    try {
      const res = await api.get("/api/settings/backup-interval");
      const data = await res.json();
      setBackupInterval(data.interval);
    } catch (error) {
      console.error("Failed to fetch backup interval");
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/db-stats");
      const data = await res.json();
      setDbStats(data);
    } catch (error) {
      console.error("Failed to fetch DB stats");
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const res = await api.get("/api/system/diagnostics");
      const data = await res.json();
      setDiagnostics(data);
    } catch (error) {
      console.error("Failed to fetch system diagnostics");
      setDiagnostics({
        status: "error",
        summary: { checked_tables: 0, missing_tables: 0, error_tables: 1 },
        tables: [],
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get("/api/backups/list");
      const data = await res.json();
      setBackups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch backups");
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDiagnostics();
    fetchBackups();
    fetchBackupInterval();
    fetchNetworkInfo();
  }, []);

  const handleCreateServerBackup = async () => {
    setActionStatus("جاري إنشاء نسخة احتياطية...");
    try {
      const res = await api.post("/api/backups/create", {});
      if (res.ok) {
        setActionStatus("تم إنشاء النسخة الاحتياطية بنجاح");
        fetchBackups();
      } else {
        throw new Error();
      }
    } catch (error) {
      setActionStatus("فشل إنشاء النسخة الاحتياطية");
    }
    setTimeout(() => setActionStatus(null), 3000);
  };

  const handleRestoreServerBackup = async (filename: string) => {
    if (
      !confirm(
        "هل أنت متأكد من استعادة هذه النسخة؟ سيتم فقدان البيانات الحالية!",
      )
    )
      return;

    setActionStatus("جاري استعادة البيانات...");
    try {
      const res = await api.post(`/api/backups/restore/${filename}`, { confirmRestore: true });
      if (res.ok) {
        setActionStatus("تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة.");
        window.location.reload();
      } else {
        throw new Error();
      }
    } catch (error) {
      setActionStatus("فشل استعادة البيانات");
    }
  };

  const handleUpdateBackupInterval = async (interval: number) => {
    try {
      const res = await api.post("/api/settings/backup-interval", { interval });
      if (res.ok) {
        setBackupInterval(interval);
        setActionStatus(
          interval === 0
            ? "تم إيقاف النسخ التلقائي"
            : `تم تغيير موعد النسخ التلقائي إلى كل ${interval} ساعة`,
        );
      }
    } catch (error) {
      setActionStatus("فشل تحديث موعد النسخ التلقائي");
    }
    setTimeout(() => setActionStatus(null), 3000);
  };

  const handleSeedDemoData = async () => {
    if (
      !confirm(
        "سوف تقوم هذه العملية بمسح وتوليد بيانات تجريبية متكاملة لجميع الأقسام (المحاسبة، المبيعات والموارد البشرية إلخ). هل ترغب في الاستمرار؟",
      )
    )
      return;

    setActionStatus("جاري توليد البيانات التجريبية المتكاملة...");
    try {
      const res = await api.post("/api/db/seed-demo", { confirmSeed: true });
      if (res.ok) {
        const data = await res.json();
        setActionStatus(data.message || "تم توليد وتغذية البيانات نجاح!");
        fetchStats();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "حدث خطأ أثناء التوليد");
      }
    } catch (error: any) {
      setActionStatus(error.message || "فشل توليد وتغذية البيانات");
    }
    setTimeout(() => setActionStatus(null), 5000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 p-8">
      <div className="w-full">
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-lg font-bold">العودة</span>
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900">
            <Database className="w-8 h-8 text-indigo-600" />
            إدارة قاعدة البيانات والنسخ الاحتياطي
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Network Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                حالة النظام
              </h3>
              <p className={`font-bold ${diagnostics?.status === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
                {diagnosticsLoading
                  ? "جاري فحص النظام..."
                  : diagnostics?.status === "ok"
                    ? "يعمل بكفاءة (SQL Active)"
                    : "يحتاج مراجعة"}
              </p>
              {diagnostics?.summary && (
                <p className="text-slate-400 text-xs mt-2">
                  تم فحص {diagnostics.summary.checked_tables} جدول — مفقود: {diagnostics.summary.missing_tables} — أخطاء: {diagnostics.summary.error_tables} — تنبيهات: {diagnostics.summary.warnings || 0}
                </p>
              )}
              {Array.isArray(diagnostics?.warnings) && diagnostics.warnings.length > 0 && (
                <div className="mt-3 w-full text-right bg-amber-50 border border-amber-100 rounded-2xl p-3">
                  {diagnostics.warnings.slice(0, 3).map((warning: string, index: number) => (
                    <p key={index} className="text-xs text-amber-700 mb-1">• {warning}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <HardDrive className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                تخزين محلي
              </h3>
              <p className="text-blue-600 font-bold">SQL Server Active</p>
              <p className="text-slate-400 text-xs mt-2">
                يتم حفظ جميع البيانات محلياً على هذا الجهاز
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 mx-auto">
                <HardDrive className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                الربط الشبكي
              </h3>

              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-700 mb-2">
                  1. من جهاز السيرفر (هذا الجهاز):
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  لفتح السيستم من نفس الجهاز الذي يعمل عليه البرنامج، استخدم
                  الرابط المحلي:
                </p>
                <div className="flex gap-2">
                  <div className="bg-slate-100 p-3 rounded-xl font-mono text-sm text-slate-700 dir-ltr select-all flex-1">
                    http://localhost:3000
                  </div>
                  <a
                    href="http://localhost:3000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl flex items-center justify-center font-bold text-sm transition-colors"
                  >
                    فتح
                  </a>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-700 mb-2">
                  2. من الأجهزة الأخرى (الشبكة المحلية):
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  لربط الأجهزة الأخرى (تابلت، شاشات مطبخ، موبايل) بنفس الشبكة، افتح المتصفح واكتب عنوان السيرفر:
                </p>
                {networkInfo && networkInfo.ips && networkInfo.ips.length > 0 && networkInfo.ips[0] !== "0.0.0.0" ? (
                  <div className="space-y-2">
                    {networkInfo.ips.map((ip) => (
                      <div key={ip} className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl font-mono text-sm text-indigo-900 dir-ltr select-all flex items-center justify-between">
                        <span className="font-bold">http://{ip}:{networkInfo.port || 3000}</span>
                        <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-md font-sans">عنوان السيرفر</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-100 p-3 rounded-xl font-mono text-sm text-slate-700 dir-ltr select-all">
                    http://[IP_السيرفر]:3000
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-2">
                  * تأكد من أن جميع الأجهزة والجوالات متصلة بنفس راوتر الواي فاي (Wi-Fi)
                </p>
              </div>
            </div>

            {/* Seed Demo Data Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                توليد البيانات التجريبية
              </h3>
              <p className="text-xs text-slate-500 mb-2 leading-relaxed text-right">
                تقوم هذه الخدمة بتثبيت وتغذية قاعدة البيانات تلقائياً ببيانات
                افتراضية متكاملة تغطي كافة تخصصات ومطالبات النظام (أدلة
                الحسابات، قيود اليومية المحاسبية، الوجبات، فواتير المبيعات،
                حركات الخزائن، الموظفين، الحضور والانصراف، والرواتب).
              </p>
              <button
                onClick={handleSeedDemoData}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                تغذية قاعـدة البيـانات الآن
              </button>
            </div>
          </div>

          {/* Automatic Backups List */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                    <Clock className="w-6 h-6 text-indigo-600" />
                    النسخ الاحتياطي التلقائي
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-slate-500">
                      يتم أخذ نسخة تلقائية كل
                    </p>
                    <select
                      value={backupInterval ?? ""}
                      onChange={(e) =>
                        handleUpdateBackupInterval(parseInt(e.target.value))
                      }
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value={1}>ساعة واحدة</option>
                      <option value={3}>3 ساعات</option>
                      <option value={6}>6 ساعات</option>
                      <option value={12}>12 ساعة</option>
                      <option value={24}>24 ساعة (يومياً)</option>
                      <option value={0}>إيقاف النسخ التلقائي</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleCreateServerBackup}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  نسخة جديدة الآن
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[500px] p-6">
                {backups.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileJson className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>لا توجد نسخ احتياطية محفوظة بعد</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backups.map((backup) => (
                      <div
                        key={backup.filename}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <FileJson className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dir-ltr text-left">
                              {backup.filename}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                              <span>{(backup.size / 1024).toFixed(2)} KB</span>
                              <span>•</span>
                              <span>
                                {new Date((backup.created_at) || 0).toLocaleString(
                                  "ar-EG",
                                )}
                              </span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleRestoreServerBackup(backup.filename)
                          }
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          استعادة
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3 mt-6">
            <h3 className="font-bold text-slate-900 mb-2">
              نسخ احتياطي يدوي (تنزيل)
            </h3>
            <button
              onClick={onBackup}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              تنزيل ملف النسخة
            </button>
            <label className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              استعادة من ملف
              <input
                type="file"
                className="hidden"
                onChange={onRestore}
                accept=".enc"
              />
            </label>
          </div>
        </div>
        {(status || actionStatus) && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 z-50">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-bold">{actionStatus || status}</span>
          </div>
        )}

        {/* Table Stats */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm mt-8">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Table className="w-6 h-6 text-slate-400" />
              إحصائيات الجداول SQL
            </h3>
            <button
              onClick={fetchStats}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
              <RefreshCw
                className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(Array.isArray(dbStats?.stats) ? dbStats.stats : []).map(
                (stat: any) => (
                  <div
                    key={stat.table}
                    className="bg-slate-50 p-4 rounded-2xl border border-slate-100"
                  >
                    <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">
                      {stat.table}
                    </p>
                    <p className="text-2xl font-black text-slate-900">
                      {stat.count}
                    </p>
                    <p className="text-[10px] text-slate-400">سجل SQL</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* System Diagnostics */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm mt-8">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                فحص سلامة النظام والموديولات
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                فحص سريع للجداول الأساسية التي يعتمد عليها البيع، المخزون، الحسابات، الخزائن، العملاء والموردين.
              </p>
            </div>
            <button
              onClick={fetchDiagnostics}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
              title="إعادة الفحص"
            >
              <RefreshCw
                className={`w-5 h-5 ${diagnosticsLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">حالة قاعدة البيانات</p>
                <p className={`text-lg font-black ${diagnostics?.database === "connected" ? "text-emerald-600" : "text-rose-600"}`}>
                  {diagnostics?.database === "connected" ? "متصلة" : "غير مؤكدة"}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">الجداول المفحوصة</p>
                <p className="text-lg font-black text-slate-900">{diagnostics?.summary?.checked_tables ?? 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">جداول مفقودة</p>
                <p className="text-lg font-black text-amber-600">{diagnostics?.summary?.missing_tables ?? 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">أخطاء فحص</p>
                <p className="text-lg font-black text-rose-600">{diagnostics?.summary?.error_tables ?? 0}</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-right">الموديول / الجدول</th>
                    <th className="p-3 text-right">الحالة</th>
                    <th className="p-3 text-right">عدد السجلات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(diagnostics?.tables || []).map((item: any) => (
                    <tr key={item.table} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono text-slate-700">{item.table}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.status === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "missing"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}>
                          {item.status === "ok" ? "سليم" : item.status === "missing" ? "مفقود" : "خطأ"}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{item.rows ?? "-"}</td>
                    </tr>
                  ))}
                  {!diagnosticsLoading && (!diagnostics?.tables || diagnostics.tables.length === 0) && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-400">
                        لم يتم تحميل بيانات الفحص بعد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
