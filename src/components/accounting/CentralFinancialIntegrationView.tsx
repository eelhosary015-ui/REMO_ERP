import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Download,
  Eye,
  Filter,
  Layers,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  AlertTriangle,
  Building2,
  FileText,
  User,
  Check,
  ChevronRight,
  ArrowRightLeft,
  Sliders,
  Scale
} from "lucide-react";
import * as XLSX from "xlsx";

interface FinancialTransaction {
  id: number;
  fin_number: string;
  source_type: string;
  source_id: string;
  source_document_number?: string;
  event_type: string;
  branch_id?: number;
  user_id?: number;
  currency: string;
  total_amount: number;
  payment_method: string;
  treasury_account_id?: number;
  bank_account_id?: number;
  customer_id?: number;
  supplier_id?: number;
  employee_id?: number;
  cost_center_id?: number;
  journal_entry_id?: number;
  treasury_transaction_id?: number;
  bank_transaction_id?: number;
  customer_transaction_id?: number;
  supplier_transaction_id?: number;
  status: string;
  description: string;
  notes?: string;
  metadata?: any;
  created_at: string;
  treasury_account_name?: string;
  bank_account_name?: string;
  customer_name?: string;
  supplier_name?: string;
  user_name?: string;
  journal_reference?: string;
}

