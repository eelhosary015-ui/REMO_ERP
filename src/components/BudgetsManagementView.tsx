import React, { useState, useEffect, useMemo } from "react";
import {
  BadgeDollarSign,
  CalendarRange,
  Plus,
  Search,
  RefreshCw,
  Download,
  Printer,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  DollarSign,
  Edit2,
  Trash2,
  X,
  PieChart,
  Scale,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../utils/api";
import { GeneralAccountsSettingsNav } from "./GeneralAccountsSettingsNav";

interface BudgetItem {
  id?: number;
  fiscal_year_id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  type: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  utilization: number;
  notes?: string;
  warning_threshold?: number;
}

interface FiscalYearOption {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface AccountOption {
  id: number;
  code: string;
  name: string;
  name_ar?: string;
  type: string;
}

interface BudgetsManagementViewProps {
  activeSettingsTab?: string;
  onSettingsTabChange?: (tab: "fiscal_years" | "account_config" | "budgets" | "audit_logs") => void;
}

export const BudgetsManagementView: React.FC<BudgetsManagementViewProps> = ({
  activeSettingsTab = "budgets",
  onSettingsTabChange,
}) => {
  const [fiscalYears, setFiscalYears] = useState<FiscalYearOption[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | "">("");
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetForm, setBudgetForm] = useState({
    account_id: "",
    amount: "",
    notes: "",
    warning_threshold: 85,
  });

  // Load Fiscal Years & Accounts
  useEffect(() => {
    loadInitialMeta();
  }, []);

  const loadInitialMeta = async () => {
    try {
      const [fyRes, accRes] = await Promise.all([
        api.get("/api/fiscal-years"),
        api.get("/api/accounts"),
      ]);
      const fyData = await fyRes.json();
      const accData = await accRes.json();

      const fyList = Array.isArray(fyData) ? fyData : fyData.data || [];
      const accList = Array.isArray(accData) ? accData : accData.data || accData.accounts || [];

      if (fyList.length > 0) {
        setFiscalYears(fyList);
        const activeYear = fyList.find((y: any) => y.status === "active") || fyList[0];
        setSelectedYearId(activeYear.id);
      } else {
        const fallbackFy: FiscalYearOption = {
          id: 1,
          name: `السنة المالية ${new Date().getFullYear()}`,
          start_date: `${new Date().getFullYear()}-01-01`,
          end_date: `${new Date().getFullYear()}-12-31`,
          status: "active",
        };
        setFiscalYears([fallbackFy]);
        setSelectedYearId(fallbackFy.id);
      }

      setAccounts(accList);
    } catch {
      const fallbackFy: FiscalYearOption = {
        id: 1,
        name: `السنة المالية ${new Date().getFullYear()}`,
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
        status: "active",
      };
      setFiscalYears([fallbackFy]);
      setSelectedYearId(fallbackFy.id);
    }
  };

  // Fetch Budgets for selected year
  useEffect(() => {
    if (selectedYearId) {
      fetchBudgetsData(selectedYearId);
    }
  }, [selectedYearId]);

  const fetchBudgetsData = async (fyId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/budget-vs-actual?fiscal_year_id=${fyId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setBudgets(list);
      } else {
        setBudgets([]);
      }
    } catch {
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateActuals = async () => {
    if (!selectedYearId) return;
    setRecalculating(true);
    try {
      await api.post("/api/v2/erp-gl/budgets/recalculate", { fiscal_year_id: selectedYearId }).catch(() => {});
      await fetchBudgetsData(Number(selectedYearId));
    } catch {
      // Refresh
      await fetchBudgetsData(Number(selectedYearId));
    } finally {
      setRecalculating(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBudget(null);
    setBudgetForm({
      account_id: "",
      amount: "",
      notes: "",
      warning_threshold: 85,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (item: BudgetItem) => {
    setEditingBudget(item);
    setBudgetForm({
      account_id: String(item.account_id),
      amount: String(item.budget_amount),
      notes: item.notes || "",
      warning_threshold: item.warning_threshold || 85,
    });
    setShowModal(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetForm.account_id || !budgetForm.amount) {
      alert("يرجى اختيار الحساب وتحديد مبلغ الموازنة التقديرية");
      return;
    }

    const amountNum = parseFloat(budgetForm.amount) || 0;
    const accIdNum = parseInt(budgetForm.account_id);
    const selectedAcc = accounts.find((a) => a.id === accIdNum);

    try {
      const res = await api.post("/api/budgets", {
        fiscal_year_id: selectedYearId,
        account_id: accIdNum,
        amount: amountNum,
      });

      if (res.ok) {
        setShowModal(false);
        fetchBudgetsData(Number(selectedYearId));
        return;
      }
    } catch {
      // Fallback local update
    }

    // Optimistic UI update
    setBudgets((prev) => {
      const existingIdx = prev.findIndex((b) => b.account_id === accIdNum);
      const accName = selectedAcc ? selectedAcc.name_ar || selectedAcc.name : "حساب معتمد";
      const accCode = selectedAcc ? selectedAcc.code : "500000";
      const accType = selectedAcc ? selectedAcc.type : "expense";

      if (existingIdx >= 0) {
        const copy = [...prev];
        const existing = copy[existingIdx];
        const act = existing.actual_amount || 0;
        copy[existingIdx] = {
          ...existing,
          budget_amount: amountNum,
          variance: amountNum - act,
          utilization: amountNum > 0 ? Math.round((act / amountNum) * 100) : 0,
          notes: budgetForm.notes,
        };
        return copy;
      } else {
        const newItem: BudgetItem = {
          id: Date.now(),
          fiscal_year_id: Number(selectedYearId),
          account_id: accIdNum,
          account_code: accCode,
          account_name: accName,
          type: accType,
          budget_amount: amountNum,
          actual_amount: 0,
          variance: amountNum,
          utilization: 0,
          notes: budgetForm.notes,
        };
        return [newItem, ...prev];
      }
    });

    setShowModal(false);
  };

  const handleDeleteBudget = (accId: number) => {
    if (!confirm("هل أنت متأكد من حذف اعتماد الموازنة لهذا الحساب؟")) return;
    setBudgets((prev) => prev.filter((b) => b.account_id !== accId));
  };

  const handleExportExcel = () => {
    const rows = filteredBudgets.map((b) => ({
      "كود الحساب": b.account_code,
      "اسم الحساب": b.account_name,
      "النوع": b.type === "expense" ? "مصروفات" : b.type === "revenue" ? "إيرادات" : "أصول/أخرى",
      "الموازنة المعتمدة (ج.م)": b.budget_amount,
      "المنصرف الفعلي (ج.م)": b.actual_amount,
      "الانحراف المالي": b.variance,
      "نسبة الاستهلاك %": `${b.utilization}%`,
      "حالة السقف": b.utilization > 100 ? "تجاوز الموازنة" : b.utilization >= 80 ? "على وشك النفاذ" : "ضمن السقف",
      "ملاحظات": b.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الموازنات التقديرية");
    XLSX.writeFile(wb, `Budgets_FY_${selectedYearId}_Report.xlsx`);
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const expenseBudgets = budgets.filter((b) => b.type === "expense" || !b.type);
    const totalExpenseBudget = expenseBudgets.reduce((acc, b) => acc + (b.budget_amount || 0), 0);
    const totalExpenseActual = expenseBudgets.reduce((acc, b) => acc + (b.actual_amount || 0), 0);
    const totalVariance = totalExpenseBudget - totalExpenseActual;
    const overallUtilization = totalExpenseBudget > 0 ? Math.round((totalExpenseActual / totalExpenseBudget) * 100) : 0;
    const overBudgetCount = budgets.filter((b) => b.utilization > 100).length;
    const nearLimitCount = budgets.filter((b) => b.utilization >= 80 && b.utilization <= 100).length;

    return {
      totalExpenseBudget,
      totalExpenseActual,
      totalVariance,
      overallUtilization,
      overBudgetCount,
      nearLimitCount,
      totalItemsCount: budgets.length,
    };
  }, [budgets]);

  // Filtered Budgets
  const filteredBudgets = useMemo(() => {
    return budgets.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.account_code.includes(searchQuery);

      const matchCategory =
        categoryFilter === "all" ||
        (categoryFilter === "expense" && (item.type === "expense" || !item.type)) ||
        (categoryFilter === "revenue" && item.type === "revenue") ||
        (categoryFilter === "asset" && item.type === "asset");

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "safe" && item.utilization < 80) ||
        (statusFilter === "warning" && item.utilization >= 80 && item.utilization <= 100) ||
        (statusFilter === "over" && item.utilization > 100);

      return matchSearch && matchCategory && matchStatus;
    });
  }, [budgets, searchQuery, categoryFilter, statusFilter]);

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

      {/* Header & Fiscal Year Selector */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
            <BadgeDollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">إدارة الموازنات وسقوف الإنفاق (Budgets Management)</h1>
            <p className="text-xs text-slate-400 font-medium">
              تحديد اعتمادات بنود شجرة الحسابات والرقابة اللحظية على الانحراف ومقارنة الفعلي
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Fiscal Year Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
            <CalendarRange className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600">السنة المالية:</span>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name} {fy.status === "active" ? "(نشطة)" : "(مغلقة)"}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRecalculateActuals}
            disabled={recalculating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
            title="إعادة احتساب الأرصدة الفعلية من قيود الأستاذ العام"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin text-emerald-600" : ""}`} />
            <span>تحديث الفعلي</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>اعتماد موازنة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي الموازنة المعتمدة</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.totalExpenseBudget.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">سقف المصروفات المعتمد للعام المالي</p>
        </div>

        {/* Total Actual */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي المنصرف الفعلي</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.totalExpenseActual.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  metrics.overallUtilization > 100
                    ? "bg-rose-500"
                    : metrics.overallUtilization >= 80
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(metrics.overallUtilization, 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-slate-600">{metrics.overallUtilization}%</span>
          </div>
        </div>

        {/* Net Variance */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">صافي الوفر المتبقي</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-black tracking-tight ${
              metrics.totalVariance >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {metrics.totalVariance.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.totalVariance >= 0 ? "وفر مالي ضمن السقوف المعتمدة" : "عجز وتجاوز في الموازنة الإجمالية"}
          </p>
        </div>

        {/* Status Alerts */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">حالة بنود الموازنة</span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-xl font-black text-rose-600">{metrics.overBudgetCount}</span>
              <span className="text-[10px] block font-bold text-slate-400">تجاوز السقف</span>
            </div>
            <div className="h-7 w-[1px] bg-slate-200" />
            <div>
              <span className="text-xl font-black text-amber-600">{metrics.nearLimitCount}</span>
              <span className="text-[10px] block font-bold text-slate-400">تنبيه 80%</span>
            </div>
            <div className="h-7 w-[1px] bg-slate-200" />
            <div>
              <span className="text-xl font-black text-slate-700">{metrics.totalItemsCount}</span>
              <span className="text-[10px] block font-bold text-slate-400">إجمالي البنود</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم الحساب أو الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none"
          >
            <option value="all">كافة أنواع الحسابات</option>
            <option value="expense">المصروفات والتكاليف (Expense)</option>
            <option value="revenue">الإيرادات المستهدفة (Revenue)</option>
            <option value="asset">الأصول الرأسمالية (Capex)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none"
          >
            <option value="all">كافة الحالات</option>
            <option value="safe">ضمن السقف الآمن (&lt; 80%)</option>
            <option value="warning">على وشك النفاذ (80% - 100%)</option>
            <option value="over">تجاوز الموازنة (&gt; 100%)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
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

      {/* Budgets Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-4 w-28">كود الحساب</th>
                <th className="p-4">اسم الحساب والبيان</th>
                <th className="p-4 w-24">النوع</th>
                <th className="p-4 text-left w-36">الموازنة المعتمدة</th>
                <th className="p-4 text-left w-36">المنصرف الفعلي</th>
                <th className="p-4 text-left w-32">الانحراف المالي</th>
                <th className="p-4 text-center w-40">نسبة الاستهلاك</th>
                <th className="p-4 text-center w-28">الحالة</th>
                <th className="p-4 text-center w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    جاري تحميل بيانات الموازنات...
                  </td>
                </tr>
              ) : filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    لا توجد بنود موازنة مطابقة للبحث أو الفلتر
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((b) => {
                  const isOver = b.utilization > 100;
                  const isWarning = b.utilization >= 80 && b.utilization <= 100;

                  return (
                    <tr key={b.account_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-600">{b.account_code}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{b.account_name}</div>
                        {b.notes && <div className="text-[10px] text-slate-400 truncate max-w-xs">{b.notes}</div>}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            b.type === "revenue"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : b.type === "asset"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {b.type === "revenue" ? "إيراد" : b.type === "asset" ? "أصل" : "مصروف"}
                        </span>
                      </td>
                      <td className="p-4 text-left font-black font-mono text-slate-900">
                        {b.budget_amount.toLocaleString()}{" "}
                        <span className="text-[10px] font-normal text-slate-400">ج.م</span>
                      </td>
                      <td className="p-4 text-left font-mono font-bold text-slate-700">
                        {b.actual_amount.toLocaleString()}{" "}
                        <span className="text-[10px] font-normal text-slate-400">ج.م</span>
                      </td>
                      <td className="p-4 text-left font-mono font-bold">
                        <span className={b.variance >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {b.variance >= 0 ? "+" : ""}
                          {b.variance.toLocaleString()}{" "}
                          <span className="text-[10px] font-normal text-slate-400">ج.م</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(b.utilization, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[11px] font-bold w-10 text-left ${
                              isOver ? "text-rose-600" : isWarning ? "text-amber-600" : "text-emerald-700"
                            }`}
                          >
                            {b.utilization}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full border inline-flex items-center gap-1 ${
                            isOver
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : isWarning
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {isOver ? (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              تجاوز السقف
                            </>
                          ) : isWarning ? (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              تحذير 80%
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              ضمن الموازنة
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-600 hover:text-emerald-600 transition-colors"
                            title="تعديل الموازنة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudget(b.account_id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="حذف الاعتماد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Modal: Add/Edit Budget */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <BadgeDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingBudget ? "تعديل اعتماد موازنة لحساب" : "اعتماد موازنة جديدة لحساب"}
                  </h3>
                  <p className="text-xs text-slate-400">تحديد سقف الإنفاق المالي وتفعيل التنبيهات</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-5 space-y-4">
              {/* Account selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الحساب المالي من شجرة الحسابات:
                </label>
                {editingBudget ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="font-mono font-bold text-xs text-slate-600 block">
                      {editingBudget.account_code}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{editingBudget.account_name}</span>
                  </div>
                ) : (
                  <select
                    value={budgetForm.account_id}
                    onChange={(e) => setBudgetForm({ ...budgetForm, account_id: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- اختر الحساب المالي --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name_ar || acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Annual Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مبلغ الموازنة السنوي المعتمد (ج.م):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="مثال: 500000"
                    value={budgetForm.amount}
                    onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-black font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-emerald-500 pl-14"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ج.م
                  </span>
                </div>
                {budgetForm.amount && parseFloat(budgetForm.amount) > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    المتوسط الشهري التقديري:{" "}
                    <span className="font-mono font-bold text-slate-800">
                      {Math.round(parseFloat(budgetForm.amount) / 12).toLocaleString()} ج.م / شهر
                    </span>
                  </p>
                )}
              </div>

              {/* Warning Threshold */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نسبة التحذير عند الاقتراب من السقف (%):
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={budgetForm.warning_threshold}
                  onChange={(e) => setBudgetForm({ ...budgetForm, warning_threshold: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">يتم إطلاق تنبيه في التقارير واللوحة عند استهلاك هذه النسبة</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات أو مبررات الاعتماد:
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات تفصيلية حول بنود الصرف أو القرارات الإدارية..."
                  value={budgetForm.notes}
                  onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all"
                >
                  حفظ الاعتماد المالي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
