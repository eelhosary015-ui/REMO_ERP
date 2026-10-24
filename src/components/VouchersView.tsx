import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Calendar,
  ChevronDown,
  RotateCcw,
  Printer,
  Download,
  MoreHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  X,
  Eye,
  Pencil,
  Trash2,
  FileText,
  Paperclip,
  Activity,
  Coins,
  Building2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { api } from "../utils/api";
import { InvoiceOCRModal } from "./InvoiceOCRModal";

// Define voucher interface
interface Voucher {
  id: number;
  code: string;
  type: "RECEIPT" | "PAYMENT"; // RECEIPT = سند قبض, PAYMENT = سند صرف
  date: string;
  partyName: string;
  accountName: string;
  accountCode: string;
  safeName: string;
  paymentMethod: "نقدي" | "فيزا" | "شيك" | "تحويل بنكي";
  amount: number;
  description: string;
  status: "معتمد" | "مسودة";
  attachments?: string[];
  ledgerEntries?: {
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
  }[];
  referenceNumber?: string;
  createdBy?: number;
  branchId?: number;
  createdAt?: string;
}

export const VouchersView: React.FC = () => {
  // ─── Data fetching state ───
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tab within bottom panel
  const [bottomActiveTab, setBottomActiveTab] = useState<
    "details" | "journal" | "attachments" | "logs"
  >("details");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<
    "الكل" | "RECEIPT" | "PAYMENT"
  >("الكل");
  const [selectedSafe, setSelectedSafe] = useState("الكل");
  const [selectedMethod, setSelectedMethod] = useState("الكل");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Form Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"RECEIPT" | "PAYMENT">("RECEIPT");
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  // Party Selection in VouchersView
  const [partyType, setPartyType] = useState<"supplier" | "customer" | "employee" | "other">("supplier");
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [partySearchQuery, setPartySearchQuery] = useState("");
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);

  // New Voucher Form Data
  const [fd, setFd] = useState({
    partyName: "",
    accountName: "",
    accountCode: "11301",
    safeName: "الخزينة الرئيسية",
    paymentMethod: "نقدي" as Voucher["paymentMethod"],
    amount: "",
    description: "",
    status: "معتمد" as Voucher["status"],
  });

  // Fetch Entities Metadata
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const [sRes, cRes, eRes] = await Promise.all([
          api.get("/api/suppliers").catch(() => null),
          api.get("/api/customers").catch(() => null),
          api.get("/api/hr/employees").catch(() => null)
        ]);
        if (sRes && sRes.ok) setSuppliersList(await sRes.json());
        if (cRes && cRes.ok) {
          const cData = await cRes.json();
          setCustomersList(Array.isArray(cData) ? cData : (cData.customers || []));
        }
        if (eRes && eRes.ok) setEmployeesList(await eRes.json());
      } catch (e) {}
    };
    fetchEntities();
  }, []);

  // ─── Fetch vouchers from API ───
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedType !== "الكل") params.set("type", selectedType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (searchQuery) params.set("search", searchQuery);

      const res = await api.get(`/api/vouchers?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setVouchers(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch vouchers");
    } finally {
      setLoading(false);
    }
  }, [selectedType, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Calculate dynamic statistics based on active values
  const stats = useMemo(() => {
    let totalReceipts = 0;
    let totalPayments = 0;

    vouchers.forEach((v) => {
      if (v.type === "RECEIPT") totalReceipts += v.amount;
      else totalPayments += v.amount;
    });

    const safesBalance = totalReceipts - totalPayments;
    const documentCount = vouchers.length;

    return {
      totalReceipts,
      totalPayments,
      safesBalance,
      documentCount,
    };
  }, [vouchers]);

  // Handle filtering (client-side for safe/method, server-side handles type/date/search)
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchSafe = selectedSafe === "الكل" || v.safeName === selectedSafe;
      const matchMethod =
        selectedMethod === "الكل" || v.paymentMethod === selectedMethod;
      return matchSafe && matchMethod;
    });
  }, [vouchers, selectedSafe, selectedMethod]);

  // Handle pagination dynamic slice
  const paginatedVouchers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVouchers.slice(startIndex, startIndex + pageSize);
  }, [filteredVouchers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredVouchers.length / pageSize) || 1;

  // Set selected item on tab change or list change if selected one filtered out
  useEffect(() => {
    if (filteredVouchers.length > 0) {
      if (
        !selectedVoucher ||
        !filteredVouchers.some((v) => v.id === selectedVoucher.id)
      ) {
        setSelectedVoucher(filteredVouchers[0]);
      }
    } else {
      setSelectedVoucher(null);
    }
  }, [filteredVouchers, selectedVoucher]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedType("الكل");
    setSelectedSafe("الكل");
    setSelectedMethod("الكل");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fd.partyName || !fd.amount) return;

    setSaving(true);
    try {
      const codePrefix = modalType === "RECEIPT" ? "RC" : "PV";
      const randomNum = String(vouchers.length + 20).padStart(5, "0");
      const fiscalYear = new Date().getFullYear();
      const generatedCode = `${codePrefix}-${fiscalYear}-${randomNum}`;

      const amtValue = Number(fd.amount);

      const generatedLedger =
        modalType === "RECEIPT"
          ? [
              {
                accountCode: "11101",
                accountName: "الصندوق",
                description: fd.description || "تم القيد",
                debit: amtValue,
                credit: 0,
              },
              {
                accountCode: fd.accountCode || "11301",
                accountName: fd.accountName || "حساب العميل",
                description: fd.description || "تم القيد",
                debit: 0,
                credit: amtValue,
              },
            ]
          : [
              {
                accountCode: fd.accountCode || "51101",
                accountName: fd.accountName || "مصروف عمومي",
                description: fd.description || "تم القيد",
                debit: amtValue,
                credit: 0,
              },
              {
                accountCode: "11101",
                accountName: "الصندوق",
                description: fd.description || "تم القيد",
                debit: 0,
                credit: amtValue,
              },
            ];

      const res = await api.post("/api/vouchers", {
        voucher_number: generatedCode,
        voucher_type: modalType,
        date: new Date().toISOString().split("T")[0],
        party_name: fd.partyName,
        account_name: fd.accountName || "حساب عام",
        account_code: fd.accountCode,
        safe_name: fd.safeName,
        payment_method: fd.paymentMethod,
        amount: amtValue,
        description:
          fd.description ||
          (modalType === "RECEIPT" ? "تحصيل أموال" : "صرف نقدية"),
        status: fd.status,
        ledger_entries: generatedLedger,
        attachments: [],
      });

      const data = await res.json();
      if (data.error) {
        alert("خطأ في إنشاء السند: " + data.error);
      } else {
        await fetchVouchers();
        setIsCreateModalOpen(false);

        // Reset Form fields
        setFd({
          partyName: "",
          accountName: "",
          accountCode: modalType === "RECEIPT" ? "11301" : "51101",
          safeName: "الخزينة الرئيسية",
          paymentMethod: "نقدي",
          amount: "",
          description: "",
          status: "معتمد",
        });
      }
    } catch (err: any) {
      alert("خطأ في إنشاء السند: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleExportToExcel = () => {
    const formattedData = filteredVouchers.map((v, i) => ({
      "#": i + 1,
      "رقم السند": v.code,
      "نوع السند": v.type === "RECEIPT" ? "سند قبض" : "سند صرف",
      التاريخ: v.date,
      "العميل / المورد": v.partyName,
      "الخزينة / البنك": v.safeName,
      "طريقة الدفع": v.paymentMethod,
      المبلغ: v.amount,
      البيان: v.description,
      الحالة: v.status,
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سندات_القبض_والصرف");
    XLSX.writeFile(
      wb,
      `سندات_القبض_والصرف_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const handleDelete = async (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا السند نهائياً؟")) {
      try {
        const res = await api.delete(`/api/vouchers/${id}`);
        const data = await res.json();
        if (data.error) {
          alert("خطأ في حذف السند: " + data.error);
          return;
        }
        await fetchVouchers();
      } catch (err: any) {
        alert("خطأ في حذف السند: " + (err.message || "Unknown error"));
      }
    }
  };

  return (
    <div className="space-y-6 text-right rtl pb-16" dir="rtl">
      {/* 1. Page Header matching the gorgeous template style */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200/50 pb-5">
        {/* Buttons Action: New Receipt (green), New Payment (red) */}
        <div className="flex items-center gap-3 order-2 md:order-1">
          <button
            onClick={() => {
              setModalType("RECEIPT");
              setFd((prev) => ({
                ...prev,
                accountCode: "11301",
                accountName: "العملاء",
              }));
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            سند قبض
          </button>

          <button
            onClick={() => {
              setModalType("PAYMENT");
              setFd((prev) => ({
                ...prev,
                accountCode: "51101",
                accountName: "مصاريف إدارية",
              }));
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            سند صرف
          </button>

          <button
            onClick={() => setIsOcrModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 hover:from-blue-800 hover:to-purple-800 text-white font-extrabold text-sm rounded-2xl shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-blue-300 animate-pulse" />
            مسح فاتورة 📸 OCR
          </button>
        </div>

        {/* Right side navigation details, export, print */}
        <div className="flex flex-wrap items-center gap-2.5 order-1 md:order-2">
          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm font-bold text-xs rounded-2xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            طباعة
          </button>

          {/* Export dropdown */}
          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-1.5 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm font-bold text-xs rounded-2xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            تصدير
          </button>

          {/* More options */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer">
              المزيد
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Premium Stat Metrics Widget Grid matching mockup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today's documents */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-violet-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400">
              عدد السندات اليوم
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-950">
                {stats.documentCount}
              </span>
              <span className="text-xs font-bold text-slate-500">سند</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <FileText className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* Metric 2: Safe general balance */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-blue-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400">
              رصيد الخزائن
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-blue-600">
                {Number(stats?.safesBalance || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-[10px] font-black text-slate-400">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Coins className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* Metric 3: Total Payment Vouchers */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-rose-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 font-sans">
              إجمالي سندات الصرف
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-rose-600">
                {Number(stats?.totalPayments || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-[10px] font-black text-slate-400">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        {/* Metric 4: Total Receipt Vouchers */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-emerald-600/50">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400">
              إجمالي سندات القبض
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-600">
                {Number(stats?.totalReceipts || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-[10px] font-black text-slate-400">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 3. Filtering & Search Row matched meticulously to screenshot */}
      <div className="bg-white p-4 border border-slate-200/85 rounded-[2rem] shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-center">
          {/* Grid 1: Search Field */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث برقم السند أو البيان..."
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 pr-11 pl-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all text-right"
            />
          </div>

          {/* Grid 2: Date From */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200/95 rounded-xl py-2.5 pr-10 pl-2.5 text-[11px] font-black text-slate-500 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            />
            <span className="absolute -top-2 right-3 px-1 text-[9px] font-black text-slate-400 bg-white">
              من تاريخ
            </span>
          </div>

          {/* Grid 3: Date To */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200/95 rounded-xl py-2.5 pr-10 pl-2.5 text-[11px] font-black text-slate-500 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            />
            <span className="absolute -top-2 right-3 px-1 text-[9px] font-black text-slate-400 bg-white">
              إلى تاريخ
            </span>
          </div>

          {/* Grid 4: Payment Method Filter */}
          <div>
            <select
              value={selectedMethod}
              onChange={(e) => {
                setSelectedMethod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 px-4 text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            >
              <option value="الكل">طريقة الدفع (الكل)</option>
              <option value="نقدي">نقدي</option>
              <option value="فيزا">فيزا</option>
              <option value="شيك">شيك</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
            </select>
          </div>

          {/* Grid 5: Safe/Bank Filter */}
          <div>
            <select
              value={selectedSafe}
              onChange={(e) => {
                setSelectedSafe(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 px-4 text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-500 transition-all"
            >
              <option value="الكل">الخزينة / البنك (الكل)</option>
              <option value="الخزينة الرئيسية">الخزينة الرئيسية</option>
              <option value="خزينة فرع الزقازيق">خزينة فرع الزقازيق</option>
              <option value="خزينة فرع المنيا القمح">
                خزينة فرع المنيا القمح
              </option>
              <option value="بنك مصر - حساب جاري">بنك مصر - حساب جاري</option>
              <option value="بنك الأهلي - حساب جاري">
                بنك الأهلي - حساب جاري
              </option>
            </select>
          </div>

          {/* Grid 6: Voucher Type Filter & Clear Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-3 px-4 text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-500"
            >
              <option value="الكل">نوع السند (الكل)</option>
              <option value="RECEIPT">سندات القبض</option>
              <option value="PAYMENT">سندات الصرف</option>
            </select>

            <button
              onClick={resetFilters}
              className="flex items-center justify-center p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer shadow-xs min-h-[44px]"
              title="إعادة ضبط الفلاتر"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Voucher main tabular lists section */}
      <div className="bg-white border border-slate-200/85 rounded-[2rem] shadow-xs overflow-hidden">

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-sm font-bold text-slate-500">جارٍ تحميل السندات...</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-6">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <span className="text-sm font-bold text-red-600 text-center max-w-md">
              {error}
            </span>
            <button
              onClick={fetchVouchers}
              className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer text-xs font-bold shadow-md transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200">
                    <th className="p-4 text-xs font-black text-slate-400 text-center w-12">
                      #
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      رقم السند
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      نوع السند
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      التاريخ
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      العميل / المورد
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      الخزينة / البنك
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      طريقة الدفع
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      المبلغ
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400">
                      البيان
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400 text-center">
                      الحالة
                    </th>
                    <th className="p-4 text-xs font-black text-slate-400 text-center w-28">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/85">
                  {paginatedVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center">
                        <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">
                          لا توجد سندات مالية مطابقة للفلاتر المحددة
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedVouchers.map((v, i) => {
                      const isSelected = selectedVoucher?.id === v.id;
                      const rowIndex = (currentPage - 1) * pageSize + i + 1;

                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedVoucher(v)}
                          className={`transition-colors cursor-pointer ${isSelected ? "bg-blue-50/60 hover:bg-blue-50 border-r-4 border-blue-600" : "hover:bg-slate-50/50"}`}
                        >
                          {/* Index */}
                          <td className="p-4 font-mono text-xs text-slate-400 text-center">
                            {rowIndex}
                          </td>

                          {/* Code */}
                          <td className="p-4 font-mono text-xs font-extrabold text-blue-600">
                            {v.code}
                          </td>

                          {/* Voucher Type Pill */}
                          <td className="p-4">
                            {v.type === "RECEIPT" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-black rounded-lg border border-emerald-100">
                                <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                                سند قبض
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-[11px] font-black rounded-lg border border-rose-100">
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                سند صرف
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="p-4 font-mono text-xs text-slate-600 font-bold">
                            {v.date}
                          </td>

                          {/* Party Name */}
                          <td className="p-4 text-xs font-extrabold text-slate-800">
                            {v.partyName}
                          </td>

                          {/* Safe Name */}
                          <td className="p-4 text-xs font-bold text-slate-600">
                            {v.safeName}
                          </td>

                          {/* Payment Method */}
                          <td className="p-4 text-xs text-slate-600 font-bold">
                            {v.paymentMethod}
                          </td>

                          {/* Amount formatted */}
                          <td className="p-4 font-mono font-black text-sm">
                            <span
                              className={
                                v.type === "RECEIPT"
                                  ? "text-emerald-600"
                                  : "text-slate-800"
                              }
                            >
                              {Number(v.amount || 0 || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </td>

                          {/* Description */}
                          <td
                            className="p-4 text-xs text-slate-500 max-w-xs truncate"
                            title={v.description}
                          >
                            {v.description}
                          </td>

                          {/* Status Badge */}
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${v.status === "معتمد" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${v.status === "معتمد" ? "bg-emerald-500" : "bg-amber-500"}`}
                              />
                              {v.status}
                            </span>
                          </td>

                          {/* Action Controls */}
                          <td
                            className="p-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedVoucher(v)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                                title="عرض تفصيلي"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(v.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                                title="حذف"
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

            {/* Dynamic Pagination matching mockup layout exactly */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 order-2 md:order-1">
                <span>عرض في الصفحة</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg p-1 text-xs text-slate-800 outline-none"
                >
                  <option value="8">8 سجلات</option>
                  <option value="20">20 سجل</option>
                  <option value="50">50 سجل</option>
                </select>
                <span>
                  عرض{" "}
                  <strong>
                    {filteredVouchers.length === 0
                      ? 0
                      : (currentPage - 1) * pageSize + 1}{" "}
                    إلى{" "}
                    {Math.min(
                      currentPage * pageSize,
                      filteredVouchers.length,
                    )}
                  </strong>{" "}
                  من أصل{" "}
                  <strong className="text-slate-900">
                    {filteredVouchers.length}
                  </strong>{" "}
                  سجل مالي
                </span>
              </div>

              <div className="flex items-center gap-1 order-1 md:order-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40"
                >
                  الأول
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40"
                >
                  السابق
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border ${currentPage === idx + 1 ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
                  >
                    {idx + 1}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40"
                >
                  التالي
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40"
                >
                  الأخير
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. Master-Detail Interactive View Area at the bottom of the page */}
      {selectedVoucher ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
          {/* Details Side Panel (Left Side - occupies 4 columns) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${selectedVoucher.status === "معتمد" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                >
                  {selectedVoucher.status}
                </span>
                <span className="text-[10px] font-black text-slate-400">
                  سند رقم: {selectedVoucher.code}
                </span>
              </div>

              {/* Specific details */}
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400">
                    الرقم المستندي
                  </h4>
                  <p className="text-base font-extrabold text-indigo-600 font-mono mt-0.5">
                    {selectedVoucher.code}
                  </p>
                </div>

                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400">
                    نوع السند
                  </h4>
                  <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                    {selectedVoucher.type === "RECEIPT" ? "سند قبض" : "سند صرف"}
                  </p>
                </div>

                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400">
                    تاريخ المعاملة المالية
                  </h4>
                  <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                    {selectedVoucher.date}
                  </p>
                </div>

                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400">
                    الخزينة المودع / المسحوب منها
                  </h4>
                  <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                    {selectedVoucher.safeName}
                  </p>
                </div>

                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400">
                    طريقة الدفع والقيد
                  </h4>
                  <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                    {selectedVoucher.paymentMethod}
                  </p>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400">
                    البيان والشرح العام
                  </h4>
                  <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {selectedVoucher.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <span className="text-[11px] font-black text-slate-400">
                القيمة الكلية:{" "}
                <strong className="text-slate-900 text-sm font-black font-mono">
                  {Number(selectedVoucher?.amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </strong>{" "}
                ج.م
              </span>
            </div>
          </div>

          {/* Dynamic Tab Panel (Right Side - occupies 8 columns) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[2rem] shadow-xs flex flex-col overflow-hidden">
            {/* Tabs Row matching exactly */}
            <div className="flex border-b border-slate-100 bg-slate-50/70 p-1">
              {[
                { id: "details", label: "تفاصيل السند", icon: FileText },
                { id: "journal", label: "القيود المحاسبية", icon: Activity },
                { id: "attachments", label: "المرفقات", icon: Paperclip },
                { id: "logs", label: "سجل الإجراءات", icon: Check },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBottomActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black transition-all cursor-pointer rounded-xl ${bottomActiveTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-700 bg-transparent"}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab contents with beautiful layout */}
            <div className="p-6 flex-1 min-h-[300px]">
              {/* TAB 1: تفاصيل السند (high contrast accounting ledger mapping) */}
              {bottomActiveTab === "details" && (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="p-3 font-black text-slate-400 text-center w-12">
                            #
                          </th>
                          <th className="p-3 font-black text-slate-400">
                            الحساب
                          </th>
                          <th className="p-3 font-black text-slate-400">
                            البيان
                          </th>
                          <th className="p-3 font-black text-slate-400 text-left">
                            مدين
                          </th>
                          <th className="p-3 font-black text-slate-400 text-left">
                            دائن
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {selectedVoucher.ledgerEntries &&
                        selectedVoucher.ledgerEntries.length > 0 ? (
                          (selectedVoucher?.ledgerEntries || []).map((entry, index) => (
                            <tr key={index} className="hover:bg-slate-50/50">
                              <td className="p-3 text-center text-slate-400 font-mono">
                                {index + 1}
                              </td>
                              <td className="p-3">
                                <span className="text-slate-950 font-extrabold block">
                                  {entry.accountName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                  {entry.accountCode}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500 font-semibold">
                                {entry.description}
                              </td>
                              <td className="p-3 text-left font-mono font-black text-emerald-600">
                                {Number(entry.debit) > 0
                                  ? Number(entry.debit || 0 || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })
                                  : "0.00"}
                              </td>
                              <td className="p-3 text-left font-mono font-black text-rose-600">
                                {Number(entry.credit) > 0
                                  ? Number(entry.credit || 0 || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })
                                  : "0.00"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 text-xs font-bold">
                              لا توجد قيود محاسبية مسجلة لهذا السند
                            </td>
                          </tr>
                        )}
                        {/* Totals row */}
                        <tr className="bg-slate-100 font-black text-slate-800">
                          <td colSpan={3} className="p-3 text-center">
                            الإجمالي
                          </td>
                          <td className="p-3 text-left font-mono font-black text-emerald-700">
                            {Number(selectedVoucher?.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-rose-700">
                            {Number(selectedVoucher?.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: القيود المحاسبية */}
              {bottomActiveTab === "journal" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">
                      قيد اليومية التلقائي المولد رقم:{" "}
                      <span className="text-indigo-600 font-mono">
                        JV-{selectedVoucher.code.split("-")[2]}
                      </span>
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-black">
                      مرحل تلقائياً للأستاذ
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 leading-relaxed">
                    تم إنشاء قيد مزدوج متوازن لتسوية حركات الصندوق والطرف
                    المستفيد في شجرة الحسابات العامة عند حفظ مستند{" "}
                    {selectedVoucher.type === "RECEIPT" ? "القبض" : "الصرف"}{" "}
                    بصفة نهائية.
                  </div>
                </div>
              )}

              {/* TAB 3: المرفقات */}
              {bottomActiveTab === "attachments" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-extrabold text-slate-800">
                      المستندات والصور المرفقة بالسند
                    </h5>
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black hover:bg-slate-200">
                      إرفاق ملف جديد +
                    </button>
                  </div>

                  {selectedVoucher.attachments &&
                  selectedVoucher.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(selectedVoucher?.attachments || []).map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                        >
                          <span className="text-xs text-slate-700 truncate max-w-[200px]">
                            {file}
                          </span>
                          <a
                            href="#"
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            تحميل
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-xs font-bold">
                        لا توجد ملفات مرفقة بهذا السند المالي حالياً
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: سجل الإجراءات */}
              {bottomActiveTab === "logs" && (
                <div className="relative border-r-2 border-slate-100 pr-5 space-y-5">
                  <div className="relative">
                    <span className="absolute -right-[23px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                    <h6 className="text-xs font-extrabold text-slate-900">
                      تم إنشاء السند وحفظه
                    </h6>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      {selectedVoucher.date}
                      {selectedVoucher.createdAt
                        ? ` ${new Date(selectedVoucher.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </p>
                  </div>
                  {selectedVoucher.status === "معتمد" && (
                    <div className="relative">
                      <span className="absolute -right-[23px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
                      <h6 className="text-xs font-extrabold text-slate-900">
                        تم ترحيل قيد اليومية آلياً
                      </h6>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        {selectedVoucher.date}
                        {selectedVoucher.createdAt
                          ? ` ${new Date(selectedVoucher.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-bold text-sm">
            حدد سطر سند مالي لعرض التفاصيل والأستاذ المحاسبي
          </p>
        </div>
      )}

      {/* 6. Form Create Modal Dialog Backdrop */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl p-6 text-right overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-950">
                  {modalType === "RECEIPT"
                    ? "إضافة سند قبض جديد"
                    : "إضافة سند صرف جديد"}
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form
                onSubmit={handleCreateVoucher}
                className="space-y-4 pt-4 text-xs font-bold text-slate-600"
              >
                {/* Safe & Payment Method Group */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1">
                      الخزينة المحاسبية / البنك
                    </label>
                    <select
                      value={fd.safeName}
                      onChange={(e) =>
                        setFd({ ...fd, safeName: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600 text-[11px]"
                    >
                      <option value="الخزينة الرئيسية">الخزينة الرئيسية</option>
                      <option value="خزينة فرع الزقازيق">
                        خزينة فرع الزقازيق
                      </option>
                      <option value="خزينة فرع المنيا القمح">
                        خزينة فرع المنيا القمح
                      </option>
                      <option value="بنك مصر - حساب جاري">
                        بنك مصر - حساب جاري
                      </option>
                      <option value="بنك الأهلي - حساب جاري">
                        بنك الأهلي - حساب جاري
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1">
                      طريقة الدفع
                    </label>
                    <select
                      value={fd.paymentMethod}
                      onChange={(e) =>
                        setFd({ ...fd, paymentMethod: e.target.value as any })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600 text-[11px]"
                    >
                      <option value="نقدي">نقدي</option>
                      <option value="فيزا">فيزا</option>
                      <option value="شيك">شيك</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                    </select>
                  </div>
                </div>

                {/* Party Type Tabs */}
                <div>
                  <label className="block text-[11px] mb-1.5 font-bold text-slate-700">
                    نوع الطرف المرتبط بالسند
                  </label>
                  <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setPartyType("supplier");
                        setSelectedSupplier(null);
                        setSelectedCustomer(null);
                        setSelectedEmployee(null);
                        setPartySearchQuery("");
                        setFd(prev => ({
                          ...prev,
                          partyName: "",
                          accountName: "الموردين / حسابات دائنة",
                          accountCode: "2110"
                        }));
                      }}
                      className={`py-1.5 px-1 text-center rounded-lg font-bold transition-all text-[10px] ${
                        partyType === "supplier" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      مورد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPartyType("customer");
                        setSelectedSupplier(null);
                        setSelectedCustomer(null);
                        setSelectedEmployee(null);
                        setPartySearchQuery("");
                        setFd(prev => ({
                          ...prev,
                          partyName: "",
                          accountName: "العملاء / حسابات مدينة",
                          accountCode: "1120"
                        }));
                      }}
                      className={`py-1.5 px-1 text-center rounded-lg font-bold transition-all text-[10px] ${
                        partyType === "customer" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      عميل
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPartyType("employee");
                        setSelectedSupplier(null);
                        setSelectedCustomer(null);
                        setSelectedEmployee(null);
                        setPartySearchQuery("");
                        setFd(prev => ({
                          ...prev,
                          partyName: "",
                          accountName: "سلف وعُهد الموظفين",
                          accountCode: "1130"
                        }));
                      }}
                      className={`py-1.5 px-1 text-center rounded-lg font-bold transition-all text-[10px] ${
                        partyType === "employee" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      موظف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPartyType("other");
                        setSelectedSupplier(null);
                        setSelectedCustomer(null);
                        setSelectedEmployee(null);
                        setPartySearchQuery("");
                        setFd(prev => ({
                          ...prev,
                          partyName: "",
                          accountName: modalType === "RECEIPT" ? "إيرادات متنوعة" : "مصروفات عمومية وإدارية",
                          accountCode: modalType === "RECEIPT" ? "4101" : "5101"
                        }));
                      }}
                      className={`py-1.5 px-1 text-center rounded-lg font-bold transition-all text-[10px] ${
                        partyType === "other" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      جهة أخرى
                    </button>
                  </div>
                </div>

                {/* Autocomplete Party Search */}
                {partyType === "supplier" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">اختر المورد *</label>
                    {!selectedSupplier ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={partySearchQuery}
                          onChange={(e) => {
                            setPartySearchQuery(e.target.value);
                            setIsPartyDropdownOpen(true);
                          }}
                          onFocus={() => setIsPartyDropdownOpen(true)}
                          placeholder="ابحث باسم المورد أو كوده أو هاتفه..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-600"
                        />
                        {isPartyDropdownOpen && (
                          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {suppliersList
                              .filter(s => {
                                if (!partySearchQuery.trim()) return true;
                                const q = partySearchQuery.toLowerCase();
                                return s.name?.toLowerCase().includes(q) || s.supplier_code?.toLowerCase().includes(q);
                              })
                              .map(sup => (
                                <button
                                  key={sup.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSupplier(sup);
                                    setFd(prev => ({
                                      ...prev,
                                      partyName: sup.name,
                                      description: `${modalType === "RECEIPT" ? "سند قبض من" : "سداد دفعة للمورد"} ${sup.name}`
                                    }));
                                    setIsPartyDropdownOpen(false);
                                    setPartySearchQuery("");
                                  }}
                                  className="w-full text-right p-2.5 hover:bg-indigo-50 flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">{sup.name}</div>
                                    {sup.supplier_code && <div className="text-[10px] text-slate-400 font-mono">{sup.supplier_code}</div>}
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    Number(sup.balance || 0) > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                  }`}>
                                    {Number(sup.balance || 0).toLocaleString()} ج.م
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{selectedSupplier.name}</div>
                          <div className="text-[10px] text-slate-600">
                            الرصيد المستحق: <span className="font-bold text-rose-600">{Number(selectedSupplier.balance || 0).toLocaleString()} ج.م</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupplier(null);
                            setFd(prev => ({ ...prev, partyName: "" }));
                          }}
                          className="text-[10px] text-rose-600 font-bold bg-white px-2 py-1 rounded-lg border border-rose-200"
                        >
                          تغيير
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {partyType === "customer" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">اختر العميل *</label>
                    {!selectedCustomer ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={partySearchQuery}
                          onChange={(e) => {
                            setPartySearchQuery(e.target.value);
                            setIsPartyDropdownOpen(true);
                          }}
                          onFocus={() => setIsPartyDropdownOpen(true)}
                          placeholder="ابحث باسم العميل أو هاتفه..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-600"
                        />
                        {isPartyDropdownOpen && (
                          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {customersList
                              .filter(c => !partySearchQuery.trim() || c.name?.toLowerCase().includes(partySearchQuery.toLowerCase()))
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(c);
                                    setFd(prev => ({
                                      ...prev,
                                      partyName: c.name,
                                      description: `تحصيل من العميل ${c.name}`
                                    }));
                                    setIsPartyDropdownOpen(false);
                                    setPartySearchQuery("");
                                  }}
                                  className="w-full text-right p-2.5 hover:bg-indigo-50"
                                >
                                  <div className="font-bold text-slate-900 text-xs">{c.name}</div>
                                  {c.phone && <div className="text-[10px] text-slate-400">{c.phone}</div>}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-xs">{selectedCustomer.name}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setFd(prev => ({ ...prev, partyName: "" }));
                          }}
                          className="text-[10px] text-rose-600 font-bold bg-white px-2 py-1 rounded-lg border border-rose-200"
                        >
                          تغيير
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {partyType === "employee" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">اختر الموظف *</label>
                    {!selectedEmployee ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={partySearchQuery}
                          onChange={(e) => {
                            setPartySearchQuery(e.target.value);
                            setIsPartyDropdownOpen(true);
                          }}
                          onFocus={() => setIsPartyDropdownOpen(true)}
                          placeholder="ابحث باسم الموظف..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-600"
                        />
                        {isPartyDropdownOpen && (
                          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {employeesList
                              .filter(e => !partySearchQuery.trim() || e.name?.toLowerCase().includes(partySearchQuery.toLowerCase()))
                              .map(emp => (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployee(emp);
                                    setFd(prev => ({
                                      ...prev,
                                      partyName: emp.name,
                                      description: `صرف سلفة / عهدة للموظف ${emp.name}`
                                    }));
                                    setIsPartyDropdownOpen(false);
                                    setPartySearchQuery("");
                                  }}
                                  className="w-full text-right p-2.5 hover:bg-indigo-50"
                                >
                                  <div className="font-bold text-slate-900 text-xs">{emp.name}</div>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-xs">{selectedEmployee.name}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(null);
                            setFd(prev => ({ ...prev, partyName: "" }));
                          }}
                          className="text-[10px] text-rose-600 font-bold bg-white px-2 py-1 rounded-lg border border-rose-200"
                        >
                          تغيير
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {partyType === "other" && (
                  <div>
                    <label className="block text-[11px] mb-1">
                      اسم الطرف / المستفيد
                    </label>
                    <input
                      type="text"
                      required
                      value={fd.partyName}
                      onChange={(e) =>
                        setFd({ ...fd, partyName: e.target.value })
                      }
                      placeholder="اكتب اسم المستفيد أو الجهة..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600"
                    />
                  </div>
                )}

                {/* Ledger Account Selection & Code */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] mb-1">
                      حساب التوجيه لشجرة الحسابات
                    </label>
                    <input
                      type="text"
                      required
                      value={fd.accountName}
                      onChange={(e) =>
                        setFd({ ...fd, accountName: e.target.value })
                      }
                      placeholder="مثال: العملاء / مصاريف إدارية"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1">كود الحساب</label>
                    <input
                      type="text"
                      required
                      value={fd.accountCode}
                      onChange={(e) =>
                        setFd({ ...fd, accountCode: e.target.value })
                      }
                      placeholder="مثال: 11301"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-mono"
                    />
                  </div>
                </div>

                {/* Amount and Status Group */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1">
                      المبلغ المالي (ج.م)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={fd.amount}
                      onChange={(e) => setFd({ ...fd, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1">
                      الحالة الرسمية
                    </label>
                    <select
                      value={fd.status}
                      onChange={(e) =>
                        setFd({ ...fd, status: e.target.value as any })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600"
                    >
                      <option value="معتمد">معتمد (يرحل آلياً)</option>
                      <option value="مسودة">مسودة (بدون ترحيل)</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] mb-1">
                    البيان والشرح التفصيلي
                  </label>
                  <textarea
                    rows={2}
                    value={fd.description}
                    onChange={(e) =>
                      setFd({ ...fd, description: e.target.value })
                    }
                    placeholder="اكتب شرحاً وافياً للحركة المالية لتسهيل المراجعة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-600 resize-none"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    حفظ السند
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <InvoiceOCRModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onJournalPosted={() => {
          fetchVouchers();
        }}
      />
    </div>
  );
};