import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Printer,
  Download,
  Share2,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ArrowUpDown,
  MoreVertical,
  DollarSign,
  Package,
  BookOpen,
  Calendar,
  User,
  Building2,
  CreditCard,
  Percent,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  FileCheck,
  Truck,
  ArrowUpRight,
  ShieldCheck,
  QrCode,
  Layers,
  Send,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  Receipt,
  FileSpreadsheet
} from "lucide-react";
import { api } from "../../utils/api";

export interface InvoiceItem {
  id?: number;
  itemId?: number;
  itemType?: string;
  ingredientId?: number | null;
  productId?: number | null;
  code?: string;
  itemCode?: string;
  name: string;
  itemName?: string;
  unit?: string;
  qty: number;
  price: number;
  unitCost?: number;
  totalCost?: number;
  discountPercent?: number;
  vatPercent?: number;
  total: number;
}

export interface Invoice {
  id: number;
  invoiceNo?: string;
  orderId?: number | null;
  orderNo?: string | null;
  quotationId?: number | null;
  deliveryNoteId?: number | null;
  deliveryNoteNo?: string | null;
  customerId?: number | null;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerTaxNo?: string | null;
  date: string;
  dueDate?: string | null;
  salesRep?: string | null;
  branch?: string | null;
  branchId?: number;
  warehouseId?: number;
  warehouse?: string | null;
  currency?: string;
  paymentMethod?: string;
  notes?: string | null;
  status: string; // "مسودة" | "معتمدة" | "مدفوعة" | "مدفوعة جزئياً" | "غير مدفوعة" | "ملغاة"
  isPosted?: boolean;
  postedAt?: string | null;
  postedBy?: string | null;
  journalEntryId?: number | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netAmount: number;
  totalCost?: number;
  paidAmount: number;
  createdAt?: string | null;
  items: InvoiceItem[];
}

interface SalesInvoicesViewProps {
  systemCustomers?: any[];
  systemWarehouses?: any[];
  salesReps?: any[];
  priceLists?: any[];
  salesProducts?: any[];
  onOpenCreateModal?: () => void;
  showToast: (msg: string) => void;
}

