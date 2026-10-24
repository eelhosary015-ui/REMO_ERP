import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Plus, Sparkles, Search, ChevronLeft, Trash2, Save, Check,
  FileText, Filter, Calendar, X, Paperclip, Link2, Eye, Clock, CheckCircle2,
  AlertTriangle, FileSpreadsheet, Printer, Copy, ChevronDown, Info,
  ClipboardList, Building2, Hash, StickyNote, UploadCloud, ShieldCheck, User,
  Scale, Lightbulb, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, ChevronRight,
  ChevronsLeft, ChevronsRight, Download, Layers, DollarSign, CheckSquare, RefreshCw
} from "lucide-react";
import { api } from "../../utils/api";
import { toDateOnly } from "../../utils/dateOnly";

/* ═══════════════════════════════════════════════════════════════
   أنواع البيانات
   ═══════════════════════════════════════════════════════════════ */
interface JournalLine {
  id: number;
  account_id: string;
  account_name: string;
  cost_center: string;
  sub_account: string;
  description: string;
  debit: string;
  credit: string;
}

interface JournalEntryData {
  id?: number;
  sourceId?: number | string | null;
  sourceType?: string;
  sourceDocumentNumber?: string;
  sourceCustomerName?: string;
  sourceWarehouseName?: string;
  code: string;
  date: string;
  entry_type: "يومي" | "افتتاحي" | "إقفال" | "تسوية";
  description: string;
  reference: string;
  source: string;
  branch: string;
  project: string;
  currency: string;
  exchange_rate: string;
  status: "draft" | "approved" | "cancelled";
  lines: JournalLine[];
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface AccountOption {
  id: number;
  code: string;
  name: string;
  type?: string;
}

/* ═══════════════════════════════════════════════════════════════
   إعدادات ثابتة
   ═══════════════════════════════════════════════════════════════ */
const ENTRY_TYPES: Array<"يومي" | "افتتاحي" | "إقفال" | "تسوية"> = ["يومي", "افتتاحي", "إقفال", "تسوية"];

const PROJECTS = ["بدون مشروع", "مشروع دبي مول", "مشروع أبوظبي مول", "مشروع برج الرياض", "مشروع التوسعات"];

const MAIN_SOURCES = [
  "قيد يدوي",
  "فاتورة مبيعات",
  "فاتورة مشتريات",
  "سند قبض",
  "سند صرف",
  "مسير رواتب",
  "تسوية بنكية",
  "إهلاك أصول",
];

const COST_CENTERS = ["التشغيل", "الإدارة", "التسويق", "المبيعات", "المخزون", "بدون مركز"];

const BRANCHES = ["الفرع الرئيسي", "دبي مول", "أبوظبي مول", "مركز المدينة"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "مسودة", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  approved: { label: "معتمد", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  cancelled: { label: "ملغي", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
};

const emptyLine = (id: number): JournalLine => ({
  id,
  account_id: "",
  account_name: "",
  cost_center: "التشغيل",
  sub_account: "",
  description: "",
  debit: "",
  credit: "",
});

const nextCode = (n: number) =>
  `JE-${new Date().getFullYear()}-${String(100100 + n).slice(1)}`;

const fmt = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════════════════════════════
   نظام الإشعارات (Toast)
   ═══════════════════════════════════════════════════════════════ */
interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info" | "warning";
}

const ToastStack: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
  const icons = {
    error: <AlertTriangle className="w-5 h-5 text-rose-500" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  };
  const borders = {
    error: "border-r-rose-500",
    success: "border-r-emerald-500",
    info: "border-r-blue-500",
    warning: "border-r-amber-500",
  };
  return (
    <div className="fixed bottom-6 left-6 z-[100] space-y-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: -40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.95 }}
            className={`pointer-events-auto bg-white border ${borders[t.type]} border-r-4 shadow-xl rounded-2xl px-5 py-4 flex items-center gap-3 min-w-[320px] max-w-md`}
          >
            {icons[t.type]}
            <p className="text-sm font-bold text-slate-800 flex-1">{t.message}</p>
            <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   حقل اختيار الحساب القابل للبحث
   ═══════════════════════════════════════════════════════════════ */
const AccountSelect: React.FC<{
  value: string;
  accounts: AccountOption[];
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
}> = ({ value, accounts, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = accounts.find((a) => String(a.id) === value);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return accounts;
    const q = query.trim().toLowerCase();
    return accounts.filter(
      (a) => a.code?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q)
    );
  }, [query, accounts]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 text-right text-xs font-bold text-slate-800 hover:border-blue-300 focus:border-blue-400 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 flex items-center justify-between gap-1 cursor-pointer"
      >
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className={selected ? "" : "text-slate-400 font-normal"}>
          {selected ? `${selected.code} - ${selected.name}` : "اختر الحساب..."}
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالكود أو الاسم..."
                className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 text-xs focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">لا توجد نتائج مطابقة</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChange(String(a.id), a.name);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full px-3 py-2.5 text-right hover:bg-blue-50 transition-colors flex items-center gap-2 cursor-pointer ${
                    String(a.id) === value ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{a.code}</span>
                  <span className="text-xs font-bold text-slate-700 flex-1">{a.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   البطاقات الجانبية — المرفقات + المراجعة والاعتماد
   ═══════════════════════════════════════════════════════════════ */
interface AttachmentFile { id: number; name: string; size: string; }

const SideCards: React.FC<{ entry: JournalEntryData; balanced: boolean; totalDebit: number; totalCredit: number }> = ({
  entry, balanced, totalDebit, totalCredit,
}) => {
  const isSalesEntry = /pos|sales_invoice|^sales$/i.test(entry.sourceType || "");
  const salesRevenue = entry.lines.reduce((total, line) => {
    const label = `${line.account_name} ${line.description}`.toLowerCase();
    return /إيراد مبيعات|إيرادات المبيعات|sales revenue/.test(label)
      ? total + (Number(line.credit) || 0) - (Number(line.debit) || 0)
      : total;
  }, 0);
  const costOfGoodsSold = entry.lines.reduce((total, line) => {
    const label = `${line.account_name} ${line.description}`.toLowerCase();
    return /تكلفة البضاعة المباعة|تكلفة المبيعات|\bcogs\b/.test(label)
      ? total + (Number(line.debit) || 0) - (Number(line.credit) || 0)
      : total;
  }, 0);

  const [attachments, setAttachments] = useState<AttachmentFile[]>([
    { id: 1, name: "فاتورة_مورد_0824.pdf", size: "1.2 MB" },
  ]);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles: AttachmentFile[] = Array.from(files).map((f, i) => ({
      id: Date.now() + i,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));
    setAttachments((prev) => [...prev, ...newFiles]);
  };

  const removeAttachment = (id: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* المرفقات والربط المحاسبي */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-gradient-to-l from-slate-50 to-white">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
            <Paperclip className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800">المرفقات والربط المحاسبي</h4>
            <p className="text-[10px] text-slate-400">إدارة المرفقات وربط القيد بالمستندات</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={`w-full py-6 border-2 border-dashed rounded-2xl transition-all flex flex-col items-center gap-2 cursor-pointer group ${
              dragOver ? "border-purple-400 bg-purple-50/50 scale-[1.02]" : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/30"
            }`}
          >
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <UploadCloud className={`w-8 h-8 transition-colors ${dragOver ? "text-purple-500" : "text-slate-300 group-hover:text-purple-400"}`} />
            <span className="text-xs font-bold text-slate-500 group-hover:text-purple-600">
              {dragOver ? "أفلت الملفات هنا الآن ✓" : "اسحب الملفات هنا أو اضغط للرفع"}
            </span>
            <span className="text-[10px] text-slate-400">PDF, JPG, PNG حتى 10 ميجابايت</span>
          </label>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                <FileText className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-700 flex-1 truncate">{att.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">{att.size}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                  title="حذف المرفق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {attachments.length === 0 && (
              <p className="text-center text-[11px] text-slate-400 py-2">لا توجد مرفقات بعد</p>
            )}
          </div>
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Link2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-bold text-slate-600">المصدر:</span>
              <span className="text-slate-800 font-black">{entry.source}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-bold text-slate-600">الفرع:</span>
              <span className="text-slate-800 font-black">{entry.branch}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Hash className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-slate-600">المرجع:</span>
              <span className="text-slate-800 font-mono font-bold" dir="ltr">{entry.reference || "—"}</span>
            </div>
            {entry.sourceCustomerName && (
              <div className="flex items-center gap-2 text-xs">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-bold text-slate-600">العميل:</span>
                <span className="text-slate-800 font-black">{entry.sourceCustomerName}</span>
              </div>
            )}
            {entry.sourceWarehouseName && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                <span className="font-bold text-slate-600">المخزن:</span>
                <span className="text-slate-800 font-black">{entry.sourceWarehouseName}</span>
              </div>
            )}
            {isSalesEntry && (
              <>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-600">إجمالي إيراد المبيعات:</span>
                  <span className="font-mono font-black text-slate-800" dir="ltr">{fmt(salesRevenue)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-600">تكلفة المبيعات (COGS):</span>
                  <span className="font-mono font-black text-rose-700" dir="ltr">{fmt(costOfGoodsSold)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs border-t border-slate-100 pt-2">
                  <span className="font-black text-slate-700">مجمل الربح:</span>
                  <span className="font-mono font-black text-emerald-700" dir="ltr">{fmt(salesRevenue - costOfGoodsSold)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* المراجعة والاعتماد */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-gradient-to-l from-slate-50 to-white">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800">المراجعة والاعتماد</h4>
            <p className="text-[10px] text-slate-400">سجل التدقيق ومعلومات الاعتماد</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
              {entry.created_by?.charAt(0) || "م"}
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-slate-800">أنشأ بواسطة {entry.created_by}</p>
              <p className="text-[10px] text-slate-400">تاريخ الإنشاء: {entry.created_at}</p>
            </div>
            <User className="w-4 h-4 text-slate-300" />
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">حالة التوازن</span>
              {balanced ? (
                <span className="font-black text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> متزن
                </span>
              ) : (
                <span className="font-black text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> غير متزن
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">إجمالي المدين</span>
              <span className="font-mono font-black text-slate-800" dir="ltr">{fmt(totalDebit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">إجمالي الدائن</span>
              <span className="font-mono font-black text-slate-800" dir="ltr">{fmt(totalCredit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">عدد البنود</span>
              <span className="font-mono font-black text-slate-800">{entry.lines.length}</span>
            </div>
          </div>

          {entry.status === "approved" ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div className="flex-1">
                <p className="text-xs font-black text-emerald-800">تم الاعتماد بواسطة {entry.approved_by || "المدير المالي"}</p>
                <p className="text-[10px] text-emerald-600">{entry.approved_at || ""}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-xs font-black text-amber-800">بانتظار الاعتماد</p>
                <p className="text-[10px] text-amber-600">القيد محفوظ كمسودة ولم يُعتمد بعد</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            <Eye className="w-3 h-3" />
            <span>آخر عرض: اليوم • سجل التدقيق مفعّل</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   المكون الرئيسي
   ═══════════════════════════════════════════════════════════════ */
interface DailyJournalEntriesProps {
  onBack?: () => void;
  embedded?: boolean;
  onNavigateModule?: (moduleName: string) => void;
}

export const DailyJournalEntries: React.FC<DailyJournalEntriesProps> = ({ onBack, embedded = false, onNavigateModule }) => {
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [entries, setEntries] = useState<JournalEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const openSourceTransaction = (entry: JournalEntryData) => {
    if (!entry.sourceId || !entry.sourceType || !onNavigateModule) return;
    const source = {
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
    };
    sessionStorage.setItem("erp.pending-sale-source", JSON.stringify(source));
    onNavigateModule(entry.sourceType.toLowerCase().includes("pos") ? "pos" : "sales");
  };

  /* حالة الإشعارات */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((message: string, type: Toast["type"] = "error") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  /* حالة البحث والفلاتر المتقدمة */
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [quickDateFilter, setQuickDateFilter] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryTotals, setSummaryTotals] = useState({ totalDebit: 0, totalCredit: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* البيانات الوصفية (Metadata) */
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [periodsList, setPeriodsList] = useState<any[]>([]);

  /* حالة المحرر */
  const [editor, setEditor] = useState<JournalEntryData | null>(null);

  /* مرفقات زر «إرفاق مستند» في الهيدر */
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const names = Array.from(files).map((f) => f.name);
    setAttachedFiles((prev) => [...prev, ...names]);
    pushToast(`تم إرفاق ${names.length} مستند بنجاح`, "success");
    e.target.value = "";
  };

  /* مزامنة البحث الحي بتأخير 300ms */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* تحميل القوائم الوصفية */
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [accsRes, branchRes, compRes, perRes] = await Promise.all([
          api.get("/api/accounts").catch(() => null),
          api.get("/api/branches").catch(() => null),
          api.get("/api/companies").catch(() => null),
          api.get("/api/financial-periods").catch(() => null),
        ]);
        if (accsRes?.ok) {
          const accs = await accsRes.json();
          const list: AccountOption[] = (Array.isArray(accs) ? accs : accs?.data || []).map((a: any) => ({
            id: a.id,
            code: String(a.code || a.id),
            name: a.name_ar || a.name || "",
            type: a.type,
          }));
          setAccounts(list);
        }
        if (branchRes?.ok) {
          const brs = await branchRes.json();
          setBranchesList(Array.isArray(brs) ? brs : brs?.data || []);
        }
        if (compRes?.ok) {
          const comps = await compRes.json();
          setCompaniesList(Array.isArray(comps) ? comps : comps?.data || []);
        }
        if (perRes?.ok) {
          const pers = await perRes.json();
          setPeriodsList(Array.isArray(pers) ? pers : pers?.data || []);
        }
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    };
    loadMetadata();
  }, []);

  /* ═══ تحميل القيود اليومية مع البحث والفلترة والصفحات ═══ */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
      if (filterFrom) q.set("dateFrom", filterFrom);
      if (filterTo) q.set("dateTo", filterTo);
      if (filterStatus !== "all") q.set("status", filterStatus);
      if (filterType !== "all") q.set("referenceType", filterType);
      if (filterCompany !== "all") q.set("companyId", filterCompany);
      if (filterBranch !== "all") q.set("branchId", filterBranch);
      if (filterPeriod !== "all") q.set("period_id", filterPeriod);
      if (filterAccount !== "all") q.set("accountId", filterAccount);
      if (filterCurrency !== "all") q.set("currency", filterCurrency);
      q.set("sortBy", sortBy);
      q.set("sortOrder", sortOrder);
      q.set("page", String(page));
      q.set("pageSize", String(pageSize));

      const res = await api.get(`/api/journal-entries?${q.toString()}`);
      if (!res.ok) {
        throw new Error(`فشل الاتصال بالخادم (${res.status})`);
      }
      const json = await res.json();
      const raw = Array.isArray(json) ? json : json?.data || [];
      const total = typeof json?.total === "number" ? json.total : raw.length;
      const tPages = typeof json?.totalPages === "number" ? json.totalPages : Math.max(1, Math.ceil(total / pageSize));

      setTotalEntries(total);
      setTotalPages(tPages);
      if (json?.summary) {
        setSummaryTotals({
          totalDebit: parseFloat(json.summary.totalDebit) || 0,
          totalCredit: parseFloat(json.summary.totalCredit) || 0,
        });
      } else {
        const d = raw.reduce((s: number, e: any) => s + (parseFloat(e.total_debit) || 0), 0);
        const c = raw.reduce((s: number, e: any) => s + (parseFloat(e.total_credit) || 0), 0);
        setSummaryTotals({ totalDebit: d, totalCredit: c });
      }

      const list: JournalEntryData[] = raw.map((e: any, i: number) => ({
        id: e.id,
        sourceId: e.source_id ?? null,
        sourceType: e.source_type || "",
        sourceDocumentNumber: e.source_document_number || "",
        sourceCustomerName: e.source_customer_name || "",
        sourceWarehouseName: e.source_warehouse_name || "",
        code: e.code || (e.id ? `JE-${String(e.id).padStart(6, "0")}` : e.reference || nextCode(i + 1)),
        date: toDateOnly(e.date),
        entry_type: e.entry_type || e.source_type || "يومي",
        description: e.description || "",
        reference: e.reference || "",
        source: e.source_type === "pos" || (e.description && (e.description.includes("نقطة البيع") || e.description.includes("POS")))
          ? "إيرادات نقطة البيع (POS)"
          : (e.source_type || e.source || "قيد يدوي"),
        branch: e.branch_name || e.branch || "الفرع الرئيسي",
        project: e.project || "بدون مشروع",
        currency: e.currency || "EGP",
        exchange_rate: e.exchange_rate || "1.00",
        status: e.status === "posted" ? "approved" : (e.status || "approved"),
        created_by: e.created_by_name || e.created_by || "مدير النظام",
        created_at: e.created_at ? new Date(e.created_at).toLocaleString("ar-EG") : "",
        approved_by: e.approved_by,
        approved_at: e.approved_at ? String(e.approved_at).split("T")[0] : undefined,
        lines: (e.items || []).map((it: any, idx: number) => ({
          id: it.id || idx + 1,
          account_id: String(it.account_id || ""),
          account_name: it.account_name || "",
          cost_center: it.cost_center || it.cost_center_name || "التشغيل",
          sub_account: it.sub_account || "",
          description: it.notes || it.description || "",
          debit: it.debit ? String(it.debit) : "",
          credit: it.credit ? String(it.credit) : "",
        })),
      }));

      setEntries(list);
    } catch (err: any) {
      console.error("Failed to load journal entries", err);
      setError(err?.message || "فشل جلب القيود اليومية");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterFrom, filterTo, filterStatus, filterType, filterCompany, filterBranch, filterPeriod, filterAccount, filterCurrency, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ═══ معالجة التواريخ السريعة ═══ */
  const applyQuickDate = (type: string) => {
    setQuickDateFilter(type);
    setPage(1);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === "all") {
      setFilterFrom("");
      setFilterTo("");
    } else if (type === "today") {
      const t = toYMD(now);
      setFilterFrom(t);
      setFilterTo(t);
    } else if (type === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      setFilterFrom(yStr);
      setFilterTo(yStr);
    } else if (type === "this_week") {
      const day = now.getDay();
      const diff = (day + 1) % 7;
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      setFilterFrom(toYMD(start));
      setFilterTo(toYMD(now));
    } else if (type === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFilterFrom(toYMD(start));
      setFilterTo(toYMD(end));
    } else if (type === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFilterFrom(toYMD(start));
      setFilterTo(toYMD(end));
    } else if (type === "this_year") {
      setFilterFrom(`${now.getFullYear()}-01-01`);
      setFilterTo(`${now.getFullYear()}-12-31`);
    }
  };

  /* ═══ إعادة ضبط الفلاتر ═══ */
  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setFilterFrom("");
    setFilterTo("");
    setQuickDateFilter("all");
    setFilterStatus("all");
    setFilterType("all");
    setFilterCompany("all");
    setFilterBranch("all");
    setFilterPeriod("all");
    setFilterAccount("all");
    setFilterCurrency("all");
    setSortBy("date");
    setSortOrder("desc");
    setPage(1);
    pushToast("تمت إعادة ضبط جميع الفلاتر وخيارات البحث بنجاح", "info");
  };

  /* ═══ فرز الأعمدة ═══ */
  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  };

  /* حساب عدد الفلاتر النشطة */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch.trim()) count++;
    if (filterFrom || filterTo) count++;
    if (filterStatus !== "all") count++;
    if (filterType !== "all") count++;
    if (filterCompany !== "all") count++;
    if (filterBranch !== "all") count++;
    if (filterPeriod !== "all") count++;
    if (filterAccount !== "all") count++;
    if (filterCurrency !== "all") count++;
    return count;
  }, [debouncedSearch, filterFrom, filterTo, filterStatus, filterType, filterCompany, filterBranch, filterPeriod, filterAccount, filterCurrency]);

  /* تصدير كـ CSV */
  const exportToCSV = () => {
    if (entries.length === 0) {
      pushToast("لا توجد قيود لتصديرها", "warning");
      return;
    }
    const headers = ["رقم القيد", "التاريخ", "البيان", "المرجع", "المصدر", "الفرع", "إجمالي المدين", "إجمالي الدائن", "الحالة"];
    const rows = entries.map((e) => {
      const { d, c } = entryTotals(e);
      return [
        `"${e.code}"`,
        `"${e.date}"`,
        `"${(e.description || "").replace(/"/g, '""')}"`,
        `"${(e.reference || "").replace(/"/g, '""')}"`,
        `"${e.source}"`,
        `"${e.branch}"`,
        d,
        c,
        `"${e.status === "approved" ? "معتمد" : e.status === "draft" ? "مسودة" : "ملغي"}"`,
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `قيود_اليومية_${toDateOnly(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    pushToast("تم تصدير القيود بنجاح بصيغة CSV", "success");
  };

  /* ═══ الحسابات الحية للقيد ═══ */
  const totalDebit = useMemo(
    () => editor?.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0) || 0,
    [editor]
  );
  const totalCredit = useMemo(
    () => editor?.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0) || 0,
    [editor]
  );
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;
  const filledLines = editor?.lines.filter((l) => l.account_id).length || 0;

  /* ═══ إدارة سطور القيد ═══ */
  const newEntry = () => {
    const n = totalEntries + 1;
    const customerAcc = accounts.find((a) => String(a.code) === "1000") || accounts.find((a) => (a.name || "").includes("عميل")) || accounts[0];
    const salesAcc = accounts.find((a) => String(a.code) === "4000") || accounts.find((a) => (a.name || "").includes("مبيعات")) || accounts[1];
    const exampleLines: JournalLine[] = [
      {
        id: 1,
        account_id: customerAcc ? String(customerAcc.id) : "",
        account_name: customerAcc?.name || "",
        cost_center: "التشغيل",
        sub_account: "",
        description: "إثبات مبيعات آجلة — فاتورة رقم INV-101",
        debit: "15000",
        credit: "",
      },
      {
        id: 2,
        account_id: salesAcc ? String(salesAcc.id) : "",
        account_name: salesAcc?.name || "",
        cost_center: "التشغيل",
        sub_account: "",
        description: "إثبات مبيعات آجلة — فاتورة رقم INV-101",
        debit: "",
        credit: "15000",
      },
    ];
    setEditor({
      code: nextCode(n),
      date: toDateOnly(new Date()),
      entry_type: "يومي",
      description: "",
      reference: "",
      source: "قيد يدوي",
      branch: "الفرع الرئيسي",
      project: "بدون مشروع",
      currency: "EGP",
      exchange_rate: "1.00",
      status: "draft",
      lines: exampleLines,
      created_by: "محمد",
      created_at: toDateOnly(new Date()),
    });
    setAttachedFiles([]);
    setMode("editor");
  };

  const editEntry = (e: JournalEntryData) => {
    const lines = e.lines.length > 0 ? e.lines : [emptyLine(1), emptyLine(2), emptyLine(3)];
    setEditor({ ...e, lines });
    setMode("editor");
  };

  const updateLine = (lineId: number, field: keyof JournalLine, value: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      lines: editor.lines.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)),
    });
  };

  /* كشف الحسابات المكررة */
  const duplicateAccountIds = useMemo(() => {
    if (!editor) return new Set<string>();
    const seen = new Map<string, number>();
    editor.lines.forEach((l) => {
      if (!l.account_id) return;
      seen.set(l.account_id, (seen.get(l.account_id) || 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [editor]);

  const handleAccountChange = (lineId: number, accountId: string, accountName: string) => {
    if (!editor) return;
    const duplicate = editor.lines.find((l) => l.id !== lineId && l.account_id === accountId && accountId !== "");
    if (duplicate) {
      pushToast(`لا يمكن تكرار نفس الحساب "${accountName}" — الحساب مستخدم بالفعل في بند آخر من هذا القيد!`, "error");
      return;
    }
    updateLine(lineId, "account_id", accountId);
    updateLine(lineId, "account_name", accountName);
  };

  const handleDebitChange = (lineId: number, value: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      lines: editor.lines.map((l) =>
        l.id === lineId
          ? { ...l, debit: value, credit: value && parseFloat(value) > 0 ? "" : l.credit }
          : l
      ),
    });
  };

  const handleCreditChange = (lineId: number, value: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      lines: editor.lines.map((l) =>
        l.id === lineId
          ? { ...l, credit: value, debit: value && parseFloat(value) > 0 ? "" : l.debit }
          : l
      ),
    });
  };

  const addLine = () => {
    if (!editor) return;
    const maxId = Math.max(0, ...editor.lines.map((l) => l.id));
    setEditor({ ...editor, lines: [...editor.lines, emptyLine(maxId + 1)] });
  };

  const removeLine = (lineId: number) => {
    if (!editor) return;
    if (editor.lines.length <= 1) {
      pushToast("لا يمكن حذف جميع البنود — يجب أن يحتوي القيد على بند واحد على الأقل", "warning");
      return;
    }
    setEditor({ ...editor, lines: editor.lines.filter((l) => l.id !== lineId) });
  };

  const clearAllLines = () => {
    if (!editor) return;
    setEditor({ ...editor, lines: [emptyLine(1), emptyLine(2), emptyLine(3)] });
    pushToast("تم مسح جميع بنود القيد", "info");
  };

  const duplicateLine = (lineId: number) => {
    if (!editor) return;
    const src = editor.lines.find((l) => l.id === lineId);
    if (!src) return;
    const maxId = Math.max(0, ...editor.lines.map((l) => l.id));
    setEditor({ ...editor, lines: [...editor.lines, { ...src, id: maxId + 1, debit: src.debit, credit: src.credit }] });
    pushToast("تم تكرار السطر — يمكنك تعديل الحساب أو المبلغ", "success");
  };

  const reverseEntry = () => {
    if (!editor) return;
    if (editor.lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)).length === 0) {
      pushToast("لا يمكن عمل قيد عكسي لقيد بدون بنود صالحة", "warning");
      return;
    }
    let maxId = Math.max(0, ...editor.lines.map((l) => l.id));
    const reversed = editor.lines
      .filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => {
        maxId += 1;
        return {
          ...l,
          id: maxId,
          debit: l.credit,
          credit: l.debit,
          description: l.description ? `${l.description} (عكسي)` : "قيد عكسي",
        };
      });
    setEditor({
      ...editor,
      description: editor.description ? `${editor.description} — قيد عكسي` : "قيد عكسي",
      lines: [...editor.lines, ...reversed],
    });
    pushToast(`تم إضافة ${reversed.length} سطر عكسي — لاحظ أن القيد أصبح غير متزن حتى اكتمال التعديل`, "info");
  };

  const copyEntry = () => {
    if (!editor) return;
    const n = totalEntries + 1;
    let maxId = Math.max(0, ...editor.lines.map((l) => l.id));
    const copiedLines = editor.lines.map((l) => {
      maxId += 1;
      return { ...l, id: maxId };
    });
    setEditor({
      ...editor,
      id: undefined,
      code: nextCode(n),
      status: "draft",
      description: `${editor.description} (نسخة)`,
      lines: copiedLines,
      approved_by: undefined,
      approved_at: undefined,
    });
    pushToast(`تم إنشاء نسخة جديدة من القيد برقم ${nextCode(n)} — عدّل واحفظ`, "success");
  };

  /* ═══ الحفظ والاعتماد ═══ */
  const saveEntry = async (approve: boolean) => {
    if (!editor) return;

    if (!editor.description.trim()) {
      pushToast("يرجى إدخال بيان القيد العام قبل الحفظ", "warning");
      return;
    }
    const validLines = editor.lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) {
      pushToast("يجب أن يحتوي القيد على بندين صالحين على الأقل (حساب + مبلغ)", "warning");
      return;
    }

    if (approve) {
      if (!balanced) {
        pushToast(`لا يمكن اعتماد قيد غير متزن! الفرق الحالي: ${fmt(diff)} — يجب أن يتساوى المدين مع الدائن`, "error");
        return;
      }
    }

    try {
      const payload: any = {
        date: editor.date,
        description: editor.description,
        reference: editor.reference,
        entry_type: editor.entry_type,
        source: editor.source,
        branch: editor.branch,
        code: editor.code,
        status: approve ? "approved" : "draft",
        total_debit: totalDebit,
        total_credit: totalCredit,
        items: validLines.map((l) => ({
          account_id: Number(l.account_id),
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          notes: l.description,
          cost_center: l.cost_center,
        })),
      };

      let res;
      if (editor.id) {
        res = await api.put(`/api/journal-entries/${editor.id}`, payload);
      } else {
        res = await api.post("/api/journal-entries", payload);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        pushToast(err.error || "فشل حفظ القيد", "error");
        return;
      }

      await loadEntries();
      setMode("list");
      pushToast(approve ? `تم اعتماد القيد ${editor.code} بنجاح ✓` : `تم حفظ القيد ${editor.code} كمسودة`, "success");
    } catch (e: any) {
      pushToast(e?.message || "حدث خطأ أثناء الحفظ", "error");
    }
  };

  const deleteEntry = async (entry: JournalEntryData) => {
    if (!confirm(`هل أنت متأكد من حذف القيد ${entry.code}؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      if (entry.id) {
        const res = await api.delete(`/api/journal-entries/${entry.id}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "فشل حذف القيد");
        }
      }
      await loadEntries();
      pushToast(`تم حذف القيد ${entry.code}`, "success");
    } catch (err: any) {
      pushToast(err?.message || "فشل حذف القيد", "error");
    }
  };

  const cancelEntry = async (entry: JournalEntryData) => {
    if (!confirm(`هل أنت متأكد من إلغاء القيد ${entry.code}؟`)) return;
    try {
      if (entry.id) {
        const res = await api.put(`/api/journal-entries/${entry.id}`, { status: "cancelled" });
        if (!res.ok) throw new Error("فشل إلغاء القيد");
      }
      await loadEntries();
      pushToast(`تم إلغاء القيد ${entry.code}`, "info");
    } catch (err: any) {
      pushToast(err?.message || "فشل إلغاء القيد", "error");
    }
  };

  const ocrScan = () => {
    pushToast("جاري تشغيل الماسح الضوئي OCR... سيتم رفع الفاتورة وقراءة بياناتها تلقائياً", "info");
  };

  const entryTotals = (e: JournalEntryData) => {
    const d = e.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const c = e.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { d, c };
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER — صفحة القائمة مع نظام بحث وفلترة وترقيم متكامل
     ═══════════════════════════════════════════════════════════════ */
  if (mode === "list") {
    const isFilteredSumBalanced = Math.abs(summaryTotals.totalDebit - summaryTotals.totalCredit) < 0.01;
    const startRowIndex = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1;
    const endRowIndex = Math.min(page * pageSize, totalEntries);

    return (
      <div dir="rtl" className={`font-sans ${embedded ? "space-y-4" : "min-h-screen bg-[#F5F7FA] pb-16 py-6 max-w-[98%] xl:max-w-[96%] mx-auto space-y-5"}`}>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <div className={embedded ? "space-y-4" : "space-y-5"}>

          {/* ─── Header ─── */}
          {!embedded && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all cursor-pointer"
                    title="رجوع"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-900">القيود اليومية</h1>
                    <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-full">
                      {totalEntries} قيد
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    سجل القيود العامة المحاسبية مع الفلترة والبحث المتقدم في قاعدة البيانات
                  </p>
                </div>
              </div>

              {/* أزرار الإجراءات الإضافية */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <button
                  onClick={loadEntries}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden md:inline">تحديث</span>
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-200 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer hover:bg-emerald-50/50"
                  title="تصدير القيود الحالية إلى ملف CSV"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span className="hidden md:inline">تصدير CSV</span>
                </button>
              </div>
            </div>
          )}

          {embedded && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-black">
                  <BookOpen className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800">دفتر القيود اليومية العامة</span>
                    <span className="bg-blue-100 text-blue-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                      {totalEntries.toLocaleString()} قيد مسجل
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold">
                    إدارة واستعراض قيود اليومية مع البحث والفلترة حسب التاريخ والحساب
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={loadEntries}
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
                  <span>تحديث</span>
                </button>
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  title="تصدير القيود الحالية إلى ملف CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── بطاقات المؤشرات السريعة (Summary Metric Cards) ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي القيود المطابقة</p>
                <p className="text-xl font-black text-slate-900 mt-1">{totalEntries.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  الصفحة {page} من {totalPages}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي المدين (للبحث الحالي)</p>
                <p className="text-xl font-black text-blue-700 font-mono mt-1" dir="ltr">
                  {fmt(summaryTotals.totalDebit)}
                </p>
                <p className="text-[10px] font-bold text-blue-500 mt-0.5">جنيه مصري</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Scale className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي الدائن (للبحث الحالي)</p>
                <p className="text-xl font-black text-emerald-700 font-mono mt-1" dir="ltr">
                  {fmt(summaryTotals.totalCredit)}
                </p>
                <p className="text-[10px] font-bold text-emerald-500 mt-0.5">جنيه مصري</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Scale className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">حالة التوازن العامة</p>
                <div className="mt-1">
                  {isFilteredSumBalanced ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> القيود متزنة تماماً
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> فرق: {fmt(Math.abs(summaryTotals.totalDebit - summaryTotals.totalCredit))}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-1">توازن طرفي المدين والدائن</p>
              </div>
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${isFilteredSumBalanced ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ─── شريط البحث والأزرار الرئيسية ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <button
                onClick={newEntry}
                className="flex items-center justify-center gap-2 bg-[#E67E22] hover:bg-[#d35400] text-white px-5 py-3 rounded-xl font-black text-sm transition-all shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4.5 h-4.5" />
                قيد يومية جديد
              </button>

              <button
                onClick={ocrScan}
                className="flex items-center justify-center gap-2 bg-gradient-to-l from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-black text-sm transition-all shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4.5 h-4.5" />
                مسح فاتورة OCR
              </button>

              {/* حقل البحث الشامل الفعال */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث شامل (رقم القيد، التاريخ، البيان، المرجع، كود الحساب، اسم الحساب، المورد، العميل، أمر الإنتاج...)"
                  className="w-full h-12 bg-[#F8F9FA] border border-slate-200 rounded-xl pr-12 pl-10 text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-blue-500 focus:bg-white focus:shadow-md focus:shadow-blue-500/5 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
                    title="مسح البحث"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* زر إظهار/إخفاء الفلاتر المتقدمة */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                  showFilters || activeFiltersCount > 0
                    ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Filter className="w-4.5 h-4.5 text-blue-600" />
                <span>الفلاتر المتقدمة</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-blue-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* ─── الفلاتر السريعة لنوع القيود والمصادر (خاصة إيرادات نقطة البيع) ─── */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
              <span className="text-xs font-black text-slate-600 whitespace-nowrap ml-1 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" /> تصنيف القيود:
              </span>
              {[
                { id: "all", label: "كل القيود" },
                { id: "pos", label: "🛒 إيرادات نقطة البيع (POS)" },
                { id: "مبيعات", label: "فواتير مبيعات" },
                { id: "مشتريات", label: "فواتير مشتريات" },
                { id: "قيد يدوي", label: "قيود يدوية" },
                { id: "صرف", label: "سندات صرف وقبض" },
              ].map((srcOpt) => {
                const isSelected = filterType === srcOpt.id;
                return (
                  <button
                    key={srcOpt.id}
                    type="button"
                    onClick={() => {
                      setFilterType(srcOpt.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm font-black ring-2 ring-emerald-300"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-700"
                    }`}
                  >
                    {srcOpt.label}
                  </button>
                );
              })}
            </div>

            {/* ─── الفترات الزمنية السريعة والفلترة بالتواريخ (Date Range & Presets) ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs font-black text-slate-600 whitespace-nowrap ml-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" /> فلترة التاريخ:
                </span>
                {[
                  { id: "all", label: "الكل" },
                  { id: "today", label: "اليوم" },
                  { id: "yesterday", label: "أمس" },
                  { id: "this_week", label: "هذا الأسبوع" },
                  { id: "this_month", label: "هذا الشهر" },
                  { id: "last_month", label: "الشهر السابق" },
                  { id: "this_year", label: "هذا العام" },
                ].map((opt) => {
                  const isActive = quickDateFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => applyQuickDate(opt.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm font-black"
                          : "bg-slate-100 hover:bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* منتقي التواريخ المباشر من تاريخ وإلى تاريخ */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-white border border-slate-200 focus-within:border-blue-500 rounded-xl px-2.5 py-1.5 transition-all">
                  <span className="text-slate-400 font-bold whitespace-nowrap text-[11px]">من:</span>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => {
                      setFilterFrom(e.target.value);
                      setQuickDateFilter("custom");
                      setPage(1);
                    }}
                    className="bg-transparent border-0 text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                    title="من تاريخ"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-white border border-slate-200 focus-within:border-blue-500 rounded-xl px-2.5 py-1.5 transition-all">
                  <span className="text-slate-400 font-bold whitespace-nowrap text-[11px]">إلى:</span>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={(e) => {
                      setFilterTo(e.target.value);
                      setQuickDateFilter("custom");
                      setPage(1);
                    }}
                    className="bg-transparent border-0 text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                    title="إلى تاريخ"
                  />
                </div>

                {(filterFrom || filterTo || quickDateFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => applyQuickDate("all")}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="إلغاء فلترة التاريخ وعرض كل القيود"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">مسح التاريخ</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── لوحة الفلاتر المتقدمة المدمجة ─── */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-800">تخصيص الفلاتر المتقدمة للقيود</h3>
                  </div>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={handleClearFilters}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> إعادة ضبط الفلاتر
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* من تاريخ */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">من تاريخ (From Date)</label>
                    <input
                      type="date"
                      value={filterFrom}
                      onChange={(e) => {
                        setFilterFrom(e.target.value);
                        setQuickDateFilter("custom");
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* إلى تاريخ */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">إلى تاريخ (To Date)</label>
                    <input
                      type="date"
                      value={filterTo}
                      onChange={(e) => {
                        setFilterTo(e.target.value);
                        setQuickDateFilter("custom");
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* حالة القيد */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">حالة القيد (Status)</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="all">كل الحالات (الكل)</option>
                      <option value="approved">معتمد / مرحل (Approved / Posted)</option>
                      <option value="draft">مسودة (Draft)</option>
                      <option value="cancelled">ملغي (Cancelled)</option>
                    </select>
                  </div>

                  {/* نوع المرجع / المصدر */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">نوع المرجع والمستند</label>
                    <select
                      value={filterType}
                      onChange={(e) => {
                        setFilterType(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="all">كل الأنواع والمصادر</option>
                      <option value="pos">🛒 إيرادات نقطة البيع (POS)</option>
                      <option value="يومي">قيد يومية عادي</option>
                      <option value="افتتاحي">قيد افتتاحي</option>
                      <option value="إقفال">قيد إقفال</option>
                      <option value="تسوية">قيد تسوية</option>
                      <option value="قيد يدوي">قيد يدوي (Manual)</option>
                      <option value="مبيعات">فواتير مبيعات (Sales)</option>
                      <option value="مشتريات">فواتير مشتريات (Purchases)</option>
                      <option value="استلام">أذون استلام (Receipts)</option>
                      <option value="إنتاج">أوامر إنتاج وتصنيع (Production)</option>
                      <option value="رواتب">مسير رواتب (Payroll)</option>
                      <option value="صرف">سندات صرف وقبض (Payments)</option>
                      <option value="إهلاك">إهلاك أصول (Depreciation)</option>
                    </select>
                  </div>

                  {/* الشركة */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">الشركة (Company)</label>
                    <select
                      value={filterCompany}
                      onChange={(e) => {
                        setFilterCompany(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="all">كل الشركات</option>
                      {companiesList.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name_ar || c.name_en || c.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* الفرع */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">الفرع (Branch)</label>
                    <select
                      value={filterBranch}
                      onChange={(e) => {
                        setFilterBranch(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="all">كل الفروع</option>
                      {branchesList.map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* الحساب المحاسبي */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">الحساب المالي</label>
                    <select
                      value={filterAccount}
                      onChange={(e) => {
                        setFilterAccount(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="all">كل الحسابات المالية</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* العملة */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600">العملة (Currency)</label>
                    <select
                      value={filterCurrency}
                      onChange={(e) => {
                        setFilterCurrency(e.target.value);
                        setPage(1);
                      }}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="all">كل العملات</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── بطاقات الفلاتر النشطة (Active Filter Chips) ─── */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-black text-slate-500">الفلاتر المطبقة:</span>

              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  بحث: "{debouncedSearch}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-blue-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {(filterFrom || filterTo) && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  التاريخ: {filterFrom || "البداية"} إلى {filterTo || "الآن"}
                  <button
                    onClick={() => {
                      setFilterFrom("");
                      setFilterTo("");
                      setQuickDateFilter("all");
                    }}
                    className="hover:text-indigo-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterStatus !== "all" && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  الحالة: {filterStatus === "approved" ? "معتمد" : filterStatus === "draft" ? "مسودة" : "ملغي"}
                  <button onClick={() => setFilterStatus("all")} className="hover:text-amber-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterType !== "all" && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  النوع: {filterType}
                  <button onClick={() => setFilterType("all")} className="hover:text-purple-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterCompany !== "all" && (
                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  الشركة: {companiesList.find((c) => String(c.id) === filterCompany)?.name_ar || filterCompany}
                  <button onClick={() => setFilterCompany("all")} className="hover:text-teal-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterBranch !== "all" && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  الفرع: {branchesList.find((b) => String(b.id) === filterBranch)?.name || filterBranch}
                  <button onClick={() => setFilterBranch("all")} className="hover:text-emerald-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterAccount !== "all" && (
                <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  الحساب: {accounts.find((a) => String(a.id) === filterAccount)?.name || filterAccount}
                  <button onClick={() => setFilterAccount("all")} className="hover:text-sky-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterCurrency !== "all" && (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-1 rounded-lg">
                  العملة: {filterCurrency}
                  <button onClick={() => setFilterCurrency("all")} className="hover:text-slate-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={handleClearFilters}
                className="text-xs font-black text-rose-600 hover:text-rose-700 mr-auto hover:underline cursor-pointer"
              >
                مسح الكل
              </button>
            </div>
          )}

          {/* ─── جدول القيود اليومية (Data Table) ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-l from-slate-100 to-slate-50 border-b border-slate-200">
                    <th
                      onClick={() => handleSort("id")}
                      className="px-5 py-4 text-right font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>رقم القيد</span>
                        {sortBy === "id" ? (
                          sortOrder === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("date")}
                      className="px-5 py-4 text-right font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>التاريخ</span>
                        {sortBy === "date" ? (
                          sortOrder === "desc" ? (
                            <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              ↓ الأحدث
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              ↑ الأقدم
                            </span>
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("description")}
                      className="px-5 py-4 text-right font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>بيان القيد (الوصف العام)</span>
                        {sortBy === "description" ? (
                          sortOrder === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("reference")}
                      className="px-5 py-4 text-right font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>المرجع والمستند</span>
                        {sortBy === "reference" ? (
                          sortOrder === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("total_debit")}
                      className="px-5 py-4 text-center font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>إجمالي المدين</span>
                        {sortBy === "total_debit" ? (
                          sortOrder === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("total_credit")}
                      className="px-5 py-4 text-center font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>إجمالي الدائن</span>
                        {sortBy === "total_credit" ? (
                          sortOrder === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("status")}
                      className="px-5 py-4 text-center font-black text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>الحالة</span>
                        {sortBy === "status" ? (
                          sortOrder === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    <th className="px-5 py-4 text-center font-black text-slate-700">العمليات</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className="animate-pulse">
                        <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-48" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                        <td className="px-5 py-4 text-center"><div className="h-4 bg-slate-200 rounded w-20 mx-auto" /></td>
                        <td className="px-5 py-4 text-center"><div className="h-4 bg-slate-200 rounded w-20 mx-auto" /></td>
                        <td className="px-5 py-4 text-center"><div className="h-6 bg-slate-200 rounded-full w-16 mx-auto" /></td>
                        <td className="px-5 py-4 text-center"><div className="h-8 bg-slate-200 rounded-lg w-20 mx-auto" /></td>
                      </tr>
                    ))
                  ) : error ? (
                    <tr>
                      <td colSpan={8} className="p-14 text-center">
                        <div className="inline-flex flex-col items-center gap-3">
                          <AlertTriangle className="w-10 h-10 text-rose-500" />
                          <p className="text-sm font-bold text-rose-600">{error}</p>
                          <button
                            onClick={loadEntries}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-16 text-center">
                        <div className="inline-flex flex-col items-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
                            <BookOpen className="w-9 h-9 text-slate-300" />
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-700">لا توجد قيود يومية مطابقة للمعايير المحددة</p>
                            <p className="text-xs text-slate-400 font-bold mt-1">
                              {activeFiltersCount > 0
                                ? "جرب تعديل كلمات البحث أو تصفية نطاق التاريخ أو الفلاتر الأخرى"
                                : "ابدأ بإضافة أول قيد يومية محاسبي في النظام"}
                            </p>
                          </div>
                          {activeFiltersCount > 0 ? (
                            <button
                              onClick={handleClearFilters}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" /> إعادة ضبط جميع الفلاتر
                            </button>
                          ) : (
                            <button
                              onClick={newEntry}
                              className="flex items-center gap-2 bg-[#E67E22] hover:bg-[#d35400] text-white px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> إضافة أول قيد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, idx) => {
                      const { d, c } = entryTotals(entry);
                      const sc = STATUS_CONFIG[entry.status] || STATUS_CONFIG.draft;
                      return (
                        <tr
                          key={entry.id || idx}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <button
                              onClick={() => editEntry(entry)}
                              className="font-mono font-black text-blue-700 hover:text-blue-900 hover:underline decoration-dotted underline-offset-4 cursor-pointer"
                              dir="ltr"
                            >
                              {entry.code}
                            </button>
                          </td>

                          <td className="px-5 py-4 text-slate-600 font-bold" dir="ltr">
                            {entry.date}
                          </td>

                          <td className="px-5 py-4 max-w-[280px]">
                            <p className="font-bold text-slate-800 truncate" title={entry.description}>
                              {entry.description || "—"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded">
                                {entry.entry_type}
                              </span>
                              {entry.branch && (
                                <span className="text-[10px] text-slate-400 font-bold truncate">
                                  • {entry.branch}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {entry.sourceId && onNavigateModule ? (
                                <button
                                  type="button"
                                  onClick={() => openSourceTransaction(entry)}
                                  title="فتح عملية البيع الأصلية"
                                  className="font-mono text-xs text-blue-700 font-bold truncate max-w-[140px] hover:underline cursor-pointer"
                                  dir="ltr"
                                >
                                  {entry.sourceDocumentNumber || String(entry.sourceId)}
                                </button>
                              ) : (
                                <span className="font-mono text-xs text-slate-700 font-bold truncate max-w-[140px]" dir="ltr">
                                  {entry.reference || "—"}
                                </span>
                              )}
                            </div>
                            {entry.source.includes("نقطة البيع") || entry.source === "pos" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🛒 إيرادات نقطة البيع
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                                {entry.source}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-mono font-black text-blue-800 bg-blue-50/80 px-2.5 py-1 rounded-lg" dir="ltr">
                              {fmt(d)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`font-mono font-black px-2.5 py-1 rounded-lg ${
                                d === c && d > 0 ? "text-emerald-700 bg-emerald-50/80" : "text-rose-700 bg-rose-50/80"
                              }`}
                              dir="ltr"
                            >
                              {fmt(c)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full border ${sc.color} ${sc.bg} ${sc.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${entry.status === "approved" ? "bg-emerald-500" : entry.status === "draft" ? "bg-amber-500" : "bg-rose-500"}`} />
                              {sc.label}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => editEntry(entry)}
                                title="عرض وتعديل القيد"
                                className="w-8 h-8 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-all flex items-center justify-center cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => cancelEntry(entry)}
                                title="إلغاء القيد"
                                disabled={entry.status === "cancelled"}
                                className="w-8 h-8 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteEntry(entry)}
                                title="حذف القيد نهائياً"
                                className="w-8 h-8 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-all flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ─── شريط الترقيم والصفحات (Server-Side Pagination) ─── */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <span>
                  عرض <span className="font-black text-slate-900">{startRowIndex} - {endRowIndex}</span> من إجمالي{" "}
                  <span className="font-black text-slate-900">{totalEntries}</span> قيد
                </span>

                <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">لكل صفحة:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-400 cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* أزرار الصفحات */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || loading}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title="الصفحة الأولى"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 h-8 rounded-lg bg-white border border-slate-200 flex items-center gap-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                >
                  <ChevronRight className="w-3.5 h-3.5" /> السابق
                </button>

                {/* أرقام الصفحات الذكية */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
                    .map((p, i, arr) => {
                      const prevPage = arr[i - 1];
                      const showEllipsis = prevPage && p - prevPage > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="text-slate-400 text-xs px-1">...</span>}
                          <button
                            onClick={() => setPage(p)}
                            disabled={loading}
                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              page === p
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 h-8 rounded-lg bg-white border border-slate-200 flex items-center gap-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                >
                  التالي <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || loading}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title="الصفحة الأخيرة"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  /* ═══════════════════════════════════════════════════════════════
     RENDER — صفحة إنشاء / تعديل القيد (Premium SaaS Design)
     ═══════════════════════════════════════════════════════════════ */
  if (!editor) return null;

  const openRecentEntry = (e: JournalEntryData) => {
    const hasUnsaved = editor.lines.some((l) => l.account_id || l.debit || l.credit) || editor.description;
    if (hasUnsaved && !confirm("سيتم فقدان التعديلات غير المحفوظة في القيد الحالي. هل تريد فتح القيد المحدد؟")) return;
    editEntry(e);
  };

  /* شريط التوازن المرئي (نسبة المدين من الإجمالي) */
  const grandTotal = totalDebit + totalCredit;
  const debitShare = grandTotal > 0 ? (totalDebit / grandTotal) * 100 : 50;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] font-sans">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="max-w-[97%] mx-auto py-6 space-y-5">

        {/* ─── Header: العنوان + أزرار الإجراءات ─── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-md shadow-blue-900/15">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
                {editor.id ? "تعديل قيد يومية" : "قيد يومية جديد"}
                <span className="text-[#1E3A8A] font-mono tracking-wide" dir="ltr">- {editor.code}</span>
              </h1>
              <p className="text-xs text-slate-400 font-bold mt-0.5">القسم الفرعي: القيود اليومية</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* إلغاء — Secondary */}
            <button
              type="button"
              onClick={() => { setMode("list"); setEditor(null); setAttachedFiles([]); }}
              className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>

            {/* إرفاق مستند */}
            <label className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleAttachFiles} />
              <Paperclip className="w-4 h-4" />
              إرفاق مستند
              {attachedFiles.length > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">{attachedFiles.length}</span>
              )}
            </label>

            {/* اعتماد — Outline */}
            <button
              type="button"
              onClick={() => saveEntry(true)}
              disabled={!balanced}
              title={balanced ? "اعتماد القيد وترحيله للحسابات" : "القيد غير متوازن — لا يمكن الاعتماد حتى يتساوى المدين مع الدائن"}
              className={`flex items-center gap-2 border-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
                balanced
                  ? "border-[#1E3A8A] text-[#1E3A8A] bg-transparent hover:bg-[#1E3A8A] hover:text-white shadow-sm cursor-pointer"
                  : "border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              اعتماد
            </button>

            {/* حفظ — Primary */}
            <button
              type="button"
              onClick={() => saveEntry(false)}
              className="flex items-center gap-2 bg-[#1E3A8A] hover:bg-[#1a3377] text-white px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md shadow-blue-900/20 hover:shadow-lg cursor-pointer"
            >
              <Save className="w-4 h-4" />
              حفظ
            </button>
          </div>
        </div>

        {/* ─── Section 1: بيانات القيد الأساسية ─── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500">رقم القيد</label>
              <input value={editor.code} disabled dir="ltr"
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-mono font-black text-slate-600 cursor-not-allowed" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500">تاريخ القيد <span className="text-rose-500">*</span></label>
              <input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500">نوع القيد <span className="text-rose-500">*</span></label>
              <select value={editor.entry_type} onChange={(e) => setEditor({ ...editor, entry_type: e.target.value as any })}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer">
                {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-500">بيان القيد العام (الوصف)</label>
            <input value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              placeholder="مثال: قيد إثبات مبيعات آجلة عن شهر يناير 2026"
              className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-normal placeholder:text-slate-300" />
          </div>
        </div>

        {/* ─── Section 2: المرجع والعملة والمشروع ─── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500">المرجع / رقم المستند</label>
              <input value={editor.reference} onChange={(e) => setEditor({ ...editor, reference: e.target.value })}
                placeholder="INV-2026-0101" dir="ltr"
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-normal placeholder:text-slate-300" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500">العملة وسعر الصرف</label>
              <div className="flex gap-2">
                <select value={editor.currency} onChange={(e) => setEditor({ ...editor, currency: e.target.value, exchange_rate: e.target.value === "EGP" ? "1.00" : editor.exchange_rate })}
                  className="w-[42%] h-11 bg-white border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] transition-all cursor-pointer">
                  <option value="EGP">EGP - جنيه مصري</option>
                  <option value="SAR">SAR - ريال سعودي</option>
                  <option value="AED">AED - درهم إماراتي</option>
                  <option value="USD">USD - دولار أمريكي</option>
                  <option value="EUR">EUR - يورو</option>
                </select>
                <input type="number" step="0.01" min="0" value={editor.exchange_rate}
                  onChange={(e) => setEditor({ ...editor, exchange_rate: e.target.value })}
                  disabled={editor.currency === "EGP"} dir="ltr"
                  title={editor.currency === "EGP" ? "سعر الصرف الأساسي للجنيه المصري" : `سعر صرف 1 ${editor.currency} بالجنيه`}
                  className="flex-1 h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500">المشروع / مركز التكلفة</label>
              <select value={editor.project} onChange={(e) => setEditor({ ...editor, project: e.target.value })}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer">
                {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ─── المحتوى الرئيسي: جدول البنود + الشريط الجانبي ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-5 items-start">

          {/* ═══ بطاقة جدول البنود ═══ */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4.5 h-4.5 text-[#1E3A8A]" />
                <div>
                  <h3 className="text-sm font-black text-slate-800">بنود القيد المحاسبي</h3>
                  <p className="text-[10px] text-slate-400 font-bold">{editor.lines.length} سطر • بنود صالحة: {filledLines} • اضغط Enter لإضافة سطر</p>
                </div>
              </div>
              {duplicateAccountIds.size > 0 && (
                <span className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black px-3 py-1.5 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" /> لا يمكن تكرار نفس الحساب ({duplicateAccountIds.size})
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F1F5FB] text-[#1E3A8A] border-b-2 border-[#1E3A8A]/10">
                    <th className="px-2 py-3.5 text-center font-black w-10">#</th>
                    <th className="px-2 py-3.5 text-right font-black min-w-[185px]">الحساب</th>
                    <th className="px-2 py-3.5 text-right font-black min-w-[160px]">البيان / الوصف</th>
                    <th className="px-2 py-3.5 text-center font-black min-w-[100px]">مدين</th>
                    <th className="px-2 py-3.5 text-center font-black min-w-[100px]">دائن</th>
                    <th className="px-2 py-3.5 text-center font-black min-w-[110px]">مركز التكلفة</th>
                    <th className="px-2 py-3.5 text-center font-black w-24">العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {editor.lines.map((line, idx) => {
                    const isDup = duplicateAccountIds.has(line.account_id);
                    return (
                      <tr key={line.id} className={`transition-colors ${isDup ? "bg-rose-50/60" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-blue-50/30`}>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black ${isDup ? "bg-rose-100 text-rose-700" : "bg-[#1E3A8A]/5 text-[#1E3A8A]"}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <AccountSelect
                            value={line.account_id}
                            accounts={accounts}
                            onChange={(accId, accName) => handleAccountChange(line.id, accId, accName)}
                          />
                          {isDup && (
                            <p className="text-[9px] font-black text-rose-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> حساب مكرر — غير مسموح
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }}
                            placeholder="وصف البند..."
                            className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-normal placeholder:text-slate-300" />
                        </td>
                        <td className="px-2 py-2.5 bg-blue-50/20">
                          <input type="number" step="0.01" min="0" value={line.debit} onChange={(e) => handleDebitChange(line.id, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }}
                            placeholder="0.00" dir="ltr" disabled={!!line.credit && parseFloat(line.credit) > 0}
                            title={line.credit && parseFloat(line.credit) > 0 ? "أدخل قيمة دائن بالفعل — امسحها أولاً" : "أدخل المدين (يمسح الدائن تلقائياً)"}
                            className="w-full h-9 bg-white border border-blue-100 rounded-xl px-2 text-center text-xs font-mono font-black text-[#1E3A8A] focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-normal placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed" />
                        </td>
                        <td className="px-2 py-2.5 bg-purple-50/20">
                          <input type="number" step="0.01" min="0" value={line.credit} onChange={(e) => handleCreditChange(line.id, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }}
                            placeholder="0.00" dir="ltr" disabled={!!line.debit && parseFloat(line.debit) > 0}
                            title={line.debit && parseFloat(line.debit) > 0 ? "أدخل قيمة مدين بالفعل — امسحها أولاً" : "أدخل الدائن (يمسح المدين تلقائياً)"}
                            className="w-full h-9 bg-white border border-purple-100 rounded-xl px-2 text-center text-xs font-mono font-black text-purple-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all placeholder:font-normal placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed" />
                        </td>
                        <td className="px-2 py-2.5">
                          <select value={line.cost_center} onChange={(e) => updateLine(line.id, "cost_center", e.target.value)}
                            className="w-full h-9 bg-white border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E3A8A] cursor-pointer">
                            {COST_CENTERS.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => duplicateLine(line.id)} title="تكرار السطر"
                              className="w-8 h-8 rounded-lg hover:bg-purple-100 text-slate-400 hover:text-purple-600 transition-all flex items-center justify-center cursor-pointer">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => removeLine(line.id)} title="حذف السطر"
                              className="w-8 h-8 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-all flex items-center justify-center cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ─── شريط الإجماليات اللاصق ─── */}
            <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm border-t-2 border-[#1E3A8A]/10 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">إجمالي المدين</span>
                  <span className="font-mono font-black text-lg text-[#1E3A8A] leading-tight" dir="ltr">{fmt(totalDebit)}</span>
                </div>
                <div className="w-px h-9 bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">إجمالي الدائن</span>
                  <span className="font-mono font-black text-lg text-purple-700 leading-tight" dir="ltr">{fmt(totalCredit)}</span>
                </div>
                <div className="w-px h-9 bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">الفرق</span>
                  <span className={`font-mono font-black text-lg leading-tight ${diff > 0 ? "text-rose-600" : "text-emerald-600"}`} dir="ltr">{fmt(diff)}</span>
                </div>
              </div>
              {balanced ? (
                <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  className="flex items-center gap-2 bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black px-4 py-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                  القيد متوازن ✓
                </motion.span>
              ) : (
                <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  className="flex flex-col items-center bg-rose-100 text-rose-700 border border-rose-200 px-4 py-1.5 rounded-xl">
                  <span className="flex items-center gap-1.5 text-xs font-black">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    الفرق: <span dir="ltr">{fmt(diff)}</span>
                  </span>
                  <span className="text-[9px] font-bold text-rose-500">
                    {totalDebit > totalCredit ? "المدين أكبر — أكمل الدائن" : "الدائن أكبر — أكمل المدين"}
                  </span>
                </motion.span>
              )}
            </div>

            {/* ─── أزرار إدارة البنود ─── */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-[#FAFBFD] flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={addLine}
                className="flex items-center gap-2 bg-white border border-[#1E3A8A]/20 text-[#1E3A8A] hover:bg-blue-50 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer">
                <Plus className="w-4 h-4" />
                إضافة سطر
              </button>
              <button type="button" onClick={clearAllLines}
                className="flex items-center gap-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer">
                <Trash2 className="w-4 h-4" />
                مسح الكل
              </button>
              <div className="mr-auto flex items-center gap-2">
                <button type="button" onClick={reverseEntry} title="إضافة بنود عكسية (قلب المدين والدائن)"
                  className="flex items-center gap-1.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer">
                  <ClipboardList className="w-3.5 h-3.5" />
                  قيد عكسي
                </button>
                <button type="button" onClick={copyEntry} title="نسخ القيد بكود جديد"
                  className="flex items-center gap-1.5 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer">
                  <Copy className="w-3.5 h-3.5" />
                  نسخ القيد
                </button>
              </div>
            </div>
          </div>

          {/* ═══ الشريط الجانبي (يسار الديسكتوب) ═══ */}
          <div className="space-y-4">

            {/* بطاقة التوازن */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#1E3A8A]/8 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-[#1E3A8A]" />
                </div>
                <h3 className="text-sm font-black text-slate-800">توازن القيد</h3>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center p-3 bg-[#1E3A8A]/5 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">إجمالي المدين</span>
                  <span className="font-mono font-black text-[#1E3A8A]" dir="ltr">{fmt(totalDebit)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">إجمالي الدائن</span>
                  <span className="font-mono font-black text-purple-700" dir="ltr">{fmt(totalCredit)}</span>
                </div>

                {/* شريط نسبة التوازن */}
                <div className="pt-1">
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-[#1E3A8A] h-full transition-all duration-500" style={{ width: `${debitShare}%` }} />
                    <div className="bg-purple-400 h-full transition-all duration-500" style={{ width: `${100 - debitShare}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] font-black text-[#1E3A8A]">مدين {Math.round(debitShare)}%</span>
                    <span className="text-[9px] font-black text-purple-500">دائن {Math.round(100 - debitShare)}%</span>
                  </div>
                </div>

                {balanced ? (
                  <div className="flex items-center gap-2.5 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-800">القيد متوازن ✓</p>
                      <p className="text-[10px] text-emerald-600 font-bold">جاهز للاعتماد والترحيل</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-rose-800">الفرق: <span dir="ltr">{fmt(diff)}</span> غير متزن</p>
                      <p className="text-[10px] text-rose-600 font-bold">
                        {totalDebit > totalCredit ? `أضف ${fmt(diff)} في خانة الدائن` : `أضف ${fmt(diff)} في خانة المدين`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* أحدث القيود */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1E3A8A]" />
                  أحدث القيود
                </h3>
                <button onClick={() => { setEditor(null); setMode("list"); }}
                  className="text-[11px] font-black text-[#1E3A8A] hover:underline cursor-pointer">
                  عرض الكل
                </button>
              </div>
              <div className="space-y-1.5">
                {entries.slice(0, 5).map((e) => (
                  <button key={e.id} onClick={() => openRecentEntry(e)}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-right cursor-pointer group">
                    <div className="w-9 h-9 rounded-xl bg-[#1E3A8A]/5 flex items-center justify-center shrink-0 group-hover:bg-[#1E3A8A]/10 transition-colors">
                      <FileText className="w-4 h-4 text-[#1E3A8A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-700 truncate">{e.description || e.code}</p>
                      <p className="text-[10px] text-slate-400 font-bold" dir="ltr">{e.code} • {e.date}</p>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#1E3A8A] transition-colors" />
                  </button>
                ))}
                {entries.length === 0 && (
                  <p className="text-center text-[11px] text-slate-400 py-6 font-bold">لا توجد قيود سابقة بعد</p>
                )}
              </div>
            </div>

            {/* نصائح سريعة */}
            <div className="bg-gradient-to-bl from-[#1E3A8A]/5 via-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-800">نصائح سريعة</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  "اضغط Enter في أي خانة بالجدول لإضافة سطر جديد فوراً",
                  "إدخال مدين يمسح الدائن تلقائياً في نفس السطر والعكس",
                  "لا يمكن اعتماد القيد إلا إذا تساوى المدين مع الدائن تماماً",
                  "لا يمكن تكرار نفس الحساب في أكثر من سطر داخل القيد الواحد",
                  "استخدم «قيد عكسي» لعكس بنود القيد أو «نسخ القيد» لإنشاء نسخة جديدة",
                ].map((tip, i) => (
                  <li key={i} className="flex gap-2 text-[11px] font-bold text-slate-600 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A] mt-1.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