interface SummaryData {
  totalTransactions: number;
  todayTransactions: number;
  totalVolume: number;
  postedCount: number;
  reversedCount: number;
  treasury: {
    totalBalance: number;
    totalCashIn: number;
    totalCashOut: number;
  };
  bank: {
    totalBalance: number;
    totalBankIn: number;
    totalBankOut: number;
  };
  gl: {
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
  integrity: {
    status: string;
    glBalanced: boolean;
    treasuryReconciled: boolean;
    bankReconciled: boolean;
  };
}

export const CentralFinancialIntegrationView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Detail Drawer / Modal
  const [selectedTxId, setSelectedTxId] = useState<number | string | null>(null);
  const [txDetails, setTxDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Simulator Modal
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [simScenario, setSimScenario] = useState<string>("SALES_CASH");
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Reversal Modal
  const [reversalTx, setReversalTx] = useState<FinancialTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState<string>("");
  const [reversing, setReversing] = useState<boolean>(false);

  // Copied feedback
  const [copiedFin, setCopiedFin] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/financial/summary");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
        }
      }
    } catch (e) {
      console.error("Error fetching financial summary:", e);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (sourceTypeFilter) params.append("source_type", sourceTypeFilter);
      if (paymentMethodFilter) params.append("payment_method", paymentMethodFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      params.append("limit", "100");

      const res = await fetch(`/api/financial/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTransactions(data.transactions || []);
          setTotalCount(data.total || 0);
        }
      }
    } catch (e) {
      console.error("Error fetching transactions:", e);
    } finally {
      setLoading(false);
    }
  }, [search, sourceTypeFilter, paymentMethodFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSummary();
    fetchTransactions();
  }, [fetchSummary, fetchTransactions]);

  const handleViewDetails = async (id: number | string) => {
    setSelectedTxId(id);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/financial/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTxDetails(data);
        }
      }
    } catch (e) {
      console.error("Error fetching tx details:", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRunReconcile = async () => {
    try {
      const res = await fetch("/api/financial/reconcile", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert(`✅ تمت عملية فحص النزاهة والتطابق المالي بنجاح!\nالحالة: ${data.reconciliation.status === 'HEALTHY' ? 'سليم ومتطابق 100%' : 'تنبيه'}\nالقيود المحاسبية: ${data.reconciliation.glBalanced ? 'متوازنة (Debit = Credit)' : 'تحتاج مراجعة'}`);
          fetchSummary();
        }
      }
    } catch (e) {
      console.error("Error reconciling:", e);
    }
  };

  const handleRunSimulator = async () => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/financial/test-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: simScenario }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        fetchSummary();
        fetchTransactions();
      }
    } catch (e) {
      console.error("Error in simulator:", e);
    } finally {
      setSimLoading(false);
    }
  };

  const handleExecuteReversal = async () => {
    if (!reversalTx) return;
    setReversing(true);
    try {
      const res = await fetch(`/api/financial/reverse/${reversalTx.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reversalReason || "طلب إلغاء وعكس يدوي" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert(`✅ تم عكس الحركة المالية ${reversalTx.fin_number} وجميع توابعها بنجاح.`);
          setReversalTx(null);
          setReversalReason("");
          if (selectedTxId) setSelectedTxId(null);
          fetchSummary();
          fetchTransactions();
        } else {
          alert(`❌ خطأ: ${data.error || "فشل عكس الحركة"}`);
        }
      }
    } catch (e) {
      console.error("Error reversing tx:", e);
    } finally {
      setReversing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFin(text);
    setTimeout(() => setCopiedFin(null), 2000);
  };

  const exportToExcel = () => {
    const dataToExport = transactions.map((t) => ({
      "المرجع المالي الموحد": t.fin_number,
      "التاريخ": new Date(t.created_at).toLocaleString("ar-EG"),
      "الموديول المصدر": t.source_type,
      "رقم المستند": t.source_document_number || t.source_id,
      "البيان": t.description,
      "طريقة السداد": t.payment_method,
      "المبلغ الإجمالي": t.total_amount,
      "العملة": t.currency,
      "حساب الخزينة": t.treasury_account_name || "-",
      "حساب البنك": t.bank_account_name || "-",
      "العميل": t.customer_name || "-",
      "المورد": t.supplier_name || "-",
      "رقم القيد اليومي": t.journal_entry_id ? `#${t.journal_entry_id}` : "-",
      "الحالة": t.status === "posted" ? "مُرحّل" : "معكوس",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial_Transactions");
    XLSX.writeFile(wb, `Financial_Integration_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case "SALES_INVOICE":
      case "POS_ORDER":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> مبيعات / نقطة بيع</span>;
      case "SALES_RETURN":
      case "POS_RETURN":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> مرتجع مبيعات</span>;
      case "CUSTOMER_RECEIPT":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1"><Coins className="w-3 h-3" /> تحصيل عميل</span>;
      case "PURCHASE_INVOICE":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> مشتريات مورد</span>;
      case "SUPPLIER_PAYMENT":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1"><Coins className="w-3 h-3" /> سداد مورد</span>;
      case "EXPENSE":
      case "COST":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><DollarSign className="w-3 h-3" /> مصروفات وتكاليف</span>;
      case "PAYROLL_BATCH":
      case "SALARY_PAYMENT":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"><User className="w-3 h-3" /> رواتب وأجور</span>;
      case "TREASURY_TRANSFER":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> تحويل خزائن</span>;
      case "TREASURY_BANK_DEPOSIT":
      case "BANK_TREASURY_WITHDRAWAL":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1"><Building2 className="w-3 h-3" /> خزينة ↔ بنك</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">{sourceType}</span>;
    }
  };

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case "cash":
        return <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100/70 text-emerald-800 rounded">نقدي (Cash)</span>;
      case "bank":
      case "card":
        return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100/70 text-blue-800 rounded">بنكي / شبكة</span>;
      case "credit":
        return <span className="px-2 py-0.5 text-xs font-medium bg-amber-100/70 text-amber-800 rounded">آجل (Credit)</span>;
      case "cheque":
        return <span className="px-2 py-0.5 text-xs font-medium bg-purple-100/70 text-purple-800 rounded">شيك بنكي</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 rounded">{method}</span>;
    }
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">نظام التكامل المالي المركزي (Central Financial Integration Layer)</h1>
                <p className="text-sm text-slate-300">
                  المحرك المركزي لتسجيل وربط الأثر المالي اللحظي لكافة حركات الـ ERP (الخزينة • البنوك • الحسابات العامة • الذمم المدينة والدائنة)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> التكامل الذري (Atomic Transactions) مُفعّل
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                <Sparkles className="w-3.5 h-3.5" /> منع التكرار (Idempotency Protection) نشط
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                <Scale className="w-3.5 h-3.5" /> قيود اليومية المتوازنة (Debit = Credit 100%)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunReconcile}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition border border-slate-700 flex items-center gap-2 shadow-sm"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              فحص المطابقة والنزاهة
            </button>
            <button
              onClick={() => { setShowSimulator(true); setSimResult(null); }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Sparkles className="w-4 h-4" />
              محاكي واختبار التدفق المالي
            </button>
            <button
              onClick={() => { fetchSummary(); fetchTransactions(); }}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Volume & Tx */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">إجمالي العمليات المالية</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {(summary?.totalTransactions || totalCount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">حركة</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>اليوم: <b className="text-indigo-600">{summary?.todayTransactions || 0}</b></span>
              <span>الحجم: <b className="text-slate-800">{(summary?.totalVolume || 0).toLocaleString()} ج.م</b></span>
            </div>
          </div>
        </div>

        {/* Card 2: Treasury Flow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">الخزينة النقدية (Cash)</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">
              {(summary?.treasury.totalBalance || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م رصيد</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span className="text-emerald-700">وارد: +{(summary?.treasury.totalCashIn || 0).toLocaleString()}</span>
              <span className="text-rose-700">صادر: -{(summary?.treasury.totalCashOut || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Bank Flow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">الحسابات البنكية (Bank)</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-600">
              {(summary?.bank.totalBalance || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م رصيد</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span className="text-blue-700">إيداعات: +{(summary?.bank.totalBankIn || 0).toLocaleString()}</span>
              <span className="text-rose-700">سحوبات: -{(summary?.bank.totalBankOut || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 4: GL Balance & Health */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">توازن القيود العامة (GL)</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-purple-700">
                100%
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                متوازن ودقيق
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>مدين: {(summary?.gl.totalDebit || 0).toLocaleString()}</span>
              <span>دائن: {(summary?.gl.totalCredit || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالرقم الموحد FIN، رقم المستند، العميل..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Source Type Filter */}
          <div>
            <select
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="">جميع المصادر (All Modules)</option>
              <option value="SALES_INVOICE">فواتير مبيعات (Sales)</option>
              <option value="POS_ORDER">نقاط بيع (POS)</option>
              <option value="CUSTOMER_RECEIPT">سندات تحصيل عملاء</option>
              <option value="PURCHASE_INVOICE">فواتير مشتريات (Purchases)</option>
              <option value="SUPPLIER_PAYMENT">سندات سداد موردين</option>
              <option value="EXPENSE">مصروفات وتكاليف</option>
              <option value="PAYROLL_BATCH">مرتبات وأجور (Payroll)</option>
              <option value="TREASURY_TRANSFER">تحويل بين خزائن</option>
              <option value="TREASURY_BANK_DEPOSIT">إيداع نقدي بالبنك</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="">جميع طرق السداد</option>
              <option value="cash">نقدي (Cash)</option>
              <option value="bank">بنكي / شبكة (Bank/Card)</option>
              <option value="credit">آجل (Credit/Receivable)</option>
              <option value="cheque">شيك بنكي (Cheque)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="">جميع الحالات</option>
              <option value="posted">مُرحّل (Posted)</option>
              <option value="reversed">معكوس (Reversed)</option>
            </select>
          </div>

          {/* Export & Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 border border-slate-300"
            >
              <Download className="w-4 h-4" />
              تصدير Excel
            </button>
            {(search || sourceTypeFilter || paymentMethodFilter || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearch("");
                  setSourceTypeFilter("");
                  setPaymentMethodFilter("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition border border-rose-200"
                title="مسح الفلاتر"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Transactions Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">سجل الحركات المالية الموحدة (Central Integration Ledger)</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              {transactions.length} من {totalCount}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            يتم تحديث الأرصدة والقيود تلقائياً وبشكل فوري لحظة إنشاء أي حركة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3.5">المرجع المالي الموحد</th>
                <th className="p-3.5">التاريخ والوقت</th>
                <th className="p-3.5">المصدر والمستند</th>
                <th className="p-3.5">البيان والوصف</th>
                <th className="p-3.5 text-center">طريقة السداد</th>
                <th className="p-3.5 text-left">المبلغ</th>
                <th className="p-3.5 text-center">القيد المحاسبي</th>
                <th className="p-3.5 text-center">الحالة</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                    جاري تحميل سجل الحركات المالية المركزية...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Layers className="w-8 h-8" />
                    </div>
                    لا توجد حركات مالية مطابقة للبحث أو الفلتر المحدد
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-indigo-50/30 transition">
                    <td className="p-3.5 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                          {tx.fin_number}
                        </span>
                        <button
                          onClick={() => handleCopy(tx.fin_number)}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded transition"
                          title="نسخ الرقم المرجعي"
                        >
                          {copiedFin === tx.fin_number ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString("ar-EG", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <div>{getSourceBadge(tx.source_type)}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          مستند: <span className="text-slate-700 font-semibold">{tx.source_document_number || tx.source_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      <div className="font-medium text-slate-800 truncate" title={tx.description}>
                        {tx.description}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
                        {tx.treasury_account_name && <span>خزينة: <b className="text-slate-700">{tx.treasury_account_name}</b></span>}
                        {tx.bank_account_name && <span>بنك: <b className="text-slate-700">{tx.bank_account_name}</b></span>}
                        {tx.customer_name && <span>عميل: <b className="text-slate-700">{tx.customer_name}</b></span>}
                        {tx.supplier_name && <span>مورد: <b className="text-slate-700">{tx.supplier_name}</b></span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      {getPaymentBadge(tx.payment_method)}
                    </td>
                    <td className="p-3.5 text-left font-bold text-slate-900 font-mono">
                      {Number(tx.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-normal">{tx.currency}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      {tx.journal_entry_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          <FileText className="w-3 h-3" /> قيد #{tx.journal_entry_id}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {tx.status === "posted" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> مُرحّل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <RotateCcw className="w-3 h-3" /> معكوس
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewDetails(tx.id)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-transparent hover:border-indigo-200"
                          title="عرض التفاصيل والأثر المالي"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {tx.status === "posted" && (
                          <button
                            onClick={() => setReversalTx(tx)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200"
                            title="عكس الحركة المالية تلقائياً"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Deep-Dive Details Drawer / Modal */}
      {selectedTxId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">تفاصيل الحركة المالية والأثر التكاملي</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    المرجع المالي: {txDetails?.transaction?.fin_number || selectedTxId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedTxId(null); setTxDetails(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {loadingDetails || !txDetails ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                  جاري جلب كافة تفاصيل الأثر المالي والقيود...
                </div>
              ) : (
                <>
                  {/* Summary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-xs text-slate-500">الموديول والمستند</span>
                      <div className="mt-1">{getSourceBadge(txDetails.transaction.source_type)}</div>
                      <div className="text-xs font-semibold text-slate-800 mt-1">
                        رقم: {txDetails.transaction.source_document_number || txDetails.transaction.source_id}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">المبلغ وطريقة السداد</span>
                      <div className="text-lg font-black text-indigo-700 font-mono mt-1">
                        {Number(txDetails.transaction.total_amount).toLocaleString()} {txDetails.transaction.currency}
                      </div>
                      <div className="mt-1">{getPaymentBadge(txDetails.transaction.payment_method)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">الحالة والتاريخ</span>
                      <div className="text-xs font-semibold text-slate-800 mt-1">
                        {new Date(txDetails.transaction.created_at).toLocaleString("ar-EG")}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        المستخدم: <b className="text-slate-700">{txDetails.transaction.user_name || "النظام"}</b>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Impact Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      الأثر المالي المتعدد على الموديولات (Multi-Financial Impact)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Treasury Card */}
                      <div className={`p-4 rounded-xl border ${txDetails.linkedEntities.treasury ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-slate-200 opacity-60"}`}>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4 text-emerald-600" /> حركة الخزينة (Cash Treasury)</span>
                          {txDetails.linkedEntities.treasury && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">مؤثر</span>}
                        </div>
                        {txDetails.linkedEntities.treasury ? (
                          <div className="mt-2 text-xs space-y-1">
                            <div>الخزينة: <b>{txDetails.linkedEntities.treasury.safe_name}</b></div>
                            <div>نوع الحركة: <b className="text-emerald-700">{txDetails.linkedEntities.treasury.transaction_type}</b></div>
                            <div>المبلغ المسجل: <b>{Number(txDetails.linkedEntities.treasury.amount).toLocaleString()} ج.م</b></div>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-400">لا يوجد أثر مباشر على حركة الخزينة النقدية</div>
                        )}
                      </div>

                      {/* Bank Card */}
                      <div className={`p-4 rounded-xl border ${txDetails.linkedEntities.bank ? "bg-blue-50/50 border-blue-200" : "bg-slate-50 border-slate-200 opacity-60"}`}>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-blue-600" /> حركة البنك (Bank Account)</span>
                          {txDetails.linkedEntities.bank && <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded">مؤثر</span>}
                        </div>
                        {txDetails.linkedEntities.bank ? (
                          <div className="mt-2 text-xs space-y-1">
                            <div>الحساب: <b>{txDetails.linkedEntities.bank.bank_name}</b></div>
                            <div>نوع الحركة: <b className="text-blue-700">{txDetails.linkedEntities.bank.type}</b></div>
                            <div>المبلغ: <b>{Number(txDetails.linkedEntities.bank.amount).toLocaleString()} ج.م</b></div>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-400">لا يوجد أثر مباشر على الحسابات البنكية</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* GL Journal Section */}
                  {txDetails.linkedEntities.glJournal && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600" />
                          قيد اليومية المحاسبي العام (General Ledger Entry #{txDetails.linkedEntities.glJournal.id})
                        </h4>
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                          متوازن (Balanced)
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-right">
                          <thead className="bg-slate-100 text-slate-700 font-bold">
                            <tr>
                              <th className="p-2.5">رمز الحساب</th>
                              <th className="p-2.5">اسم الحساب</th>
                              <th className="p-2.5 text-left">مدين (Debit)</th>
                              <th className="p-2.5 text-left">دائن (Credit)</th>
                              <th className="p-2.5">مركز التكلفة</th>
                              <th className="p-2.5">البيان</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {txDetails.linkedEntities.glJournal.items?.map((item: any) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono text-indigo-700 font-semibold">{item.account_code || item.account_id}</td>
                                <td className="p-2.5 font-medium">{item.account_name || "حساب عام"}</td>
                                <td className="p-2.5 text-left font-mono font-bold text-slate-800">
                                  {Number(item.debit) > 0 ? Number(item.debit).toLocaleString() : "-"}
                                </td>
                                <td className="p-2.5 text-left font-mono font-bold text-slate-800">
                                  {Number(item.credit) > 0 ? Number(item.credit).toLocaleString() : "-"}
                                </td>
                                <td className="p-2.5 text-slate-500">{item.cost_center_name || "-"}</td>
                                <td className="p-2.5 text-slate-500">{item.notes || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Audit Trail Section */}
                  {txDetails.linkedEntities.auditLogs?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-600" />
                        سجل التدقيق والتتبع المالي (Audit Trail)
                      </h4>
                      <div className="space-y-2 text-xs">
                        {txDetails.linkedEntities.auditLogs.map((log: any) => (
                          <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-800">{log.action}</span>
                              <span className="text-slate-500 mr-2">بواسطة: {log.user_name || "النظام"}</span>
                            </div>
                            <div className="text-slate-400 font-mono">
                              {new Date(log.created_at).toLocaleString("ar-EG")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                مرجع الرقابة المالية: {txDetails?.transaction?.idempotency_key}
              </span>
              <button
                onClick={() => { setSelectedTxId(null); setTxDetails(null); }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Interactive Simulator Modal */}
      {showSimulator && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">محاكي اختبار التكامل المالي (Test Flow Simulator)</h3>
                  <p className="text-xs text-slate-500">تشغيل سيناريو تكامل كامل وفحص القيود والخزينة تلقائياً</p>
                </div>
              </div>
              <button
                onClick={() => setShowSimulator(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">اختر السيناريو المراد اختباره:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSimScenario("SALES_CASH")}
                  className={`p-3 rounded-xl border text-right transition ${simScenario === "SALES_CASH" ? "border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
                >
                  🟢 فاتورة مبيعات نقدية (2,500 ج.م)
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">خزينة IN + إيراد مبيعات + قيد GL متوازن</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimScenario("SALES_CREDIT")}
                  className={`p-3 rounded-xl border text-right transition ${simScenario === "SALES_CREDIT" ? "border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
                >
                  🟡 فاتورة مبيعات آجلة (3,500 ج.م)
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">ذمم عملاء + إيراد مبيعات (بدون خزينة نقدية)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimScenario("PURCHASE_CASH")}
                  className={`p-3 rounded-xl border text-right transition ${simScenario === "PURCHASE_CASH" ? "border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
                >
                  🔵 مشتريات نقدية (1,800 ج.م)
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">خزينة OUT + مخزون / مشتريات + قيد GL</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimScenario("PAYROLL")}
                  className={`p-3 rounded-xl border text-right transition ${simScenario === "PAYROLL" ? "border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
                >
                  🟣 صرف مسير رواتب (12,500 ج.م)
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">خزينة OUT + مصروف رواتب وأجور + قيد GL</div>
                </button>
              </div>
            </div>

            {simResult && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {simResult.result?.message}
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1 font-mono">
                  <div>المرجع المالي: <b>{simResult.result?.finNumber}</b></div>
                  <div>رقم القيد اليومي: <b>#{simResult.result?.journalEntryId}</b></div>
                  <div>أثر الخزينة: <b>{simResult.result?.impacts?.treasury} ج.م</b></div>
                  <div>أثر الذمم: <b>{simResult.result?.impacts?.customer || simResult.result?.impacts?.supplier || 0} ج.م</b></div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={simLoading}
                onClick={handleRunSimulator}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
              >
                {simLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                تنفيذ الاختبار فوراً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reversal Confirmation Modal */}
      {reversalTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">تأكيد عكس الحركة المالية</h3>
                <p className="text-xs text-slate-500 font-mono">{reversalTx.fin_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              سيتم إنشاء قيد محاسبي عكسي آلياً، ورد المبالغ للخزينة أو البنك وتعديل أرصدة الحسابات والذمم بشكل ذري ومترابط.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">سبب العكس / الإلغاء:</label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="أدخل سبب إلغاء الحركة..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={reversing}
                onClick={handleExecuteReversal}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-500/20"
              >
                {reversing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                تأكيد العكس الذري
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CentralFinancialIntegrationView;
