import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import {
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Settings,
  FileText,
  Download,
  Printer,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
  CreditCard,
  Receipt,
  Calendar,
  Filter,
  Link2,
  ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types + helpers                                                     */
/* ------------------------------------------------------------------ */

type BankTab = "dashboard" | "accounts" | "transactions" | "reconciliation" | "cheques" | "reports" | "settings";
type ReportKind = "balances" | "statement" | "cashflow" | "fees" | "reconciliation" | "cheques";

interface BankManagementProps {
  onBack: () => void;
  initialTab?: string;
}

const money = (value: any) =>
  Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthStartISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const formatDate = (value: any) => {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const CATEGORY_LABELS: Record<string, string> = {
  deposit: "إيداع من الخزينة",
  withdraw: "سحب إلى الخزينة",
  fee: "عمولة / مصروف بنكي",
  interest: "فوائد / إيراد بنكي",
  transfer: "تحويل بين بنكين",
  cheque_in: "تحصيل شيك وارد",
  cheque_out: "صرف شيك صادر",
  adjustment: "تسوية يدوية",
};

const STATUS_LABELS: Record<string, string> = {
  unmatched: "غير مطابق",
  matched: "مطابق",
  reconciled: "تمت التسوية",
  imported: "مستورد",
  registered: "مسجل",
  pending: "معلق",
  collected: "محصل",
  paid: "مدفوع",
  cancelled: "ملغي",
};

const normalizeTab = (value?: string): { tab: BankTab; report?: ReportKind } => {
  switch (value) {
    case "bank_settings":
    case "bank_accounting":
      return { tab: "settings" };
    case "transfers":
      return { tab: "transactions" };
    case "bank_balances":
      return { tab: "reports", report: "balances" };
    case "bank_transactions":
      return { tab: "transactions" };
    case "bank_reconciliation":
      return { tab: "reports", report: "reconciliation" };
    case "bank_flow":
      return { tab: "reports", report: "cashflow" };
    case "bank_fees":
      return { tab: "reports", report: "fees" };
    case "bank_cheques":
      return { tab: "reports", report: "cheques" };
    case "accounts":
    case "transactions":
    case "reconciliation":
    case "cheques":
    case "reports":
    case "settings":
    case "dashboard":
      return { tab: value as BankTab };
    default:
      return { tab: "dashboard" };
  }
};

/* ------------------------------------------------------------------ */
/* Small UI building blocks                                            */
/* ------------------------------------------------------------------ */

const Kpi: React.FC<{
  title: string;
  value: string;
  hint?: string;
  tone?: "indigo" | "emerald" | "rose" | "slate" | "amber" | "cyan";
  icon?: React.ReactNode;
}> = ({ title, value, hint, tone = "indigo", icon }) => {
  const tones: Record<string, string> = {
    indigo: "border-indigo-200 text-indigo-700 bg-indigo-50",
    emerald: "border-emerald-200 text-emerald-700 bg-emerald-50",
    rose: "border-rose-200 text-rose-700 bg-rose-50",
    slate: "border-slate-200 text-slate-700 bg-slate-50",
    amber: "border-amber-200 text-amber-700 bg-amber-50",
    cyan: "border-cyan-200 text-cyan-700 bg-cyan-50",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black text-slate-500">{title}</span>
        {icon && <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${tones[tone]}`}>{icon}</span>}
      </div>
      <div className="text-xl font-black text-slate-900 mt-2">{value}</div>
      {hint && <div className="text-[10px] font-bold text-slate-400 mt-1">{hint}</div>}
    </div>
  );
};

const Badge: React.FC<{ children: React.ReactNode; tone?: string }> = ({ children, tone = "slate" }) => {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
};

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({
  title,
  subtitle,
  onClose,
  children,
  wide,
}) => (
  <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-3 md:p-6" dir="rtl">
    <div className={`bg-white rounded-2xl w-full ${wide ? "max-w-6xl" : "max-w-2xl"} max-h-[92vh] flex flex-col shadow-2xl`}>
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={`block ${className || ""}`}>
    <span className="text-[11px] font-black text-slate-500 block mb-1">{label}</span>
    {children}
  </label>
);

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500";

const btnPrimary =
  "px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50";
const btnGhost =
  "px-3 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer";

const EmptyState: React.FC<{ title: string; hint?: string; action?: React.ReactNode }> = ({ title, hint, action }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
    <Landmark className="w-10 h-10 text-slate-300" />
    <p className="text-sm font-black text-slate-500">{title}</p>
    {hint && <p className="text-xs text-slate-400 max-w-md">{hint}</p>}
    {action}
  </div>
);

const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escape = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const printTable = (title: string, subtitle: string, headers: string[], rows: (string | number)[][], footer?: string) => {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = (value: any) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:'Cairo',Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:20px;margin:0 0 4px} p{font-size:11px;color:#64748b;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#eef2ff;color:#3730a3;padding:8px;border:1px solid #c7d2fe;text-align:right}
      td{padding:7px;border:1px solid #e2e8f0}
      tfoot td{font-weight:bold;background:#f8fafc}
      .brand{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #4f46e5;padding-bottom:10px;margin-bottom:14px}
    </style></head><body>
    <div class="brand"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><strong>REMO PRO ERP</strong></div>
    <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody>
    ${footer ? `<tfoot><tr><td colspan="${headers.length}">${esc(footer)}</td></tr></tfoot>` : ""}</table>
    <script>window.onload=function(){window.focus();window.print();}</script>
    </body></html>`);
  w.document.close();
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const BankManagement: React.FC<BankManagementProps> = ({ onBack, initialTab }) => {
  const initial = normalizeTab(initialTab);

  const [tab, setTab] = useState<BankTab>(initial.tab);
  const [reportKind, setReportKind] = useState<ReportKind>(initial.report || "balances");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [lookups, setLookups] = useState<any>({ treasury_accounts: [], gl_accounts: [], banks: [], defaults: {}, settings: {} });
  const [branches, setBranches] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [cheques, setCheques] = useState<any[]>([]);
  const [statementDetails, setStatementDetails] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [settingsForm, setSettingsForm] = useState<any>({});

  const [txFilters, setTxFilters] = useState({
    account_id: "all",
    type: "all",
    category: "all",
    from_date: monthStartISO(),
    to_date: todayISO(),
    search: "",
  });
  const [recAccount, setRecAccount] = useState<string>("all");
  const [reportParams, setReportParams] = useState({
    account_id: "",
    as_of: todayISO(),
    from_date: monthStartISO(),
    to_date: todayISO(),
    year: String(new Date().getFullYear()),
  });

  const [accountModal, setAccountModal] = useState<{ open: boolean; editing: any | null; form: any }>({
    open: false,
    editing: null,
    form: {},
  });
  const [txModal, setTxModal] = useState<{ open: boolean; form: any }>({ open: false, form: {} });
  const [transferModal, setTransferModal] = useState<{ open: boolean; form: any }>({ open: false, form: {} });
  const [statementModal, setStatementModal] = useState<{ open: boolean; form: any }>({ open: false, form: {} });
  const [chequeModal, setChequeModal] = useState<{ open: boolean; form: any }>({ open: false, form: {} });

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const next = normalizeTab(initialTab);
    setTab(next.tab);
    if (next.report) setReportKind(next.report);
  }, [initialTab]);

  /* ------------------------- loaders ------------------------- */

  const loadLookups = useCallback(async () => {
    try {
      const [lookupRes, branchRes, settingsRes] = await Promise.all([
        api.get("/api/banks/lookups"),
        api.get("/api/branches"),
        api.get("/api/banks/settings"),
      ]);
      if (lookupRes.ok) {
        const data = await lookupRes.json();
        setLookups(data);
      }
      if (branchRes.ok) setBranches(await branchRes.json().catch(() => []));
      if (settingsRes.ok) setSettingsForm(await settingsRes.json().catch(() => ({})));
    } catch (err) {
      console.error("bank lookups", err);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await api.get("/api/banks/accounts");
    if (res.ok) setAccounts(await res.json());
  }, []);

  const loadDashboard = useCallback(async () => {
    const res = await api.get("/api/banks/dashboard");
    if (res.ok) setDashboard(await res.json());
  }, []);

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(txFilters).forEach(([key, value]) => {
      if (value && value !== "all") params.append(key, String(value));
    });
    const res = await api.get(`/api/banks/transactions?${params.toString()}`);
    if (res.ok) setTransactions(await res.json());
  }, [txFilters]);

  const loadStatements = useCallback(async () => {
    const params = new URLSearchParams();
    if (recAccount !== "all") params.append("account_id", recAccount);
    const res = await api.get(`/api/banks/statements?${params.toString()}`);
    if (res.ok) setStatements(await res.json());
  }, [recAccount]);

  const loadCheques = useCallback(async () => {
    const res = await api.get("/api/banks/cheques");
    if (res.ok) setCheques(await res.json());
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let url = "";
      if (reportKind === "balances") {
        url = `/api/banks/reports/balances?as_of=${reportParams.as_of}`;
      } else if (reportKind === "statement") {
        if (!reportParams.account_id) {
          setReportData(null);
          return;
        }
        url = `/api/banks/reports/statement?account_id=${reportParams.account_id}&from_date=${reportParams.from_date}&to_date=${reportParams.to_date}`;
      } else if (reportKind === "cashflow") {
        url = `/api/banks/reports/cashflow?year=${reportParams.year}`;
      } else if (reportKind === "fees") {
        url = `/api/banks/reports/fees?from_date=${reportParams.from_date}&to_date=${reportParams.to_date}`;
      } else if (reportKind === "reconciliation") {
        url = `/api/banks/reports/reconciliation?account_id=${reportParams.account_id || "all"}`;
      } else {
        url = `/api/banks/reports/cheques`;
      }
      const res = await api.get(url);
      if (res.ok) setReportData(await res.json());
      else showToast("error", "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }, [reportKind, reportParams, showToast]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    loadLookups();
    loadAccounts();
  }, [loadLookups, loadAccounts]);

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      try {
        if (tab === "dashboard") await Promise.all([loadDashboard(), loadAccounts()]);
        else if (tab === "accounts") await loadAccounts();
        else if (tab === "transactions") await loadTransactions();
        else if (tab === "reconciliation") await Promise.all([loadStatements(), loadAccounts()]);
        else if (tab === "cheques") await Promise.all([loadCheques(), loadAccounts()]);
        else if (tab === "reports") await loadReport();
        else if (tab === "settings") await loadLookups();
      } finally {
        setLoading(false);
      }
    };
    run();
    // Filters are applied explicitly through the refresh button (reloadKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reloadKey, recAccount]);

  useEffect(() => {
    if (!reportParams.account_id && accounts[0]) {
      setReportParams((prev) => ({ ...prev, account_id: String(accounts[0].id) }));
    }
  }, [accounts, reportParams.account_id]);

  /* ------------------------- actions ------------------------- */

  const openAccountModal = (account?: any) => {
    setAccountModal({
      open: true,
      editing: account || null,
      form: account
        ? { ...account, opening_balance: account.opening_balance ?? 0, bank_id: account.bank_id ?? "", gl_account_id: account.gl_account_id ?? "", treasury_account_id: account.treasury_account_id ?? "" }
        : {
            name: "",
            bank_name: "",
            bank_id: "",
            account_number: "",
            iban: "",
            swift_code: "",
            currency: "EGP",
            account_type: "current",
            opening_balance: 0,
            branch_id: branches[0]?.id ?? "",
            gl_account_id: "",
            treasury_account_id: "",
            create_gl_account: true,
            create_treasury_account: true,
            is_active: true,
            notes: "",
            opening_date: todayISO(),
          },
    });
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = accountModal.form;
    const payload = {
      ...f,
      opening_balance: num(f.opening_balance),
      branch_id: f.branch_id ? Number(f.branch_id) : null,
      bank_id: f.bank_id ? Number(f.bank_id) : null,
      gl_account_id: f.gl_account_id ? Number(f.gl_account_id) : null,
      treasury_account_id: f.treasury_account_id ? Number(f.treasury_account_id) : null,
    };
    const res = accountModal.editing
      ? await api.put(`/api/banks/accounts/${accountModal.editing.id}`, payload)
      : await api.post("/api/banks/accounts", payload);
    if (res.ok) {
      setAccountModal({ open: false, editing: null, form: {} });
      showToast("success", accountModal.editing ? "تم تحديث الحساب البنكي" : "تم إنشاء الحساب البنكي وربطه بالخزينة والحسابات العامة");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر حفظ الحساب البنكي");
    }
  };

  const openTxModal = (operation = "deposit", accountId?: number) => {
    setTxModal({
      open: true,
      form: {
        operation,
        account_id: accountId || accounts[0]?.id || "",
        amount: "",
        transaction_date: todayISO(),
        description: "",
        reference: "",
        counterparty: "",
        cash_account_id: lookups.treasury_accounts?.find((t: any) => t.type === "cash")?.id || "",
        counterpart_account_id:
          operation === "fee"
            ? lookups.defaults?.other_expense_account_id || ""
            : operation === "interest"
              ? lookups.defaults?.other_income_account_id || ""
              : "",
      },
    });
  };

  const saveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = txModal.form;
    const res = await api.post("/api/banks/transactions", {
      ...f,
      account_id: Number(f.account_id),
      amount: num(f.amount),
      cash_account_id: f.cash_account_id ? Number(f.cash_account_id) : null,
      counterpart_account_id: f.counterpart_account_id ? Number(f.counterpart_account_id) : null,
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setTxModal({ open: false, form: {} });
      showToast(
        "success",
        `تم تنفيذ الحركة بنجاح${data?.journal_entry_id ? ` وترحيلها للحسابات العامة (قيد #${data.journal_entry_id})` : ""}`
      );
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر تنفيذ الحركة");
    }
  };

  const openTransferModal = () => {
    setTransferModal({
      open: true,
      form: {
        from_account_id: accounts[0]?.id || "",
        to_account_id: accounts[1]?.id || "",
        amount: "",
        transaction_date: todayISO(),
        description: "",
        reference: "",
      },
    });
  };

  const saveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = transferModal.form;
    const res = await api.post("/api/banks/transfers", {
      ...f,
      from_account_id: Number(f.from_account_id),
      to_account_id: Number(f.to_account_id),
      amount: num(f.amount),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setTransferModal({ open: false, form: {} });
      showToast("success", `تم التحويل ${data?.transfer_number || ""} وترحيله محاسبيًا`);
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر تنفيذ التحويل");
    }
  };

  const openStatementModal = () => {
    setStatementModal({
      open: true,
      form: {
        account_id: recAccount !== "all" ? recAccount : accounts[0]?.id || "",
        period_from: monthStartISO(),
        period_to: todayISO(),
        opening_balance: "",
        closing_balance: "",
        lines_text: "2026-10-01,عمولة بنك,100,debit\n2026-10-05,إيداع عميل,5000,credit",
      },
    });
  };

  const parseStatementLines = (text: string) =>
    String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim());
        const [date, description, amount, direction] = parts;
        const n = num(amount);
        return {
          date,
          description,
          amount: Math.abs(n),
          direction: (direction || "").toLowerCase() || (n < 0 ? "debit" : "credit"),
        };
      });

  const saveStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = statementModal.form;
    const lines = parseStatementLines(f.lines_text);
    const res = await api.post("/api/banks/statements", {
      account_id: Number(f.account_id),
      period_from: f.period_from,
      period_to: f.period_to,
      opening_balance: num(f.opening_balance),
      closing_balance: num(f.closing_balance),
      lines,
    });
    if (res.ok) {
      setStatementModal({ open: false, form: {} });
      showToast("success", `تم إنشاء كشف الحساب بـ ${lines.length} حركة`);
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر إنشاء الكشف");
    }
  };

  const openStatementDetails = async (id: number) => {
    const res = await api.get(`/api/banks/statements/${id}`);
    if (res.ok) setStatementDetails(await res.json());
  };

  const autoMatch = async (id: number) => {
    const res = await api.post(`/api/banks/statements/${id}/auto-match`, {});
    if (res.ok) {
      const data = await res.json();
      showToast("success", `تمت مطابقة ${data.matched} من ${data.total} حركة`);
      openStatementDetails(id);
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذرت المطابقة");
    }
  };

  const closeStatement = async (id: number) => {
    const res = await api.post(`/api/banks/statements/${id}/close`, {});
    if (res.ok) {
      showToast("success", "تم إغلاق التسوية البنكية");
      setStatementDetails(null);
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر إغلاق التسوية");
    }
  };

  const openChequeModal = () => {
    setChequeModal({
      open: true,
      form: {
        account_id: accounts[0]?.id || "",
        check_number: "",
        check_type: "incoming",
        beneficiary: "",
        amount: "",
        issue_date: todayISO(),
        due_date: todayISO(),
        reference: "",
        notes: "",
      },
    });
  };

  const saveCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = chequeModal.form;
    const res = await api.post("/api/banks/cheques", { ...f, account_id: Number(f.account_id), amount: num(f.amount) });
    if (res.ok) {
      setChequeModal({ open: false, form: {} });
      showToast("success", "تم تسجيل الشيك");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر تسجيل الشيك");
    }
  };

  const settleCheque = async (id: number) => {
    const res = await api.post(`/api/banks/cheques/${id}/settle`, {});
    if (res.ok) {
      showToast("success", "تم تحصيل/صرف الشيك وترحيله للبنك والخزينة والحسابات");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر تسوية الشيك");
    }
  };

  const cancelCheque = async (id: number) => {
    const res = await api.post(`/api/banks/cheques/${id}/cancel`, {});
    if (res.ok) {
      showToast("success", "تم إلغاء الشيك");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast("error", body?.error || "تعذر إلغاء الشيك");
    }
  };

  const saveSettings = async () => {
    const res = await api.put("/api/banks/settings", settingsForm);
    if (res.ok) showToast("success", "تم حفظ إعدادات البنوك");
    else showToast("error", "تعذر حفظ الإعدادات");
  };

  /* ------------------------- derived ------------------------- */

  const totals = useMemo(
    () => ({
      balance: accounts.reduce((sum, a) => sum + num(a.balance), 0),
      available: accounts.reduce((sum, a) => sum + num(a.available_balance ?? a.balance), 0),
      active: accounts.filter((a) => a.is_active !== false).length,
    }),
    [accounts]
  );

  const glAccounts = lookups.gl_accounts || [];
  const treasuryAccounts = lookups.treasury_accounts || [];

  const txTotalIn = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + num(t.amount), 0);
  const txTotalOut = transactions.filter((t) => t.type === "debit").reduce((s, t) => s + num(t.amount), 0);

  const reports: { id: ReportKind; label: string; hint: string; icon: React.ReactNode }[] = [
    { id: "balances", label: "أرصدة البنوك ومطابقة GL", hint: "رصيد كل بنك مقابل الحسابات العامة والخزينة", icon: <Wallet className="w-4 h-4" /> },
    { id: "statement", label: "كشف حساب بنكي", hint: "حركة الحساب مع الرصيد التراكمي", icon: <FileText className="w-4 h-4" /> },
    { id: "cashflow", label: "التدفق النقدي البنكي", hint: "إيداعات ومسحوبات شهرية", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "fees", label: "العمولات والفوائد", hint: "مصروفات وإيرادات البنك", icon: <Receipt className="w-4 h-4" /> },
    { id: "reconciliation", label: "التسويات البنكية", hint: "كشوف البنك وحالة المطابقة", icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: "cheques", label: "سجل الشيكات", hint: "شيكات واردة وصادرة", icon: <CreditCard className="w-4 h-4" /> },
  ];

  /* ------------------------- renderers ------------------------- */

  const renderDashboard = () => {
    if (!dashboard) return <EmptyState title="لا توجد بيانات لعرضها" hint="أضف حسابًا بنكيًا أو حركة لبدء المؤشرات." />;
    const months = dashboard.monthly || [];
    const maxMonth = Math.max(1, ...months.map((m: any) => Math.max(num(m.inflows), num(m.outflows))));
    const perBank = dashboard.per_bank || [];
    const maxBank = Math.max(1, ...perBank.map((b: any) => num(b.balance)));

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi title="إجمالي أرصدة البنوك" value={`${money(dashboard.accounts?.total_balance)} ج.م`} hint={`${dashboard.accounts?.count || 0} حساب · ${dashboard.accounts?.active_count || 0} نشط`} tone="indigo" icon={<Landmark className="w-4 h-4" />} />
          <Kpi title="الرصيد المتاح" value={`${money(dashboard.accounts?.total_available)} ج.م`} hint="بعد الحجوزات والحدود" tone="emerald" icon={<Wallet className="w-4 h-4" />} />
          <Kpi title="الشهر الحالي — داخل / خارج" value={`${money(dashboard.month?.inflows)} / ${money(dashboard.month?.outflows)}`} hint="إيداعات / مسحوبات" tone="cyan" icon={<ArrowRightLeft className="w-4 h-4" />} />
          <Kpi title="حركات غير مطابقة" value={String(dashboard.unreconciled?.count || 0)} hint="تحتاج تسوية بنكية" tone={num(dashboard.unreconciled?.count) ? "rose" : "slate"} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        <div className={`rounded-2xl border p-4 ${Math.abs(num(dashboard.integration?.gl_variance)) < 0.02 && Math.abs(num(dashboard.integration?.treasury_variance)) < 0.02 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${Math.abs(num(dashboard.integration?.gl_variance)) < 0.02 ? "text-emerald-600" : "text-amber-600"}`} />
              <div>
                <p className="text-xs font-black text-slate-800">مطابقة التكامل: البنوك ↔ الحسابات العامة ↔ الخزينة</p>
                <p className="text-[10px] font-bold text-slate-500">أي فرق يعني حركة لم تُرحّل أو حساب غير مربوط</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
              <Badge tone="indigo">البنوك: {money(dashboard.integration?.bank_total)}</Badge>
              <Badge tone="emerald">GL: {money(dashboard.integration?.gl_total)}</Badge>
              <Badge tone="cyan">الخزينة: {money(dashboard.integration?.treasury_total)}</Badge>
              <Badge tone={Math.abs(num(dashboard.integration?.gl_variance)) < 0.02 ? "emerald" : "rose"}>
                فرق GL: {money(dashboard.integration?.gl_variance)}
              </Badge>
              <Badge tone={Math.abs(num(dashboard.integration?.treasury_variance)) < 0.02 ? "emerald" : "rose"}>
                فرق الخزينة: {money(dashboard.integration?.treasury_variance)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" /> أرصدة البنوك
            </h3>
            <div className="space-y-3">
              {perBank.length === 0 && <p className="text-xs text-slate-400 font-bold">لا توجد حسابات بنكية بعد</p>}
              {perBank.map((b: any) => (
                <div key={b.bank_name}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">{b.bank_name}</span>
                    <span className="text-slate-500">{money(b.balance)} ج.م · {b.accounts} حساب</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(3, (num(b.balance) / maxBank) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> التدفق آخر 6 أشهر
            </h3>
            <div className="flex items-end justify-between gap-2 h-44">
              {months.map((m: any) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-32 flex items-end justify-center gap-0.5">
                    <div className="w-1/2 bg-emerald-500 rounded-t" style={{ height: `${Math.max(2, (num(m.inflows) / maxMonth) * 100)}%` }} title={`داخل ${money(m.inflows)}`} />
                    <div className="w-1/2 bg-rose-400 rounded-t" style={{ height: `${Math.max(2, (num(m.outflows) / maxMonth) * 100)}%` }} title={`خارج ${money(m.outflows)}`} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400" dir="ltr">{m.month}</span>
                </div>
              ))}
              {months.length === 0 && <p className="text-xs text-slate-400 font-bold">لا توجد حركات</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><Receipt className="w-4 h-4 text-indigo-600" /> أحدث الحركات</h3>
              <button type="button" onClick={() => setTab("transactions")} className="text-[11px] font-black text-indigo-600 cursor-pointer">عرض الكل</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-right font-black">التاريخ</th>
                    <th className="p-3 text-right font-black">الحساب</th>
                    <th className="p-3 text-right font-black">البيان</th>
                    <th className="p-3 text-center font-black">النوع</th>
                    <th className="p-3 text-center font-black">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.latest || []).map((t: any) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="p-3 font-mono text-[10px] text-slate-500">{formatDate(t.transaction_date)}</td>
                      <td className="p-3 font-bold text-slate-700">{t.account_name}</td>
                      <td className="p-3 text-slate-600 max-w-[220px] truncate">{t.description}</td>
                      <td className="p-3 text-center">
                        <Badge tone={t.type === "credit" ? "emerald" : "rose"}>
                          {t.type === "credit" ? "داخل" : "خارج"}
                        </Badge>
                      </td>
                      <td className={`p-3 text-center font-black ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                        {t.type === "credit" ? "+" : "-"}{money(t.amount)}
                      </td>
                    </tr>
                  ))}
                  {(dashboard.latest || []).length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">لا توجد حركات بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-600" /> الشيكات</h3>
              <div className="space-y-2 text-[11px] font-bold">
                <div className="flex justify-between"><span className="text-slate-500">واردة معلقة</span><span className="text-emerald-700">{money(dashboard.cheques?.incoming_pending)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">صادرة معلقة</span><span className="text-rose-700">{money(dashboard.cheques?.outgoing_pending)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">عمولات وفوائد الشهر</span><span>{money(dashboard.fees?.total)}</span></div>
              </div>
              <button type="button" onClick={() => setTab("cheques")} className="mt-3 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black cursor-pointer">سجل الشيكات</button>
            </div>
            <div className="bg-indigo-600 rounded-2xl p-4 text-white">
              <p className="text-xs font-black mb-2">إجراءات سريعة</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openTxModal("deposit")} className="py-2 rounded-xl bg-white/15 hover:bg-white/25 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer"><ArrowDownLeft className="w-3 h-3" /> إيداع</button>
                <button type="button" onClick={() => openTxModal("withdraw")} className="py-2 rounded-xl bg-white/15 hover:bg-white/25 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer"><ArrowUpRight className="w-3 h-3" /> سحب</button>
                <button type="button" onClick={openTransferModal} className="py-2 rounded-xl bg-white/15 hover:bg-white/25 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer"><ArrowRightLeft className="w-3 h-3" /> تحويل</button>
                <button type="button" onClick={openStatementModal} className="py-2 rounded-xl bg-white/15 hover:bg-white/25 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer"><FileText className="w-3 h-3" /> كشف</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAccounts = () => (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <EmptyState
          title="لا توجد حسابات بنكية بعد"
          hint="أضف أول حساب بنكي وسيتم إنشاء حساب خزينة مرتبط وحساب فرعي في الحسابات العامة تلقائيًا."
          action={<button type="button" onClick={() => openAccountModal()} className={btnPrimary}><Plus className="w-4 h-4" /> إضافة حساب بنكي</button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const glOk = !!account.gl_account_id;
            const treasuryOk = !!account.treasury_account_id;
            return (
              <div key={account.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate">{account.name}</p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">{account.bank_name || account.bank_master_name || "بنك"} · {account.account_type || "حساب"}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openAccountModal(account)} className="text-[11px] font-black text-indigo-600 cursor-pointer">تعديل</button>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">الرصيد الحالي</p>
                    <p className="text-2xl font-black text-slate-900">{money(account.balance)} <span className="text-xs text-slate-400">{account.currency || "EGP"}</span></p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${account.is_active === false ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                    {account.is_active === false ? "موقوف" : "نشط"}
                  </span>
                </div>

                <div className="mt-3 text-[10px] font-bold text-slate-500 space-y-1">
                  <p>رقم الحساب: <span className="font-mono" dir="ltr">{account.account_number || "—"}</span></p>
                  <p>IBAN: <span className="font-mono" dir="ltr">{account.iban || "—"}</span></p>
                  <p className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    الحسابات العامة: {glOk ? <b>{account.gl_code} — {account.gl_name}</b> : <span className="text-rose-600">غير مربوط</span>}
                  </p>
                  <p className="flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    خزينة: {treasuryOk ? <b>{account.treasury_name}</b> : <span className="text-rose-600">غير مرتبطة</span>}
                  </p>
                  {treasuryOk && <p className="text-slate-400">رصيد الخزينة: {money(account.treasury_balance)}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button type="button" onClick={() => openTxModal("deposit", account.id)} className="py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black cursor-pointer">إيداع</button>
                  <button type="button" onClick={() => openTxModal("withdraw", account.id)} className="py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black cursor-pointer">سحب</button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportParams((prev) => ({ ...prev, account_id: String(account.id) }));
                      setReportKind("statement");
                      setTab("reports");
                    }}
                    className="py-2 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-black cursor-pointer"
                  >
                    كشف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="الحساب" className="w-44">
            <select value={txFilters.account_id} onChange={(e) => setTxFilters({ ...txFilters, account_id: e.target.value })} className={inputCls}>
              <option value="all">كل الحسابات</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="النوع" className="w-36">
            <select value={txFilters.type} onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })} className={inputCls}>
              <option value="all">الكل</option>
              <option value="credit">داخل</option>
              <option value="debit">خارج</option>
            </select>
          </Field>
          <Field label="التصنيف" className="w-44">
            <select value={txFilters.category} onChange={(e) => setTxFilters({ ...txFilters, category: e.target.value })} className={inputCls}>
              <option value="all">كل التصنيفات</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field label="من" className="w-36"><input type="date" value={txFilters.from_date} onChange={(e) => setTxFilters({ ...txFilters, from_date: e.target.value })} className={inputCls} /></Field>
          <Field label="إلى" className="w-36"><input type="date" value={txFilters.to_date} onChange={(e) => setTxFilters({ ...txFilters, to_date: e.target.value })} className={inputCls} /></Field>
          <Field label="بحث" className="flex-1 min-w-[180px]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} placeholder="البيان أو المرجع أو الطرف" className={`${inputCls} pr-9`} />
            </div>
          </Field>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={btnPrimary}><Filter className="w-4 h-4" /> تطبيق</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi title="عدد الحركات" value={String(transactions.length)} tone="slate" icon={<Receipt className="w-4 h-4" />} />
        <Kpi title="إجمالي الداخل" value={`${money(txTotalIn)} ج.م`} tone="emerald" icon={<ArrowDownLeft className="w-4 h-4" />} />
        <Kpi title="إجمالي الخارج" value={`${money(txTotalOut)} ج.م`} tone="rose" icon={<ArrowUpRight className="w-4 h-4" />} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-800">حركات الحسابات البنكية</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `bank-transactions-${todayISO()}.csv`,
                  ["التاريخ", "الحساب", "التصنيف", "البيان", "المرجع", "داخل", "خارج", "الرصيد بعد", "الحالة"],
                  transactions.map((t) => [
                    t.transaction_date,
                    t.account_name || t.account_id,
                    CATEGORY_LABELS[t.category] || t.category || "",
                    t.description || "",
                    t.reference || "",
                    t.type === "credit" ? num(t.amount) : "",
                    t.type === "debit" ? num(t.amount) : "",
                    num(t.balance_after),
                    STATUS_LABELS[t.status] || t.status,
                  ])
                )
              }
              className={btnGhost}
            >
              <Download className="w-4 h-4" /> تصدير
            </button>
            <button type="button" onClick={openTransferModal} className={btnGhost}><ArrowRightLeft className="w-4 h-4" /> تحويل بنكي</button>
            <button type="button" onClick={() => openTxModal("deposit")} className={btnPrimary}><Plus className="w-4 h-4" /> حركة جديدة</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right font-black">التاريخ</th>
                <th className="p-3 text-right font-black">الحساب</th>
                <th className="p-3 text-right font-black">التصنيف</th>
                <th className="p-3 text-right font-black">البيان</th>
                <th className="p-3 text-right font-black">المرجع / القيد</th>
                <th className="p-3 text-center font-black">داخل</th>
                <th className="p-3 text-center font-black">خارج</th>
                <th className="p-3 text-center font-black">الرصيد بعد</th>
                <th className="p-3 text-center font-black">المطابقة</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono text-[10px] text-slate-500">{formatDate(t.transaction_date)}</td>
                  <td className="p-3 font-bold text-slate-700">{t.account_name || t.account_id}</td>
                  <td className="p-3"><Badge tone={t.type === "credit" ? "emerald" : "rose"}>{CATEGORY_LABELS[t.category] || t.category || "حركة"}</Badge></td>
                  <td className="p-3 text-slate-600 max-w-[260px]">
                    <div className="truncate">{t.description || "—"}</div>
                    {t.counterparty && <div className="text-[10px] text-slate-400 truncate">الطرف: {t.counterparty}</div>}
                  </td>
                  <td className="p-3 text-[10px] font-mono text-slate-500">
                    <div dir="ltr">{t.reference || "—"}</div>
                    {t.journal_entry_id && <div className="text-indigo-600" dir="ltr">JE #{t.journal_entry_id}</div>}
                  </td>
                  <td className="p-3 text-center font-black text-emerald-600">{t.type === "credit" ? money(t.amount) : "—"}</td>
                  <td className="p-3 text-center font-black text-rose-600">{t.type === "debit" ? money(t.amount) : "—"}</td>
                  <td className="p-3 text-center font-bold text-slate-700">{t.balance_after != null ? money(t.balance_after) : "—"}</td>
                  <td className="p-3 text-center"><Badge tone={t.status === "matched" ? "emerald" : "amber"}>{STATUS_LABELS[t.status] || t.status}</Badge></td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-slate-400 font-bold">لا توجد حركات في الفترة المحددة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderReconciliation = () => (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-2">
        <Field label="الحساب البنكي" className="w-60">
          <select value={recAccount} onChange={(e) => setRecAccount(e.target.value)} className={inputCls}>
            <option value="all">كل الحسابات</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={btnGhost}><RefreshCw className="w-4 h-4" /> تحديث</button>
        <button type="button" onClick={openStatementModal} className={btnPrimary}><Plus className="w-4 h-4" /> كشف حساب جديد</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800">كشوف الحسابات البنكية</h3>
          <Badge tone="slate">{statements.length} كشف</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right font-black">رقم الكشف</th>
                <th className="p-3 text-right font-black">الحساب</th>
                <th className="p-3 text-center font-black">الفترة</th>
                <th className="p-3 text-center font-black">رصيد أول</th>
                <th className="p-3 text-center font-black">رصيد آخر</th>
                <th className="p-3 text-center font-black">الحركات</th>
                <th className="p-3 text-center font-black">المطابقة</th>
                <th className="p-3 text-center font-black">الحالة</th>
                <th className="p-3 text-center font-black">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono font-black text-slate-800" dir="ltr">{s.statement_number || `#${s.id}`}</td>
                  <td className="p-3 font-bold text-slate-700">{s.account_name}</td>
                  <td className="p-3 text-center text-[10px] font-bold text-slate-500">{formatDate(s.period_from)} → {formatDate(s.period_to)}</td>
                  <td className="p-3 text-center font-bold">{money(s.opening_balance)}</td>
                  <td className="p-3 text-center font-bold">{money(s.closing_balance)}</td>
                  <td className="p-3 text-center font-bold">{s.lines_count}</td>
                  <td className="p-3 text-center">
                    <Badge tone={num(s.matched_count) === num(s.lines_count) && num(s.lines_count) > 0 ? "emerald" : "amber"}>
                      {s.matched_count}/{s.lines_count}
                    </Badge>
                  </td>
                  <td className="p-3 text-center"><Badge tone={s.status === "reconciled" ? "emerald" : "indigo"}>{STATUS_LABELS[s.status] || s.status}</Badge></td>
                  <td className="p-3 text-center">
                    <button type="button" onClick={() => openStatementDetails(s.id)} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black cursor-pointer">تفاصيل</button>
                  </td>
                </tr>
              ))}
              {statements.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-slate-400 font-bold">لا توجد كشوف بعد — أضف كشف البنك لبدء التسوية</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCheques = () => {
    const incoming = cheques.filter((c) => c.check_type === "incoming");
    const outgoing = cheques.filter((c) => c.check_type === "outgoing");
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi title="شيكات واردة" value={`${money(incoming.reduce((s, c) => s + num(c.amount), 0))} ج.م`} hint={`${incoming.length} شيك`} tone="emerald" icon={<ArrowDownLeft className="w-4 h-4" />} />
          <Kpi title="شيكات صادرة" value={`${money(outgoing.reduce((s, c) => s + num(c.amount), 0))} ج.م`} hint={`${outgoing.length} شيك`} tone="rose" icon={<ArrowUpRight className="w-4 h-4" />} />
          <Kpi title="واردة معلقة" value={`${money(incoming.filter((c) => ["registered", "pending"].includes(c.status)).reduce((s, c) => s + num(c.amount), 0))} ج.م`} tone="amber" icon={<Calendar className="w-4 h-4" />} />
          <Kpi title="صادرة معلقة" value={`${money(outgoing.filter((c) => ["registered", "pending"].includes(c.status)).reduce((s, c) => s + num(c.amount), 0))} ج.م`} tone="amber" icon={<Calendar className="w-4 h-4" />} />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">سجل الشيكات</h3>
            <button type="button" onClick={openChequeModal} className={btnPrimary}><Plus className="w-4 h-4" /> شيك جديد</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-right font-black">رقم الشيك</th>
                  <th className="p-3 text-center font-black">النوع</th>
                  <th className="p-3 text-right font-black">الحساب</th>
                  <th className="p-3 text-right font-black">المستفيد</th>
                  <th className="p-3 text-center font-black">المبلغ</th>
                  <th className="p-3 text-center font-black">الإصدار</th>
                  <th className="p-3 text-center font-black">الاستحقاق</th>
                  <th className="p-3 text-center font-black">الحالة</th>
                  <th className="p-3 text-center font-black">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {cheques.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono font-black text-slate-800" dir="ltr">{c.check_number}</td>
                    <td className="p-3 text-center"><Badge tone={c.check_type === "incoming" ? "emerald" : "rose"}>{c.check_type === "incoming" ? "وارد" : "صادر"}</Badge></td>
                    <td className="p-3 font-bold text-slate-700">{c.account_name}</td>
                    <td className="p-3 text-slate-600">{c.beneficiary || "—"}</td>
                    <td className="p-3 text-center font-black">{money(c.amount)}</td>
                    <td className="p-3 text-center text-[10px] font-mono text-slate-500">{formatDate(c.issue_date)}</td>
                    <td className="p-3 text-center text-[10px] font-mono text-slate-500">{formatDate(c.due_date)}</td>
                    <td className="p-3 text-center"><Badge tone={["collected", "paid"].includes(c.status) ? "emerald" : c.status === "cancelled" ? "slate" : "amber"}>{STATUS_LABELS[c.status] || c.status}</Badge></td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {["registered", "pending"].includes(c.status) && (
                          <>
                            <button type="button" onClick={() => settleCheque(c.id)} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer">{c.check_type === "incoming" ? "تحصيل" : "صرف"}</button>
                            <button type="button" onClick={() => cancelCheque(c.id)} className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black cursor-pointer">إلغاء</button>
                          </>
                        )}
                        {!["registered", "pending"].includes(c.status) && <span className="text-[10px] text-slate-400 font-bold">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {cheques.length === 0 && (
                  <tr><td colSpan={9} className="p-10 text-center text-slate-400 font-bold">لا توجد شيكات مسجلة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    const controls = (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-2">
        {reportKind === "balances" && (
          <Field label="حتى تاريخ" className="w-40"><input type="date" value={reportParams.as_of} onChange={(e) => setReportParams({ ...reportParams, as_of: e.target.value })} className={inputCls} /></Field>
        )}
        {(reportKind === "statement" || reportKind === "reconciliation") && (
          <Field label="الحساب" className="w-60">
            <select value={reportParams.account_id} onChange={(e) => setReportParams({ ...reportParams, account_id: e.target.value })} className={inputCls}>
              <option value="">اختر الحساب</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        {reportKind === "statement" && (
          <>
            <Field label="من" className="w-36"><input type="date" value={reportParams.from_date} onChange={(e) => setReportParams({ ...reportParams, from_date: e.target.value })} className={inputCls} /></Field>
            <Field label="إلى" className="w-36"><input type="date" value={reportParams.to_date} onChange={(e) => setReportParams({ ...reportParams, to_date: e.target.value })} className={inputCls} /></Field>
          </>
        )}
        {reportKind === "cashflow" && (
          <Field label="السنة" className="w-32"><input type="number" value={reportParams.year} onChange={(e) => setReportParams({ ...reportParams, year: e.target.value })} className={inputCls} /></Field>
        )}
        {reportKind === "fees" && (
          <>
            <Field label="من" className="w-36"><input type="date" value={reportParams.from_date} onChange={(e) => setReportParams({ ...reportParams, from_date: e.target.value })} className={inputCls} /></Field>
            <Field label="إلى" className="w-36"><input type="date" value={reportParams.to_date} onChange={(e) => setReportParams({ ...reportParams, to_date: e.target.value })} className={inputCls} /></Field>
          </>
        )}
        <button type="button" onClick={loadReport} className={btnPrimary}><Filter className="w-4 h-4" /> عرض التقرير</button>
        <button type="button" onClick={printCurrentReport} className={btnGhost}><Printer className="w-4 h-4" /> طباعة</button>
        <button type="button" onClick={exportCurrentReport} className={btnGhost}><Download className="w-4 h-4" /> CSV</button>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setReportKind(r.id); setReportData(null); }}
              className={`text-right p-3 rounded-2xl border transition-all cursor-pointer ${reportKind === r.id ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"}`}
            >
              <span className={`inline-flex w-8 h-8 rounded-xl items-center justify-center mb-2 ${reportKind === r.id ? "bg-white/15" : "bg-indigo-50 text-indigo-600"}`}>{r.icon}</span>
              <div className="text-[11px] font-black">{r.label}</div>
              <div className={`text-[9px] mt-0.5 ${reportKind === r.id ? "text-indigo-100" : "text-slate-400"}`}>{r.hint}</div>
            </button>
          ))}
        </div>

        {controls}

        {reportKind === "balances" && reportData && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">أرصدة البنوك ومطابقة الحسابات العامة</h3>
              <Badge tone={Math.abs(num(reportData.totals?.balance) - num(reportData.totals?.gl_balance)) < 0.02 ? "emerald" : "rose"}>
                فرق: {money(num(reportData.totals?.balance) - num(reportData.totals?.gl_balance))}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-right font-black">الحساب</th>
                    <th className="p-3 text-center font-black">رصيد البنك</th>
                    <th className="p-3 text-center font-black">رصيد GL</th>
                    <th className="p-3 text-center font-black">فرق GL</th>
                    <th className="p-3 text-center font-black">رصيد الخزينة</th>
                    <th className="p-3 text-center font-black">فرق الخزينة</th>
                    <th className="p-3 text-center font-black">كود GL</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows?.map((row: any) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="p-3 font-bold text-slate-800">{row.name}<span className="block text-[10px] text-slate-400">{row.bank_name}</span></td>
                      <td className="p-3 text-center font-black">{money(row.balance)}</td>
                      <td className="p-3 text-center font-bold">{money(row.gl_balance)}</td>
                      <td className={`p-3 text-center font-black ${Math.abs(num(row.gl_variance)) < 0.02 ? "text-emerald-600" : "text-rose-600"}`}>{money(row.gl_variance)}</td>
                      <td className="p-3 text-center font-bold">{money(row.treasury_balance)}</td>
                      <td className={`p-3 text-center font-black ${Math.abs(num(row.treasury_variance)) < 0.02 ? "text-emerald-600" : "text-rose-600"}`}>{money(row.treasury_variance)}</td>
                      <td className="p-3 text-center font-mono text-[10px] text-slate-500" dir="ltr">{row.gl_code || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-black">
                  <tr>
                    <td className="p-3">الإجمالي</td>
                    <td className="p-3 text-center">{money(reportData.totals?.balance)}</td>
                    <td className="p-3 text-center">{money(reportData.totals?.gl_balance)}</td>
                    <td className="p-3 text-center">{money(num(reportData.totals?.balance) - num(reportData.totals?.gl_balance))}</td>
                    <td className="p-3 text-center">{money(reportData.totals?.treasury_balance)}</td>
                    <td className="p-3 text-center">{money(num(reportData.totals?.balance) - num(reportData.totals?.treasury_balance))}</td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {reportKind === "statement" && reportData && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-800">كشف حساب: {reportData.account?.name}</h3>
              <div className="flex gap-2 text-[10px] font-black">
                <Badge tone="slate">رصيد أول: {money(reportData.opening_balance)}</Badge>
                <Badge tone="emerald">داخل: {money(reportData.total_in)}</Badge>
                <Badge tone="rose">خارج: {money(reportData.total_out)}</Badge>
                <Badge tone="indigo">رصيد آخر: {money(reportData.closing_balance)}</Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[860px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-right font-black">التاريخ</th>
                    <th className="p-3 text-right font-black">البيان</th>
                    <th className="p-3 text-right font-black">التصنيف</th>
                    <th className="p-3 text-center font-black">داخل</th>
                    <th className="p-3 text-center font-black">خارج</th>
                    <th className="p-3 text-center font-black">الرصيد</th>
                    <th className="p-3 text-center font-black">القيد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50 font-black">
                    <td className="p-3" colSpan={5}>رصيد افتتاحي</td>
                    <td className="p-3 text-center">{money(reportData.opening_balance)}</td>
                    <td className="p-3" />
                  </tr>
                  {reportData.lines?.map((line: any) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="p-3 font-mono text-[10px] text-slate-500">{formatDate(line.transaction_date)}</td>
                      <td className="p-3 text-slate-600">{line.description || "—"}<span className="block text-[10px] text-slate-400">{line.reference}</span></td>
                      <td className="p-3"><Badge tone={line.type === "credit" ? "emerald" : "rose"}>{CATEGORY_LABELS[line.category] || line.category || "حركة"}</Badge></td>
                      <td className="p-3 text-center font-bold text-emerald-600">{line.type === "credit" ? money(line.amount) : "—"}</td>
                      <td className="p-3 text-center font-bold text-rose-600">{line.type === "debit" ? money(line.amount) : "—"}</td>
                      <td className="p-3 text-center font-black">{money(line.running_balance)}</td>
                      <td className="p-3 text-center font-mono text-[10px] text-indigo-600" dir="ltr">{line.journal_entry_id ? `#${line.journal_entry_id}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportKind === "cashflow" && reportData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Kpi title="إجمالي الداخل" value={`${money(reportData.totals?.inflows)} ج.م`} tone="emerald" />
              <Kpi title="إجمالي الخارج" value={`${money(reportData.totals?.outflows)} ج.م`} tone="rose" />
              <Kpi title="الصافي" value={`${money(num(reportData.totals?.inflows) - num(reportData.totals?.outflows))} ج.م`} tone="indigo" />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-black text-slate-800">التدفق الشهري {reportData.year}</h3></div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right font-black">الشهر</th><th className="p-3 text-center font-black">داخل</th><th className="p-3 text-center font-black">خارج</th><th className="p-3 text-center font-black">الصافي</th></tr></thead>
                  <tbody>
                    {reportData.months?.map((m: any) => (
                      <tr key={m.month} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{m.month}</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{money(m.inflows)}</td>
                        <td className="p-3 text-center text-rose-600 font-bold">{money(m.outflows)}</td>
                        <td className={`p-3 text-center font-black ${m.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(m.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-black text-slate-800">حسب التصنيف</h3></div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right font-black">التصنيف</th><th className="p-3 text-center font-black">داخل</th><th className="p-3 text-center font-black">خارج</th></tr></thead>
                  <tbody>
                    {reportData.by_category?.map((c: any) => (
                      <tr key={c.category} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{CATEGORY_LABELS[c.category] || c.category}</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{money(c.inflows)}</td>
                        <td className="p-3 text-center text-rose-600 font-bold">{money(c.outflows)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {reportKind === "fees" && reportData && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">العمولات والفوائد</h3>
              <div className="flex gap-2"><Badge tone="rose">عمولات: {money(reportData.totals?.fees)}</Badge><Badge tone="emerald">فوائد: {money(reportData.totals?.interest)}</Badge></div>
            </div>
            <table className="w-full text-xs min-w-[760px]">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right font-black">التاريخ</th><th className="p-3 text-right font-black">الحساب</th><th className="p-3 text-right font-black">البيان</th><th className="p-3 text-center font-black">التصنيف</th><th className="p-3 text-center font-black">المبلغ</th></tr></thead>
              <tbody>
                {reportData.rows?.map((row: any) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono text-[10px] text-slate-500">{formatDate(row.transaction_date)}</td>
                    <td className="p-3 font-bold">{row.account_name}</td>
                    <td className="p-3 text-slate-600">{row.description}</td>
                    <td className="p-3 text-center"><Badge tone={row.category === "interest" ? "emerald" : "rose"}>{CATEGORY_LABELS[row.category]}</Badge></td>
                    <td className="p-3 text-center font-black">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportKind === "reconciliation" && reportData && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">تقرير التسويات البنكية</h3>
              <div className="flex gap-2"><Badge tone="indigo">كشوف: {reportData.totals?.statements}</Badge><Badge tone="emerald">مُسوّاة: {reportData.totals?.reconciled}</Badge><Badge tone="amber">بنود غير مطابقة: {reportData.totals?.unmatched_lines}</Badge></div>
            </div>
            <table className="w-full text-xs min-w-[820px]">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right font-black">الكشف</th><th className="p-3 text-right font-black">الحساب</th><th className="p-3 text-center font-black">الفترة</th><th className="p-3 text-center font-black">رصيد آخر</th><th className="p-3 text-center font-black">مطابق/إجمالي</th><th className="p-3 text-center font-black">الحالة</th></tr></thead>
              <tbody>
                {reportData.rows?.map((row: any) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono text-[10px]">{row.statement_number}</td>
                    <td className="p-3 font-bold">{row.account_name}</td>
                    <td className="p-3 text-center text-[10px]">{formatDate(row.period_from)} → {formatDate(row.period_to)}</td>
                    <td className="p-3 text-center font-black">{money(row.closing_balance)}</td>
                    <td className="p-3 text-center font-bold">{row.matched_count}/{row.lines_count}</td>
                    <td className="p-3 text-center"><Badge tone={row.status === "reconciled" ? "emerald" : "amber"}>{STATUS_LABELS[row.status] || row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportKind === "cheques" && reportData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Kpi title="شيكات واردة" value={`${money(reportData.incoming?.total)} ج.م`} hint={`${reportData.incoming?.count || 0} شيك · محصل ${money(reportData.incoming?.collected)}`} tone="emerald" />
              <Kpi title="شيكات صادرة" value={`${money(reportData.outgoing?.total)} ج.م`} hint={`${reportData.outgoing?.count || 0} شيك · مدفوع ${money(reportData.outgoing?.paid)}`} tone="rose" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right font-black">الشيك</th><th className="p-3 text-center font-black">النوع</th><th className="p-3 text-right font-black">المستفيد</th><th className="p-3 text-center font-black">المبلغ</th><th className="p-3 text-center font-black">الاستحقاق</th><th className="p-3 text-center font-black">الحالة</th></tr></thead>
                <tbody>
                  {reportData.rows?.map((row: any) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="p-3 font-mono font-black">{row.check_number}</td>
                      <td className="p-3 text-center"><Badge tone={row.check_type === "incoming" ? "emerald" : "rose"}>{row.check_type === "incoming" ? "وارد" : "صادر"}</Badge></td>
                      <td className="p-3">{row.beneficiary || "—"}</td>
                      <td className="p-3 text-center font-black">{money(row.amount)}</td>
                      <td className="p-3 text-center text-[10px]">{row.due_date || "—"}</td>
                      <td className="p-3 text-center"><Badge tone={["collected", "paid"].includes(row.status) ? "emerald" : row.status === "cancelled" ? "slate" : "amber"}>{STATUS_LABELS[row.status] || row.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!reportData && !loading && (
          <EmptyState title="اختر نوع التقرير لعرض البيانات" hint="كل تقرير قابل للطباعة والتصدير إلى Excel/CSV." />
        )}
      </div>
    );
  };

  const printCurrentReport = () => {
    if (!reportData) return;
    if (reportKind === "balances") {
      printTable(
        "أرصدة البنوك ومطابقة الحسابات العامة",
        `حتى ${reportData.as_of}`,
        ["الحساب", "البنك", "رصيد البنك", "رصيد GL", "الفرق", "رصيد الخزينة", "كود GL"],
        (reportData.rows || []).map((r: any) => [r.name, r.bank_name || "", money(r.balance), money(r.gl_balance), money(r.gl_variance), money(r.treasury_balance), r.gl_code || ""]),
        `الإجمالي: ${money(reportData.totals?.balance)} — GL: ${money(reportData.totals?.gl_balance)}`
      );
    } else if (reportKind === "statement") {
      printTable(
        `كشف حساب: ${reportData.account?.name}`,
        `من ${reportData.from_date} إلى ${reportData.to_date}`,
        ["التاريخ", "البيان", "التصنيف", "داخل", "خارج", "الرصيد"],
        (reportData.lines || []).map((l: any) => [formatDate(l.transaction_date), l.description || "", CATEGORY_LABELS[l.category] || l.category || "", l.type === "credit" ? money(l.amount) : "", l.type === "debit" ? money(l.amount) : "", money(l.running_balance)]),
        `رصيد افتتاحي: ${money(reportData.opening_balance)} — رصيد آخر: ${money(reportData.closing_balance)}`
      );
    } else if (reportKind === "cashflow") {
      printTable(
        `التدفق النقدي البنكي ${reportData.year}`,
        "ملخص شهري",
        ["الشهر", "داخل", "خارج", "الصافي"],
        (reportData.months || []).map((m: any) => [m.month, money(m.inflows), money(m.outflows), money(m.net)]),
        `الإجمالي داخل: ${money(reportData.totals?.inflows)} — خارج: ${money(reportData.totals?.outflows)}`
      );
    } else if (reportKind === "fees") {
      printTable(
        "العمولات والفوائد البنكية",
        `من ${reportData.from_date} إلى ${reportData.to_date}`,
        ["التاريخ", "الحساب", "البيان", "التصنيف", "المبلغ"],
        (reportData.rows || []).map((r: any) => [formatDate(r.transaction_date), r.account_name, r.description || "", CATEGORY_LABELS[r.category] || "", money(r.amount)]),
        `عمولات: ${money(reportData.totals?.fees)} — فوائد: ${money(reportData.totals?.interest)}`
      );
    } else if (reportKind === "reconciliation") {
      printTable(
        "التسويات البنكية",
        "حالة الكشوف والمطابقة",
        ["الكشف", "الحساب", "الفترة", "رصيد آخر", "مطابق/إجمالي", "الحالة"],
        (reportData.rows || []).map((r: any) => [r.statement_number, r.account_name, `${formatDate(r.period_from)} → ${formatDate(r.period_to)}`, money(r.closing_balance), `${r.matched_count}/${r.lines_count}`, STATUS_LABELS[r.status] || r.status]),
        `كشوف: ${reportData.totals?.statements} — غير مطابق: ${reportData.totals?.unmatched_lines}`
      );
    } else {
      printTable(
        "سجل الشيكات",
        "شيكات واردة وصادرة",
        ["الشيك", "النوع", "الحساب", "المستفيد", "المبلغ", "الاستحقاق", "الحالة"],
        (reportData.rows || []).map((r: any) => [r.check_number, r.check_type === "incoming" ? "وارد" : "صادر", r.account_name, r.beneficiary || "", money(r.amount), formatDate(r.due_date), STATUS_LABELS[r.status] || r.status])
      );
    }
  };

  const exportCurrentReport = () => {
    if (!reportData) return;
    if (reportKind === "balances") {
      downloadCsv(`bank-balances-${reportData.as_of}.csv`, ["الحساب", "البنك", "رصيد البنك", "رصيد GL", "فرق GL", "رصيد الخزينة", "فرق الخزينة"], (reportData.rows || []).map((r: any) => [r.name, r.bank_name || "", num(r.balance), num(r.gl_balance), num(r.gl_variance), num(r.treasury_balance), num(r.treasury_variance)]));
    } else if (reportKind === "statement") {
      downloadCsv(`bank-statement-${reportData.account?.id}-${todayISO()}.csv`, ["التاريخ", "البيان", "داخل", "خارج", "الرصيد", "القيد"], (reportData.lines || []).map((l: any) => [formatDate(l.transaction_date), l.description || "", l.type === "credit" ? num(l.amount) : "", l.type === "debit" ? num(l.amount) : "", num(l.running_balance), l.journal_entry_id || ""]));
    } else if (reportKind === "cashflow") {
      downloadCsv(`bank-cashflow-${reportData.year}.csv`, ["الشهر", "داخل", "خارج", "الصافي"], (reportData.months || []).map((m: any) => [m.month, m.inflows, m.outflows, m.net]));
    } else if (reportKind === "fees") {
      downloadCsv(`bank-fees-${todayISO()}.csv`, ["التاريخ", "الحساب", "البيان", "التصنيف", "المبلغ"], (reportData.rows || []).map((r: any) => [formatDate(r.transaction_date), r.account_name, r.description || "", r.category, num(r.amount)]));
    } else if (reportKind === "reconciliation") {
      downloadCsv(`bank-reconciliation-${todayISO()}.csv`, ["الكشف", "الحساب", "من", "إلى", "رصيد آخر", "مطابق", "إجمالي", "الحالة"], (reportData.rows || []).map((r: any) => [r.statement_number, r.account_name, formatDate(r.period_from), formatDate(r.period_to), num(r.closing_balance), r.matched_count, r.lines_count, r.status]));
    } else {
      downloadCsv(`bank-cheques-${todayISO()}.csv`, ["الشيك", "النوع", "الحساب", "المستفيد", "المبلغ", "الاستحقاق", "الحالة"], (reportData.rows || []).map((r: any) => [r.check_number, r.check_type, r.account_name, r.beneficiary || "", num(r.amount), formatDate(r.due_date), r.status]));
    }
  };

  const renderSettings = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-indigo-600" /> إعدادات البنوك</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="العملة الافتراضية"><input value={settingsForm.default_currency ?? "EGP"} onChange={(e) => setSettingsForm({ ...settingsForm, default_currency: e.target.value })} className={inputCls} /></Field>
          <Field label="هامش فرق التسوية"><input value={settingsForm.reconciliation_tolerance ?? "0.01"} onChange={(e) => setSettingsForm({ ...settingsForm, reconciliation_tolerance: e.target.value })} className={inputCls} /></Field>
          <Field label="طلب اعتماد للحركات فوق"><input value={settingsForm.require_approval_over ?? "50000"} onChange={(e) => setSettingsForm({ ...settingsForm, require_approval_over: e.target.value })} className={inputCls} /></Field>
          <Field label="السماح برصيد سالب">
            <select value={String(settingsForm.allow_negative_balance ?? false)} onChange={(e) => setSettingsForm({ ...settingsForm, allow_negative_balance: e.target.value === "true" })} className={inputCls}>
              <option value="false">لا</option>
              <option value="true">نعم</option>
            </select>
          </Field>
          <Field label="الترحيل التلقائي للحسابات العامة">
            <select value={String(settingsForm.auto_post_to_accounting ?? true)} onChange={(e) => setSettingsForm({ ...settingsForm, auto_post_to_accounting: e.target.value === "true" })} className={inputCls}>
              <option value="true">مفعل</option>
              <option value="false">متوقف</option>
            </select>
          </Field>
        </div>
        <button type="button" onClick={saveSettings} className={`${btnPrimary} mt-4`}><Save className="w-4 h-4" /> حفظ الإعدادات</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-600" /> ربط الحسابات الافتراضية</h3>
        <div className="space-y-2 text-[11px] font-bold">
          <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">حساب البنك في GL</span><span className="font-mono">{glAccounts.find((a: any) => a.id === lookups.defaults?.bank_gl_account_id)?.code || "—"} — {glAccounts.find((a: any) => a.id === lookups.defaults?.bank_gl_account_id)?.name || "غير محدد"}</span></div>
          <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">حساب الصندوق في GL</span><span className="font-mono">{glAccounts.find((a: any) => a.id === lookups.defaults?.cash_gl_account_id)?.code || "—"} — {glAccounts.find((a: any) => a.id === lookups.defaults?.cash_gl_account_id)?.name || "غير محدد"}</span></div>
          <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">حساب المصروفات/العمولات</span><span className="font-mono">{glAccounts.find((a: any) => a.id === lookups.defaults?.other_expense_account_id)?.name || "غير محدد"}</span></div>
          <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">حساب الفوائد/الإيرادات</span><span className="font-mono">{glAccounts.find((a: any) => a.id === lookups.defaults?.other_income_account_id)?.name || "غير محدد"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">حسابات الخزينة المتاحة</span><span className="font-mono">{treasuryAccounts.length} حساب</span></div>
        </div>
        <p className="mt-4 text-[10px] leading-5 text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded-xl p-3">
          كل حساب بنكي جديد يتم إنشاء حساب فرعي له في الحسابات العامة (تحت حساب البنك) وحساب خزينة مرتبط تلقائيًا،
          وأي حركة بنكية تُرحّل قيدًا محاسبيًا وتحرك الخزينة في نفس المعاملة.
        </p>
      </div>
    </div>
  );

  /* ------------------------- shell ------------------------- */

  const tabs: { id: BankTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "لوحة التحكم", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "accounts", label: "الحسابات البنكية", icon: <Landmark className="w-4 h-4" /> },
    { id: "transactions", label: "الحركات", icon: <ArrowRightLeft className="w-4 h-4" /> },
    { id: "reconciliation", label: "التسوية البنكية", icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: "cheques", label: "الشيكات", icon: <CreditCard className="w-4 h-4" /> },
    { id: "reports", label: "التقارير", icon: <FileText className="w-4 h-4" /> },
    { id: "settings", label: "الإعدادات", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen h-full bg-slate-50 flex flex-col overflow-hidden text-right font-cairo" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer" title="رجوع">
            <span className="text-lg">‹</span>
          </button>
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">إدارة البنوك</h1>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">بنوك · خزينة · حسابات عامة · تسويات وتقارير في منظومة واحدة</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="indigo">{accounts.length} حساب بنكي</Badge>
          <Badge tone="emerald">إجمالي: {money(totals.balance)} ج.م</Badge>
          <button type="button" onClick={refresh} className={btnGhost}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> تحديث</button>
          {tab === "accounts" && <button type="button" onClick={() => openAccountModal()} className={btnPrimary}><Plus className="w-4 h-4" /> إضافة حساب</button>}
          {tab === "transactions" && <button type="button" onClick={() => openTxModal("deposit")} className={btnPrimary}><Plus className="w-4 h-4" /> حركة جديدة</button>}
          {tab === "reconciliation" && <button type="button" onClick={openStatementModal} className={btnPrimary}><Plus className="w-4 h-4" /> كشف جديد</button>}
          {tab === "cheques" && <button type="button" onClick={openChequeModal} className={btnPrimary}><Plus className="w-4 h-4" /> شيك جديد</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-6 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${tab === item.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {toast && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-xs font-black flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.message}
            <button type="button" onClick={() => setToast(null)} className="mr-auto cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {loading && (
          <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            جاري تحميل بيانات البنوك...
          </div>
        )}

        {tab === "dashboard" && renderDashboard()}
        {tab === "accounts" && renderAccounts()}
        {tab === "transactions" && renderTransactions()}
        {tab === "reconciliation" && renderReconciliation()}
        {tab === "cheques" && renderCheques()}
        {tab === "reports" && renderReports()}
        {tab === "settings" && renderSettings()}
      </div>

      {/* Account modal */}
      {accountModal.open && (
        <Modal title={accountModal.editing ? "تعديل حساب بنكي" : "إضافة حساب بنكي"} subtitle="سيتم ربط الحساب تلقائيًا بالخزينة والحسابات العامة" onClose={() => setAccountModal({ open: false, editing: null, form: {} })}>
          <form onSubmit={saveAccount} className="grid md:grid-cols-2 gap-3">
            <Field label="اسم الحساب *"><input required value={accountModal.form.name || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, name: e.target.value } })} className={inputCls} /></Field>
            <Field label="اسم البنك"><input value={accountModal.form.bank_name || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, bank_name: e.target.value } })} className={inputCls} /></Field>
            <Field label="رقم الحساب"><input value={accountModal.form.account_number || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, account_number: e.target.value } })} className={inputCls} /></Field>
            <Field label="IBAN"><input value={accountModal.form.iban || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, iban: e.target.value } })} className={inputCls} /></Field>
            <Field label="SWIFT"><input value={accountModal.form.swift_code || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, swift_code: e.target.value } })} className={inputCls} /></Field>
            <Field label="العملة"><input value={accountModal.form.currency || "EGP"} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, currency: e.target.value } })} className={inputCls} /></Field>
            <Field label="نوع الحساب">
              <select value={accountModal.form.account_type || "current"} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, account_type: e.target.value } })} className={inputCls}>
                <option value="current">جاري</option>
                <option value="savings">توفير</option>
                <option value="deposit">وديعة</option>
                <option value="loan">قرض</option>
              </select>
            </Field>
            <Field label="الرصيد الافتتاحي">
              <input type="number" step="0.01" disabled={!!accountModal.editing && num(accountModal.editing.balance) !== num(accountModal.editing.opening_balance)} value={accountModal.form.opening_balance ?? 0} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, opening_balance: e.target.value } })} className={inputCls} />
            </Field>
            <Field label="الفرع">
              <select value={accountModal.form.branch_id || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, branch_id: e.target.value } })} className={inputCls}>
                <option value="">بدون فرع</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="حساب GL للبنك (اختياري)">
              <select value={accountModal.form.gl_account_id || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, gl_account_id: e.target.value } })} className={inputCls}>
                <option value="">إنشاء حساب فرعي تلقائيًا</option>
                {glAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </Field>
            <Field label="حساب الخزينة المرتبط">
              <select value={accountModal.form.treasury_account_id || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, treasury_account_id: e.target.value } })} className={inputCls}>
                <option value="">إنشاء خزينة مرتبطة تلقائيًا</option>
                {treasuryAccounts.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
              </select>
            </Field>
            <Field label="الحالة">
              <select value={accountModal.form.is_active === false ? "false" : "true"} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, is_active: e.target.value === "true" } })} className={inputCls}>
                <option value="true">نشط</option>
                <option value="false">موقوف</option>
              </select>
            </Field>
            <Field label="ملاحظات" className="md:col-span-2"><textarea rows={2} value={accountModal.form.notes || ""} onChange={(e) => setAccountModal({ ...accountModal, form: { ...accountModal.form, notes: e.target.value } })} className={inputCls} /></Field>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAccountModal({ open: false, editing: null, form: {} })} className={btnGhost}>إلغاء</button>
              <button type="submit" className={btnPrimary}><Save className="w-4 h-4" /> حفظ الحساب</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transaction modal */}
      {txModal.open && (
        <Modal title="حركة بنكية جديدة" subtitle="كل حركة تُحدّث رصيد البنك والخزينة وتُسجّل قيدًا في الحسابات العامة" onClose={() => setTxModal({ open: false, form: {} })}>
          <form onSubmit={saveTransaction} className="grid md:grid-cols-2 gap-3">
            <Field label="نوع الحركة" className="md:col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { id: "deposit", label: "إيداع من الخزينة", icon: <ArrowDownLeft className="w-4 h-4" /> },
                  { id: "withdraw", label: "سحب إلى الخزينة", icon: <ArrowUpRight className="w-4 h-4" /> },
                  { id: "fee", label: "عمولة بنكية", icon: <Receipt className="w-4 h-4" /> },
                  { id: "interest", label: "فوائد بنكية", icon: <TrendingUp className="w-4 h-4" /> },
                  { id: "adjustment", label: "تسوية يدوية", icon: <Settings className="w-4 h-4" /> },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() =>
                      setTxModal({
                        ...txModal,
                        form: {
                          ...txModal.form,
                          operation: op.id,
                          counterpart_account_id:
                            op.id === "fee"
                              ? lookups.defaults?.other_expense_account_id || ""
                              : op.id === "interest"
                                ? lookups.defaults?.other_income_account_id || ""
                                : txModal.form.counterpart_account_id,
                        },
                      })
                    }
                    className={`p-3 rounded-xl border text-[10px] font-black flex flex-col items-center gap-1 cursor-pointer ${txModal.form.operation === op.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"}`}
                  >
                    {op.icon}
                    {op.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="الحساب البنكي *">
              <select required value={txModal.form.account_id || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, account_id: e.target.value } })} className={inputCls}>
                <option value="">اختر الحساب</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}
              </select>
            </Field>
            <Field label="المبلغ *"><input required type="number" min="0.01" step="0.01" value={txModal.form.amount || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, amount: e.target.value } })} className={inputCls} /></Field>
            <Field label="التاريخ"><input type="date" value={txModal.form.transaction_date || todayISO()} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, transaction_date: e.target.value } })} className={inputCls} /></Field>
            <Field label="المرجع"><input value={txModal.form.reference || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, reference: e.target.value } })} className={inputCls} /></Field>
            {(txModal.form.operation === "deposit" || txModal.form.operation === "withdraw") && (
              <Field label="الخزينة النقدية" className="md:col-span-2">
                <select value={txModal.form.cash_account_id || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, cash_account_id: e.target.value } })} className={inputCls}>
                  <option value="">الخزينة الافتراضية</option>
                  {treasuryAccounts.filter((t: any) => t.type === "cash").map((t: any) => <option key={t.id} value={t.id}>{t.name} — {money(t.current_balance)}</option>)}
                </select>
              </Field>
            )}
            {(txModal.form.operation === "fee" || txModal.form.operation === "interest" || txModal.form.operation === "adjustment") && (
              <Field label="الحساب المقابل في الحسابات العامة" className="md:col-span-2">
                <select value={txModal.form.counterpart_account_id || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, counterpart_account_id: e.target.value } })} className={inputCls}>
                  <option value="">افتراضي حسب نوع الحركة</option>
                  {glAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="الطرف / الجهة"><input value={txModal.form.counterparty || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, counterparty: e.target.value } })} className={inputCls} /></Field>
            <Field label="البيان"><input value={txModal.form.description || ""} onChange={(e) => setTxModal({ ...txModal, form: { ...txModal.form, description: e.target.value } })} className={inputCls} /></Field>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTxModal({ open: false, form: {} })} className={btnGhost}>إلغاء</button>
              <button type="submit" className={btnPrimary}><Save className="w-4 h-4" /> تنفيذ الحركة</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transfer modal */}
      {transferModal.open && (
        <Modal title="تحويل بين الحسابات البنكية" subtitle="يُنشئ قيدًا واحدًا مدين/دائن بين حسابي البنكين" onClose={() => setTransferModal({ open: false, form: {} })}>
          <form onSubmit={saveTransfer} className="grid md:grid-cols-2 gap-3">
            <Field label="من حساب *">
              <select required value={transferModal.form.from_account_id || ""} onChange={(e) => setTransferModal({ ...transferModal, form: { ...transferModal.form, from_account_id: e.target.value } })} className={inputCls}>
                <option value="">اختر الحساب</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}
              </select>
            </Field>
            <Field label="إلى حساب *">
              <select required value={transferModal.form.to_account_id || ""} onChange={(e) => setTransferModal({ ...transferModal, form: { ...transferModal.form, to_account_id: e.target.value } })} className={inputCls}>
                <option value="">اختر الحساب</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}
              </select>
            </Field>
            <Field label="المبلغ *"><input required type="number" min="0.01" step="0.01" value={transferModal.form.amount || ""} onChange={(e) => setTransferModal({ ...transferModal, form: { ...transferModal.form, amount: e.target.value } })} className={inputCls} /></Field>
            <Field label="التاريخ"><input type="date" value={transferModal.form.transaction_date || todayISO()} onChange={(e) => setTransferModal({ ...transferModal, form: { ...transferModal.form, transaction_date: e.target.value } })} className={inputCls} /></Field>
            <Field label="المرجع"><input value={transferModal.form.reference || ""} onChange={(e) => setTransferModal({ ...transferModal, form: { ...transferModal.form, reference: e.target.value } })} className={inputCls} /></Field>
            <Field label="البيان"><input value={transferModal.form.description || ""} onChange={(e) => setTransferModal({ ...transferModal, form: { ...transferModal.form, description: e.target.value } })} className={inputCls} /></Field>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTransferModal({ open: false, form: {} })} className={btnGhost}>إلغاء</button>
              <button type="submit" className={btnPrimary}><ArrowRightLeft className="w-4 h-4" /> تنفيذ التحويل</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Statement modal */}
      {statementModal.open && (
        <Modal title="كشف حساب بنكي جديد" subtitle="الصق حركات كشف البنك: التاريخ, البيان, المبلغ, النوع (credit/debit)" wide onClose={() => setStatementModal({ open: false, form: {} })}>
          <form onSubmit={saveStatement} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="الحساب البنكي *">
                <select required value={statementModal.form.account_id || ""} onChange={(e) => setStatementModal({ ...statementModal, form: { ...statementModal.form, account_id: e.target.value } })} className={inputCls}>
                  <option value="">اختر الحساب</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="من تاريخ *"><input required type="date" value={statementModal.form.period_from || monthStartISO()} onChange={(e) => setStatementModal({ ...statementModal, form: { ...statementModal.form, period_from: e.target.value } })} className={inputCls} /></Field>
              <Field label="إلى تاريخ *"><input required type="date" value={statementModal.form.period_to || todayISO()} onChange={(e) => setStatementModal({ ...statementModal, form: { ...statementModal.form, period_to: e.target.value } })} className={inputCls} /></Field>
              <Field label="رصيد أول الكشف"><input type="number" step="0.01" value={statementModal.form.opening_balance ?? ""} onChange={(e) => setStatementModal({ ...statementModal, form: { ...statementModal.form, opening_balance: e.target.value } })} className={inputCls} /></Field>
              <Field label="رصيد آخر الكشف"><input type="number" step="0.01" value={statementModal.form.closing_balance ?? ""} onChange={(e) => setStatementModal({ ...statementModal, form: { ...statementModal.form, closing_balance: e.target.value } })} className={inputCls} /></Field>
            </div>
            <Field label="حركات الكشف (سطر لكل حركة)">
              <textarea rows={8} value={statementModal.form.lines_text || ""} onChange={(e) => setStatementModal({ ...statementModal, form: { ...statementModal.form, lines_text: e.target.value } })} className={`${inputCls} font-mono text-[11px]`} dir="ltr" />
            </Field>
            <p className="text-[10px] font-bold text-slate-400">مثال: <span dir="ltr" className="font-mono">2026-10-01,عمولة بنك,100,debit</span> — النوع: credit (داخل) أو debit (خارج).</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStatementModal({ open: false, form: {} })} className={btnGhost}>إلغاء</button>
              <button type="submit" className={btnPrimary}><Save className="w-4 h-4" /> إنشاء الكشف</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Statement details */}
      {statementDetails && (
        <Modal title={`كشف حساب ${statementDetails.statement?.statement_number || ""}`} subtitle={`${statementDetails.account?.name || ""} — ${formatDate(statementDetails.statement?.period_from)} → ${formatDate(statementDetails.statement?.period_to)}`} wide onClose={() => setStatementDetails(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Kpi title="رصيد الدفاتر" value={`${money(statementDetails.summary?.book_balance)}`} tone="indigo" />
              <Kpi title="رصيد الكشف" value={`${money(statementDetails.summary?.statement_closing)}`} tone="cyan" />
              <Kpi title="الفرق" value={`${money(statementDetails.summary?.difference)}`} tone={Math.abs(num(statementDetails.summary?.difference)) < 0.02 ? "emerald" : "rose"} />
              <Kpi title="مطابق" value={`${statementDetails.summary?.matched}/${statementDetails.summary?.lines}`} tone="emerald" />
              <Kpi title="غير مطابق" value={String(statementDetails.summary?.unmatched)} tone="amber" />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => autoMatch(statementDetails.statement.id)} className={btnGhost}><Link2 className="w-4 h-4" /> مطابقة تلقائية</button>
              <button type="button" onClick={() => closeStatement(statementDetails.statement.id)} className={btnPrimary}><CheckCircle2 className="w-4 h-4" /> إغلاق التسوية</button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-auto max-h-[45vh]">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-right font-black">التاريخ</th>
                    <th className="p-3 text-right font-black">البيان</th>
                    <th className="p-3 text-center font-black">داخل</th>
                    <th className="p-3 text-center font-black">خارج</th>
                    <th className="p-3 text-center font-black">الحالة</th>
                    <th className="p-3 text-left font-black">حركة النظام</th>
                  </tr>
                </thead>
                <tbody>
                  {(statementDetails.lines || []).map((line: any) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="p-3 font-mono text-[10px]">{formatDate(line.line_date)}</td>
                      <td className="p-3 text-slate-600">{line.description || "—"}</td>
                      <td className="p-3 text-center text-emerald-600 font-bold">{line.direction === "credit" ? money(line.amount) : "—"}</td>
                      <td className="p-3 text-center text-rose-600 font-bold">{line.direction === "debit" ? money(line.amount) : "—"}</td>
                      <td className="p-3 text-center"><Badge tone={line.reconciliation_status === "matched" ? "emerald" : "amber"}>{STATUS_LABELS[line.reconciliation_status] || line.reconciliation_status}</Badge></td>
                      <td className="p-3 text-[10px] text-slate-500 text-left" dir="ltr">{line.matched_reference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Cheque modal */}
      {chequeModal.open && (
        <Modal title="تسجيل شيك جديد" subtitle="يمكن تحصيل/صرف الشيك لاحقًا ليُرحّل تلقائيًا على البنك والحسابات" onClose={() => setChequeModal({ open: false, form: {} })}>
          <form onSubmit={saveCheque} className="grid md:grid-cols-2 gap-3">
            <Field label="الحساب البنكي *">
              <select required value={chequeModal.form.account_id || ""} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, account_id: e.target.value } })} className={inputCls}>
                <option value="">اختر الحساب</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="نوع الشيك">
              <select value={chequeModal.form.check_type || "incoming"} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, check_type: e.target.value } })} className={inputCls}>
                <option value="incoming">وارد (تحصيل)</option>
                <option value="outgoing">صادر (صرف)</option>
              </select>
            </Field>
            <Field label="رقم الشيك *"><input required value={chequeModal.form.check_number || ""} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, check_number: e.target.value } })} className={inputCls} /></Field>
            <Field label="المستفيد"><input value={chequeModal.form.beneficiary || ""} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, beneficiary: e.target.value } })} className={inputCls} /></Field>
            <Field label="المبلغ *"><input required type="number" min="0.01" step="0.01" value={chequeModal.form.amount || ""} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, amount: e.target.value } })} className={inputCls} /></Field>
            <Field label="تاريخ الإصدار"><input type="date" value={chequeModal.form.issue_date || todayISO()} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, issue_date: e.target.value } })} className={inputCls} /></Field>
            <Field label="تاريخ الاستحقاق"><input type="date" value={chequeModal.form.due_date || todayISO()} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, due_date: e.target.value } })} className={inputCls} /></Field>
            <Field label="المرجع"><input value={chequeModal.form.reference || ""} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, reference: e.target.value } })} className={inputCls} /></Field>
            <Field label="ملاحظات" className="md:col-span-2"><input value={chequeModal.form.notes || ""} onChange={(e) => setChequeModal({ ...chequeModal, form: { ...chequeModal.form, notes: e.target.value } })} className={inputCls} /></Field>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setChequeModal({ open: false, form: {} })} className={btnGhost}>إلغاء</button>
              <button type="submit" className={btnPrimary}><Save className="w-4 h-4" /> تسجيل الشيك</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default BankManagement;
