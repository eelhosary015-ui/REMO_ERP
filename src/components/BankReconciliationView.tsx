import React, { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import {
  Building2,
  Calendar,
  Download,
  Plus,
  Search,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Scale,
  RefreshCw,
  Wallet,
  Check,
  Eye,
  FileSpreadsheet,
  FileDown,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

// Define transaction types
interface BankTransaction {
  id: number;
  date: string;
  type: "إيداع" | "سحب" | "رصيد افتتاحي";
  description: string;
  reference: string;
  paymentMethod: string;
  deposit: number;
  withdrawal: number;
  balance: number;
  status: "مسواة" | "غير مسواة" | "-";
}

interface UnmatchedItem {
  id: number;
  description: string;
  date: string;
  systemAmount: number;
  bankAmount: number;
  difference: number;
}

// Helper functions for dynamic today-based dates
const getDynamicDateStr = (dayNum: number): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(dayNum).padStart(2, "0");
  return `${day}/${month}/${year}`;
};

const getCurrentPeriodString = (offsetMonths = 0): string => {
  const arabicMonths = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return `${arabicMonths[d.getMonth()]} ${d.getFullYear()}`;
};

const getPeriodLabel = (offsetMonths = 0): string => {
  const arabicMonths = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  const mName = arabicMonths[d.getMonth()];
  const year4 = d.getFullYear();
  const year2 = String(year4).slice(-2);
  return `${mName} ${year2}\\${year4}`;
};

const getTodayInputFormat = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const BankReconciliationView: React.FC = () => {
  // Main data states
  const [systransactions, setSystransactions] = useState<BankTransaction[]>([]);
  const [bankStatementTransactions, setBankStatementTransactions] = useState<any[]>([]);
  const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedItem[]>([]);

  const fetchTransactions = useCallback(async () => {
    try {
      const rowsRes = await api.get('/api/bank-reconciliation/transactions');
      const rows: any[] = await rowsRes.json();
// await api.get('/api/bank-reconciliation/transactions');
      const sysRows = rows.filter((r: any) => r.source === 'system' || (!r.source && r.type));
      const stmtRows = rows.filter((r: any) => r.source === 'bank_statement');
      setSystransactions(sysRows.map((r: any) => ({
        id: r.id,
        date: r.transaction_date,
        type: r.type === 'credit' ? 'إيداع' : r.type === 'debit' ? 'سحب' : 'رصيد افتتاحي',
        description: r.description || '',
        reference: r.reference || '-',
        paymentMethod: '-',
        deposit: r.type === 'credit' ? r.amount : 0,
        withdrawal: r.type === 'debit' ? r.amount : 0,
        balance: 0,
        status: r.status === 'matched' ? 'مسواة' : 'غير مسواة',
      })));
      setBankStatementTransactions(stmtRows.map((r: any) => ({
        id: r.id,
        date: r.transaction_date,
        description: r.description || '',
        deposit: r.type === 'credit' ? r.amount : 0,
        withdrawal: r.type === 'debit' ? r.amount : 0,
        balance: 0,
        status: r.status === 'matched' ? 'مسواة' : 'غير مسواة',
        _matchedWith: r.matched_with,
      })));
    } catch (err) {
      console.error('Failed to fetch bank transactions:', err);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Selectors
  const [selectedBank, setSelectedBank] = useState("بنك مصر - الحساب الرئيسي");
  const [selectedPeriod, setSelectedPeriod] = useState(
    getCurrentPeriodString(),
  );

  // Tab within the grid filter: system trans (12), bank statement trans (10), reconciliation trans (2)
  const [activeSegment, setActiveSegment] = useState<
    "system" | "bank" | "unmatched"
  >("system");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("الكل");
  const [selectedMethod, setSelectedMethod] = useState("الكل");
  const [dateFrom, setDateFrom] = useState(getTodayInputFormat());
  const [dateTo, setDateTo] = useState(getTodayInputFormat());

  // Form states and dialogs
  const [isNewBankModalOpen, setIsNewBankModalOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  // Form parameters for new bank account
  const [newBank, setNewBank] = useState({
    name: "",
    accountNumber: "",
    currency: "جنيه مصري",
    openingBalance: "",
  });

  // Filtering system transactions
  const filteredSysTransactions = useMemo(() => {
    return systransactions.filter((t) => {
      const matchSearch =
        t.description.includes(searchQuery) ||
        t.reference.includes(searchQuery);
      const matchType = selectedType === "الكل" || t.type === selectedType;
      const matchMethod =
        selectedMethod === "الكل" || t.paymentMethod === selectedMethod;
      return matchSearch && matchType && matchMethod;
    });
  }, [systransactions, searchQuery, selectedType, selectedMethod]);

  const handleCreateBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.name || !newBank.accountNumber) return;
    setAlertMsg(`تم إنشاء حساب بنكي جديد بنجاح: ${newBank.name}`);
    setIsAlertOpen(true);
    setIsNewBankModalOpen(false);
    setNewBank({
      name: "",
      accountNumber: "",
      currency: "جنيه مصري",
      openingBalance: "",
    });
  };

  const handleReconcileItem = async (itemId: number) => {
    const reconciledItem = unmatchedItems.find((item) => item.id === itemId);
    if (reconciledItem) {
      try {
        const system_id = reconciledItem.systemAmount > 0 ? itemId : undefined;
        const statement_id = reconciledItem.bankAmount > 0 ? itemId : undefined;
        await api.post('/api/bank-reconciliation/match', { system_id, statement_id });
        setUnmatchedItems(unmatchedItems.filter((item) => item.id !== itemId));
        setSystransactions((prev) => prev.map((t) => ({ ...t, status: "مسواة" })));  
      } catch (err) {
        console.error('Reconciliation failed:', err);
      }
    }
  };

  const handleGlobalReconciliation = async () => {
    if (unmatchedItems.length === 0) {
      setAlertMsg("النظام متطابق بالكامل بالفعل مع كشف حساب البنك!");
      setIsAlertOpen(true);
      return;
    }
    try {
      for (const item of unmatchedItems) {
        await api.post('/api/bank-reconciliation/match', { system_id: item.id, statement_id: undefined });
      }
      setUnmatchedItems([]);
      setSystransactions((prev) => prev.map((t) => ({ ...t, status: "مسواة" })));
      setAlertMsg(
        "تمت المطابقة الشاملة لكافة البنود المعلقة وإجراء التسوية البنكية الدورية بنجاح.",
      );
      setIsAlertOpen(true);
    } catch (err) {
      console.error('Global reconciliation failed:', err);
    }
  };

  const handleExcelExport = () => {
    const data = filteredSysTransactions.map((t, idx) => ({
      "#": idx + 1,
      التاريخ: t.date,
      "نوع الحركة": t.type,
      البيان: t.description,
      "رقم الشيك / المرجع": t.reference,
      "طريقة الدفع": t.paymentMethod,
      إيداع: t.deposit || "-",
      سحب: t.withdrawal || "-",
      "الرصيد في النظام": t.balance,
      الحالة: t.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التسوية البنكية");
    XLSX.writeFile(wb, `التسوية_البنكية_بنك_مصر_${dateFrom}.xlsx`);
  };

  return (
    <div className="space-y-6 text-right rtl pb-16" dir="rtl">
      {/* 1. Header Toolbar with actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200/50 pb-5">
        {/* Blue buttons and actions from screenshot */}
        <div className="flex flex-wrap items-center gap-3 order-2 md:order-1">
          <button
            onClick={() => setIsNewBankModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            حساب بنكي جديد
          </button>

          {/* Selector 1: Bank selection */}
          <div className="relative">
            <select
              value={selectedBank ?? ""}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="bg-white border-2 border-slate-200 text-slate-700 font-extrabold text-xs py-3 px-5 pr-10 rounded-2xl focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer"
            >
              <option value="بنك مصر - الحساب الرئيسي">
                بنك مصر - الحساب الرئيسي
              </option>
              <option value="البنك الأهلي - حساب جاري">
                البنك الأهلي - حساب جاري
              </option>
              <option value="بنك القاهرة - صندوق الطوارئ">
                بنك القاهرة - صندوق الطوارئ
              </option>
            </select>
            <Building2 className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Selector 2: Period date select */}
          <div className="relative">
            <select
              value={selectedPeriod ?? ""}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-white border-2 border-slate-200 text-slate-700 font-extrabold text-xs py-3 px-5 pr-10 rounded-2xl focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer"
            >
              <option value={getCurrentPeriodString(0)}>
                {getPeriodLabel(0)}
              </option>
              <option value={getCurrentPeriodString(-1)}>
                {getPeriodLabel(-1)}
              </option>
              <option value={getCurrentPeriodString(1)}>
                {getPeriodLabel(1)}
              </option>
            </select>
            <Calendar className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Right title & custom button from screenshot */}
        <div className="flex items-center gap-2.5 order-1 md:order-2">
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 font-extrabold text-xs rounded-2xl transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-400" />
            كشف حساب البنك
          </button>
        </div>
      </div>

      {/* 2. Premium Grid Stat Cards from mockup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* METRIC 1: الرصيد في النظام (1,250,850.00) */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-blue-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 text-right block">
              الرصيد في النظام
            </span>
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-2xl font-black text-slate-900">
                1,250,850.00
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wallet className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* METRIC 2: الرصيد في كشف البنك (1,248,250.00) */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-emerald-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 text-right block">
              الرصيد في كشف البنك
            </span>
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-2xl font-black text-emerald-600">
                1,248,250.00
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Building2 className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* METRIC 3: فرق التسوية (2,600.00) */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-amber-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 text-right block">
              فرق التسوية
            </span>
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-2xl font-black text-amber-600">
                2,600.00
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center animate-pulse">
            <Scale className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* METRIC 4: حالة التسوية (متوازن جزئياً) */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-purple-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 text-right block">
              حالة التسوية
            </span>
            <div className="mt-1 text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-black rounded-lg border border-amber-200">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                متوازن جزئياً
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* 3. Filter Controls Row matching mockup */}
      <div className="bg-white p-4 border border-slate-200/85 rounded-[2rem] shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-center">
          {/* Box 1: Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم أو بيان أو شريك..."
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 pr-11 pl-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all text-right"
            />
          </div>

          {/* Box 2: Date From */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={dateFrom ?? ""}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/95 rounded-xl py-2.5 pr-10 pl-2.5 text-[11px] font-black text-slate-500 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Box 3: Date To */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={dateTo ?? ""}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/95 rounded-xl py-2.5 pr-10 pl-2.5 text-[11px] font-black text-slate-500 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Box 4: Payment Method */}
          <div>
            <select
              value={selectedMethod ?? ""}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 px-4 text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            >
              <option value="الكل">طريقة الدفع (الكل)</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
              <option value="شيك">شيك</option>
              <option value="نقدي">نقدي</option>
            </select>
          </div>

          {/* Box 5: Movement Type */}
          <div>
            <select
              value={selectedType ?? ""}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 px-4 text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            >
              <option value="الكل">الكل</option>
              <option value="إيداع">إيداع</option>
              <option value="سحب">سحب</option>
              <option value="رصيد افتتاحي">رصيد افتتاحي</option>
            </select>
          </div>

          {/* Box 6: Reset */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedType("الكل");
                setSelectedMethod("الكل");
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              مسح الفلاتر
            </button>
          </div>
        </div>
      </div>

      {/* 4. Segmented System/Bank/Matching tab view */}
      <div className="bg-white border border-slate-200/85 rounded-[2rem] shadow-xs overflow-hidden">
        {/* Interactive Segmented Switch row */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 p-1">
          <button
            onClick={() => setActiveSegment("system")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black rounded-xl transition-all cursor-pointer ${activeSegment === "system" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
          >
            حركات البنك في النظام
            <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-black">
              12
            </span>
          </button>

          <button
            onClick={() => setActiveSegment("bank")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black rounded-xl transition-all cursor-pointer ${activeSegment === "bank" ? "bg-white text-emerald-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
          >
            حركات البنك في كشف البنك
            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-black">
              10
            </span>
          </button>

          <button
            onClick={() => setActiveSegment("unmatched")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black rounded-xl transition-all cursor-pointer ${activeSegment === "unmatched" ? "bg-white text-amber-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
          >
            بنود التسوية
            <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-black">
              {unmatchedItems.length}
            </span>
          </button>
        </div>

        {/* Tab content view 1: SYSTEM TRANSACTIONS */}
        {activeSegment === "system" && (
          <div className="overflow-x-auto animate-fade-in">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-400 text-xs font-black">
                  <th className="p-4 text-center w-12">#</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">نوع الحركة</th>
                  <th className="p-4">البيان</th>
                  <th className="p-4">رقم الشيك / المرجع</th>
                  <th className="p-4">طريقة الدفع</th>
                  <th className="p-4 text-left">إيداع</th>
                  <th className="p-4 text-left">سحب</th>
                  <th className="p-4 text-left">الرصيد</th>
                  <th className="p-4 text-center">الحالة</th>
                  <th className="p-4 text-center w-20">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90 text-xs font-bold text-slate-700">
                {filteredSysTransactions.map((t, idx) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 text-center text-slate-400 font-mono font-normal">
                      {idx + 1}
                    </td>
                    <td className="p-4 font-mono text-slate-600">{t.date}</td>
                    <td className="p-4">
                      {t.type === "إيداع" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          إيداع
                        </span>
                      ) : t.type === "سحب" ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          سحب
                        </span>
                      ) : (
                        <span className="text-slate-400">{t.type}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-900 font-extrabold">
                      {t.description}
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {t.reference}
                    </td>
                    <td className="p-4 text-slate-500">{t.paymentMethod}</td>
                    <td className="p-4 text-left font-mono text-emerald-600">
                      {t.deposit > 0
                        ? Number(t.deposit || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : "-"}
                    </td>
                    <td className="p-4 text-left font-mono text-rose-600">
                      {t.withdrawal > 0
                        ? Number(t.withdrawal || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : "-"}
                    </td>
                    <td className="p-4 text-left font-mono font-black text-slate-800">
                      {Number(t.balance || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4 text-center">
                      {t.status === "مسواة" ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[10px] font-black">
                          مسواة
                        </span>
                      ) : t.status === "غير مسواة" ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-md text-[10px] font-black">
                          غير مسواة
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                          title="تفاصيل"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab content view 2: BANK STATEMENT */}
        {activeSegment === "bank" && (
          <div className="overflow-x-auto animate-fade-in">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-400 text-xs font-black">
                  <th className="p-4 text-center w-12">#</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">البيان بكشف البنك</th>
                  <th className="p-4 text-left">إيداع وارد</th>
                  <th className="p-4 text-left">سحب صادر</th>
                  <th className="p-4 text-left">الرصيد الدفتري</th>
                  <th className="p-4 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90 text-xs font-bold text-slate-700">
                {bankStatementTransactions.map((t, idx) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="p-4 font-mono text-slate-600">{t.date}</td>
                    <td className="p-4 text-slate-900 font-black">
                      {t.description}
                    </td>
                    <td className="p-4 text-left font-mono text-emerald-600">
                      {t.deposit > 0
                        ? Number(t.deposit || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : "-"}
                    </td>
                    <td className="p-4 text-left font-mono text-rose-600">
                      {t.withdrawal > 0
                        ? Number(t.withdrawal || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : "-"}
                    </td>
                    <td className="p-4 text-left font-mono font-black text-slate-800">
                      {Number(t.balance || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black">
                        مسواة
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab content view 3: UNMATCHED ITEMS */}
        {activeSegment === "unmatched" && (
          <div className="p-6 text-center">
            {unmatchedItems.length > 0 ? (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-black">
                      <th className="p-3">البيان والسبب</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3 text-left">القيمة بالنظام</th>
                      <th className="p-3 text-left">القيمة بالكشف</th>
                      <th className="p-3 text-left">الفرق الحسابي</th>
                      <th className="p-3 text-center w-28">الإجراء والربط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold font-sans">
                    {unmatchedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-50/20">
                        <td className="p-3 text-slate-950 font-extrabold">
                          {item.description}
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {item.date}
                        </td>
                        <td className="p-3 text-left font-mono">
                          {item.systemAmount > 0
                            ? Number(item.systemAmount || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })
                            : "-"}
                        </td>
                        <td className="p-3 text-left font-mono">
                          {item.bankAmount > 0
                            ? Number(item.bankAmount || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })
                            : "-"}
                        </td>
                        <td className="p-3 text-left font-mono font-black text-rose-600">
                          {Number(item.difference || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleReconcileItem(item.id)}
                            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg border border-blue-200 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                          >
                            تسوية السند
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="text-slate-800 font-extrabold text-sm mb-1">
                  تسوية بنكية مكتملة!
                </h4>
                <p className="text-slate-400 text-xs">
                  لا توجد أي فروقات متبقية بين النظام وكامل كشوف البنوك في الوقت
                  الحالي
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Split Bottom Sub-Panels matching layouts perfectly with correct titles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        {/* Panel Left: كشف حساب البنك (Bank Statement Widget) - occupies 4 columns */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[2.5rem] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-blue-900 text-sm">
                كشف حساب البنك
              </h3>
              <select className="bg-slate-50 border border-slate-200 text-slate-500 font-bold text-[10px] py-1 px-3 rounded-lg outline-none cursor-pointer">
                <option value="all">اختر الملف المستورد</option>
                <option value="test_stmt">كشف_مايو_2024.pdf</option>
              </select>
            </div>

            {/* Minimised Statement rows */}
            <div className="space-y-2 border border-slate-100 rounded-2xl p-2.5 max-h-[295px] overflow-y-auto">
              <table className="w-full text-[10px] border-collapse text-right select-none font-sans font-bold">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-black border-b border-slate-200">
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">إيداع</th>
                    <th className="p-2">سحب</th>
                    <th className="p-2">الرصيد</th>
                    <th className="p-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {bankStatementTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-slate-500">{t.date}</td>
                      <td className="p-2 font-mono text-emerald-600">
                        {t.deposit > 0 ? Number(t.deposit || 0).toLocaleString() : "-"}
                      </td>
                      <td className="p-2 font-mono text-rose-600">
                        {t.withdrawal > 0 ? Number(t.withdrawal || 0).toLocaleString() : "-"}
                      </td>
                      <td className="p-2 font-mono text-slate-700">
                        {Number(t.balance || 0).toLocaleString()}
                      </td>
                      <td className="p-2 text-center text-[8px]">
                        <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded">
                          مسواة
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 font-bold">
              إجمالي المطابقة الدفترية نشط ومؤمّن
            </span>
          </div>
        </div>

        {/* Panel Middle: بنود التسوية (غير مطابقة) (Unmatched Items) - occupies 5 columns */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-[2.5rem] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-rose-950 text-sm">
                  بنود التسوية (غير مطابقة)
                </h3>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black animate-bounce">
                  {unmatchedItems.length}
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-400">
                تحديث تلقائي
              </span>
            </div>

            {/* Statement pending items */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {unmatchedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-red-50/40 rounded-xl border border-red-100 flex items-center justify-between font-bold text-xs gap-4 shadow-3xs hover:-translate-y-0.5 transition-all"
                >
                  <div className="space-y-1">
                    <span className="block font-black text-rose-950">
                      {item.description}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono">
                      {item.date}
                    </span>
                  </div>

                  {/* Values & Action */}
                  <div className="text-left space-y-1 bg-white p-2 rounded-lg border border-red-200/50 min-w-[200px]">
                    <div className="flex justify-between gap-6 text-[10px] border-b border-dashed border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold">
                        في النظام:
                      </span>
                      <span className="font-mono text-slate-800">
                        {item.systemAmount > 0
                          ? Number(item.systemAmount || 0).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6 text-[10px] border-b border-dashed border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold">
                        في كشف البنك:
                      </span>
                      <span className="font-mono text-emerald-600">
                        {item.bankAmount > 0
                          ? Number(item.bankAmount || 0).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6 text-[10px] pb-1 font-black">
                      <span className="text-slate-500 font-bold">الفرق:</span>
                      <span className="font-mono text-rose-600">
                        {Number(item.difference || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="pt-1.5 text-center">
                      <button
                        onClick={() => handleReconcileItem(item.id)}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white hover:scale-103 transition-all rounded-lg text-[10px] font-black cursor-pointer shadow-sm"
                      >
                        تسوية البند الآن
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {unmatchedItems.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  كل البنود مطابقة 100% بنجاح!
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>فرق كلي معلق:</span>
            <span className="font-mono font-black text-rose-600">
              {unmatchedItems
                .reduce((acc, current) => acc + current.difference, 0)
                .toLocaleString()}{" "}
              جنيه
            </span>
          </div>
        </div>

        {/* Panel Right: ملخص التسوية (Reconciliation summary widget) - occupies 3 columns */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-[2.5rem] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 text-sm">
              ملخص التسوية
            </h3>

            {/* Structured details list */}
            <div className="space-y-3.5 text-xs font-bold text-slate-600">
              <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                <span className="text-slate-500">الرصيد في النظام:</span>
                <span className="font-mono font-black text-blue-600">
                  1,250,850.00
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                <span className="text-slate-500">الرصيد في كشف البنك:</span>
                <span className="font-mono font-black text-emerald-600">
                  1,248,250.00
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                <span className="text-slate-500">فرق التسوية:</span>
                <span className="font-mono font-black text-amber-600">
                  2,600.00
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                <span className="text-slate-500">
                  عدد البنود غير المتطابقة:
                </span>
                <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                  {unmatchedItems.length}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                <span className="text-slate-500">آخر تسوية تمت في:</span>
                <span className="font-mono font-bold text-slate-700">
                  28/04/2024
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">تمت التسوية بواسطة:</span>
                <span className="text-slate-700 font-extrabold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                  أحمد محمد
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={handleGlobalReconciliation}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white hover:scale-102 transition-all font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Scale className="w-4 h-4 text-white" />
              إجراء التسوية البنكية
            </button>
          </div>
        </div>
      </div>

      {/* 6. Modals & Dialog Dialogs */}
      <AnimatePresence>
        {isNewBankModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 text-right overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h3 className="text-base font-black text-slate-950">
                  إضافة حساب بنكي جديد
                </h3>
                <button
                  onClick={() => setIsNewBankModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400"
                >
                  &times;
                </button>
              </div>

              <form
                onSubmit={handleCreateBank}
                className="space-y-4 text-xs font-bold text-slate-600"
              >
                <div>
                  <label className="block mb-1 text-slate-500">
                    اسم البنك / الفرع
                  </label>
                  <input
                    type="text"
                    required
                    value={newBank.name ?? ""}
                    onChange={(e) =>
                      setNewBank({ ...newBank, name: e.target.value })
                    }
                    placeholder="مثال: البنك العربي الأفريقي الدولي - فرع العباسية"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:bg-white text-right font-extrabold"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-500">
                    رقم الحساب البنكي (IBAN)
                  </label>
                  <input
                    type="text"
                    required
                    value={newBank.accountNumber ?? ""}
                    onChange={(e) =>
                      setNewBank({ ...newBank, accountNumber: e.target.value })
                    }
                    placeholder="EG000000000000000000000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:bg-white text-left font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-500">
                      العملة الأساسية
                    </label>
                    <select
                      value={newBank.currency ?? ""}
                      onChange={(e) =>
                        setNewBank({ ...newBank, currency: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                    >
                      <option value="جنيه مصري">USD ($)</option>
                      <option value="جنيه مصري">EUR (€)</option>
                      <option value="جنيه مصري">جنيه مصري (ج.م)</option>
                      <option value="ريال سعودي">ريال سعودي (ر.س)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-500">
                      الرصيد الافتتاحي
                    </label>
                    <input
                      type="number"
                      value={newBank.openingBalance ?? ""}
                      onChange={(e) =>
                        setNewBank({
                          ...newBank,
                          openingBalance: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewBankModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    إنشاء الحساب
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dialog Toast Alert */}
      <AnimatePresence>
        {isAlertOpen && (
          <div className="fixed bottom-4 left-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 text-xs font-black rtl leading-relaxed max-w-sm"
              dir="rtl"
            >
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{alertMsg}</span>
              <button
                onClick={() => setIsAlertOpen(false)}
                className="mr-auto text-slate-400 hover:text-white font-bold"
              >
                &times;
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
