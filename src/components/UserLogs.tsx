import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield,
  Search,
  Calendar,
  User,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Activity,
  Users,
  Layers,
  Globe,
  MonitorSmartphone,
  Timer,
  Copy,
  Filter,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";

interface UserLog {
  id: number;
  user_id: number | null;
  username: string;
  user_role?: string | null;
  action: string;
  module?: string | null;
  details?: string | null;
  entity_type?: string | null;
  entity_ref?: string | null;
  record_id?: number | null;
  amount?: number | string | null;
  status?: string | null;
  status_code?: number | null;
  severity?: string | null;
  ip_address?: string | null;
  http_method?: string | null;
  route?: string | null;
  duration_ms?: number | null;
  request_body?: any;
  response_body?: any;
  meta?: any;
  request_id?: string | null;
  timestamp: string;
  row_type?: string;
}

interface UserLogStats {
  total: number;
  success: number;
  failed: number;
  high_risk: number;
  active_users: number;
  by_module: Array<{ module: string; count: number }>;
  by_action: Array<{ action: string; count: number }>;
  by_user: Array<{ user_id: number | null; username: string; count: number }>;
}

interface User {
  id: number;
  username: string;
}

interface UserLogsProps {
  onBack: () => void;
}

const EMPTY_STATS: UserLogStats = {
  total: 0,
  success: 0,
  failed: 0,
  high_risk: 0,
  active_users: 0,
  by_module: [],
  by_action: [],
  by_user: [],
};

const today = () => new Date().toISOString().split("T")[0];

const fmtNumber = (value: number) => Number(value || 0).toLocaleString("ar-EG");

const fmtMoney = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (value: string) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const relativeTime = (value: string) => {
  const date = new Date(value || 0).getTime();
  if (!date) return "";
  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return fmtDate(value).split(",")[0];
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "معلوماتي",
  normal: "عادي",
  high: "حساس",
  warning: "تحذير",
  critical: "خطير",
};

const prettify = (value: any): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const MODULE_COLORS: Record<string, string> = {};
const PALETTE = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-teal-50 text-teal-700 border-teal-200",
];
const moduleColor = (module?: string | null) => {
  const key = module || "النظام";
  if (!MODULE_COLORS[key]) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 9973;
    MODULE_COLORS[key] = PALETTE[hash % PALETTE.length];
  }
  return MODULE_COLORS[key];
};

