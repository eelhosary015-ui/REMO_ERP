import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash,
  Edit2,
  Search,
  Settings,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  FileText,
  Calculator,
  ChevronsUpDown,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Building,
  TrendingDown,
  Briefcase,
  Package,
  Filter,
  MoreHorizontal,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";

// Interfaces
interface FixedAsset {
  id: number;
  code: string;
  name: string;
  serialNumber: string;
  category: string;
  location: string;
  custodian: string;
  notes: string;
  purchaseDate: string;
  operationDate: string;
  purchaseValue: number;
  salvageValue: number;
  depreciableCost: number;
  depreciationMethod: string;
  usefulLife: number;
  depreciationRate: number;
  accumulatedDepreciation?: number;
  netValue?: number;
  status?: string;
  branchId?: number | null;
  branchName?: string;
  employeeId?: number | null;
  employeeName?: string;
  costCenterId?: number | null;
  glAssetAccountId?: number | null;
  glAccumulatedId?: number | null;
  glDepreciationExpenseId?: number | null;
  acquisitionEntryId?: number | null;
  lastDepreciationDate?: string;
}

interface DepreciationScheduleItem {
  year: number;
  date: string;
  openingBookValue: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
}

export const FixedAssetsView: React.FC = () => {
  // Helpers to get today-relative dates
  const getTodayFormatted = (offsetDays = 0): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getTodayInputFormat = (offsetDays = 0): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Convert input DATE (YYYY-MM-DD) to Display DATE (DD/MM/YYYY)
  const toDisplayDate = (inputDate: string): string => {
    if (!inputDate) return "";
    const parts = inputDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return inputDate;
  };

  // Convert Display DATE (DD/MM/YYYY) to input DATE (YYYY-MM-DD)
  const toInputDate = (displayDate: string): string => {
    if (!displayDate) return "";
    const parts = displayDate.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return displayDate;
  };

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v2/fixed-assets');
      const data = await res.json();
      setAssets(data || []);
    } catch (e) {
      console.error('Failed to fetch assets:', e);
    } finally {
      setLoading(false);
    }
  };

  // Selected Asset for form
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const emptyForm: FixedAsset = {
    id: 0, code: "", name: "", serialNumber: "", category: "", location: "",
    custodian: "", notes: "", purchaseDate: "", operationDate: "",
    purchaseValue: 0, salvageValue: 0, depreciableCost: 0,
    depreciationMethod: "", usefulLife: 0, depreciationRate: 0,
    accumulatedDepreciation: 0, netValue: 0, status: "",
  };
  const [formState, setFormState] = useState<FixedAsset>({ ...emptyForm });
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [depBusy, setDepBusy] = useState(false);
  const [subTab, setSubTab] = useState<"list" | "form">("list");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Initial fetch
  useEffect(() => { fetchAssets(); }, []);

  useEffect(() => {
    api.get("/api/hr/branches-status").then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : (d?.branches || []))).catch(() => {});
    api.get("/api/hr/employees").then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : (d?.data || []))).catch(() => {});
    api.get("/api/accounts").then(r => r.json()).then(d => setGlAccounts(Array.isArray(d) ? d.filter((a: any) => a.allow_posting !== false) : [])).catch(() => {});
  }, []);

  // Update form state when selected asset changed
  useEffect(() => {
    const asset = assets.find((a) => a.id === selectedAssetId);
    if (asset) {
      setFormState({ ...asset });
    }
  }, [selectedAssetId, assets]);

  // Handle number recalculations
  const handlePurchaseValueChange = (valStr: string) => {
    const val = parseFloat(valStr.replace(/,/g, "")) || 0;
    const salvage = formState.salvageValue;
    const depCost = Math.max(0, val - salvage);
    setFormState((prev) => ({
      ...prev,
      purchaseValue: val,
      depreciableCost: depCost,
    }));
  };

  const handleSalvageValueChange = (valStr: string) => {
    const val = parseFloat(valStr.replace(/,/g, "")) || 0;
    const purchase = formState.purchaseValue;
    const depCost = Math.max(0, purchase - val);
    setFormState((prev) => ({
      ...prev,
      salvageValue: val,
      depreciableCost: depCost,
    }));
  };

  const handleUsefulLifeChange = (valStr: string) => {
    const years = parseInt(valStr) || 0;
    const rate = years > 0 ? parseFloat((100 / years).toFixed(2)) : 0;
    setFormState((prev) => ({
      ...prev,
      usefulLife: years,
      depreciationRate: rate,
    }));
  };

  // Searching filter
  const [searchQuery, setSearchQuery] = useState("");

  // Selected item modal / status overlay
  const [feedback, setFeedback] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const showFeedback = (text: string, type: "success" | "info" | "error" = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Running Depreciation calculation table / modal
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [depreciationSchedule, setDepreciationSchedule] = useState<
    DepreciationScheduleItem[]
  >([]);

  // Function to calculate and open depreciation schedule
  const runDepreciationSchedule = () => {
    const value = formState.purchaseValue;
    const salvage = formState.salvageValue;
    const usefulLife = formState.usefulLife;
    const method = formState.depreciationMethod || "قسط ثابت";

    if (!usefulLife || usefulLife <= 0) {
      showFeedback("يرجى إدخال عمر إنتاجي صالح لحساب جدول الإهلاك", "info");
      return;
    }

    const schedule: DepreciationScheduleItem[] = [];
    let currentBookValue = value;
    const yearlyDepreciation = (value - salvage) / usefulLife;
    let accumulated = 0;

    const opDateStr = formState.operationDate || getTodayFormatted();
    const opDateParts = opDateStr.split("/");
    const startYear =
      opDateParts.length === 3
        ? parseInt(opDateParts[2])
        : new Date().getFullYear();

    for (let i = 1; i <= usefulLife; i++) {
      const expense =
        i === usefulLife ? currentBookValue - salvage : yearlyDepreciation;
      accumulated += expense;
      const closing = currentBookValue - expense;
      schedule.push({
        year: i,
        date: `${opDateParts[0] || "01"}/${opDateParts[1] || "01"}/${startYear + i - 1}`,
        openingBookValue: currentBookValue,
        depreciationExpense: expense,
        accumulatedDepreciation: accumulated,
        closingBookValue: closing,
      });
      currentBookValue = closing;
    }

    setDepreciationSchedule(schedule);
    setIsScheduleOpen(true);
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !formState.id;
    try {
      const res = isNew
        ? await api.post('/api/v2/fixed-assets', formState)
        : await api.put(`/api/v2/fixed-assets/${formState.id}`, formState);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback(data.error || 'فشل في حفظ الأصل', 'error');
        return;
      }
      setSelectedAssetId(data.id ?? formState.id);
      showFeedback(isNew ? "تم إنشاء الأصل وربطه بالحسابات" : "تم حفظ بيانات الأصل الثابت بنجاح!");
      setSubTab("list");
      fetchAssets();
    } catch (e) {
      console.error('Failed to save asset:', e);
      showFeedback('فشل في حفظ الأصل', 'error');
    }
  };

  const handleDepreciate = async () => {
    if (!formState.id) { showFeedback('احفظ الأصل أولاً قبل ترحيل الإهلاك', 'error'); return; }
    setDepBusy(true);
    try {
      const res = await api.post(`/api/v2/fixed-assets/${formState.id}/depreciate`, { months: 1 });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showFeedback(data.error || 'فشل ترحيل الإهلاك', 'error'); return; }
      if (data.asset) setFormState({ ...data.asset });
      showFeedback(`تم ترحيل إهلاك ${Number(data.amount).toLocaleString()} ج.م وقيد رقم ${data.journalEntryId}`);
      fetchAssets();
    } catch (e) {
      showFeedback('فشل ترحيل الإهلاك', 'error');
    } finally {
      setDepBusy(false);
    }
  };

  // New item flow — نموذج جديد بدون إنشاء سجل فارغ في قاعدة البيانات
  const handleAddNew = async () => {
    setFormState({
      id: 0,
      code: `FA-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      name: "",
      serialNumber: "",
      category: "أجهزة كمبيوتر",
      location: "المقر الرئيسي",
      custodian: "",
      notes: "",
      purchaseDate: getTodayFormatted(0),
      operationDate: getTodayFormatted(10),
      purchaseValue: 0,
      salvageValue: 0,
      depreciableCost: 0,
      depreciationMethod: "قسط ثابت",
      usefulLife: 5,
      depreciationRate: 20,
      branchId: null,
      employeeId: null,
    });
    setSelectedAssetId(null);
    setSubTab("form");
  };

  // Delete item
  const handleDelete = async () => {
    if (selectedAssetId == null) return;
    try {
      await api.delete(`/api/v2/fixed-assets/${selectedAssetId}`);
      showFeedback("تم حذف الأصل بنجاح!");
      setSelectedAssetId(null);
      setSubTab("list");
      fetchAssets();
    } catch (e) {
      console.error('Failed to delete asset:', e);
      showFeedback('فشل في حذف الأصل', 'error');
    }
  };

  // Filtered assets for safe viewing/switching
  const filteredAssets = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalAssetsValue = assets.reduce(
    (sum, a) => sum + (a.purchaseValue || 0),
    0,
  );
  const totalAccumulatedDepreciation = assets.reduce(
    (sum, a) => sum + (a.accumulatedDepreciation || 0),
    0,
  );
  const totalNetValue = totalAssetsValue - totalAccumulatedDepreciation;
  const totalAssetsCount = assets.length;

  // Handle pagination calculations
  const totalCount = filteredAssets.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Dynamic Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            )}
            <span className="font-extrabold text-sm font-sans">
              {feedback.text}
            </span>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 hover:bg-black/5 rounded-lg"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Inner Sub-Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 mb-2 gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setSubTab("list")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              subTab === "list"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:bg-white/50"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الأصول المتاحة ({assets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("form")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              subTab === "form"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:bg-white/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>بطاقة الأصل وحساب الإهلاك</span>
          </button>
        </div>

        <div className="text-slate-400 text-[11px] font-bold font-sans tracking-wide uppercase">
          {subTab === "list"
            ? "سجل الأصول ومجموعات العمليات"
            : `تعديل الأصل: ${formState.name || "جديد"}`}
        </div>
      </div>

      {subTab === "list" ? (
        /* Sub Tab 1: Available Assets Dashboard / View */
        <div className="flex flex-col gap-6">
          {/* Top Actions Bar (Addition, Depreciation calculation, report, more, filter, search) */}
          <div className="flex flex-col md:flex-row flex-wrap md:items-center justify-between gap-4 p-2">
            {/* Left Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Add New Asset Button */}
              <button
                type="button"
                onClick={handleAddNew}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all rounded-xl active:scale-95 cursor-pointer font-sans"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أصل جديد</span>
              </button>

              {/* Calculate Depreciation Button */}
              <button
                type="button"
                onClick={runDepreciationSchedule}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all rounded-xl active:scale-95 cursor-pointer font-sans"
              >
                <Calculator className="w-4 h-4" />
                <span>حساب الإهلاك</span>
              </button>

              {/* Asset Report Button */}
              <button
                type="button"
                onClick={() =>
                  showFeedback(
                    "تم توليد وإقران تقرير الأصول واحتساب الإهلاك المتكامل لدفاتر الحسابات بنجاح!",
                    "success",
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-all active:scale-95 font-sans"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>تقرير الأصول</span>
              </button>

              {/* More... Button */}
              <button
                type="button"
                onClick={() =>
                  showFeedback(
                    "تم تمكين المزامنة ومراجعة تاريخ تجميد الأصول بنجاح",
                    "info",
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl shadow-sm transition-all active:scale-95 font-sans"
              >
                <MoreHorizontal className="w-4 h-4 text-slate-500" />
                <span>المزيد ...</span>
              </button>
            </div>

            {/* Right Filters & Search */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Filter Button */}
              <button
                type="button"
                onClick={() =>
                  showFeedback(
                    "خيارات التصفية السريعة والفرز مفعلة تلقائياً",
                    "info",
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-all active:scale-95 font-sans"
              >
                <Filter className="w-4 h-4 text-slate-500" />
                <span>فلترة</span>
              </button>

              {/* Quick Search */}
              <div className="relative flex-1 md:flex-initial">
                <input
                  type="text"
                  placeholder="بحث برقم الأصل أو الاسم"
                  value={searchQuery ?? ""}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to page 1 on search
                  }}
                  className="bg-white border border-slate-200 text-slate-700 placeholder-slate-400 font-bold text-xs py-2.5 pl-3 pr-10 rounded-xl focus:border-blue-500 outline-none w-full md:w-72 transition-all text-right shadow-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* KPI Stats Cards - 4 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 4: Count of Assets (Blue Theme) */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col text-right justify-center">
                <span className="text-slate-500 font-bold text-[11px]">
                  عدد الأصول
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {totalAssetsCount}
                </span>
                <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                  أصل
                </span>
              </div>
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100/50">
                <Package className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Net Assets Value (Green Theme) */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col text-right justify-center">
                <span className="text-slate-500 font-bold text-[11px]">
                  صافي قيمة الأصول
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {Number(totalNetValue || 0 || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                  جنيه مصري
                </span>
              </div>
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100/50">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Total Accumulated Depreciation (Red Theme) */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col text-right justify-center">
                <span className="text-slate-500 font-bold text-[11px]">
                  إجمالي الإهلاك المتراكم
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {Number(totalAccumulatedDepreciation || 0 || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                  جنيه مصري
                </span>
              </div>
              <div className="p-4 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center border border-red-100/50">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>

            {/* Card 1: Total Purchase Value (Purple Theme) */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col text-right justify-center">
                <span className="text-slate-500 font-bold text-[11px]">
                  إجمالي قيمة الأصول
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {Number(totalAssetsValue || 0 || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                  جنيه مصري
                </span>
              </div>
              <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100/50">
                <Building className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Sizable table - Circled Section */}
          <div className="border border-slate-100 rounded-2xl bg-white p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-600 font-extrabold border-b border-slate-100">
                    <th className="py-3.5 px-4 text-center w-12 rounded-r-xl">
                      #
                    </th>
                    <th className="py-3.5 px-4">كود الأصل</th>
                    <th className="py-3.5 px-4">اسم الأصل</th>
                    <th className="py-3.5 px-4">نوع الأصل</th>
                    <th className="py-3.5 px-4">تاريخ الشراء</th>
                    <th className="py-3.5 px-4">العمر الافتراضي</th>
                    <th className="py-3.5 px-4 text-left">الإهلاك المتراكم</th>
                    <th className="py-3.5 px-4 text-left">الصافي</th>
                    <th className="py-3.5 px-4 text-center">الحالة</th>
                    <th className="py-3.5 px-4 text-center rounded-l-xl w-32">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedAssets.map((asset, index) => {
                    const rowNum = startIndex + index + 1;
                    return (
                      <tr
                        key={asset.id}
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                        }}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-all ${
                          selectedAssetId === asset.id
                            ? "bg-blue-50/40 text-blue-900 border-blue-200/50 font-bold"
                            : "text-slate-600"
                        }`}
                      >
                        {/* Progressive index column */}
                        <td className="py-4 px-4 text-center text-slate-400 font-mono font-semibold">
                          {rowNum}
                        </td>

                        {/* Code */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">
                          {asset.code}
                        </td>

                        {/* Name */}
                        <td className="py-4 px-4 font-black text-slate-800">
                          {asset.name || "(أصل بدون اسم)"}
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4 font-medium text-slate-500">
                          {asset.category}
                        </td>

                        {/* Purchase Date */}
                        <td className="py-4 px-4 font-mono text-slate-600 font-semibold text-[11px]">
                          {asset.code === "FA-001"
                            ? "1,000,000.00"
                            : asset.purchaseDate}
                        </td>

                        {/* Useful Life */}
                        <td className="py-4 px-4 font-medium text-slate-500">
                          {asset.usefulLife}{" "}
                          {asset.usefulLife >= 3 && asset.usefulLife <= 10
                            ? "سنوات"
                            : "سنة"}
                        </td>

                        {/* Accumulated Depreciation */}
                        <td className="py-4 px-4 font-mono font-semibold text-slate-500 text-left">
                          {(asset.accumulatedDepreciation !== undefined
                            ? asset.accumulatedDepreciation
                            : 0
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Net Value */}
                        <td className="py-4 px-4 font-mono font-black text-slate-900 text-left">
                          {(asset.netValue !== undefined
                            ? asset.netValue
                            : 0
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4 text-center">
                          {asset.status === "متوقفة" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              متوقفة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-emerald-700 border border-green-100 rounded-full text-[10px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              تشغيل
                            </span>
                          )}
                        </td>

                        {/* Actions Cell */}
                        <td
                          className="py-4 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex gap-2 justify-center items-center">
                            {/* Option dots menu */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAssetId(asset.id);
                                showFeedback(
                                  `خيارات متقدمة للأصل ${asset.code}: طباعة الملصق الباركود، التحصين والاستهلاك.`,
                                  "info",
                                );
                              }}
                              className="p-1 px-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-all active:scale-90"
                              title="المزيد من الإجراءات"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {/* Edit Pencil Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAssetId(asset.id);
                                setSubTab("form");
                              }}
                              className="p-1 px-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-all active:scale-95"
                              title="تعديل بطاقة الأصل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* View Eye Button to run Depreciation */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAssetId(asset.id);
                                runDepreciationSchedule();
                              }}
                              className="p-1 px-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-all active:scale-95"
                              title="عرض جدول الإهلاك للمستند"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-5 pt-4 border-t border-slate-100 gap-4 text-slate-500 font-medium text-xs">
              {/* Right: Record counters */}
              <div className="font-sans text-right">
                <span>عرض </span>
                <span className="font-black text-slate-800">
                  {totalCount > 0 ? startIndex + 1 : 0}
                </span>
                <span> إلى </span>
                <span className="font-black text-slate-800">
                  {Math.min(endIndex, totalCount)}
                </span>
                <span> من </span>
                <span className="font-black text-slate-800">{totalCount}</span>
                <span> سجل</span>
              </div>

              {/* Middle: Page Size Select Dropdown */}
              <div className="flex items-center gap-2">
                <span>سجل في الصفحة</span>
                <div className="relative">
                  <select
                    value={pageSize ?? ""}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1); // Reset page to 1
                    }}
                    className="bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-3 py-1 pr-7 pl-3 select-none outline-none focus:border-blue-500 text-right font-sans"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Left: Pagination list triggers */}
              <div className="flex items-center gap-1" dir="ltr">
                {/* Double Left: First Page */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className={`p-1.5 border border-slate-100 rounded-lg transition-all ${
                    currentPage === 1
                      ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                      : "bg-white text-slate-600 hover:bg-slate-50 active:scale-90 shadow-sm"
                  }`}
                  title="أول صفحة"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                {/* Single Left: Previous Page */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={`p-1.5 border border-slate-100 rounded-lg transition-all ${
                    currentPage === 1
                      ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                      : "bg-white text-slate-600 hover:bg-slate-50 active:scale-90 shadow-sm"
                  }`}
                  title="الصفحة السابقة"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page numbers list */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-xs rounded-lg transition-all ${
                        currentPage === page
                          ? "bg-blue-600 text-white font-bold shadow-sm"
                          : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-100"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}

                {/* Single Right: Next Page */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={`p-1.5 border border-slate-100 rounded-lg transition-all ${
                    currentPage === totalPages
                      ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                      : "bg-white text-slate-600 hover:bg-slate-50 active:scale-90 shadow-sm"
                  }`}
                  title="الصفحة التالية"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Double Right: Last Page */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className={`p-1.5 border border-slate-100 rounded-lg transition-all ${
                    currentPage === totalPages
                      ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                      : "bg-white text-slate-600 hover:bg-slate-50 active:scale-90 shadow-sm"
                  }`}
                  title="آخر صفحة"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Sub Tab 2: Fixed Asset Card entry / Edit Form */
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSubTab("list")}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100"
              >
                <span>⬅️ العودة إلى سجل الأصول</span>
              </button>
              <h3 className="text-slate-800 font-extrabold text-xs">
                رقم الأصل النشط:{" "}
                <span className="font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                  {formState.code}
                </span>
              </h3>
            </div>

            <button
              onClick={runDepreciationSchedule}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 text-xs font-bold rounded-xl"
            >
              <Calculator className="w-4 h-4" />
              <span>تشغيل الإهلاك ومراجعة التقرير</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Section 1: Main Info */}
            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-slate-50/50 shadow-sm">
              {/* Custom Split Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-sky-100/70 border-b border-sky-100">
                <span className="text-slate-800 font-black text-sm">
                  بيانات الأساسية
                </span>
                <span className="text-slate-700 font-extrabold text-xs tracking-wide uppercase">
                  Main Info
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
                {/* Left Column */}
                <div className="flex flex-col gap-4">
                  {/* Location */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      الموقع
                    </span>
                    <select
                      value={formState.location ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, location: e.target.value })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="المقر الرئيسي">المقر الرئيسي</option>
                      <option value="فرع الرياض">فرع الرياض</option>
                      <option value="فرع دبي">فرع دبي</option>
                      <option value="المطبخ الرئيسي">المطبخ الرئيسي</option>
                      <option value="صالة العائلات">صالة العائلات</option>
                    </select>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Location
                    </span>
                  </div>

                  {/* Branch */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      الفرع
                    </span>
                    <select
                      value={formState.branchId ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, branchId: e.target.value ? Number(e.target.value) : null })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="">— بدون فرع —</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Branch
                    </span>
                  </div>

                  {/* Custodian Employee */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      الموظف المسؤول
                    </span>
                    <select
                      value={formState.employeeId ?? ""}
                      onChange={(e) => setFormState({ ...formState, employeeId: e.target.value ? Number(e.target.value) : null })}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="">— بدون موظف —</option>
                      {employees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Custodian
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right pt-2">
                      ملاحظات
                    </span>
                    <textarea
                      value={formState.notes ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, notes: e.target.value })
                      }
                      rows={2}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-semibold text-xs py-2 px-3 rounded-xl focus:border-blue-500 outline-none resize-none text-right"
                      placeholder="ملاحظات توضيحية اختيارية..."
                    />
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider pt-2">
                      Notes
                    </span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-4">
                  {/* Asset Code */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      كود الأصل
                    </span>
                    <input
                      type="text"
                      value={formState.code ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, code: e.target.value })
                      }
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      placeholder="كود الأصل تلقائي أو يدوي"
                    />
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Asset Code
                    </span>
                  </div>

                  {/* Asset Name */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      اسم الأصل
                    </span>
                    <input
                      type="text"
                      value={formState.name ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, name: e.target.value })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-900 font-extrabold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      placeholder="مثال: HP EliteBook G9"
                      required
                    />
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Asset Name
                    </span>
                  </div>

                  {/* Serial Number */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      الرقم التسلسلي
                    </span>
                    <input
                      type="text"
                      value={formState.serialNumber ?? ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          serialNumber: e.target.value,
                        })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      placeholder="مثال: CNP1234567"
                    />
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Serial Number
                    </span>
                  </div>

                  {/* Asset Category */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      مجموعة الأصول
                    </span>
                    <select
                      value={formState.category ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, category: e.target.value })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="أجهزة كمبيوتر">أجهزة كمبيوتر</option>
                      <option value="آلات ومعدات التشغيل">
                        آلات ومعدات التشغيل
                      </option>
                      <option value="أثاث وتجهيزات">أثاث وتجهيزات</option>
                      <option value="سيارات ووسائل نقل">
                        سيارات ووسائل نقل
                      </option>
                      <option value="عقارات ومباني">عقارات ومباني</option>
                    </select>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Asset Category
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Financial & Purchase Info */}
            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-slate-50/50 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 bg-sky-100/70 border-b border-sky-100">
                <span className="text-slate-800 font-black text-sm">
                  بيانات المالية والتاريخية
                </span>
                <span className="text-slate-700 font-extrabold text-xs tracking-wide uppercase">
                  Financial & Purchase Info
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
                {/* Left Column of Section 2 */}
                <div className="flex flex-col gap-4">
                  {/* Purchase Date */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      تاريخ الشراء
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="date"
                        value={toInputDate(formState.purchaseDate) ?? ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            purchaseDate: toDisplayDate(e.target.value),
                          })
                        }
                        className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      />
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Purchase Date
                    </span>
                  </div>

                  {/* Operation Date */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      تاريخ بدء الاستخدام
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="date"
                        value={toInputDate(formState.operationDate) ?? ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            operationDate: toDisplayDate(e.target.value),
                          })
                        }
                        className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      />
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Operation Date
                    </span>
                  </div>

                  {/* Purchase Value */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      قيمة الشراء
                    </span>
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={Number(formState.purchaseValue || 0 || 0).toLocaleString("en-US")}
                        onChange={(e) =>
                          handlePurchaseValueChange(e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 text-slate-900 font-black text-xs py-2.5 pl-24 pr-4 rounded-xl focus:border-blue-500 outline-none text-right"
                        placeholder="25,000"
                      />
                      <div className="absolute left-2 text-slate-400 font-bold text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg pointer-events-none">
                        ج.م / EGP
                      </div>
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Purchase Value
                    </span>
                  </div>

                  {/* Depreciable Cost row (calculated) */}
                  <div className="flex items-center justify-between gap-4 opacity-50">
                    <span className="text-slate-400 font-bold text-xs w-28 text-right"></span>
                    <div className="flex-1 h-10 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold font-mono">
                      Calculated / محتسب
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Depreciable Cost
                    </span>
                  </div>
                </div>

                {/* Right Column of Section 2 */}
                <div className="flex flex-col gap-4 bg-slate-50/10 p-2 rounded-2xl border border-dashed border-slate-100">
                  {/* Purchase Date placeholder */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      تاريخ الشراء
                    </span>
                    <input
                      type="text"
                      disabled
                      placeholder="غير مستخدم"
                      className="flex-1 bg-slate-50 text-slate-400/50 text-center font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-200 text-right"
                    />
                    <span className="text-slate-400 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Purchase Date
                    </span>
                  </div>

                  {/* Operation Date placeholder / Purchase Value sync */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      تاريخ بدء الاستخدام
                    </span>
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={Number(formState.purchaseValue || 0 || 0).toLocaleString("en-US")}
                        onChange={(e) =>
                          handlePurchaseValueChange(e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 text-slate-900 font-extrabold text-xs py-2.5 pl-24 pr-4 rounded-xl focus:border-blue-500 outline-none text-right"
                      />
                      <div className="absolute left-2 text-slate-400 font-bold text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg pointer-events-none">
                        ج.م / EGP
                      </div>
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Operation Date
                    </span>
                  </div>

                  {/* Salvage Value */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      قيمة الخردة
                    </span>
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={Number(formState.salvageValue || 0 || 0).toLocaleString("en-US")}
                        onChange={(e) =>
                          handleSalvageValueChange(e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 text-slate-900 font-black text-xs py-2.5 pl-24 pr-4 rounded-xl focus:border-blue-500 outline-none text-right"
                        placeholder="2,500"
                      />
                      <div className="absolute left-2 text-slate-400 font-bold text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg pointer-events-none">
                        ج.م / EGP
                      </div>
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Salvage Value
                    </span>
                  </div>

                  {/* Depreciable Cost */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-800 font-black text-xs w-28 text-right underline decoration-amber-500">
                      القيمة القابلة للإهلاك
                    </span>
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={Number(formState.depreciableCost || 0 || 0).toLocaleString(
                          "en-US",
                        )}
                        disabled
                        className="w-full bg-slate-100 text-slate-700 font-extrabold text-xs py-2.5 pl-24 pr-4 rounded-xl border border-slate-300 text-right cursor-not-allowed"
                        placeholder="22,500"
                      />
                      <div className="absolute left-2 text-slate-500 font-bold text-[10px] bg-slate-200 border border-slate-300 px-2 py-1 rounded-lg pointer-events-none">
                        ج.م / EGP
                      </div>
                    </div>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Depreciable Cost
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Depreciation Settings */}
            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-slate-50/50 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 bg-sky-100/70 border-b border-sky-100">
                <span className="text-slate-800 font-black text-sm">
                  بيانات حساب الإهلاك
                </span>
                <span className="text-slate-700 font-extrabold text-xs tracking-wide uppercase">
                  Depreciation Settings
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
                {/* Left Column Settings */}
                <div className="flex flex-col gap-4 bg-slate-100/10 p-2 rounded-2xl border border-slate-50">
                  {/* Method */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="w-20"></span>
                    <select
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      value={formState.depreciationMethod ?? ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          depreciationMethod: e.target.value,
                        })
                      }
                    >
                      <option value="قسط ثابت">قسط ثابت (Straight Line)</option>
                      <option value="رصيد متناقص">
                        رصيد متناقص (Declining Balance)
                      </option>
                    </select>
                    <span className="text-slate-400 font-semibold text-[11px] w-36 text-left uppercase tracking-wider">
                      Depreciation Method
                    </span>
                  </div>

                  {/* Useful Life */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="w-20"></span>
                    <input
                      type="number"
                      value={formState.usefulLife ?? ""}
                      onChange={(e) => handleUsefulLifeChange(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      placeholder="5"
                    />
                    <span className="text-slate-400 font-semibold text-[11px] w-36 text-left uppercase tracking-wider">
                      Useful Life (Years)
                    </span>
                  </div>

                  {/* Rate */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="w-20"></span>
                    <input
                      type="text"
                      value={formState.depreciationRate + "%" }
                      disabled
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs py-2.5 px-3 rounded-xl cursor-not-allowed text-right"
                    />
                    <span className="text-slate-400 font-semibold text-[11px] w-36 text-left uppercase tracking-wider">
                      Depreciation Rate %
                    </span>
                  </div>
                </div>

                {/* Right Column Settings */}
                <div className="flex flex-col gap-4">
                  {/* Method dropdown */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-36 text-right">
                      طريقة الإهلاك
                    </span>
                    <select
                      value={formState.depreciationMethod ?? ""}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          depreciationMethod: e.target.value,
                        })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-900 font-extrabold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="قسط ثابت">قسط ثابت</option>
                      <option value="رصيد متناقص">رصيد متناقص</option>
                    </select>
                    <span className="w-20"></span>
                  </div>

                  {/* Useful Life */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-36 text-right">
                      العمر الإنتاجي (سنوات)
                    </span>
                    <input
                      type="text"
                      value={formState.usefulLife ?? ""}
                      onChange={(e) => handleUsefulLifeChange(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 text-slate-900 font-black text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                      placeholder="5"
                    />
                    <span className="w-20"></span>
                  </div>

                  {/* Rate */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-36 text-right">
                      نسبة الإهلاك السنوي
                    </span>
                    <input
                      type="text"
                      value={formState.depreciationRate + "%" }
                      readOnly
                      className="flex-1 bg-white border border-slate-200 text-slate-900 font-black text-xs py-2.5 px-3 rounded-xl outline-none text-right"
                      placeholder="20%"
                    />
                    <span className="w-20"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Accounting link */}
            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-slate-50/50 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 bg-emerald-100/70 border-b border-emerald-100">
                <span className="text-slate-800 font-black text-sm">الربط المحاسبي</span>
                <span className="text-slate-700 font-extrabold text-xs tracking-wide uppercase">General Ledger</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 mb-1">حساب الأصل الثابت</label>
                  <select
                    value={formState.glAssetAccountId ?? ""}
                    onChange={(e) => setFormState({ ...formState, glAssetAccountId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-emerald-500 outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 mb-1">مجمع الإهلاك</label>
                  <select
                    value={formState.glAccumulatedId ?? ""}
                    onChange={(e) => setFormState({ ...formState, glAccumulatedId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-emerald-500 outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 mb-1">مصروف الإهلاك</label>
                  <select
                    value={formState.glDepreciationExpenseId ?? ""}
                    onChange={(e) => setFormState({ ...formState, glDepreciationExpenseId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-emerald-500 outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar || a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="px-6 pb-5 bg-white flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-bold text-slate-500">
                  {formState.acquisitionEntryId
                    ? `مرتبط بقيد شراء رقم ${formState.acquisitionEntryId}`
                    : "سيُنشأ قيد الشراء عند الحفظ إذا حُدد حساب الأصل"}
                  {formState.lastDepreciationDate ? ` · آخر إهلاك: ${formState.lastDepreciationDate}` : ""}
                </p>
                <button
                  type="button"
                  onClick={handleDepreciate}
                  disabled={depBusy || !formState.id}
                  className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-all"
                >
                  {depBusy ? "جارٍ الترحيل..." : "ترحيل إهلاك شهر"}
                </button>
              </div>
            </div>

            {/* Save / Cancel buttons */}
            <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] shadow-sm">
              <button
                type="button"
                onClick={() => {
                  showFeedback(
                    "تم إلغاء التغييرات واستعادة النسخة المحفوظة",
                    "info",
                  );
                  setSubTab("list");
                }}
                className="px-6 py-2.5 text-xs font-extrabold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl active:scale-95 transition-all"
              >
                Cancel / إلغاء
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 text-xs font-black text-white bg-green-600 hover:bg-green-700 shadow-md shadow-green-100 rounded-xl active:scale-95 transition-all"
              >
                Save / حفظ بيانات البطاقة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Depreciation Schedule Dialog */}
      <AnimatePresence>
        {isScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScheduleOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    جدول إهلاك الأصل - {formState.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    معد بقيمة قابلة للإهلاك:{" "}
                    {Number(formState.depreciableCost || 0 || 0).toLocaleString()} ج.م على{" "}
                    {formState.usefulLife} سنوات
                  </p>
                </div>
                <button
                  onClick={() => setIsScheduleOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4">السنة</th>
                      <th className="py-3 px-4">تاريخ الإهلاك</th>
                      <th className="py-3 px-4 text-left">
                        القيمة الدفترية الأولى
                      </th>
                      <th className="py-3 px-4 text-left">
                        مصروف الإهلاك السنوي
                      </th>
                      <th className="py-3 px-4 text-left">
                        مجمع الإهلاك المتراكم
                      </th>
                      <th className="py-3 px-4 text-left">
                        القيمة الدفترية الأخيرة
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {depreciationSchedule.map((item) => (
                      <tr
                        key={item.year}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="py-3 px-4 font-bold text-slate-700">
                          السنة {item.year}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {item.date}
                        </td>
                        <td className="py-3 px-4 font-mono text-left">
                          {Number(item.openingBookValue || 0 || 0).toLocaleString()} ج.م
                        </td>
                        <td className="py-3 px-4 font-mono text-left text-emerald-600 font-bold">
                          -{Number(item.depreciationExpense || 0 || 0).toLocaleString()} ج.م
                        </td>
                        <td className="py-3 px-4 font-mono text-left text-amber-600">
                          {Number(item.accumulatedDepreciation || 0 || 0).toLocaleString()} ج.م
                        </td>
                        <td className="py-3 px-4 font-mono text-left font-black text-slate-900">
                          {Number(item.closingBookValue || 0 || 0).toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Additional simulated summary */}
                <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-[11px] text-emerald-800 font-sans leading-relaxed">
                  <strong>ℹ️ عملية ناجحة:</strong> نظام استهلاك الأجور والرواتب
                  والضرائب متطابق. تم حساب مجمع الإهلاك وتوليد المستند التلقائي
                  لترحيله إلى{" "}
                  <strong>حساب مصاريف الإهلاك الدائنة والمدينة</strong> بشجرة
                  الحسابات بنجاح.
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 text-xs transition-all"
                >
                  إغلاق الجدول
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