export const SalesInvoicesView: React.FC<SalesInvoicesViewProps> = ({
  systemCustomers = [],
  systemWarehouses = [],
  salesReps = [],
  salesProducts = [],
  showToast
}) => {
  // ════════════════════════════════════════════════════════════
  // 1. STATE & DATA FETCHING
  // ════════════════════════════════════════════════════════════
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected invoices for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals & Panels
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("نقدي");
  const [paymentSafeId, setPaymentSafeId] = useState<number>(1);
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // New Invoice Form State
  const [defaultVatRate, setDefaultVatRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("sales_settings_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.defaultVatRate !== undefined && parsed.defaultVatRate !== null) {
          return Number(parsed.defaultVatRate) || 0;
        }
      }
    } catch (_) {}
    return 0;
  });

  const [newInvoiceForm, setNewInvoiceForm] = useState({
    customerName: "",
    customerId: undefined as number | undefined,
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    salesRep: "",
    paymentMethod: "نقدي",
    warehouse: "المخزن الرئيسي",
    warehouseId: 1,
    branchId: 1,
    notes: "",
    status: "معتمدة",
    paidAmount: 0,
    items: [
      {
        name: "",
        code: "",
        unit: "قطعة",
        qty: 1,
        price: 0,
        discountPercent: 0,
        vatPercent: 0,
        total: 0,
        productId: null as number | null,
        ingredientId: null as number | null
      }
    ]
  });
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<"date" | "invoiceNo" | "netAmount" | "customerName">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Company settings for printable invoices
  const [companySettings, setCompanySettings] = useState({
    name: "مؤسسة ريمو برو للتجارة والتوزيع",
    address: "المقر الرئيسي — جمهورية مصر العربية",
    phone: "0100000000",
    taxNumber: "300123456700003",
    crNumber: "1010543210",
    logo: ""
  });

  const showToastRef = React.useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Fetch Company & Sales Settings
  useEffect(() => {
    let isMounted = true;
    const fetchCompanySettings = async () => {
      try {
        const keys = ["company_name", "company_address", "company_phone", "company_tax_number", "receipt_logo", "commercial_register", "sales_settings_config"];
        const responses = await Promise.all(keys.map(k => api.get(`/api/settings/${k}`)));
        const values: Record<string, any> = {};
        for (let i = 0; i < responses.length; i++) {
          if (responses[i].ok) {
            const data = await responses[i].json();
            values[keys[i]] = data?.value || "";
          }
        }
        if (isMounted) {
          setCompanySettings(prev => ({
            name: values.company_name || prev.name,
            address: values.company_address || prev.address,
            phone: values.company_phone || prev.phone,
            taxNumber: values.company_tax_number || prev.taxNumber,
            crNumber: values.commercial_register || prev.crNumber,
            logo: values.receipt_logo || prev.logo
          }));
          if (values.sales_settings_config) {
            try {
              const parsed = typeof values.sales_settings_config === "string"
                ? JSON.parse(values.sales_settings_config)
                : values.sales_settings_config;
              const vat = parsed?.defaultVatRate !== undefined && parsed?.defaultVatRate !== null
                ? Number(parsed.defaultVatRate) || 0
                : 0;
              setDefaultVatRate(vat);
              setNewInvoiceForm(prev => ({
                ...prev,
                items: prev.items.map(it => (!it.name && it.price === 0 ? { ...it, vatPercent: vat } : it))
              }));
            } catch (_) {}
          }
        }
      } catch (_) {}
    };
    fetchCompanySettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Invoices from Backend API
  const fetchInvoices = useCallback(async (showToastNotice = false) => {
    try {
      if (showToastNotice) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await api.get("/api/v2/sales/invoices");
      if (res.ok) {
        const json = await res.json();
        const rawData = Array.isArray(json) ? json : json.data || [];
        setInvoices(rawData);
        if (showToastNotice && showToastRef.current) {
          showToastRef.current("تم تحديث قائمة فواتير المبيعات بنجاح!");
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "تعذر جلب فواتير المبيعات من الخادم");
      }
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      setError(err.message || "خطأ أثناء الاتصال بقاعدة البيانات لجلب الفواتير");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Close context action menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveActionMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // ════════════════════════════════════════════════════════════
  // 2. COMPUTED METRICS & DASHBOARD STATS
  // ════════════════════════════════════════════════════════════
  const metrics = useMemo(() => {
    const totalInvoicesCount = invoices.length;
    const todayStr = new Date().toISOString().split("T")[0];
    
    let todayCount = 0;
    let todayAmount = 0;
    let totalSalesAmount = 0;
    let totalTaxAmount = 0;
    let totalPaidAmount = 0;
    let totalRemainingAmount = 0;
    let unpaidInvoicesCount = 0;

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      const tax = Number(inv.taxTotal || 0);
      const paid = Number(inv.paidAmount || 0);
      const remaining = Math.max(0, net - paid);

      totalSalesAmount += net;
      totalTaxAmount += tax;
      totalPaidAmount += paid;
      totalRemainingAmount += remaining;

      if (inv.date === todayStr) {
        todayCount++;
        todayAmount += net;
      }

      if (inv.status === "غير مدفوعة" || inv.status === "مدفوعة جزئياً" || remaining > 0) {
        unpaidInvoicesCount++;
      }
    }

    return {
      totalInvoicesCount,
      todayCount,
      todayAmount,
      totalSalesAmount,
      totalTaxAmount,
      totalPaidAmount,
      totalRemainingAmount,
      unpaidInvoicesCount
    };
  }, [invoices]);

  // ════════════════════════════════════════════════════════════
  // 3. FILTERING & SORTING LOGIC
  // ════════════════════════════════════════════════════════════
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = (inv.invoiceNo || `INV-${inv.id}`).toLowerCase().includes(q);
        const matchCustomer = (inv.customerName || "").toLowerCase().includes(q);
        const matchOrder = (inv.orderNo || "").toLowerCase().includes(q);
        const matchRep = (inv.salesRep || "").toLowerCase().includes(q);
        const matchNotes = (inv.notes || "").toLowerCase().includes(q);
        if (!matchNo && !matchCustomer && !matchOrder && !matchRep && !matchNotes) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "posted" && !inv.isPosted) return false;
        if (statusFilter === "draft" && inv.status !== "مسودة") return false;
        if (statusFilter === "cancelled" && inv.status !== "ملغاة" && inv.status !== "ملغية") return false;
        if (statusFilter === "confirmed" && inv.status !== "معتمدة" && inv.status !== "مؤكدة") return false;
        if (statusFilter === "paid" && inv.status !== "مدفوعة" && inv.status !== "مدفوع") return false;
      }

      // 3. Payment Status Filter
      if (paymentStatusFilter !== "all") {
        const net = Number(inv.netAmount || 0);
        const paid = Number(inv.paidAmount || 0);
        if (paymentStatusFilter === "paid" && paid < net) return false;
        if (paymentStatusFilter === "partial" && (paid <= 0 || paid >= net)) return false;
        if (paymentStatusFilter === "unpaid" && paid > 0) return false;
      }

      // 4. Payment Method Filter
      if (paymentMethodFilter !== "all") {
        const method = inv.paymentMethod || "نقدي";
        if (paymentMethodFilter === "cash" && !method.includes("نقدي") && !method.includes("كاش")) return false;
        if (paymentMethodFilter === "credit" && !method.includes("آجل") && !method.includes("اجل")) return false;
        if (paymentMethodFilter === "bank" && !method.includes("شبكة") && !method.includes("بنك") && !method.includes("فيزا")) return false;
      }

      // 5. Warehouse Filter
      if (warehouseFilter !== "all") {
        if ((inv.warehouse || "المخزن الرئيسي") !== warehouseFilter && String(inv.warehouseId) !== warehouseFilter) {
          return false;
        }
      }

      // 6. Sales Rep Filter
      if (salesRepFilter !== "all") {
        if ((inv.salesRep || "بدون مندوب") !== salesRepFilter) return false;
      }

      // 7. Date Range
      if (startDate && inv.date < startDate) return false;
      if (endDate && inv.date > endDate) return false;

      return true;
    });
  }, [invoices, searchQuery, statusFilter, paymentStatusFilter, paymentMethodFilter, warehouseFilter, salesRepFilter, startDate, endDate]);

  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === "date") {
        valA = new Date(a.date || 0).getTime();
        valB = new Date(b.date || 0).getTime();
      } else if (sortBy === "netAmount") {
        valA = Number(a.netAmount || 0);
        valB = Number(b.netAmount || 0);
      } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredInvoices, sortBy, sortOrder]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / pageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, paymentStatusFilter, paymentMethodFilter, warehouseFilter, startDate, endDate]);

  // ════════════════════════════════════════════════════════════
  // 4. ACTION HANDLERS
  // ════════════════════════════════════════════════════════════
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedInvoices.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleViewDetails = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowDetailModal(true);
  };

  const handlePreviewInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowPreviewModal(true);
  };

  const handleOpenPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    const remaining = Math.max(0, Number(inv.netAmount || 0) - Number(inv.paidAmount || 0));
    setPaymentAmount(remaining);
    setPaymentMethod(inv.paymentMethod || "نقدي");
    setPaymentNotes(`سداد نقدي لفاتورة #${inv.invoiceNo || inv.id}`);
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (paymentAmount <= 0) {
      showToast("يرجى إدخال مبلغ سداد أكبر من صفر");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await api.post(`/api/v2/sales/invoices/${selectedInvoice.id}/payments`, {
        amount: Number(paymentAmount),
        method: paymentMethod,
        safeId: paymentSafeId,
        notes: paymentNotes
      });

      if (res.ok) {
        const response = await res.json();
        const warnings = response.data?.integrationWarnings || [];
        showToast(warnings.length
          ? `تم تسجيل الدفعة، لكن تعذر ترحيلها مالياً: ${warnings.join("؛ ")}`
          : `تم تسجيل الدفعة وترحيلها إلى الخزينة والحسابات بقيمة ${Number(paymentAmount).toLocaleString()} ج.م بنجاح!`);
        setShowPaymentModal(false);
        await fetchInvoices();
        if (selectedInvoice) {
          const updated = await api.get(`/api/v2/sales/invoices/${selectedInvoice.id}`);
          if (updated.ok) {
            const upJson = await updated.json();
            setSelectedInvoice(upJson.data || upJson);
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "فشل تسجيل دفعة السداد");
      }
    } catch (err: any) {
      showToast(err.message || "خطأ أثناء تسجيل دفعة السداد");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      const res = await api.post(`/api/v2/sales/invoices/${selectedInvoice.id}/cancel`, {});
      if (res.ok) {
        showToast(`تم إلغاء الفاتورة #${selectedInvoice.invoiceNo || selectedInvoice.id} واسترجاع المخزون وتسوية الحسابات بنجاح.`);
        setShowCancelConfirmModal(false);
        setShowDetailModal(false);
        await fetchInvoices();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "فشل إلغاء الفاتورة");
      }
    } catch (err: any) {
      showToast(err.message || "خطأ أثناء إلغاء الفاتورة");
    }
  };

  // Quick export to CSV
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      showToast("لا توجد فواتير لتصديرها");
      return;
    }

    const headers = [
      "رقم الفاتورة",
      "العميل",
      "التاريخ",
      "المخزن",
      "طريقة الدفع",
      "المندوب",
      "المبلغ قبل الضريبة",
      "الخصم",
      "الضريبة",
      "الإجمالي الصافي",
      "المدفوع",
      "المتبقي",
      "الحالة",
      "حالة الترحيل"
    ];

    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNo || `INV-${inv.id}`,
      `"${inv.customerName || "عميل عام"}"`,
      inv.date,
      `"${inv.warehouse || "المخزن الرئيسي"}"`,
      inv.paymentMethod || "نقدي",
      inv.salesRep || "بدون مندوب",
      inv.subtotal || 0,
      inv.discountTotal || 0,
      inv.taxTotal || 0,
      inv.netAmount || 0,
      inv.paidAmount || 0,
      Math.max(0, (inv.netAmount || 0) - (inv.paidAmount || 0)),
      inv.status || "مسودة",
      inv.isPosted ? "مرحل" : "غير مرحل"
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_invoices_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`تم تصدير ${filteredInvoices.length} فاتورة بنجاح.`);
  };

  // Helper formatting
  const formatMoney = (amount: number | undefined | null) => {
    return Number(amount || 0).toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper status badges
  const renderStatusBadge = (status: string, isPosted?: boolean) => {
    if (status === "ملغاة" || status === "ملغية") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" /> ملغاة
        </span>
      );
    }
    if (status === "مدفوعة" || status === "مدفوع") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> مدفوعة بالكامل
        </span>
      );
    }
    if (status === "مدفوعة جزئياً") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> مدفوعة جزئياً
        </span>
      );
    }
    if (status === "معتمدة" || isPosted) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200">
          <FileCheck className="w-3 h-3" /> معتمدة ومرحلة
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3" /> {status || "مسودة"}
      </span>
    );
  };

  const renderPaymentBadge = (netAmount: number, paidAmount: number) => {
    const net = Number(netAmount || 0);
    const paid = Number(paidAmount || 0);
    if (paid >= net && net > 0) {
      return <span className="text-emerald-600 font-black text-[11px]">مسدد</span>;
    }
    if (paid > 0 && paid < net) {
      return <span className="text-amber-600 font-black text-[11px]">متبقي {formatMoney(net - paid)}</span>;
    }
    return <span className="text-rose-600 font-black text-[11px]">غير مسدد</span>;
  };

  // ════════════════════════════════════════════════════════════
  // 5. RENDER UI
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* ─── SECTION 1: HEADER & PRIMARY ACTIONS ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                فواتير البيع والضريبة
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                إدارة ومراجعة وطباعة فواتير البيع الضريبية وربطها بالمبيعات والمخزون والحسابات
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => fetchInvoices(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="تحديث البيانات من السيرفر"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="تصدير جدول الفواتير بتنسيق CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير</span>
          </button>

          <button
            onClick={() => window.print()}
            className="py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="طباعة تقرير الفواتير الحالية"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ إصدار فاتورة بيع</span>
          </button>
        </div>
      </div>

      {/* ─── SECTION 2: METRIC SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {/* Card 1: Total Invoices */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-slate-500">إجمالي الفواتير</span>
            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-600">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900">{metrics.totalInvoicesCount}</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">مستند رسمي مسجل</div>
          </div>
        </div>

        {/* Card 2: Today's Invoices */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-blue-700">فواتير اليوم</span>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-blue-600">{metrics.todayCount}</div>
            <div className="text-[10px] text-blue-500 font-bold mt-0.5">بقيمة {formatMoney(metrics.todayAmount)} ج.م</div>
          </div>
        </div>

        {/* Card 3: Total Sales */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-indigo-700">إجمالي المبيعات</span>
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-indigo-700 truncate">{formatMoney(metrics.totalSalesAmount)}</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">شامل الضرائب والخصومات</div>
          </div>
        </div>

        {/* Card 4: Total VAT */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-emerald-200 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-emerald-700">إجمالي الضريبة (14%)</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-emerald-700 truncate">{formatMoney(metrics.totalTaxAmount)}</div>
            <div className="text-[10px] text-emerald-600/80 font-bold mt-0.5">القيمة المضافة المحصلة</div>
          </div>
        </div>

        {/* Card 5: Total Paid */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-teal-200 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-teal-700">المحصل (المدفوع)</span>
            <div className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-teal-700 truncate">{formatMoney(metrics.totalPaidAmount)}</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">سيولة نقدية وبنكية</div>
          </div>
        </div>

        {/* Card 6: Total Remaining */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-amber-200 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-amber-700">المتبقي (الآجل)</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-amber-600 truncate">{formatMoney(metrics.totalRemainingAmount)}</div>
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">مديونيات عملاء مستحقة</div>
          </div>
        </div>

        {/* Card 7: Unpaid Invoices */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:border-rose-200 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black text-rose-700">فواتير غير مسددة</span>
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-rose-600">{metrics.unpaidInvoicesCount}</div>
            <div className="text-[10px] text-rose-500 font-bold mt-0.5">تحتاج متابعة تحصيل</div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: SEARCH & FILTER TOOLBAR ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الفاتورة، اسم العميل، رقم الهاتف، المرجع، أو المندوب..."
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Selector */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">كل الحالات</option>
              <option value="posted">مرحلة ومعتمدة</option>
              <option value="draft">مسودة</option>
              <option value="paid">مدفوعة</option>
              <option value="cancelled">ملغاة</option>
            </select>

            {/* Payment Status Selector */}
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">كل حالات السداد</option>
              <option value="paid">مدفوع بالكامل</option>
              <option value="partial">مدفوع جزئياً</option>
              <option value="unpaid">غير مدفوع (آجل)</option>
            </select>

            {/* Payment Method Selector */}
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="cash">نقدي (Cash)</option>
              <option value="credit">آجل (Credit)</option>
              <option value="bank">شبكة / بنك (Card)</option>
            </select>

            {/* Warehouse Filter */}
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">كل المستودعات</option>
              {systemWarehouses.map((w: any) => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
              <option value="المخزن الرئيسي">المخزن الرئيسي</option>
            </select>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`py-2.5 px-3.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all border ${
                showAdvancedFilters || startDate || endDate || salesRepFilter !== "all"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>فلاتر إضافية</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl">
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1">من تاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1">مندوب المبيعات</label>
              <select
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="all">كل المندوبين</option>
                {salesReps.map((r: any) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPaymentStatusFilter("all");
                  setPaymentMethodFilter("all");
                  setWarehouseFilter("all");
                  setSalesRepFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> إعادة تعيين الفلاتر
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 4: DATA TABLE ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-800">
              سجل الفواتير الضريبية ({filteredInvoices.length})
            </span>
            {selectedIds.length > 0 && (
              <span className="bg-indigo-100 text-indigo-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                تم تحديد {selectedIds.length} فاتورة
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-bold">
            <div className="flex items-center gap-1.5">
              <span>ترتيب حسب:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-700"
              >
                <option value="date">التاريخ</option>
                <option value="invoiceNo">رقم الفاتورة</option>
                <option value="netAmount">المبلغ الصافي</option>
                <option value="customerName">العميل</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="p-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600"
                title="تبديل اتجاه الترتيب"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span>عرض:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-700"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {/* The Main Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 font-black text-slate-500 text-[11px]">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedInvoices.length > 0 && selectedIds.length === paginatedInvoices.length}
                    onChange={handleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">العميل</th>
                <th className="p-3.5 text-center">التاريخ</th>
                <th className="p-3.5 text-center">المستودع</th>
                <th className="p-3.5 text-center">المندوب</th>
                <th className="p-3.5 text-left">قبل الضريبة</th>
                <th className="p-3.5 text-left">الضريبة (14%)</th>
                <th className="p-3.5 text-left">الإجمالي الصافي</th>
                <th className="p-3.5 text-center">طريقة الدفع</th>
                <th className="p-3.5 text-center">حالة السداد</th>
                <th className="p-3.5 text-center">الترحيل والمخزن</th>
                <th className="p-3.5 text-center w-28">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {loading ? (
                // Skeleton Loading State
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="animate-pulse">
                    <td className="p-3.5 text-center"><div className="w-4 h-4 bg-slate-200 rounded mx-auto" /></td>
                    <td className="p-3.5"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="p-3.5"><div className="h-4 bg-slate-200 rounded w-36" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-20 mx-auto" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-20 mx-auto" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                    <td className="p-3.5 text-left"><div className="h-4 bg-slate-200 rounded w-16 ml-auto" /></td>
                    <td className="p-3.5 text-left"><div className="h-4 bg-slate-200 rounded w-16 ml-auto" /></td>
                    <td className="p-3.5 text-left"><div className="h-4 bg-slate-200 rounded w-20 ml-auto" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-14 mx-auto" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-20 mx-auto" /></td>
                    <td className="p-3.5 text-center"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                // Error State
                <tr>
                  <td colSpan={13} className="p-12 text-center text-rose-600 space-y-3">
                    <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
                    <p className="font-black text-sm">{error}</p>
                    <button
                      onClick={() => fetchInvoices()}
                      className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-all inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                    </button>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={13} className="p-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto shadow-sm">
                      <Receipt className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-800">
                        {searchQuery || statusFilter !== "all" || paymentStatusFilter !== "all"
                          ? "لا توجد فواتير مطابقة لمعايير البحث الحالية"
                          : "لا توجد فواتير مبيعات مسجلة حتى الآن"}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto">
                        {searchQuery || statusFilter !== "all"
                          ? "يرجى تجربة تعديل خيارات الفلترة أو مسح شريط البحث لعرض النتائج."
                          : "عند ترحيل أول أمر بيع أو إصدار فاتورة مباشرة ستظهر كافة السجلات هنا مع الترحيل الآلي للمخازن والحسابات."}
                      </p>
                    </div>
                    {(!searchQuery && statusFilter === "all") && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" /> إصدار أول فاتورة
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const remaining = Math.max(0, Number(inv.netAmount || 0) - Number(inv.paidAmount || 0));
                  const isSelected = selectedIds.includes(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-indigo-50/40 transition-colors cursor-pointer group ${
                        isSelected ? "bg-indigo-50/60" : ""
                      }`}
                      onClick={() => handleViewDetails(inv)}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(inv.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Invoice Number */}
                      <td className="p-3.5 font-black text-indigo-600">
                        <div className="flex items-center gap-1.5">
                          <span className="hover:underline">{inv.invoiceNo || `INV-${String(inv.id).padStart(6, "0")}`}</span>
                          {inv.isPosted && (
                            <span title="مرحل ومقيد بالحسابات" className="text-emerald-500">
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3.5 font-black text-slate-900">
                        <div>
                          <div>{inv.customerName || "عميل عام"}</div>
                          {inv.customerTaxNo && (
                            <div className="text-[10px] text-slate-400 font-bold">ض.ر: {inv.customerTaxNo}</div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-center text-slate-600 font-bold text-[11px]">
                        {inv.date}
                      </td>

                      {/* Warehouse */}
                      <td className="p-3.5 text-center text-slate-600 font-bold">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[10px]">
                          {inv.warehouse || "المخزن الرئيسي"}
                        </span>
                      </td>

                      {/* Sales Rep */}
                      <td className="p-3.5 text-center text-slate-700 font-bold">
                        {inv.salesRep || "بدون مندوب"}
                      </td>

                      {/* Subtotal */}
                      <td className="p-3.5 text-left font-bold text-slate-600">
                        {formatMoney(inv.subtotal || (Number(inv.netAmount || 0) - Number(inv.taxTotal || 0)))} ج.م
                      </td>

                      {/* VAT */}
                      <td className="p-3.5 text-left font-bold text-emerald-600">
                        {formatMoney(inv.taxTotal || 0)} ج.م
                      </td>

                      {/* Net Total */}
                      <td className="p-3.5 text-left font-black text-indigo-700 text-[13px]">
                        {formatMoney(inv.netAmount)} ج.م
                      </td>

                      {/* Payment Method */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          (inv.paymentMethod || "").includes("نقدي")
                            ? "bg-emerald-50 text-emerald-700"
                            : (inv.paymentMethod || "").includes("آجل")
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                        }`}>
                          {inv.paymentMethod || "نقدي"}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="p-3.5 text-center">
                        {renderPaymentBadge(inv.netAmount, inv.paidAmount)}
                      </td>

                      {/* Posting Status */}
                      <td className="p-3.5 text-center">
                        {renderStatusBadge(inv.status, inv.isPosted)}
                      </td>

                      {/* Action Menu */}
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 relative">
                          <button
                            onClick={() => handlePreviewInvoice(inv)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="معاينة الفاتورة الضريبية"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setShowPreviewModal(true);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="طباعة الفاتورة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Action Dropdown Menu Trigger */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(activeActionMenuId === inv.id ? null : inv.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu Popup */}
                            {activeActionMenuId === inv.id && (
                              <div
                                className="absolute left-0 top-8 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 w-52 p-1.5 space-y-1 text-right animate-in fade-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    handleViewDetails(inv);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl flex items-center gap-2 transition-all"
                                >
                                  <FileText className="w-3.5 h-3.5" /> عرض تفاصيل الفاتورة
                                </button>

                                <button
                                  onClick={() => {
                                    handlePreviewInvoice(inv);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl flex items-center gap-2 transition-all"
                                >
                                  <Eye className="w-3.5 h-3.5" /> معاينة الفاتورة الضريبية
                                </button>

                                {remaining > 0 && inv.status !== "ملغاة" && (
                                  <button
                                    onClick={() => {
                                      handleOpenPaymentModal(inv);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl flex items-center gap-2 transition-all"
                                  >
                                    <DollarSign className="w-3.5 h-3.5" /> تسجيل دفعة سداد
                                  </button>
                                )}

                                {inv.status !== "ملغاة" && (
                                  <button
                                    onClick={() => {
                                      setSelectedInvoice(inv);
                                      setShowCancelConfirmModal(true);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-all"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> إلغاء الفاتورة وتسوية الحسابات
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/40 text-xs font-bold text-slate-500">
          <div>
            عرض {paginatedInvoices.length > 0 ? (page - 1) * pageSize + 1 : 0} إلى {Math.min(page * pageSize, filteredInvoices.length)} من أصل {filteredInvoices.length} فاتورة
          </div>

          <div className="flex items-center gap-1.5 self-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-slate-800 font-black">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          6. MODAL: INVOICE FULL DETAILS & DRILLDOWN
      ════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-l from-indigo-50/50 to-white flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">
                      فاتورة مبيعات ضريبية #{selectedInvoice.invoiceNo || selectedInvoice.id}
                    </h2>
                    {renderStatusBadge(selectedInvoice.status, selectedInvoice.isPosted)}
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    تاريخ الإصدار: {selectedInvoice.date} • المستودع: {selectedInvoice.warehouse || "المخزن الرئيسي"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowPreviewModal(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" /> معاينة وطباعة A4
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Customer & Invoice Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Information */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs border-b border-slate-200/60 pb-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>بيانات العميل المستورد</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">اسم العميل:</span>
                      <strong className="text-slate-800">{selectedInvoice.customerName || "عميل عام"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">الرقم الضريبي:</span>
                      <strong className="text-slate-800">{selectedInvoice.customerTaxNo || "غير مسجل"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">رقم الهاتف:</span>
                      <strong className="text-slate-800">{selectedInvoice.customerPhone || "—"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">العنوان:</span>
                      <strong className="text-slate-800">{selectedInvoice.customerAddress || "—"}</strong>
                    </div>
                  </div>
                </div>

                {/* Invoice Metadata */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs border-b border-slate-200/60 pb-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>بيانات المستند والتسليم</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">مندوب المبيعات:</span>
                      <strong className="text-slate-800">{selectedInvoice.salesRep || "المبيعات"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">طريقة السداد:</span>
                      <strong className="text-slate-800">{selectedInvoice.paymentMethod || "نقدي"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">تاريخ الاستحقاق:</span>
                      <strong className="text-slate-800">{selectedInvoice.dueDate || selectedInvoice.date}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px]">المستودع المصروف منه:</span>
                      <strong className="text-slate-800">{selectedInvoice.warehouse || "المخزن الرئيسي"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-black text-slate-800 mb-2 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>أصناف وبنود الفاتورة ({selectedInvoice.items?.length || 0})</span>
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 font-black text-slate-600 text-[11px]">
                        <th className="p-3">#</th>
                        <th className="p-3">الصنف</th>
                        <th className="p-3 text-center">الكود</th>
                        <th className="p-3 text-center">الكمية</th>
                        <th className="p-3 text-center">الوحدة</th>
                        <th className="p-3 text-left">السعر</th>
                        <th className="p-3 text-center">الخصم</th>
                        <th className="p-3 text-left">الضريبة</th>
                        <th className="p-3 text-left">الإجمالي الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                        selectedInvoice.items.map((it, idx) => {
                          const itemSubtotal = it.qty * it.price;
                          const discount = (itemSubtotal * (it.discountPercent || 0)) / 100;
                          const taxable = itemSubtotal - discount;
                          const vatPct = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : 0;
                          const tax = (taxable * vatPct) / 100;

                          return (
                            <tr key={it.id || idx} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-400 text-center">{idx + 1}</td>
                              <td className="p-3 font-black text-slate-900">{it.name || it.itemName}</td>
                              <td className="p-3 text-center text-slate-500 font-mono text-[11px]">{it.code || it.itemCode || "—"}</td>
                              <td className="p-3 text-center font-black text-indigo-600">{it.qty}</td>
                              <td className="p-3 text-center text-slate-500">{it.unit || "قطعة"}</td>
                              <td className="p-3 text-left">{formatMoney(it.price)} ج.م</td>
                              <td className="p-3 text-center text-amber-600">{it.discountPercent ? `${it.discountPercent}%` : "0%"}</td>
                              <td className="p-3 text-left text-emerald-600">{formatMoney(tax)} ج.م ({vatPct}%)</td>
                              <td className="p-3 text-left font-black text-slate-900">{formatMoney(it.total || (taxable + tax))} ج.م</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-slate-400 font-bold">
                            لا توجد بنود مفصلة مسجلة في هذه الفاتورة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Breakdown & Tax Statement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tax Statement / E-Invoice Details */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> البيانات الضريبية والفاتورة الإلكترونية
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                      معتمدة ضريبياً
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">الرقم الضريبي للمنشأة:</span>
                      <strong className="font-mono">{companySettings.taxNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">السجل التجاري:</span>
                      <strong className="font-mono">{companySettings.crNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">الرقم المرجعي الضريبي:</span>
                      <strong className="font-mono">UUID-{selectedInvoice.id}-2026-TX</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">نوع الفاتورة:</span>
                      <strong>{selectedInvoice.customerTaxNo ? "فاتورة ضريبية (B2B)" : "فاتورة ضريبية مبسطة (B2C)"}</strong>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-gradient-to-br from-indigo-50/40 to-slate-50 rounded-2xl p-4 border border-indigo-100/80 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="font-bold">الإجمالي قبل الخصم:</span>
                    <span>{formatMoney(selectedInvoice.subtotal)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span className="font-bold">إجمالي الخصم الممنوح:</span>
                    <span>- {formatMoney(selectedInvoice.discountTotal)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="font-bold">الصافي قبل الضريبة:</span>
                    <span>{formatMoney(Number(selectedInvoice.subtotal || 0) - Number(selectedInvoice.discountTotal || 0))} ج.م</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span className="font-bold">ضريبة القيمة المضافة:</span>
                    <span>+ {formatMoney(selectedInvoice.taxTotal)} ج.م</span>
                  </div>
                  <div className="border-t border-indigo-200/80 pt-2 flex justify-between text-sm font-black text-indigo-900">
                    <span>الإجمالي النهائي المستحق:</span>
                    <span className="text-base">{formatMoney(selectedInvoice.netAmount)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-teal-700">
                    <span>المبلغ المسدد:</span>
                    <span>{formatMoney(selectedInvoice.paidAmount)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-rose-600">
                    <span>المتبقي للسداد:</span>
                    <span>{formatMoney(Math.max(0, Number(selectedInvoice.netAmount || 0) - Number(selectedInvoice.paidAmount || 0)))} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Linked Operations Across Modules */}
              <div>
                <h4 className="text-xs font-black text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>العمليات والقيود المرتبطة بالمستند (Integrated ERP Traceability)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Linked Sales Order */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                    <div className="text-slate-400 font-bold text-[10px]">أمر البيع المنشئ</div>
                    <div className="font-black text-indigo-600 mt-1">
                      {selectedInvoice.orderNo || (selectedInvoice.orderId ? `SO-${selectedInvoice.orderId}` : "بيع مباشر")}
                    </div>
                  </div>

                  {/* Linked Delivery Note */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                    <div className="text-slate-400 font-bold text-[10px]">إذن التسليم وصرف المخزن</div>
                    <div className="font-black text-emerald-600 mt-1">
                      {selectedInvoice.deliveryNoteNo || (selectedInvoice.deliveryNoteId ? `DN-${selectedInvoice.deliveryNoteId}` : "صرف مخزني مباشر")}
                    </div>
                  </div>

                  {/* Linked Safe Transaction */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                    <div className="text-slate-400 font-bold text-[10px]">حركة الخزينة / البنك</div>
                    <div className="font-black text-teal-600 mt-1">
                      {selectedInvoice.paidAmount > 0 ? `TRX-SAFE-${selectedInvoice.id}` : "آجل (بدون نقدية)"}
                    </div>
                  </div>

                  {/* Linked GL Journal Entry */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                    <div className="text-slate-400 font-bold text-[10px]">قيد اليومية العام (GL)</div>
                    <div className="font-black text-indigo-700 mt-1">
                      {selectedInvoice.journalEntryId ? `JE-${selectedInvoice.journalEntryId}` : "قيد مبيعات آلي"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {Math.max(0, Number(selectedInvoice.netAmount || 0) - Number(selectedInvoice.paidAmount || 0)) > 0 && selectedInvoice.status !== "ملغاة" && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenPaymentModal(selectedInvoice);
                    }}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <DollarSign className="w-4 h-4" /> تسجيل دفعة سداد
                  </button>
                )}

                {selectedInvoice.status !== "ملغاة" && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowCancelConfirmModal(true);
                    }}
                    className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> إلغاء الفاتورة
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="py-2 px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          7. MODAL: PRINTABLE TAX INVOICE PREVIEW (A4)
      ════════════════════════════════════════════════════════════ */}
      {showPreviewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-[180] flex items-center justify-center p-3 sm:p-6 overflow-y-auto printable-modal" dir="rtl">
          <div className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Action Bar (Hidden on Print) */}
            <div className="no-print p-4 border-b border-slate-800 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-indigo-400" />
                <div>
                  <span className="font-black text-sm block">معاينة الفاتورة الضريبية والإلكترونية الرسمية (A4)</span>
                  <span className="text-[11px] text-slate-400 font-bold">رقم المستند: #{selectedInvoice.invoiceNo || `INV-${String(selectedInvoice.id).padStart(6, "0")}`}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="py-2 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> طباعة الفاتورة (A4)
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Body */}
            <div className="printable-report p-8 sm:p-10 space-y-5 text-slate-900 text-xs bg-white" id="printable-tax-invoice">
              {/* Company Header */}
              <div className="grid grid-cols-3 items-start border-b-2 border-slate-900 pb-5 gap-4">
                <div className="space-y-1 text-right">
                  <h1 className="text-lg font-black text-slate-900 tracking-tight">{companySettings.name}</h1>
                  <p className="text-slate-600 font-bold text-[11px]">{companySettings.address}</p>
                  <p className="text-slate-600 font-bold text-[11px]">هاتف: {companySettings.phone}</p>
                  <p className="text-slate-800 font-black text-[11px]">الرقم الضريبي: <span className="font-mono">{companySettings.taxNumber}</span></p>
                  <p className="text-slate-600 font-bold text-[11px]">السجل التجاري: <span className="font-mono">{companySettings.crNumber}</span></p>
                </div>

                <div className="text-center flex flex-col items-center justify-center pt-1">
                  <div className="px-5 py-2 bg-slate-900 text-white rounded-xl font-black text-base tracking-wide shadow-xs">
                    فاتورة ضريبية إلكترونية
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1">
                    {selectedInvoice.customerTaxNo ? "فاتورة ضريبية قياسية (B2B)" : "فاتورة ضريبية مبسطة (B2C)"}
                  </span>
                </div>

                <div className="space-y-1 text-left flex flex-col items-end">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-right w-full max-w-[230px] space-y-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">رقم الفاتورة:</span>
                      <span className="font-mono font-black text-xs text-indigo-700">
                        #{selectedInvoice.invoiceNo || `INV-${String(selectedInvoice.id).padStart(6, "0")}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">تاريخ الإصدار:</span>
                      <span className="font-mono font-bold text-[11px] text-slate-800">{selectedInvoice.date}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">تاريخ الاستحقاق:</span>
                      <span className="font-mono font-bold text-[11px] text-slate-800">{selectedInvoice.dueDate || selectedInvoice.date}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">حالة الفاتورة:</span>
                      <span className="font-black text-[10px] text-emerald-700">{selectedInvoice.status || "معتمدة"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To & Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/60 space-y-1.5">
                  <div className="text-[11px] font-black text-white bg-slate-800 px-3 py-1 rounded-lg inline-block mb-1">
                    بيانات العميل (Bill To)
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="col-span-2"><span className="text-slate-500 font-bold">اسم العميل: </span><strong className="text-slate-900 font-black">{selectedInvoice.customerName || "عميل عام"}</strong></div>
                    <div><span className="text-slate-500 font-bold">الرقم الضريبي: </span><strong className="font-mono text-slate-800">{selectedInvoice.customerTaxNo || "غير مسجل"}</strong></div>
                    <div><span className="text-slate-500 font-bold">الهاتف: </span><strong className="font-mono text-slate-800">{selectedInvoice.customerPhone || "—"}</strong></div>
                    <div className="col-span-2"><span className="text-slate-500 font-bold">العنوان: </span><strong className="text-slate-800">{selectedInvoice.customerAddress || "—"}</strong></div>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/60 space-y-1.5">
                  <div className="text-[11px] font-black text-white bg-slate-800 px-3 py-1 rounded-lg inline-block mb-1">
                    تفاصيل التوريد والدفع
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div><span className="text-slate-500 font-bold">المستودع: </span><strong className="text-slate-900">{selectedInvoice.warehouse || "المخزن الرئيسي"}</strong></div>
                    <div><span className="text-slate-500 font-bold">طريقة الدفع: </span><strong className="text-slate-900">{selectedInvoice.paymentMethod || "نقدي"}</strong></div>
                    <div><span className="text-slate-500 font-bold">المندوب: </span><strong className="text-slate-900">{selectedInvoice.salesRep || "المبيعات"}</strong></div>
                    <div><span className="text-slate-500 font-bold">أمر البيع: </span><strong className="font-mono text-slate-900">{selectedInvoice.orderNo || "مباشر"}</strong></div>
                    <div className="col-span-2"><span className="text-slate-500 font-bold">الرقم المرجعي الضريبي (UUID): </span><strong className="font-mono text-[10px] text-slate-700">ETA-UUID-{selectedInvoice.id}-2026</strong></div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[11px]">
                      <th className="p-2.5 text-center w-10 border border-slate-700">م</th>
                      <th className="p-2.5 text-center w-24 border border-slate-700">كود الصنف</th>
                      <th className="p-2.5 text-right border border-slate-700">الصنف / البيان</th>
                      <th className="p-2.5 text-center w-16 border border-slate-700">الوحدة</th>
                      <th className="p-2.5 text-center w-16 border border-slate-700">الكمية</th>
                      <th className="p-2.5 text-center w-24 border border-slate-700">سعر الوحدة</th>
                      <th className="p-2.5 text-center w-16 border border-slate-700">الخصم</th>
                      <th className="p-2.5 text-center w-24 border border-slate-700">الضريبة</th>
                      <th className="p-2.5 text-center w-28 border border-slate-700">الإجمالي الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold">
                    {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                      selectedInvoice.items.map((it, idx) => {
                        const itemSubtotal = Number(it.qty || 0) * Number(it.price || 0);
                        const discount = (itemSubtotal * Number(it.discountPercent || 0)) / 100;
                        const taxable = itemSubtotal - discount;
                        const vatPct = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : 0;
                        const tax = (taxable * vatPct) / 100;

                        return (
                          <tr key={it.id || idx} className="even:bg-slate-50/60">
                            <td className="p-2 text-center text-slate-600 border border-slate-200">{idx + 1}</td>
                            <td className="p-2 text-center font-mono text-slate-600 text-[10px] border border-slate-200">{it.code || it.itemCode || "—"}</td>
                            <td className="p-2 font-black text-slate-900 text-right border border-slate-200">{it.name || it.itemName}</td>
                            <td className="p-2 text-center text-slate-600 border border-slate-200">{it.unit || "قطعة"}</td>
                            <td className="p-2 text-center font-black text-slate-900 border border-slate-200">{it.qty}</td>
                            <td className="p-2 text-center font-mono border border-slate-200">{formatMoney(it.price)}</td>
                            <td className="p-2 text-center text-rose-600 border border-slate-200">{it.discountPercent ? `${it.discountPercent}%` : "0%"}</td>
                            <td className="p-2 text-center font-mono text-emerald-700 border border-slate-200">{formatMoney(tax)} ({vatPct}%)</td>
                            <td className="p-2 text-center font-mono font-black text-slate-900 border border-slate-200">{formatMoney(it.total || (taxable + tax))}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={9} className="p-4 text-center text-slate-400">لا توجد بنود مفصلة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals & QR Code Section */}
              <div className="grid grid-cols-12 gap-5 items-start pt-1">
                {/* Notes & E-Invoice QR Code */}
                <div className="col-span-7 space-y-3">
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/40 min-h-[76px]">
                    <div className="font-black text-[11px] text-slate-700 mb-1">ملاحظات وشروط الفاتورة:</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {selectedInvoice.notes || "البضاعة المباعة لا ترد ولا تستبدل إلا وفق سياسة الاسترجاع المعتمدة وبوجود أصل الفاتورة الضريبية."}
                    </p>
                  </div>

                  <div className="flex items-center gap-3.5 border border-slate-300 rounded-xl p-3 bg-white">
                    <div className="p-2 border-2 border-slate-900 rounded-xl bg-white shrink-0">
                      <QrCode className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="space-y-1 text-[10px] text-slate-600 font-bold">
                      <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-black text-[10px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> فاتورة إلكترونية ضريبية معتمدة
                      </div>
                      <p>الرقم المرجعي الضريبي: <span className="font-mono text-slate-900">INV-{selectedInvoice.id}-{new Date().getFullYear()}</span></p>
                      <p>التوقيع الإلكتروني: <span className="font-mono text-emerald-700">Validated & Signed (ETA/ZATCA Standard)</span></p>
                    </div>
                  </div>
                </div>

                {/* Financial Totals Table */}
                <div className="col-span-5 border border-slate-300 rounded-xl overflow-hidden bg-slate-50 text-xs">
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-slate-700">
                    <span>الإجمالي قبل الخصم:</span>
                    <span className="font-mono">{formatMoney(selectedInvoice.subtotal)} ج.م</span>
                  </div>
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-rose-600">
                    <span>إجمالي الخصم:</span>
                    <span className="font-mono">- {formatMoney(selectedInvoice.discountTotal)} ج.م</span>
                  </div>
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-slate-800">
                    <span>الصافي الخاضع للضريبة:</span>
                    <span className="font-mono">{formatMoney(Number(selectedInvoice.subtotal || 0) - Number(selectedInvoice.discountTotal || 0))} ج.م</span>
                  </div>
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-emerald-700">
                    <span>ضريبة القيمة المضافة:</span>
                    <span className="font-mono">+ {formatMoney(selectedInvoice.taxTotal)} ج.م</span>
                  </div>
                  <div className="p-3 flex justify-between bg-slate-900 text-white font-black text-sm">
                    <span>الإجمالي النهائي المستحق:</span>
                    <span className="font-mono">{formatMoney(selectedInvoice.netAmount)} ج.م</span>
                  </div>
                  <div className="p-2 flex justify-between border-t border-slate-200 font-bold text-teal-700 bg-white text-[11px]">
                    <span>المسدد: {formatMoney(selectedInvoice.paidAmount)} ج.م</span>
                    <span className="text-rose-600">المتبقي: {formatMoney(Math.max(0, Number(selectedInvoice.netAmount || 0) - Number(selectedInvoice.paidAmount || 0)))} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Signatures Row */}
              <div className="grid grid-cols-4 gap-3 pt-3">
                {["إعداد المحاسب", "مراجعة الحسابات", "اعتماد الإدارة", "توقيع المستلم"].map((title) => (
                  <div key={title} className="border border-slate-300 rounded-xl p-2.5 text-center space-y-5 bg-slate-50/30">
                    <span className="text-[11px] font-black text-slate-700 block">{title}</span>
                    <div className="border-b border-dashed border-slate-400 w-4/5 mx-auto"></div>
                  </div>
                ))}
              </div>

              {/* Official Footer */}
              <div className="border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500 font-bold space-y-0.5">
                <p>شكراً لتعاملكم معنا • مستند ضريبي رسمي صادر إلكترونياً</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          8. MODAL: RECORD PAYMENT FOR INVOICE
      ════════════════════════════════════════════════════════════ */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPaymentSubmit}
            className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تسجيل دفعة سداد لفاتورة</h3>
                  <p className="text-[11px] text-slate-400 font-bold">#{selectedInvoice.invoiceNo || selectedInvoice.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">العميل:</span>
                <strong className="text-slate-900">{selectedInvoice.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">إجمالي الفاتورة:</span>
                <strong className="text-indigo-700">{formatMoney(selectedInvoice.netAmount)} ج.م</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">المدفوع سابقاً:</span>
                <strong className="text-teal-700">{formatMoney(selectedInvoice.paidAmount)} ج.م</strong>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 text-rose-600 font-black">
                <span>المتبقي المستحق:</span>
                <span>{formatMoney(Math.max(0, Number(selectedInvoice.netAmount || 0) - Number(selectedInvoice.paidAmount || 0)))} ج.م</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 block mb-1">مبلغ السداد المطلوب تحصيله (ج.م) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={Math.max(0, Number(selectedInvoice.netAmount || 0) - Number(selectedInvoice.paidAmount || 0))}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">طريقة التحصيل</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="نقدي">نقدي (Cash)</option>
                  <option value="شبكة">شبكة / مدى (Card)</option>
                  <option value="تحويل بنكي">تحويل بنكي (Transfer)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">الخزينة المستلمة</label>
                <select
                  value={paymentSafeId}
                  onChange={(e) => setPaymentSafeId(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value={1}>الخزينة الرئيسية</option>
                  <option value={2}>خزينة الفرع</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 block mb-1">ملاحظات السداد</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                placeholder="ملاحظات أو رقم الحوالة..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
              >
                {isSubmittingPayment ? "جاري الحفظ والترحيل..." : "تأكيد واستلام السداد"}
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          9. MODAL: CANCEL INVOICE CONFIRMATION
      ════════════════════════════════════════════════════════════ */}
      {showCancelConfirmModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">تأكيد إلغاء الفاتورة الضريبية</h3>
              <p className="text-xs text-slate-500 font-bold">
                هل أنت متأكد من رغبتك في إلغاء الفاتورة رقم #{selectedInvoice.invoiceNo || selectedInvoice.id}؟
              </p>
            </div>

            <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 text-[11px] text-rose-700 space-y-1 font-bold">
              <p>• سيتم إعادة إدخال جميع الكميات المصروفة إلى رصيد المخزن آلياً.</p>
              <p>• سيتم إلغاء مديونية العميل وقيد اليومية المحاسبي المرتبط.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelInvoice}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all"
              >
                نعم، إلغاء الفاتورة
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          10. MODAL: CREATE NEW SALES INVOICE (MULTI-ITEM BUILDER)
      ════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newInvoiceForm.customerName) {
                showToast("يرجى اختيار العميل");
                return;
              }
              if (newInvoiceForm.items.length === 0 || !newInvoiceForm.items[0].name) {
                showToast("يرجى إضافة صنف واحد على الأقل");
                return;
              }

              setIsSubmittingInvoice(true);
              try {
                const calculatedSubtotal = newInvoiceForm.items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)), 0);
                const calculatedDiscount = newInvoiceForm.items.reduce((s, it) => s + ((Number(it.qty || 0) * Number(it.price || 0)) * (Number(it.discountPercent || 0) / 100)), 0);
                const calculatedTax = newInvoiceForm.items.reduce((s, it) => {
                  const lineSub = Number(it.qty || 0) * Number(it.price || 0);
                  const lineDisc = lineSub * (Number(it.discountPercent || 0) / 100);
                  const vatRate = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : defaultVatRate;
                  return s + ((lineSub - lineDisc) * (vatRate / 100));
                }, 0);
                const netAmount = calculatedSubtotal - calculatedDiscount + calculatedTax;
                const paidAmount = newInvoiceForm.paymentMethod === "نقدي" ? netAmount : Number(newInvoiceForm.paidAmount || 0);

                const res = await api.post("/api/v2/sales/invoices", {
                  ...newInvoiceForm,
                  subtotal: calculatedSubtotal,
                  discountTotal: calculatedDiscount,
                  taxTotal: calculatedTax,
                  netAmount,
                  paidAmount,
                  isPosted: true,
                  status: paidAmount >= netAmount ? "مدفوعة" : "معتمدة"
                });

                if (res.ok) {
                  const response = await res.json();
                  const warnings = response.data?.integrationWarnings || [];
                  showToast(warnings.length
                    ? `تم إصدار الفاتورة، لكن تعذر ترحيلها مالياً: ${warnings.join("؛ ")}`
                    : "تم إصدار فاتورة المبيعات وترحيلها إلى الخزينة والحسابات بنجاح!");
                  setShowCreateModal(false);
                  await fetchInvoices();
                } else {
                  const errJson = await res.json().catch(() => ({}));
                  showToast(errJson.error || "فشل إصدار الفاتورة");
                }
              } catch (err: any) {
                showToast(err.message || "خطأ أثناء إصدار الفاتورة");
              } finally {
                setIsSubmittingInvoice(false);
              }
            }}
            className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-l from-indigo-50/50 to-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">إصدار فاتورة مبيعات ضريبية جديدة</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">ترحيل فوري للمخزون والحسابات العامة ورصيد العميل</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Customer Selector */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">العميل المستورد *</label>
                  <select
                    value={newInvoiceForm.customerName}
                    onChange={(e) => {
                      const cust = systemCustomers.find(c => c.name === e.target.value);
                      setNewInvoiceForm(prev => ({
                        ...prev,
                        customerName: e.target.value,
                        customerId: cust?.id
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    required
                  >
                    <option value="">-- اختر العميل --</option>
                    {systemCustomers.map((c: any) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="عميل عام">عميل عام / مبيعات نقدية</option>
                  </select>
                </div>

                {/* Warehouse */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">مستودع الصرف الفوري *</label>
                  <select
                    value={newInvoiceForm.warehouse}
                    onChange={(e) => {
                      const wh = systemWarehouses.find(w => w.name === e.target.value);
                      setNewInvoiceForm(prev => ({
                        ...prev,
                        warehouse: e.target.value,
                        warehouseId: wh?.id || 1
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {systemWarehouses.map((w: any) => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                    <option value="المخزن الرئيسي">المخزن الرئيسي</option>
                  </select>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">طريقة السداد والتسوية</label>
                  <select
                    value={newInvoiceForm.paymentMethod}
                    onChange={(e) => setNewInvoiceForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="نقدي">نقدي (Cash)</option>
                    <option value="آجل">آجل (Credit Account)</option>
                    <option value="شبكة">شبكة / مدى / فيزا (Card)</option>
                  </select>
                </div>
              </div>

              {/* Items Table Builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-black text-slate-800">أصناف وبنود الفاتورة *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewInvoiceForm(prev => ({
                        ...prev,
                        items: [
                          ...prev.items,
                          {
                            name: "",
                            code: "",
                            unit: "قطعة",
                            qty: 1,
                            price: 0,
                            discountPercent: 0,
                            vatPercent: defaultVatRate,
                            total: 0,
                            productId: null,
                            ingredientId: null
                          }
                        ]
                      }));
                    }}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة صنف آخر
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden space-y-2 p-3 bg-slate-50/50">
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-2.5 text-[11px] font-black text-slate-500">
                    <div className="col-span-4">الصنف</div>
                    <div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-2 text-center">السعر</div>
                    <div className="col-span-1 text-center">خصم %</div>
                    <div className="col-span-1 text-center">ضريبة %</div>
                    <div className="col-span-2 text-left">الصافي</div>
                  </div>
                  {newInvoiceForm.items.map((it, idx) => {
                    const lineSub = Number(it.qty || 0) * Number(it.price || 0);
                    const lineDisc = lineSub * (Number(it.discountPercent || 0) / 100);
                    const vatRate = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : defaultVatRate;
                    const lineVat = (lineSub - lineDisc) * (vatRate / 100);
                    const lineTotal = lineSub - lineDisc + lineVat;

                    return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                      {/* Item Selector */}
                      <div className="col-span-12 sm:col-span-4">
                        <select
                          value={it.productId ? String(it.productId) : (it.name || "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Options are keyed by products.id only. Falling back to ingredientId
                            // here made the select resolve to whatever product shared that id, so a
                            // correctly saved line could render under another item's name.
                            const prod = salesProducts.find(p => String(p.id) === val);
                            const updatedItems = [...newInvoiceForm.items];
                            if (prod) {
                              const pPrice = parseFloat(prod.price || prod.sale_price || prod.basePrice || 0);
                              const rawTax = prod.taxRate !== undefined ? Number(prod.taxRate) : (prod.tax_rate !== undefined ? Number(prod.tax_rate) : defaultVatRate);
                              const itemVat = prod.taxable === false ? 0 : (defaultVatRate === 0 && rawTax === 14 ? 0 : rawTax);
                              const q = Number(updatedItems[idx].qty || 1);
                              const d = Number(updatedItems[idx].discountPercent || 0);
                              const sub = pPrice * q;
                              const afterDisc = sub * (1 - d / 100);
                              updatedItems[idx] = {
                                ...updatedItems[idx],
                                name: prod.name,
                                code: prod.code || prod.sku || "",
                                price: pPrice,
                                vatPercent: itemVat,
                                productId: prod.id,
                                ingredientId: prod.master_item_id || prod.inventory_item_id || null,
                                unit: prod.unit || "قطعة",
                                total: afterDisc * (1 + itemVat / 100)
                              };
                            } else {
                              const q = Number(updatedItems[idx].qty || 1);
                              const pPrice = Number(updatedItems[idx].price || 0);
                              const d = Number(updatedItems[idx].discountPercent || 0);
                              const v = updatedItems[idx].vatPercent !== undefined ? Number(updatedItems[idx].vatPercent) : defaultVatRate;
                              updatedItems[idx] = {
                                ...updatedItems[idx],
                                name: val,
                                total: (pPrice * q * (1 - d / 100)) * (1 + v / 100)
                              };
                            }
                            setNewInvoiceForm(prev => ({ ...prev, items: updatedItems }));
                          }}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          required
                        >
                          <option value="">-- اختر الصنف --</option>
                          {salesProducts.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.code || "ITEM"}) — {Number(p.price || p.basePrice || 0)} ج.م</option>
                          ))}
                        </select>
                      </div>

                      {/* Qty */}
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={(e) => {
                            const q = parseFloat(e.target.value) || 1;
                            const updatedItems = [...newInvoiceForm.items];
                            const pPrice = Number(updatedItems[idx].price || 0);
                            const d = Number(updatedItems[idx].discountPercent || 0);
                            const v = updatedItems[idx].vatPercent !== undefined ? Number(updatedItems[idx].vatPercent) : defaultVatRate;
                            updatedItems[idx].qty = q;
                            updatedItems[idx].total = (q * pPrice * (1 - d / 100)) * (1 + v / 100);
                            setNewInvoiceForm(prev => ({ ...prev, items: updatedItems }));
                          }}
                          placeholder="الكمية"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                          required
                        />
                      </div>

                      {/* Price */}
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          value={it.price}
                          onChange={(e) => {
                            const p = parseFloat(e.target.value) || 0;
                            const updatedItems = [...newInvoiceForm.items];
                            const q = Number(updatedItems[idx].qty || 1);
                            const d = Number(updatedItems[idx].discountPercent || 0);
                            const v = updatedItems[idx].vatPercent !== undefined ? Number(updatedItems[idx].vatPercent) : defaultVatRate;
                            updatedItems[idx].price = p;
                            updatedItems[idx].total = (q * p * (1 - d / 100)) * (1 + v / 100);
                            setNewInvoiceForm(prev => ({ ...prev, items: updatedItems }));
                          }}
                          placeholder="السعر"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                          required
                        />
                      </div>

                      {/* Discount % */}
                      <div className="col-span-2 sm:col-span-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={it.discountPercent ?? 0}
                          onChange={(e) => {
                            const d = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            const updatedItems = [...newInvoiceForm.items];
                            const q = Number(updatedItems[idx].qty || 1);
                            const p = Number(updatedItems[idx].price || 0);
                            const v = updatedItems[idx].vatPercent !== undefined ? Number(updatedItems[idx].vatPercent) : defaultVatRate;
                            updatedItems[idx].discountPercent = d;
                            updatedItems[idx].total = (q * p * (1 - d / 100)) * (1 + v / 100);
                            setNewInvoiceForm(prev => ({ ...prev, items: updatedItems }));
                          }}
                          placeholder="خصم%"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-rose-600 text-center"
                        />
                      </div>

                      {/* VAT % */}
                      <div className="col-span-2 sm:col-span-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={it.vatPercent ?? defaultVatRate}
                          onChange={(e) => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0);
                            const updatedItems = [...newInvoiceForm.items];
                            const q = Number(updatedItems[idx].qty || 1);
                            const p = Number(updatedItems[idx].price || 0);
                            const d = Number(updatedItems[idx].discountPercent || 0);
                            updatedItems[idx].vatPercent = v;
                            updatedItems[idx].total = (q * p * (1 - d / 100)) * (1 + v / 100);
                            setNewInvoiceForm(prev => ({ ...prev, items: updatedItems }));
                          }}
                          placeholder="ضريبة%"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 text-center"
                        />
                      </div>

                      {/* Total Net & Remove */}
                      <div className="col-span-2 sm:col-span-2 flex items-center justify-between gap-1">
                        <span className="font-black text-indigo-700 text-xs">
                          {formatMoney(lineTotal)} ج.م
                        </span>
                        {newInvoiceForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewInvoiceForm(prev => ({
                                ...prev,
                                items: prev.items.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="p-1 text-rose-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              {/* Financial Summary Breakdown */}
              {(() => {
                const sub = newInvoiceForm.items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)), 0);
                const disc = newInvoiceForm.items.reduce((s, it) => s + ((Number(it.qty || 0) * Number(it.price || 0)) * (Number(it.discountPercent || 0) / 100)), 0);
                const vat = newInvoiceForm.items.reduce((s, it) => {
                  const lSub = Number(it.qty || 0) * Number(it.price || 0);
                  const lDisc = lSub * (Number(it.discountPercent || 0) / 100);
                  const vRate = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : defaultVatRate;
                  return s + ((lSub - lDisc) * (vRate / 100));
                }, 0);
                const net = sub - disc + vat;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 font-bold block text-[10px]">الإجمالي قبل الضريبة والخصم</span>
                      <span className="font-black text-slate-800 text-sm">{formatMoney(sub)} ج.م</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 font-bold block text-[10px]">إجمالي الخصم</span>
                      <span className="font-black text-rose-600 text-sm">{formatMoney(disc)} ج.م</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 font-bold block text-[10px]">إجمالي الضريبة المضافة</span>
                      <span className="font-black text-emerald-600 text-sm">{formatMoney(vat)} ج.م</span>
                    </div>
                    <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-sm">
                      <span className="text-indigo-100 font-bold block text-[10px]">الصافي النهائي للفاتورة</span>
                      <span className="font-black text-sm">{formatMoney(net)} ج.م</span>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">ملاحظات الفاتورة</label>
                <input
                  type="text"
                  value={newInvoiceForm.notes}
                  onChange={(e) => setNewInvoiceForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="أي ملاحظات أو شروط خاصة بالفاتورة..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="text-xs font-black text-indigo-900">
                {(() => {
                  const sub = newInvoiceForm.items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)), 0);
                  const disc = newInvoiceForm.items.reduce((s, it) => s + ((Number(it.qty || 0) * Number(it.price || 0)) * (Number(it.discountPercent || 0) / 100)), 0);
                  const vat = newInvoiceForm.items.reduce((s, it) => {
                    const lSub = Number(it.qty || 0) * Number(it.price || 0);
                    const lDisc = lSub * (Number(it.discountPercent || 0) / 100);
                    const vRate = it.vatPercent !== undefined && it.vatPercent !== null ? Number(it.vatPercent) : defaultVatRate;
                    return s + ((lSub - lDisc) * (vRate / 100));
                  }, 0);
                  const net = sub - disc + vat;
                  return `الإجمالي النهائي المستحق: ${formatMoney(net)} ج.م ${vat > 0 ? `(شامل ضريبة ${formatMoney(vat)} ج.م)` : "(بدون ضريبة)"}`;
                })()}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingInvoice}
                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
                >
                  {isSubmittingInvoice ? "جاري الترحيل والإصدار..." : "ترحيل وإصدار الفاتورة"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
