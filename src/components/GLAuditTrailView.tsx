import React, { useState, useEffect, useMemo } from "react";
import {
  FileSearch,
  Search,
  Filter,
  RefreshCw,
  Download,
  Printer,
  ShieldCheck,
  Clock,
  User,
  Database,
  Eye,
  X,
  FileText,
  Activity,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../utils/api";
import { GeneralAccountsSettingsNav } from "./GeneralAccountsSettingsNav";

interface GLAuditEntry {
  id: number;
  table_name: string;
  record_id: number | string;
  action: string;
  user_id?: number;
  user_name?: string;
  username?: string;
  ip_address?: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
  description?: string;
}

interface GLAuditTrailViewProps {
  activeSettingsTab?: string;
  onSettingsTabChange?: (tab: "fiscal_years" | "account_config" | "budgets" | "audit_logs") => void;
}

export const GLAuditTrailView: React.FC<GLAuditTrailViewProps> = ({
  activeSettingsTab = "audit_logs",
  onSettingsTabChange,
}) => {
  const [logs, setLogs] = useState<GLAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  // Inspection Modal
  const [inspectItem, setInspectItem] = useState<GLAuditEntry | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // Try both routes: /api/gl-audit and /api/v2/erp-gl/gl-audit-logs
      const res = await api.get("/api/gl-audit?limit=150");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setLogs(list);
      } else {
        const res2 = await api.get("/api/v2/erp-gl/gl-audit-logs?limit=150");
        if (res2.ok) {
          const data2 = await res2.json();
          const list2 = Array.isArray(data2) ? data2 : data2.data || [];
          setLogs(list2);
        } else {
          setLogs([]);
        }
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = logs.length;
    const postCount = logs.filter((l) => l.action?.toLowerCase() === "post").length;
    const updateCount = logs.filter((l) => l.action?.toLowerCase() === "update").length;
    const closeCount = logs.filter((l) => ["close", "cancel", "delete"].includes(l.action?.toLowerCase())).length;

    return { totalCount, postCount, updateCount, closeCount };
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      const userStr = (item.user_name || item.username || "").toLowerCase();
      const descStr = (item.description || "").toLowerCase();
      const recStr = String(item.record_id || "").toLowerCase();
      const tableStr = (item.table_name || "").toLowerCase();

      const matchSearch =
        !searchQuery ||
        userStr.includes(searchQuery.toLowerCase()) ||
        descStr.includes(searchQuery.toLowerCase()) ||
        recStr.includes(searchQuery.toLowerCase()) ||
        tableStr.includes(searchQuery.toLowerCase());

      const matchEntity = entityFilter === "all" || item.table_name === entityFilter;

      const actionLower = (item.action || "").toLowerCase();
      const matchAction =
        actionFilter === "all" ||
        (actionFilter === "create" && ["create", "insert"].includes(actionLower)) ||
        (actionFilter === "update" && actionLower === "update") ||
        (actionFilter === "delete" && ["delete", "cancel"].includes(actionLower)) ||
        (actionFilter === "post" && actionLower === "post") ||
        (actionFilter === "close" && actionLower === "close");

      return matchSearch && matchEntity && matchAction;
    });
  }, [logs, searchQuery, entityFilter, actionFilter]);

  const handleExportExcel = () => {
    const rows = filteredLogs.map((l) => ({
      "التاريخ والوقت": new Date(l.created_at).toLocaleString("ar-EG"),
      "المستخدم": l.user_name || l.username || `User #${l.user_id || "System"}`,
      "عنوان IP": l.ip_address || "المتصفح المحلي",
      "نوع الحركة": l.action,
      "الجدول / الكيان": l.table_name,
      "رقم السجل": l.record_id,
      "البيان والتفاصيل": l.description || (l.action === "update" ? "تعديل بيانات" : "تسجيل عملية"),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل المراجعة والتدقيق");
    XLSX.writeFile(wb, `GL_Audit_Trail_Report.xlsx`);
  };

  const renderActionBadge = (action: string) => {
    const act = (action || "").toLowerCase();
    switch (act) {
      case "create":
      case "insert":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            إنشاء جديد
          </span>
        );
      case "update":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            تعديل
          </span>
        );
      case "post":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            ترحيل محاسبي
          </span>
        );
      case "close":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            إقفال فترة
          </span>
        );
      case "cancel":
      case "delete":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            إلغاء / حذف
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const renderTableName = (table: string) => {
    switch (table) {
      case "journal_entries":
        return "القيود اليومية";
      case "accounts":
        return "شجرة الحسابات";
      case "account_config":
        return "ربط الحسابات التلقائي";
      case "financial_periods":
        return "الفترات المالية";
      case "fiscal_years":
        return "السنوات المالية";
      case "budgets":
        return "الموازنات التقديرية";
      case "vouchers":
        return "سندات الخزينة";
      default:
        return table;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Settings Navigation Strip */}
      <GeneralAccountsSettingsNav
        activeTab={activeSettingsTab}
        onSelectTab={(tab) => {
          if (onSettingsTabChange) {
            onSettingsTabChange(tab);
          }
        }}
      />

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center">
            <FileSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">سجل المراجعة والتدقيق المالي (GL Audit Trail)</h1>
            <p className="text-xs text-slate-400 font-medium">
              الرقابة الأمنية والمحاسبية الكاملة على حركات القيود، التعديلات، الإلغاءات وإقفالات الفترات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            <span>تحديث السجل</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>تصدير Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>طباعة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي العمليات المدققة</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.totalCount} <span className="text-xs font-bold text-slate-400">عملية</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تتبع غير قابل للحذف أو التعديل</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">الترحيل الآلي والقيود</span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 tracking-tight">
            {metrics.postCount} <span className="text-xs font-bold text-slate-400">قيد</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">قيود المبيعات والمشتريات والخزينة</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">تعديل الإعدادات والربط</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 tracking-tight">
            {metrics.updateCount} <span className="text-xs font-bold text-slate-400">تعديل</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تعديلات شجرة الحسابات والتهيئة</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">حركات حساسة وإقفالات</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {metrics.closeCount} <span className="text-xs font-bold text-slate-400">حركة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">إقفال فترات، ترحيل سنوي أو إلغاء قيود</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالمستخدم، رقم السند، أو البيان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none"
          >
            <option value="all">كافة الكيانات المحاسبية</option>
            <option value="journal_entries">القيود اليومية (journal_entries)</option>
            <option value="accounts">شجرة الحسابات (accounts)</option>
            <option value="account_config">ربط الحسابات (account_config)</option>
            <option value="financial_periods">الفترات المالية (financial_periods)</option>
            <option value="budgets">الموازنات التقديرية (budgets)</option>
            <option value="vouchers">سندات الخزينة (vouchers)</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none"
          >
            <option value="all">كافة أنواع العمليات</option>
            <option value="create">إنشاء وإضافة (Create / Insert)</option>
            <option value="update">تعديل وتحديث (Update)</option>
            <option value="post">ترحيل محاسبي (Post)</option>
            <option value="close">إقفال فترة (Close)</option>
            <option value="delete">إلغاء أو حذف (Cancel / Delete)</option>
          </select>
        </div>

        <span className="text-xs font-bold text-slate-500 self-end md:self-auto">
          المعروض: <span className="text-slate-900 font-mono font-black">{filteredLogs.length}</span> حركة
        </span>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-4 w-44">الوقت والتاريخ</th>
                <th className="p-4 w-40">المستخدم والجهة</th>
                <th className="p-4 w-32 text-center">نوع الإجراء</th>
                <th className="p-4 w-36">الكيان / الجدول</th>
                <th className="p-4 w-32 font-mono">رقم السجل</th>
                <th className="p-4">البيان والتفاصيل</th>
                <th className="p-4 text-center w-28">فحص التغييرات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    جاري جلب سجلات المراجعة والتدقيق...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا توجد حركات مطابقة للبحث أو الفلتر
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => {
                  const dateObj = new Date(item.created_at);
                  const formattedDate = isNaN(dateObj.getTime())
                    ? item.created_at
                    : dateObj.toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                  const formattedTime = isNaN(dateObj.getTime())
                    ? ""
                    : dateObj.toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{formattedDate}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{formattedTime}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.user_name || item.username || `User #${item.user_id || "System"}`}</span>
                        </div>
                        {item.ip_address && (
                          <div className="text-[10px] font-mono text-slate-400 mr-5">{item.ip_address}</div>
                        )}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">{renderActionBadge(item.action)}</td>
                      <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                        {renderTableName(item.table_name)}
                        <span className="block font-mono text-[10px] text-slate-400 font-normal">
                          {item.table_name}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        #{item.record_id}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800 line-clamp-2">
                          {item.description || (
                            <span className="text-slate-400 italic">
                              تم تنفيذ إجراء {item.action} على السجل رقم #{item.record_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-xs font-bold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          <span>مطابقة</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal: Snapshot / Diff */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تفاصيل الفحص ومطابقة التغييرات (Audit Record #{inspectItem.id})
                  </h3>
                  <p className="text-xs text-slate-400">
                    الكيان: {renderTableName(inspectItem.table_name)} | السجل: #{inspectItem.record_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Meta information row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400">المستخدم</span>
                  <span className="text-xs font-black text-slate-800">
                    {inspectItem.user_name || inspectItem.username || "System"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400">نوع الحركة</span>
                  <span className="text-xs font-black text-indigo-700">{inspectItem.action.toUpperCase()}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400">عنوان IP</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {inspectItem.ip_address || "Local"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400">التاريخ والوقت</span>
                  <span className="text-xs font-bold text-slate-800">
                    {new Date(inspectItem.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>
              </div>

              {inspectItem.description && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                  <span className="block text-[10px] font-bold text-indigo-500 mb-0.5">البيان والملاحظة المحاسبية:</span>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">{inspectItem.description}</p>
                </div>
              )}

              {/* Old vs New Values side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Old Values */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>القيم السابقة (Old Values)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-slate-200 text-slate-600">Before</span>
                  </div>
                  <pre className="p-3 text-[11px] font-mono bg-slate-50/50 text-slate-800 overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                    {inspectItem.old_values ? JSON.stringify(inspectItem.old_values, null, 2) : "لا توجد بيانات سابقة (سجل جديد)"}
                  </pre>
                </div>

                {/* New Values */}
                <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                  <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-200 text-xs font-bold text-indigo-900 flex items-center justify-between">
                    <span>القيم المعتمدة (New Values)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-indigo-200 text-indigo-800">After</span>
                  </div>
                  <pre className="p-3 text-[11px] font-mono bg-indigo-50/20 text-indigo-950 overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                    {inspectItem.new_values ? JSON.stringify(inspectItem.new_values, null, 2) : "لا توجد قيم مسجلة"}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