export const UserLogs: React.FC<UserLogsProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [stats, setStats] = useState<UserLogStats>(EMPTY_STATS);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserLog | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);

  const [filters, setFilters] = useState({
    userId: "",
    module: "",
    status: "",
    search: "",
    startDate: today(),
    endDate: today(),
  });
  const [searchInput, setSearchInput] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const fetchLogs = useCallback(
    async (overrides: Partial<typeof filters> = {}, targetPage = page, size = pageSize) => {
      setLoading(true);
      setError(null);
      try {
        const active = { ...filters, ...overrides };
        const params = new URLSearchParams();
        if (active.userId) params.set("userId", active.userId);
        if (active.module) params.set("module", active.module);
        if (active.status) params.set("status", active.status);
        if (active.search) params.set("search", active.search);
        if (active.startDate) params.set("startDate", active.startDate);
        if (active.endDate) params.set("endDate", active.endDate);
        params.set("page", String(targetPage));
        params.set("pageSize", String(size));

        const res = await api.get(`/api/user-logs?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "تعذر تحميل السجل");

        setLogs(Array.isArray(data.rows) ? data.rows : []);
        setStats({ ...EMPTY_STATS, ...(data.stats || {}) });
        setTotal(Number(data.total || 0));
        setPages(Number(data.pages || 1));
        setPage(Number(data.page || targetPage));
      } catch (err: any) {
        setError(err.message || "تعذر تحميل السجل");
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, page, pageSize]
  );

  useEffect(() => {
    fetchUsers();
    fetchLogs({}, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // بحث بتأخير بسيط
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput }));
        fetchLogs({ search: searchInput }, 1);
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const applyFilters = (overrides: Partial<typeof filters> = {}) => {
    const next = { ...filters, ...overrides };
    setFilters(next);
    fetchLogs(overrides, 1);
  };

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const range = { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
    applyFilters(range);
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pages || nextPage === page) return;
    setPage(nextPage);
    fetchLogs({}, nextPage);
  };

  const moduleOptions = useMemo(() => {
    const set = new Set<string>(stats.by_module.map((item) => item.module).filter(Boolean));
    ["الهالك والتالف", "المخازن", "المبيعات", "نقطة البيع", "المشتريات", "الحسابات", "الخزينة والبنوك", "الموارد البشرية", "المستخدمون والصلاحيات", "الإعدادات"].forEach((m) => set.add(m));
    return Array.from(set).sort();
  }, [stats.by_module]);

  const exportCsv = () => {
    if (logs.length === 0) return;
    const header = ["التاريخ والوقت", "المستخدم", "الوحدة", "العملية", "المرجع", "المبلغ", "الحالة", "IP", "التفاصيل"];
    const rows = logs.map((log) => [
      fmtDate(log.timestamp),
      log.username,
      log.module || "",
      log.action,
      log.entity_ref || "",
      log.amount != null ? Number(log.amount) : "",
      log.status === "failed" ? "فاشلة" : "ناجحة",
      log.ip_address || "",
      (log.details || "").replace(/\s+/g, " "),
    ]);
    const escape = (value: any) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `user-logs-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySelected = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const statusBadge = (log: UserLog) => {
    if (log.status === "failed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
          <Ban className="w-3 h-3" /> فاشلة
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> ناجحة
      </span>
    );
  };

  const kpiCards = [
    { label: "إجمالي الحركات", value: fmtNumber(stats.total), icon: Activity, color: "bg-slate-100 text-slate-600", hint: "في نطاق الفلترة" },
    { label: "حركات ناجحة", value: fmtNumber(stats.success), icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600", hint: "اكتملت بنجاح" },
    { label: "حركات فاشلة / مرفوضة", value: fmtNumber(stats.failed), icon: AlertTriangle, color: "bg-red-50 text-red-600", hint: "أخطاء أو صلاحيات" },
    { label: "حركات حساسة", value: fmtNumber(stats.high_risk), icon: Shield, color: "bg-amber-50 text-amber-600", hint: "إلغاء / حذف / عكس" },
    { label: "مستخدمون نشطون", value: fmtNumber(stats.active_users), icon: Users, color: "bg-blue-50 text-blue-600", hint: "قاموا بحركات" },
  ];

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">سجل حركات المستخدمين</h1>
            <p className="text-slate-500 text-sm">تتبّع دقيق لكل عملية: من فعلها، ماذا غيّر، بأي قيمة، ومن أي جهاز</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={logs.length === 0}
            className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
          >
            <Download className="w-4 h-4" /> تصدير
          </button>
          <button onClick={onBack} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl transition-all text-sm font-bold">
            رجوع
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 truncate">{card.label}</p>
                <p className="text-xl font-black text-slate-800">{card.value}</p>
                <p className="text-[10px] text-slate-400 font-semibold truncate">{card.hint}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <User className="w-3 h-3" /> المستخدم
            </label>
            <select
              value={filters.userId}
              onChange={(e) => applyFilters({ userId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 text-sm"
            >
              <option value="">جميع المستخدمين</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> الوحدة
            </label>
            <select
              value={filters.module}
              onChange={(e) => applyFilters({ module: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 text-sm"
            >
              <option value="">كل الوحدات</option>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> الحالة
            </label>
            <select
              value={filters.status}
              onChange={(e) => applyFilters({ status: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 text-sm"
            >
              <option value="">الكل</option>
              <option value="success">ناجحة</option>
              <option value="failed">فاشلة / مرفوضة</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> من تاريخ
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => applyFilters({ startDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 text-sm font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> إلى تاريخ
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => applyFilters({ endDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 text-sm font-bold"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs({}, 1)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl font-bold shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all text-sm"
            >
              <Search className="w-4 h-4" /> بحث
            </button>
            <button
              onClick={() => {
                const cleared = { userId: "", module: "", status: "", search: "", startDate: "", endDate: "" };
                setFilters(cleared);
                setSearchInput("");
                fetchLogs(cleared, 1);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-xl font-bold text-xs transition-all"
            >
              الكل
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث في العملية، التفاصيل، رقم المستند، IP..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-400">اختصارات:</span>
            {[
              { label: "اليوم", days: 0 },
              { label: "آخر 7 أيام", days: 7 },
              { label: "آخر 30 يوم", days: 30 },
              { label: "آخر 90 يوم", days: 90 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.days)}
                className="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg font-bold transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchLogs({}, page)}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {stats.by_module.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-bold text-slate-400">توزيع الحركات:</span>
            {stats.by_module.slice(0, 6).map((item) => (
              <button
                key={item.module}
                onClick={() => applyFilters({ module: item.module === filters.module ? "" : item.module })}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${moduleColor(item.module)} ${
                  filters.module === item.module ? "ring-2 ring-orange-300" : ""
                }`}
              >
                {item.module} · {fmtNumber(item.count)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 font-bold text-slate-600 text-xs whitespace-nowrap">التاريخ والوقت</th>
                <th className="p-4 font-bold text-slate-600 text-xs">المستخدم</th>
                <th className="p-4 font-bold text-slate-600 text-xs">الوحدة</th>
                <th className="p-4 font-bold text-slate-600 text-xs">العملية</th>
                <th className="p-4 font-bold text-slate-600 text-xs">المرجع</th>
                <th className="p-4 font-bold text-slate-600 text-xs">القيمة</th>
                <th className="p-4 font-bold text-slate-600 text-xs">التفاصيل</th>
                <th className="p-4 font-bold text-slate-600 text-xs text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500 font-bold">جاري تحميل السجلات...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <FileText className="w-16 h-16" />
                      <span className="text-lg font-bold">لا توجد سجلات تطابق البحث</span>
                      <span className="text-xs">جرّب توسيع نطاق التاريخ أو إزالة الفلاتر</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.01, 0.2) }}
                    key={`${log.id}-${index}`}
                    onClick={() => setSelected(log)}
                    className={`border-b border-slate-50 hover:bg-orange-50/40 cursor-pointer transition-colors ${
                      log.status === "failed" ? "bg-red-50/30" : ""
                    }`}
                  >
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <p className="text-xs font-bold font-mono">{fmtDate(log.timestamp)}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{relativeTime(log.timestamp)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-bold text-xs">
                          {log.username?.substring(0, 1).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-xs">{log.username}</p>
                          {log.user_role && <p className="text-[10px] text-slate-400">{log.user_role}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${moduleColor(log.module)}`}>
                        {log.module || "النظام"}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-bold text-slate-800">{log.action}</p>
                      {log.severity && ["high", "critical"].includes(log.severity) && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 mt-0.5">
                          <Shield className="w-3 h-3" /> {SEVERITY_LABELS[log.severity] || log.severity}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {log.entity_ref ? (
                        <div>
                          <p className="text-xs font-mono font-bold text-slate-700">{log.entity_ref}</p>
                          {log.record_id ? <p className="text-[10px] text-slate-400 font-mono">#{log.record_id}</p> : null}
                        </div>
                      ) : log.record_id ? (
                        <p className="text-xs font-mono text-slate-500">#{log.record_id}</p>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {log.amount != null && Number(log.amount) !== 0 ? (
                        <span className="text-xs font-mono font-bold text-emerald-700">{fmtMoney(log.amount)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-[11px] text-slate-500 max-w-[320px] truncate" title={log.details || ""}>
                        {log.details || "—"}
                      </p>
                    </td>
                    <td className="p-4 text-center">{statusBadge(log)}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <span>
              عرض {fmtNumber(logs.length)} من {fmtNumber(total)} حركة
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                setPageSize(size);
                fetchLogs({}, 1, size);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size} / صفحة
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-600">
              صفحة {page} من {pages}
            </span>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= pages}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/50 flex justify-start"
            onClick={() => setSelected(null)}
            dir="rtl"
          >
            <motion.div
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
                <div>
                  <p className="text-[11px] font-bold text-slate-400">تفاصيل الحركة #{selected.id}</p>
                  <h3 className="text-base font-black text-slate-800">{selected.action}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={copySelected} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600" title="نسخ JSON">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: User, label: "المستخدم", value: selected.username + (selected.user_role ? ` (${selected.user_role})` : "") },
                    { icon: Clock, label: "التاريخ والوقت", value: fmtDate(selected.timestamp) },
                    { icon: Layers, label: "الوحدة", value: selected.module || "النظام" },
                    { icon: FileText, label: "المرجع", value: selected.entity_ref || (selected.record_id ? `#${selected.record_id}` : "—") },
                    { icon: Activity, label: "القيمة", value: selected.amount != null ? `${fmtMoney(selected.amount)} ج.م` : "—" },
                    { icon: Timer, label: "زمن التنفيذ", value: selected.duration_ms != null ? `${fmtNumber(selected.duration_ms)} ms` : "—" },
                    { icon: Globe, label: "IP", value: selected.ip_address || "—" },
                    { icon: MonitorSmartphone, label: "كود الاستجابة", value: selected.status_code ? String(selected.status_code) : "—" },
                  ].map((field) => (
                    <div key={field.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                        <field.icon className="w-3 h-3" /> {field.label}
                      </p>
                      <p className="text-xs font-bold text-slate-700 break-words">{field.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-400 mb-1">التفاصيل</p>
                  <p className="text-xs font-semibold text-slate-700 leading-6">{selected.details || "—"}</p>
                </div>

                {selected.route && (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">المسار / الطلب</p>
                    <p className="text-[11px] font-mono font-bold text-slate-600 break-all">
                      {selected.http_method || ""} {selected.route}
                    </p>
                    {selected.request_id && <p className="text-[10px] text-slate-400 font-mono mt-1">request: {selected.request_id}</p>}
                    {selected.meta?.source && (
                      <p className="text-[10px] text-slate-400 mt-1">مصدر التسجيل: {selected.meta.source === "explicit" ? "الموديول (دقيق)" : "الميدلوير العام"}</p>
                    )}
                  </div>
                )}

                {selected.request_body && Object.keys(selected.request_body).length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1">البيانات المُرسلة</p>
                    <pre className="text-[10px] leading-5 bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto max-h-64" dir="ltr">
                      {prettify(selected.request_body)}
                    </pre>
                  </div>
                )}

                {selected.meta && Object.keys(selected.meta).length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1">بيانات إضافية</p>
                    <pre className="text-[10px] leading-5 bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto max-h-64" dir="ltr">
                      {prettify(selected.meta)}
                    </pre>
                  </div>
                )}

                {selected.response_body && Object.keys(selected.response_body).length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1">ملخص الاستجابة</p>
                    <pre className="text-[10px] leading-5 bg-slate-100 text-slate-700 rounded-xl p-3 overflow-x-auto max-h-48" dir="ltr">
                      {prettify(selected.response_body)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserLogs;
