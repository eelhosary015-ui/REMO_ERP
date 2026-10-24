import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  XCircle,
  FileText,
  DollarSign,
  Search,
  Eye,
  Phone,
  MapPin,
  Mail,
  Building,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Receipt,
  RotateCcw,
  UserCheck,
  BarChart3,
  FileSpreadsheet,
  Printer,
  FileDown,
} from "lucide-react";
import { api, authFetch } from "../utils/api";
import { SupplierAdvancedPanel } from "./SupplierAdvancedPanel";
import * as XLSX from "xlsx";
import { downloadDataAsWord } from "../utils/wordExport";
import { downloadDataAsPdf } from "../utils/pdfExport";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════
interface Supplier {
  id: number;
  supplier_code?: string | null;
  name: string;
  name_en?: string | null;
  currency?: string;
  contact_person?: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  address: string | null;
  commercial_register: string | null;
  tax_number: string | null;
  group_name: string | null;
  payment_terms: string;
  credit_limit: number;
  balance: number;
  opening_balance: number;
  rating: number;
  notes: string | null;
  status: string;
  created_at: string;
  total_purchases?: number;
  total_paid?: number;
  total_payments?: number;
  total_returns?: number;
  purchase_count?: number;
}

interface SupplierStatementSummary {
  opening_balance: number;
  opening_balance_at_start: number;
  total_debit: number;
  total_credit: number;
  period_net: number;
  closing_balance: number;
  current_balance?: number;
  calculated_current_balance?: number;
  reconciliation_difference?: number;
  reconciled?: boolean;
  from: string | null;
  to: string | null;
}

interface SupplierTransaction {
  id: number;
  supplier_id: number;
  type: string;
  amount: number;
  notes: string | null;
  timestamp: string;
  reference_id: number | null;
  effect?: number;
  running_balance?: number;
  reference_type?: string | null;
  payment_method?: string | null;
  currency?: string | null;
  due_date?: string | null;
  document_number?: string | null;
  status?: string | null;
}

interface DashboardStats {
  active_suppliers: number;
  total_suppliers: number;
  total_payable: number;
  purchases_30d: number;
  payments_30d: number;
  pending_orders: number;
  overdue_payable?: number;
}

interface SupplierProps {
  onBack: () => void;
  onViewReports?: () => void;
}

type TabType = "list" | "detail" | "statement";
type PaymentTerms = "cash" | "credit_30" | "credit_60" | "credit_90";

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit_30: "آجل 30 يوم",
  credit_60: "آجل 60 يوم",
  credit_90: "آجل 90 يوم",
};

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "متوقف",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-rose-100 text-rose-700",
};

const TX_TYPE_LABELS: Record<string, string> = {
  purchase: "شراء",
  payment: "سداد",
  return: "مرتجع",
  adjustment: "تسوية",
};

const TX_TYPE_COLORS: Record<string, string> = {
  purchase: "text-rose-600 bg-rose-50",
  payment: "text-emerald-600 bg-emerald-50",
  return: "text-blue-600 bg-blue-50",
  adjustment: "text-amber-600 bg-amber-50",
};

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export function Suppliers({ onBack, onViewReports }: SupplierProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("list");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [statementSummary, setStatementSummary] = useState<SupplierStatementSummary | null>(null);
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementType, setStatementType] = useState<string>("all");
  const [statementView, setStatementView] = useState<"detailed" | "summary">("detailed");
  const [statementPage, setStatementPage] = useState(1);
  const [statementPageSize, setStatementPageSize] = useState(25);
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierPageSize, setSupplierPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Form data
  const emptyForm = {
    name: "",
    phone: "",
    phone_2: "",
    email: "",
    address: "",
    commercial_register: "",
    tax_number: "",
    group_name: "",
    payment_terms: "cash" as PaymentTerms,
    credit_limit: "",
    opening_balance: "",
    notes: "",
    status: "active" as string,
  };

  const [formData, setFormData] = useState(emptyForm);
  const [formDocType, setFormDocType] = useState("بطاقة المورد");
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formDocIssueDate, setFormDocIssueDate] = useState("");
  const [formDocExpiryDate, setFormDocExpiryDate] = useState("");
  const [formDocNotes, setFormDocNotes] = useState("");
  const [formDocFile, setFormDocFile] = useState<File | null>(null);
  const [uploadingFormDoc, setUploadingFormDoc] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });

  // ═══════════════════════════════════════
  // Data Fetching
  // ═══════════════════════════════════════
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterGroup !== "all") params.set("group", filterGroup);
      const res = await api.get(`/api/suppliers?${params.toString()}`);
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterStatus, filterGroup]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get("/api/suppliers-dashboard");
      const data = await res.json();
      if (data.stats) setDashboard(data.stats);
    } catch (error) {
      console.error("Failed to fetch dashboard", error);
    }
  }, []);

  const fetchSupplierDetail = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/suppliers/${id}`);
      const data = await res.json();
      setSelectedSupplier(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch supplier detail", error);
      return null;
    }
  }, []);

  const fetchTransactions = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/suppliers/${id}/transactions?limit=100`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      setTransactions([]);
    }
  }, []);

  const fetchStatement = useCallback(async (id: number, from = statementFrom, to = statementTo) => {
    try {
      setStatementLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await api.get(`/api/suppliers/${id}/statement${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : (Array.isArray(data?.transactions) ? data.transactions : []));
      setStatementSummary(data?.summary || null);
    } catch (error) {
      console.error("Failed to fetch statement", error);
      setTransactions([]);
      setStatementSummary(null);
    } finally {
      setStatementLoading(false);
    }
  }, [statementFrom, statementTo]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ═══════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════
  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setFormData(emptyForm);
    resetFormDocument();
    setShowFormModal(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      phone_2: supplier.phone_2 || "",
      email: supplier.email || "",
      address: supplier.address || "",
      commercial_register: supplier.commercial_register || "",
      tax_number: supplier.tax_number || "",
      group_name: supplier.group_name || "",
      payment_terms: (supplier.payment_terms as PaymentTerms) || "cash",
      credit_limit: String(supplier.credit_limit || ""),
      opening_balance: String(supplier.opening_balance || ""),
      notes: supplier.notes || "",
      status: supplier.status || "active",
    });
    setSelectedSupplier(supplier);
    resetFormDocument();
    setShowFormModal(true);
  };

  const resetFormDocument = () => {
    setFormDocType("بطاقة المورد");
    setFormDocNumber("");
    setFormDocIssueDate("");
    setFormDocExpiryDate("");
    setFormDocNotes("");
    setFormDocFile(null);
  };

  const uploadFormDocument = async (supplierId:number) => {
    if (!formDocFile) return true;
    if (formDocFile.size > 15 * 1024 * 1024) {
      throw new Error("حجم المستند يجب ألا يتجاوز 15MB");
    }
    const fd = new FormData();
    fd.append("file", formDocFile);
    fd.append("document_type", formDocType);
    if (formDocNumber) fd.append("document_number", formDocNumber);
    if (formDocIssueDate) fd.append("issue_date", formDocIssueDate);
    if (formDocExpiryDate) fd.append("expiry_date", formDocExpiryDate);
    if (formDocNotes) fd.append("notes", formDocNotes);
    const r = await authFetch(`/api/suppliers/${supplierId}/documents`, { method: "POST", body: fd });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || "فشل رفع المستند");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingFormDoc) return;
    try {
      setUploadingFormDoc(true);
      const body = {
        ...formData,
        credit_limit: Number(formData.credit_limit) || 0,
        opening_balance: Number(formData.opening_balance) || 0,
      };
      const isEdit = !!selectedSupplier;
      const url = isEdit ? `/api/suppliers/${selectedSupplier!.id}` : "/api/suppliers";
      const res = isEdit ? await api.put(url, body) : await api.post(url, body);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "فشل حفظ بيانات المورد");
        return;
      }

      const supplierId = Number(data.id || selectedSupplier?.id);
      if (formDocFile && supplierId) {
        try {
          await uploadFormDocument(supplierId);
        } catch (docError:any) {
          alert(`تم حفظ المورد بنجاح، لكن تعذر حفظ المستند: ${docError.message || "خطأ غير معروف"}`);
          await fetchSupplierDetail(supplierId);
          setShowFormModal(false);
          setSelectedSupplier(null);
          resetFormDocument();
          fetchSuppliers();
          fetchDashboard();
          return;
        }
      }

      setShowFormModal(false);
      setSelectedSupplier(null);
      resetFormDocument();
      fetchSuppliers();
      fetchDashboard();
    } catch (error:any) {
      alert(error?.message || "فشل حفظ بيانات المورد");
    } finally {
      setUploadingFormDoc(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`هل أنت متأكد من حذف المورد "${supplier.name}"؟`)) return;
    try {
      const res = await api.delete(`/api/suppliers/${supplier.id}`);
      if (res.ok) {
        fetchSuppliers();
        fetchDashboard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "فشل حذف المورد");
      }
    } catch (error) {
      alert("فشل حذف المورد");
    }
  };

  const handleOpenPayment = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentData({ amount: "", payment_method: "cash", notes: "" });
    setShowPaymentModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    try {
      const res = await api.post(
        `/api/suppliers/${selectedSupplier.id}/payments`,
        {
          amount: Number(paymentData.amount),
          payment_method: paymentData.payment_method,
          notes: paymentData.notes,
        }
      );
      if (res.ok) {
        setShowPaymentModal(false);
        fetchSuppliers();
        fetchDashboard();
        if (activeTab === "detail" || activeTab === "statement") {
          fetchSupplierDetail(selectedSupplier.id);
          fetchTransactions(selectedSupplier.id);
        }
      } else {
        alert("فشل تسجيل الدفعة");
      }
    } catch (error) {
      alert("فشل تسجيل الدفعة");
    }
  };

  const handleViewDetail = async (supplier: Supplier) => {
    await fetchSupplierDetail(supplier.id);
    await fetchTransactions(supplier.id);
    setActiveTab("detail");
  };

  const handleViewStatement = async (supplier: Supplier) => {
    setStatementFrom("");
    setStatementTo("");
    setStatementType("all");
    setStatementView("detailed");
    setStatementPage(1);
    await fetchSupplierDetail(supplier.id);
    await fetchStatement(supplier.id, "", "");
    setActiveTab("statement");
  };

  const handleBackToList = () => {
    setActiveTab("list");
    setSelectedSupplier(null);
    setTransactions([]);
    setStatementSummary(null);
    setStatementFrom("");
    setStatementTo("");
    setStatementType("all");
    setStatementView("detailed");
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  // ═══════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════
  const supplierGroups = useMemo(() => {
    const groups = new Set<string>();
    suppliers.forEach((s) => {
      if (s.group_name) groups.add(s.group_name);
    });
    return Array.from(groups);
  }, [suppliers]);

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "", "ar");
          break;
        case "balance":
          cmp = (a.balance || 0) - (b.balance || 0);
          break;
        case "total_purchases":
          cmp = (a.total_purchases || 0) - (b.total_purchases || 0);
          break;
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          cmp = 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [suppliers, sortBy, sortDir]);

  const supplierPageCount = Math.max(1, Math.ceil(sortedSuppliers.length / supplierPageSize));
  const safeSupplierPage = Math.min(supplierPage, supplierPageCount);
  const paginatedSuppliers = useMemo(() => {
    const start = (safeSupplierPage - 1) * supplierPageSize;
    return sortedSuppliers.slice(start, start + supplierPageSize);
  }, [sortedSuppliers, safeSupplierPage, supplierPageSize]);

  useEffect(() => {
    setSupplierPage(1);
  }, [searchQuery, filterStatus, filterGroup, sortBy, sortDir, supplierPageSize]);

  // ═══════════════════════════════════════
  // Render Helpers
  // ═══════════════════════════════════════
  const toEnglishDigits = (value: string | number | null | undefined) =>
    String(value ?? "")
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

  const formatCurrency = (val: number | null | undefined) =>
    toEnglishDigits(((val || 0) as number).toLocaleString("ar-EG-u-nu-latn", {
      maximumFractionDigits: 2,
    }));

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "-";
    return toEnglishDigits(new Date(d).toLocaleDateString("ar-EG-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }));
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-orange-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-orange-500" />
    );
  };

  // ═══════════════════════════════════════
  // Enterprise ERP dashboard strip
  // ═══════════════════════════════════════
  const renderDashboardCards = () => {
    if (!dashboard) return null;
    const cards = [
      { label: "إجمالي الموردين", value: dashboard.total_suppliers || 0, sub: `${dashboard.active_suppliers || 0} نشط`, icon: <Truck className="w-4 h-4" />, tone: "blue" },
      { label: "إجمالي المستحقات", value: `${formatCurrency(dashboard.total_payable)} ج.م`, sub: "الرصيد الحالي", icon: <CreditCard className="w-4 h-4" />, tone: "red" },
      { label: "مشتريات 30 يوم", value: `${formatCurrency(dashboard.purchases_30d)} ج.م`, sub: "إجمالي المشتريات", icon: <TrendingUp className="w-4 h-4" />, tone: "blue" },
      { label: "مدفوعات 30 يوم", value: `${formatCurrency(dashboard.payments_30d)} ج.م`, sub: "إجمالي المدفوعات", icon: <TrendingDown className="w-4 h-4" />, tone: "green" },
      { label: "مستحقات متأخرة", value: `${formatCurrency(dashboard.overdue_payable)} ج.م`, sub: "متجاوزة تاريخ الاستحقاق", icon: <AlertCircle className="w-4 h-4" />, tone: "amber" },
      { label: "أوامر شراء معلقة", value: dashboard.pending_orders || 0, sub: "بانتظار الاستلام", icon: <Clock className="w-4 h-4" />, tone: "blue" },
    ];
    return (
      <div className="supplier-kpi-strip" aria-label="ملخص الموردين">
        {cards.map((card, i) => (
          <div key={i} className={`supplier-kpi supplier-kpi-${card.tone}`}>
            <div className="supplier-kpi-head"><span>{card.label}</span><span className="supplier-kpi-icon">{card.icon}</span></div>
            <strong>{card.value}</strong>
            <small>{card.sub}</small>
          </div>
        ))}
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Supplier List View
  // ═══════════════════════════════════════
  const renderListView = () => (
    <div className="supplier-management-shell">
      {renderDashboardCards()}

      <section className="supplier-data-panel">
        <div className="supplier-filter-bar">
          <div className="supplier-filter-title">
            <Filter className="w-4 h-4" />
            <div><strong>بحث وتصفية الموردين</strong><span>استخدم الفلاتر للوصول إلى السجل المطلوب</span></div>
          </div>

          <div className="supplier-field supplier-search-field">
            <label>بحث</label>
            <div className="supplier-input-wrap">
              <Search className="w-4 h-4" />
              <input type="text" placeholder="الاسم أو الهاتف أو الرقم الضريبي..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className="supplier-field">
            <label>الحالة</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">متوقف</option>
            </select>
          </div>

          {supplierGroups.length > 0 && (
            <div className="supplier-field">
              <label>المجموعة</label>
              <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
                <option value="all">كل المجموعات</option>
                {supplierGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          <button type="button" className="supplier-filter-reset" onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterGroup("all"); }} title="إعادة تعيين الفلاتر">
            <RotateCcw className="w-4 h-4" /> إعادة تعيين
          </button>
        </div>

        <div className="supplier-table-toolbar">
          <div><strong>قائمة الموردين</strong><span>{sortedSuppliers.length} سجل</span></div>
          <div className="supplier-table-tools"><span className="supplier-record-count">إجمالي النتائج: {sortedSuppliers.length}</span></div>
        </div>

        <div className="supplier-table-scroll">
          <table className="supplier-enterprise-table">
            <thead>
              <tr>
                <th className="supplier-index-col">#</th>
                <th onClick={() => handleSort("name")} className="sortable"><span>المورد <SortIcon field="name" /></span></th>
                <th>الهاتف</th>
                <th>المجموعة</th>
                <th>شروط الدفع</th>
                <th onClick={() => handleSort("balance")} className="sortable number-col"><span>الرصيد <SortIcon field="balance" /></span></th>
                <th onClick={() => handleSort("total_purchases")} className="sortable number-col"><span>إجمالي المشتريات <SortIcon field="total_purchases" /></span></th>
                <th>الحالة</th>
                <th className="actions-col">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="supplier-table-state"><div><span className="supplier-spinner" /> جاري تحميل بيانات الموردين...</div></td></tr>
              ) : sortedSuppliers.length === 0 ? (
                <tr><td colSpan={9} className="supplier-table-state"><div><Truck className="w-8 h-8" /><strong>{searchQuery || filterStatus !== "all" || filterGroup !== "all" ? "لا توجد نتائج مطابقة" : "لا يوجد موردين بعد"}</strong>{!searchQuery && filterStatus === "all" && filterGroup === "all" && <button onClick={handleOpenCreate}>إضافة أول مورد</button>}</div></td></tr>
              ) : paginatedSuppliers.map((supplier, index) => (
                <tr key={supplier.id}>
                  <td className="supplier-index-col">{(safeSupplierPage - 1) * supplierPageSize + index + 1}</td>
                  <td className="supplier-name-cell">
                    <div className="supplier-name-wrap">
                      <div className="supplier-avatar">{(supplier?.name || supplier?.name_en || "م").charAt(0)}</div>
                      <div><strong title={supplier.name || ""}>{supplier.name || "مورد"}</strong>{supplier.tax_number && <small>ض.ر: {supplier.tax_number}</small>}</div>
                    </div>
                  </td>
                  <td>{supplier.phone || "-"}</td>
                  <td>{supplier.group_name || "-"}</td>
                  <td>{PAYMENT_TERMS_LABELS[supplier.payment_terms] || supplier.payment_terms}</td>
                  <td className={`number-cell balance-cell ${(supplier.balance || 0) > 0 ? "negative" : (supplier.balance || 0) < 0 ? "positive" : "neutral"}`}>{formatCurrency(supplier.balance)} ج.م</td>
                  <td className="number-cell">{formatCurrency(supplier.total_purchases)} ج.م</td>
                  <td><span className={`supplier-status ${supplier.status === "active" ? "active" : "inactive"}`}>{STATUS_LABELS[supplier.status] || supplier.status}</span></td>
                  <td className="actions-cell">
                    <button onClick={() => handleViewDetail(supplier)} title="عرض التفاصيل"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleViewStatement(supplier)} title="كشف حساب"><FileSpreadsheet className="w-4 h-4" /></button>
                    <button onClick={() => handleOpenPayment(supplier)} title="تسديد دفعة"><DollarSign className="w-4 h-4" /></button>
                    <button onClick={() => handleOpenEdit(supplier)} title="تعديل"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(supplier)} title="حذف" className="danger"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="supplier-list-footer supplier-list-pagination">
          <div className="supplier-pagination-info">
            <span>عرض {sortedSuppliers.length ? ((safeSupplierPage - 1) * supplierPageSize + 1) : 0}–{Math.min(safeSupplierPage * supplierPageSize, sortedSuppliers.length)} من {sortedSuppliers.length} مورد</span>
          </div>
          <div className="supplier-pagination-controls">
            <label>
              <span>عدد الصفوف</span>
              <select value={supplierPageSize} onChange={(e) => { setSupplierPageSize(Number(e.target.value)); setSupplierPage(1); }}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <button type="button" disabled={safeSupplierPage <= 1} onClick={() => setSupplierPage(1)} title="الصفحة الأولى">الأولى</button>
            <button type="button" disabled={safeSupplierPage <= 1} onClick={() => setSupplierPage((p) => Math.max(1, p - 1))} title="السابق">السابق</button>
            <span className="supplier-page-number">صفحة {safeSupplierPage} من {supplierPageCount}</span>
            <button type="button" disabled={safeSupplierPage >= supplierPageCount} onClick={() => setSupplierPage((p) => Math.min(supplierPageCount, p + 1))} title="التالي">التالي</button>
            <button type="button" disabled={safeSupplierPage >= supplierPageCount} onClick={() => setSupplierPage(supplierPageCount)} title="الصفحة الأخيرة">الأخيرة</button>
          </div>
        </div>
      </section>
    </div>
  );

  // ═══════════════════════════════════════
  // Supplier Detail View
  // ═══════════════════════════════════════
  const renderDetailView = () => {
    if (!selectedSupplier) return null;
    const s = selectedSupplier;

    const statCards = [
      {
        label: "الرصيد المستحق",
        value: `${formatCurrency(s.balance)} ج.م`,
        color: (s.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600",
        icon: <CreditCard className="w-5 h-5" />,
        bg: (s.balance || 0) > 0 ? "bg-rose-50" : "bg-emerald-50",
      },
      {
        label: "إجمالي المشتريات",
        value: `${formatCurrency(s.total_purchases)} ج.م`,
        color: "text-blue-600",
        icon: <Package className="w-5 h-5" />,
        bg: "bg-blue-50",
      },
      {
        label: "إجمالي المدفوعات",
        value: `${formatCurrency(s.total_payments)} ج.م`,
        color: "text-emerald-600",
        icon: <TrendingDown className="w-5 h-5" />,
        bg: "bg-emerald-50",
      },
      {
        label: "عدد فواتير الشراء",
        value: s.purchase_count || 0,
        color: "text-purple-600",
        icon: <Receipt className="w-5 h-5" />,
        bg: "bg-purple-50",
      },
    ];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-lg">
                {(s?.name || s?.name_en || "م").charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">
                  {s?.name || "مورد"}
                </h1>
                <div className="text-[11px] text-slate-400 font-bold">كود المورد: {s.supplier_code || `SUP-${String(s.id).padStart(6,"0")}`}</div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {s.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {s.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${STATUS_COLORS[s.status]}`}
          >
            {STATUS_LABELS[s.status]}
          </span>
          <button
            onClick={() => handleOpenPayment(s)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-bold text-sm"
          >
            <DollarSign className="w-4 h-4" />
            تسديد دفعة
          </button>
          <button
            onClick={() => handleOpenEdit(s)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-bold text-sm"
          >
            <Pencil className="w-4 h-4" />
            تعديل
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">
                    {card.label}
                  </p>
                  <p className={`text-lg font-black ${card.color}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SupplierAdvancedPanel supplierId={s.id} />

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contact Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-500" />
              بيانات المورد
            </h3>
            <div className="space-y-3 text-sm">
              {s.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{s.phone}</span>
                </div>
              )}
              {s.phone_2 && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{s.phone_2}</span>
                </div>
              )}
              {s.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{s.email}</span>
                </div>
              )}
              {s.address && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{s.address}</span>
                </div>
              )}
              {s.commercial_register && (
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>س.ت: {s.commercial_register}</span>
                </div>
              )}
              {s.tax_number && (
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>ض.ر: {s.tax_number}</span>
                </div>
              )}
              {s.group_name && (
                <div className="flex items-center gap-2 text-slate-600">
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  <span>{s.group_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Credit Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" />
              بيانات ائتمانية
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">شروط الدفع</span>
                <span className="font-bold text-slate-800">
                  {PAYMENT_TERMS_LABELS[s.payment_terms] || s.payment_terms}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">حد الائتمان</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(s.credit_limit)} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">الرصيد الافتتاحي</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(s.opening_balance)} ج.م
                </span>
              </div>
              <div className="h-px bg-slate-100 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-slate-500">المستحق حالياً</span>
                <span
                  className={`font-black text-lg ${(s.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {formatCurrency(s.balance)} ج.م
                </span>
              </div>
              {/* Credit utilization bar */}
              {s.credit_limit > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>نسبة الاستخدام</span>
                    <span>
                      {Math.min(100, Math.round(((s.balance || 0) / s.credit_limit) * 100))}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${((s.balance || 0) / s.credit_limit) > 0.8 ? "bg-rose-500" : ((s.balance || 0) / s.credit_limit) > 0.5 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{
                        width: `${Math.min(100, ((s.balance || 0) / s.credit_limit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              معلومات إضافية
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">تاريخ التسجيل</span>
                <span className="font-bold text-slate-800">
                  {formatDate(s.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">إجمالي المرتجعات</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(s.total_returns)} ج.م
                </span>
              </div>
              {s.notes && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">ملاحظات</p>
                  <p className="text-sm text-slate-700">{s.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              آخر الحركات ({transactions.length})
            </h3>
            <button
              onClick={() => handleViewStatement(s)}
              className="text-sm text-orange-500 hover:text-orange-600 font-bold flex items-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" />
              كشف حساب كامل
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 px-4 font-bold text-slate-600">التاريخ</th>
                  <th className="p-3 px-4 font-bold text-slate-600">النوع</th>
                  <th className="p-3 px-4 font-bold text-slate-600">المبلغ</th>
                  <th className="p-3 px-4 font-bold text-slate-600">ملاحظات</th>
                  <th className="p-3 px-4 font-bold text-slate-600">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      لا توجد حركات
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 20).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3 px-4 text-slate-600">
                        {formatDate(tx.timestamp)}
                      </td>
                      <td className="p-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-bold ${TX_TYPE_COLORS[tx.type] || "bg-slate-100 text-slate-500"}`}
                        >
                          {TX_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className="p-3 px-4">
                        <span
                          className={`font-bold ${tx.type === "payment" || tx.type === "return" ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {tx.type === "payment" || tx.type === "return"
                            ? "-"
                            : ""}
                          {formatCurrency(tx.amount)} ج.م
                        </span>
                      </td>
                      <td className="p-3 px-4 text-slate-500 text-xs max-w-[200px] truncate">
                        {tx.notes || "-"}
                      </td>
                      <td className="p-3 px-4 font-bold text-slate-700">
                        {tx.running_balance !== undefined
                          ? `${formatCurrency(tx.running_balance)} ج.م`
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Statement View
  // ═══════════════════════════════════════
  const filteredStatementTransactions = useMemo(() => {
    if (statementType === "all") return transactions;
    return transactions.filter(tx => tx.type === statementType);
  }, [transactions, statementType]);

  const statementPageCount = Math.max(1, Math.ceil(filteredStatementTransactions.length / statementPageSize));
  const safeStatementPage = Math.min(statementPage, statementPageCount);
  const paginatedStatementTransactions = useMemo(() => {
    const start = (safeStatementPage - 1) * statementPageSize;
    return filteredStatementTransactions.slice(start, start + statementPageSize);
  }, [filteredStatementTransactions, safeStatementPage, statementPageSize]);

  const statementTotals = useMemo(() => {
    const opening = Number(statementSummary?.opening_balance_at_start ?? statementSummary?.opening_balance ?? 0);
    const debit = filteredStatementTransactions.reduce((a, t) => a + ((t.type === "purchase" || t.type === "adjustment") ? Number(t.amount || 0) : 0), 0);
    const credit = filteredStatementTransactions.reduce((a, t) => a + ((t.type === "payment" || t.type === "return") ? Number(t.amount || 0) : 0), 0);
    const closing = Number(statementSummary?.closing_balance ?? (opening + debit - credit));
    return { opening, debit, credit, net: Number((debit - credit).toFixed(2)), closing };
  }, [statementSummary, filteredStatementTransactions, statementType]);

  const statementStatus = statementTotals.closing > 0.009
    ? { label: "مستحق للمورد", cls: "text-rose-700 bg-rose-50 border-rose-200" }
    : statementTotals.closing < -0.009
      ? { label: "رصيد دائن لصالح الشركة", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" }
      : { label: "الحساب متزن", cls: "text-slate-700 bg-slate-50 border-slate-200" };

  const paymentMethodLabel = (method?: string | null) => ({ cash: "نقدي", bank: "بنك", transfer: "تحويل", card: "بطاقة", cheque: "شيك" } as Record<string,string>)[String(method || "").toLowerCase()] || method || "-";
  const referenceLabel = (tx: SupplierTransaction) => tx.document_number || (tx.reference_id ? `#${tx.reference_id}` : "-");

  const getStatementRows = () => {
    return [
      ["", statementFrom || "بداية الحساب", "رصيد سابق عند بداية الفترة", "", "", statementTotals.opening],
      ...filteredStatementTransactions.map((tx, idx) => {
        const isDebit = tx.type === "purchase" || tx.type === "adjustment";
        const isCredit = tx.type === "payment" || tx.type === "return";
        return [idx + 1, formatDate(tx.timestamp), `${TX_TYPE_LABELS[tx.type] || tx.type}${tx.notes ? ` - ${tx.notes}` : ""}`, isDebit ? Number(tx.amount || 0) : "", isCredit ? Number(tx.amount || 0) : "", Number(tx.running_balance || 0)];
      }),
    ];
  };
  const statementExportRows = () => getStatementRows().map(r => r.map(v => v === "" ? "" : v));

  const exportStatementExcel = () => {
    if (!selectedSupplier) return;
    const detailRows = filteredStatementTransactions.map((tx, idx) => {
      const isDebit = tx.type === "purchase" || tx.type === "adjustment";
      const isCredit = tx.type === "payment" || tx.type === "return";
      return [idx + 1, formatDate(tx.timestamp), TX_TYPE_LABELS[tx.type] || tx.type, referenceLabel(tx), tx.notes || "", paymentMethodLabel(tx.payment_method), isDebit ? Number(tx.amount || 0) : "", isCredit ? Number(tx.amount || 0) : "", Number(tx.running_balance || 0)];
    });
    const data = [
      ["كشف حساب المورد", selectedSupplier.name],
      ["كود المورد", selectedSupplier.supplier_code || selectedSupplier.id, "الفترة", `${statementFrom || "بداية الحساب"} - ${statementTo || "حتى الآن"}`],
      ["حالة الحساب", statementStatus.label, "تاريخ الإصدار", new Date().toLocaleString("ar-EG")],
      ["مطابقة الرصيد الحالي", statementSummary?.reconciled ? "مطابق" : `يوجد فرق ${formatCurrency(Math.abs(Number(statementSummary?.reconciliation_difference || 0)))}`],
      [],
      ["الرصيد السابق عند بداية الفترة", statementTotals.opening],
      ["إجمالي المدين في الفترة", statementTotals.debit],
      ["إجمالي الدائن في الفترة", statementTotals.credit],
      ["صافي الحركة", statementTotals.net],
      ["الرصيد الختامي", statementTotals.closing],
      [],
      ["#", "التاريخ", "النوع", "رقم المستند", "البيان", "طريقة السداد", "مدين", "دائن", "الرصيد"],
      ["", statementFrom || "بداية الحساب", "رصيد سابق", "-", "الرصيد السابق عند بداية الفترة", "-", "", "", statementTotals.opening],
      ...detailRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{wch:8},{wch:18},{wch:16},{wch:18},{wch:42},{wch:16},{wch:16},{wch:16},{wch:18}];
    ws["!freeze"] = { xSplit: 0, ySplit: 12 };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "كشف حساب المورد");
    XLSX.writeFile(wb, `كشف_حساب_مورد_${selectedSupplier.supplier_code || selectedSupplier.id}_${statementFrom || "all"}_${statementTo || "all"}.xlsx`);
  };

  const exportStatementWord = async () => {
    if (!selectedSupplier) return;
    const rows = [
      ["المورد", selectedSupplier.name, "الكود", selectedSupplier.supplier_code || selectedSupplier.id, "الفترة", `${statementFrom || "بداية الحساب"} - ${statementTo || "حتى الآن"}`, "الحالة", statementStatus.label],
      ["الرصيد السابق", formatCurrency(statementTotals.opening), "إجمالي المدين", formatCurrency(statementTotals.debit), "إجمالي الدائن", formatCurrency(statementTotals.credit), "الرصيد الختامي", formatCurrency(statementTotals.closing)],
      ...filteredStatementTransactions.map((tx,idx)=>[idx+1, formatDate(tx.timestamp), `${TX_TYPE_LABELS[tx.type]||tx.type}${tx.notes?` - ${tx.notes}`:""}`, tx.type==="purchase"||tx.type==="adjustment"?formatCurrency(tx.amount):"", tx.type==="payment"||tx.type==="return"?formatCurrency(tx.amount):"", formatCurrency(tx.running_balance), referenceLabel(tx), paymentMethodLabel(tx.payment_method)]),
    ];
    await downloadDataAsWord(["# / البيان","التاريخ / القيمة","الحركة","مدين","دائن","الرصيد","رقم المستند","طريقة السداد"], rows, `كشف_حساب_مورد_${selectedSupplier.supplier_code || selectedSupplier.id}`, `كشف حساب المورد - ${selectedSupplier.name}`);
  };

  const exportStatementPdf = async () => {
    if (!selectedSupplier) return;
    const rows = [
      ["المورد", selectedSupplier.name, "الكود", selectedSupplier.supplier_code || selectedSupplier.id, "الفترة", `${statementFrom || "بداية الحساب"} - ${statementTo || "حتى الآن"}`, "الحالة", statementStatus.label],
      ["الرصيد السابق", formatCurrency(statementTotals.opening), "إجمالي المدين", formatCurrency(statementTotals.debit), "إجمالي الدائن", formatCurrency(statementTotals.credit), "الرصيد الختامي", formatCurrency(statementTotals.closing)],
      ...filteredStatementTransactions.map((tx,idx)=>[idx+1, formatDate(tx.timestamp), `${TX_TYPE_LABELS[tx.type]||tx.type}${tx.notes?` - ${tx.notes}`:""}`, tx.type==="purchase"||tx.type==="adjustment"?formatCurrency(tx.amount):"", tx.type==="payment"||tx.type==="return"?formatCurrency(tx.amount):"", formatCurrency(tx.running_balance), referenceLabel(tx), paymentMethodLabel(tx.payment_method)]),
    ];
    await downloadDataAsPdf(["# / البيان","التاريخ / القيمة","الحركة","مدين","دائن","الرصيد","رقم المستند","طريقة السداد"], rows, `كشف_حساب_مورد_${selectedSupplier.supplier_code || selectedSupplier.id}`, `كشف حساب المورد - ${selectedSupplier.name}`);
  };

  const printStatement = () => {
    if (!selectedSupplier) return;
    const rows = filteredStatementTransactions;
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) { alert("يرجى السماح بفتح نافذة الطباعة من المتصفح"); return; }
    const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] as string));
    const body = rows.map((tx, idx) => { const debit=tx.type==="purchase"||tx.type==="adjustment"; const credit=tx.type==="payment"||tx.type==="return"; return `<tr><td>${idx+1}</td><td>${esc(formatDate(tx.timestamp))}</td><td>${esc(TX_TYPE_LABELS[tx.type]||tx.type)}</td><td>${esc(toEnglishDigits(referenceLabel(tx)))}</td><td>${esc(toEnglishDigits(tx.notes||"-"))}</td><td>${esc(paymentMethodLabel(tx.payment_method))}</td><td>${debit?esc(formatCurrency(tx.amount)):""}</td><td>${credit?esc(formatCurrency(tx.amount)):""}</td><td>${esc(formatCurrency(tx.running_balance))}</td></tr>`; }).join("");
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب المورد - ${esc(selectedSupplier.name)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,Tahoma,sans-serif;color:#111827}h1{text-align:center;margin:0 0 8px}h2{text-align:center;font-size:16px;margin:0 0 18px;color:#475569}.meta{display:flex;justify-content:space-between;border:1px solid #cbd5e1;padding:10px;margin-bottom:14px}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}.card{border:1px solid #cbd5e1;padding:8px;text-align:center}.label{font-size:10px;color:#64748b}.value{font-size:15px;font-weight:700;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right;font-size:10px}th{background:#f1f5f9;font-weight:700}tfoot td{font-weight:700;background:#f8fafc}</style></head><body><h1>كشف حساب المورد</h1><h2>${esc(selectedSupplier.name)} ${esc(selectedSupplier.supplier_code||"")}</h2><div class="meta"><span>من: ${esc(statementFrom||"بداية الحساب")}</span><span>إلى: ${esc(statementTo||"حتى الآن")}</span><span>الحالة: ${esc(statementStatus.label)}</span><span>الإصدار: ${esc(new Date().toLocaleDateString("ar-EG-u-nu-latn"))}</span></div><div class="summary"><div class="card"><div class="label">الرصيد السابق</div><div class="value">${esc(formatCurrency(statementTotals.opening))}</div></div><div class="card"><div class="label">إجمالي المدين</div><div class="value">${esc(formatCurrency(statementTotals.debit))}</div></div><div class="card"><div class="label">إجمالي الدائن</div><div class="value">${esc(formatCurrency(statementTotals.credit))}</div></div><div class="card"><div class="label">صافي الحركة</div><div class="value">${esc(formatCurrency(statementTotals.net))}</div></div><div class="card"><div class="label">الرصيد الختامي</div><div class="value">${esc(formatCurrency(statementTotals.closing))}</div></div></div><table><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>رقم المستند</th><th>البيان</th><th>طريقة السداد</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody><tr><td>-</td><td>${esc(statementFrom||"بداية الحساب")}</td><td>رصيد سابق</td><td>-</td><td>الرصيد السابق عند بداية الفترة</td><td>-</td><td></td><td></td><td>${esc(formatCurrency(statementTotals.opening))}</td></tr>${body}</tbody><tfoot><tr><td colspan="6">إجماليات الفترة / الرصيد الختامي</td><td>${esc(formatCurrency(statementTotals.debit))}</td><td>${esc(formatCurrency(statementTotals.credit))}</td><td>${esc(formatCurrency(statementTotals.closing))}</td></tr></tfoot></table><div style="margin-top:30px;display:flex;justify-content:space-between"><div>إعداد التقرير: __________________</div><div>اعتماد المسؤول: __________________</div></div><script>window.onload=()=>{window.focus();window.print();}</script></body></html>`);
    win.document.close();
  };

  const renderStatementView = () => {
    if (!selectedSupplier) return null;
    const s = selectedSupplier;
    const openingAtStart = statementTotals.opening;
    const closing = statementTotals.closing;
    const totalDebit = statementTotals.debit;
    const totalCredit = statementTotals.credit;
    const reconciliationDifference = Math.abs(Number(statementSummary?.reconciliation_difference || 0));

    return (
      <div className="erp-statement-page" dir="rtl">
        <div className="erp-statement-header">
          <div className="erp-statement-title-group">
            <button onClick={handleBackToList} className="erp-icon-button" title="رجوع" aria-label="رجوع">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="erp-breadcrumb">الموردين <span>/</span> كشف حساب المورد</div>
              <h1>كشف حساب المورد</h1>
              <p>{s.name}{s.supplier_code ? ` • كود المورد: ${s.supplier_code}` : ""}</p>
            </div>
          </div>
          <div className="erp-statement-header-balance">
            <span>الرصيد الختامي</span>
            <strong className={closing > 0.009 ? "is-debit" : closing < -0.009 ? "is-credit" : "is-zero"}>
              {formatCurrency(closing)} ج.م
            </strong>
          </div>
        </div>

        <section className="erp-statement-filter-bar" aria-label="فلاتر كشف الحساب">
          <div className="erp-filter-heading">
            <Filter className="w-4 h-4" />
            <div>
              <strong>فترة كشف الحساب</strong>
              <span>حدد الفترة ونوع الحركة ثم اضغط تنفيذ.</span>
            </div>
          </div>

          <label className="erp-field">
            <span>من تاريخ</span>
            <input type="date" value={statementFrom} onChange={e => { setStatementFrom(e.target.value); setStatementPage(1); }} />
          </label>
          <label className="erp-field">
            <span>إلى تاريخ</span>
            <input type="date" value={statementTo} min={statementFrom || undefined} onChange={e => { setStatementTo(e.target.value); setStatementPage(1); }} />
          </label>
          <label className="erp-field erp-field-wide">
            <span>نوع الحركة</span>
            <select value={statementType} onChange={e => { setStatementType(e.target.value); setStatementPage(1); }}>
              <option value="all">كل الحركات</option>
              <option value="purchase">مشتريات</option>
              <option value="payment">سداد</option>
              <option value="return">مرتجعات</option>
              <option value="adjustment">تسويات</option>
            </select>
          </label>
          <button
            onClick={() => selectedSupplier && fetchStatement(selectedSupplier.id)}
            disabled={statementLoading || (!!statementFrom && !!statementTo && statementFrom > statementTo)}
            className="erp-primary-button"
          >
            <Search className="w-4 h-4" />
            {statementLoading ? "جاري التنفيذ..." : "تنفيذ البحث"}
          </button>
          <button
            onClick={() => { setStatementFrom(""); setStatementTo(""); setStatementType("all"); setStatementPage(1); if (selectedSupplier) fetchStatement(selectedSupplier.id, "", ""); }}
            className="erp-secondary-button"
          >
            <RotateCcw className="w-4 h-4" /> إعادة تعيين
          </button>
        </section>

        <div className="erp-statement-toolbar">
          <div className="erp-toolbar-meta">
            <span><b>المورد:</b> {s.name}</span>
            <span><b>الفترة:</b> {statementFrom || "بداية الحساب"} — {statementTo || "حتى الآن"}</span>
            <span className={statementStatus.cls || ""}><b>الحالة:</b> {statementStatus.label}</span>
          </div>
          <div className="erp-toolbar-actions">
            <div className="erp-segmented">
              <button onClick={() => setStatementView("detailed")} className={statementView === "detailed" ? "active" : ""}>تفصيلي</button>
              <button onClick={() => setStatementView("summary")} className={statementView === "summary" ? "active" : ""}>ملخص</button>
            </div>
            <button onClick={exportStatementExcel} className="erp-export-button excel"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
            <button onClick={exportStatementWord} className="erp-export-button word"><FileDown className="w-4 h-4" /> Word</button>
            <button onClick={exportStatementPdf} className="erp-export-button pdf"><FileDown className="w-4 h-4" /> PDF</button>
            <button onClick={printStatement} className="erp-export-button print"><Printer className="w-4 h-4" /> طباعة</button>
          </div>
        </div>

        <section className="erp-statement-summary" aria-label="ملخص الحساب">
          <div><span>الرصيد السابق</span><strong>{formatCurrency(openingAtStart)} <small>ج.م</small></strong></div>
          <div><span>إجمالي المدين</span><strong className="debit">{formatCurrency(totalDebit)} <small>ج.م</small></strong></div>
          <div><span>إجمالي الدائن</span><strong className="credit">{formatCurrency(totalCredit)} <small>ج.م</small></strong></div>
          <div><span>صافي الحركة</span><strong>{formatCurrency(statementTotals.net)} <small>ج.م</small></strong></div>
          <div><span>الرصيد الختامي</span><strong className={closing > 0.009 ? "debit" : closing < -0.009 ? "credit" : ""}>{formatCurrency(closing)} <small>ج.م</small></strong></div>
          <div><span>مطابقة الرصيد</span><strong className={statementSummary?.reconciled ? "credit" : "debit"}>{statementSummary?.reconciled ? "مطابق ✓" : `فرق ${formatCurrency(reconciliationDifference)}`}</strong></div>
        </section>

        <section className="erp-reconciliation-row">
          <div>
            <strong>مطابقة حساب المورد</strong>
            <span>مقارنة الرصيد المحسوب من دفتر المورد بالرصيد المسجل على بطاقة المورد.</span>
          </div>
          <div className={statementSummary?.reconciled ? "match" : "mismatch"}>
            {statementSummary?.reconciled ? "الحساب مطابق ✓" : `يوجد فرق: ${formatCurrency(reconciliationDifference)} ج.م`}
          </div>
        </section>

        <section id="supplier-statement-print" className="erp-statement-sheet">
          <div className="erp-sheet-heading">
            <div>
              <strong>كشف حساب {statementView === "detailed" ? "تفصيلي" : "مختصر"}</strong>
              <span>{s.name} {s.supplier_code ? `• ${toEnglishDigits(s.supplier_code)}` : ""}</span>
            </div>
            <div className="erp-sheet-period">من {statementFrom || "بداية الحساب"} إلى {statementTo || "حتى الآن"}</div>
          </div>

          {statementView === "summary" ? (
            <div className="erp-summary-report">
              <div><span>الرصيد السابق</span><b>{formatCurrency(openingAtStart)} ج.م</b></div>
              <div><span>إجمالي المدين</span><b>{formatCurrency(totalDebit)} ج.م</b></div>
              <div><span>إجمالي الدائن</span><b>{formatCurrency(totalCredit)} ج.م</b></div>
              <div><span>صافي الحركة</span><b>{formatCurrency(statementTotals.net)} ج.م</b></div>
              <div><span>الرصيد الختامي</span><b>{formatCurrency(closing)} ج.م</b></div>
            </div>
          ) : (
            <div className="erp-table-scroll">
              <table className="erp-statement-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>التاريخ</th>
                    <th>نوع الحركة</th>
                    <th>رقم المستند</th>
                    <th className="description-col">البيان</th>
                    <th>طريقة السداد</th>
                    <th className="number-col">مدين</th>
                    <th className="number-col">دائن</th>
                    <th className="number-col">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="opening-row">
                    <td>—</td>
                    <td>{statementFrom || "بداية الحساب"}</td>
                    <td>رصيد سابق</td>
                    <td>—</td>
                    <td>الرصيد السابق عند بداية الفترة</td>
                    <td>—</td>
                    <td></td>
                    <td></td>
                    <td className="number-cell">{formatCurrency(openingAtStart)}</td>
                  </tr>
                  {statementLoading ? (
                    <tr><td colSpan={9} className="erp-table-state"><Clock className="w-5 h-5" /> جاري تحميل كشف الحساب...</td></tr>
                  ) : filteredStatementTransactions.length === 0 ? (
                    <tr><td colSpan={9} className="erp-table-state"><FileText className="w-5 h-5" /> لا توجد حركات في الفترة المحددة</td></tr>
                  ) : paginatedStatementTransactions.map((tx, idx) => {
                    const absoluteIndex = (safeStatementPage - 1) * statementPageSize + idx + 1;
                    const isDebit = tx.type === "purchase" || tx.type === "adjustment";
                    const isCredit = tx.type === "payment" || tx.type === "return";
                    return (
                      <tr key={tx.id}>
                        <td className="index-cell">{absoluteIndex}</td>
                        <td className="date-cell">{formatDate(tx.timestamp)}</td>
                        <td><span className={`erp-type-badge ${tx.type}`}>{TX_TYPE_LABELS[tx.type] || tx.type}</span></td>
                        <td className="document-cell">{toEnglishDigits(referenceLabel(tx))}</td>
                        <td className="description-cell" title={toEnglishDigits(tx.notes || "-")}>{toEnglishDigits(tx.notes || "-")}</td>
                        <td>{paymentMethodLabel(tx.payment_method)}</td>
                        <td className="number-cell debit">{isDebit ? formatCurrency(tx.amount) : ""}</td>
                        <td className="number-cell credit">{isCredit ? formatCurrency(tx.amount) : ""}</td>
                        <td className="number-cell balance">{formatCurrency(tx.running_balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>إجماليات الفترة / الرصيد الختامي</td>
                    <td className="number-cell debit">{formatCurrency(totalDebit)}</td>
                    <td className="number-cell credit">{formatCurrency(totalCredit)}</td>
                    <td className="number-cell balance">{formatCurrency(closing)} ج.م</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {statementView === "detailed" && (
            <div className="erp-pagination">
              <div className="pagination-info">عرض {filteredStatementTransactions.length ? ((safeStatementPage - 1) * statementPageSize + 1) : 0}–{Math.min(safeStatementPage * statementPageSize, filteredStatementTransactions.length)} من {filteredStatementTransactions.length} سجل</div>
              <div className="pagination-controls">
                <label>عدد الصفوف
                  <select value={statementPageSize} onChange={e => { setStatementPageSize(Number(e.target.value)); setStatementPage(1); }}>
                    <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                  </select>
                </label>
                <button disabled={safeStatementPage <= 1} onClick={() => setStatementPage(p => Math.max(1, p - 1))}>السابق</button>
                <span>صفحة {safeStatementPage} من {statementPageCount}</span>
                <button disabled={safeStatementPage >= statementPageCount} onClick={() => setStatementPage(p => Math.min(statementPageCount, p + 1))}>التالي</button>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Form Modal (Create/Edit)
  // ═══════════════════════════════════════
  const renderFormModal = () => {
    if (!showFormModal) return null;
    const isEdit = !!selectedSupplier;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
            <h2 className="text-lg font-black text-slate-800">
              {isEdit ? "تعديل بيانات مورد" : "إضافة مورد جديد"}
            </h2>
            <button
              onClick={() => setShowFormModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Row 1: Name + Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  اسم المورد *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Row 2: Phone 2 + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  هاتف بديل
                </label>
                <input
                  type="text"
                  value={formData.phone_2}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_2: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Row 3: Address + Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  العنوان
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  مجموعة الموردين
                </label>
                <input
                  type="text"
                  value={formData.group_name}
                  onChange={(e) =>
                    setFormData({ ...formData, group_name: e.target.value })
                  }
                  placeholder="مثال: موردين رئيسيين"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Row 4: CR + Tax */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  السجل التجاري
                </label>
                <input
                  type="text"
                  value={formData.commercial_register}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commercial_register: e.target.value,
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  الرقم الضريبي
                </label>
                <input
                  type="text"
                  value={formData.tax_number}
                  onChange={(e) =>
                    setFormData({ ...formData, tax_number: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Row 5: Payment Terms + Credit Limit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  شروط الدفع
                </label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_terms: e.target.value as PaymentTerms,
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                >
                  <option value="cash">نقدي</option>
                  <option value="credit_30">آجل 30 يوم</option>
                  <option value="credit_60">آجل 60 يوم</option>
                  <option value="credit_90">آجل 90 يوم</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  حد الائتمان (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) =>
                    setFormData({ ...formData, credit_limit: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  الرصيد الافتتاحي (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      opening_balance: e.target.value,
                    })
                  }
                  disabled={isEdit}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm disabled:opacity-50"
                />
              </div>
            </div>

            {/* Row 6: Status */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                الحالة
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full md:w-48 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              >
                <option value="active">نشط</option>
                <option value="inactive">متوقف</option>
              </select>
            </div>

            {/* Row 7: Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                ملاحظات
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm resize-none"
              />
            </div>

            {/* Supplier Documents */}
            <div className="border border-purple-200 bg-purple-50/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-black text-slate-800">مستندات المورد</h3>
                  <p className="text-xs text-slate-500">يمكنك رفع بطاقة المورد أو البطاقة الضريبية وحفظها مباشرة داخل قاعدة البيانات</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={formDocType} onChange={e=>setFormDocType(e.target.value)} className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm">
                  <option>بطاقة المورد</option>
                  <option>السجل التجاري</option>
                  <option>البطاقة الضريبية</option>
                  <option>شهادة ضريبة القيمة المضافة</option>
                  <option>بيانات المورد</option>
                  <option>عقد</option>
                  <option>شهادة بنكية</option>
                  <option>مستند آخر</option>
                </select>
                <input value={formDocNumber} onChange={e=>setFormDocNumber(e.target.value)} placeholder="رقم المستند" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
                <input type="date" value={formDocIssueDate} onChange={e=>setFormDocIssueDate(e.target.value)} title="تاريخ الإصدار" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
                <input type="date" value={formDocExpiryDate} onChange={e=>setFormDocExpiryDate(e.target.value)} title="تاريخ الانتهاء" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
              </div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.doc,.docx,.xls,.xlsx" onChange={e=>setFormDocFile(e.target.files?.[0] || null)} className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
              {formDocFile && <div className="text-xs text-purple-700 font-bold">المحدد: {formDocFile.name} — {(formDocFile.size/1024/1024).toFixed(2)} MB</div>}
              <textarea value={formDocNotes} onChange={e=>setFormDocNotes(e.target.value)} rows={2} placeholder="ملاحظات على المستند (اختياري)" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm resize-none" />
              <div className="text-[11px] text-slate-500">الحد الأقصى 15MB. المستند يُرفع بعد حفظ المورد مباشرة، سواء عند الإضافة أو التعديل.</div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
              >
                {uploadingFormDoc ? "جاري الحفظ ورفع المستند..." : (isEdit ? "حفظ التعديلات" : "إضافة المورد")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Payment Modal
  // ═══════════════════════════════════════
  const renderPaymentModal = () => {
    if (!showPaymentModal || !selectedSupplier) return null;
    const s = selectedSupplier;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-black text-slate-800">
              تسديد دفعة للمورد
            </h2>
            <button
              onClick={() => setShowPaymentModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handlePayment} className="p-5 space-y-4">
            <div className="bg-gradient-to-l from-emerald-50 to-white p-4 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm">
                  {(s?.name || s?.name_en || "م").charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{s?.name || "مورد"}</p>
                  <p className="text-xs text-slate-500">
                    {PAYMENT_TERMS_LABELS[s.payment_terms] || "نقدي"}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">الرصيد المستحق:</span>
                <span className="font-black text-lg text-rose-600">
                  {formatCurrency(s.balance)} ج.م
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                طريقة الدفع
              </label>
              <select
                value={paymentData.payment_method}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    payment_method: e.target.value,
                  })
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              >
                <option value="cash">نقدي</option>
                <option value="bank">تحويل بنكي</option>
                <option value="check">شيك</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                المبلغ المدفوع (ج.م) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      amount: e.target.value,
                    })
                  }
                  className="w-full p-3 pl-14 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  ج.م
                </span>
              </div>
              {paymentData.amount && s.balance > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  المتبقي بعد الدفع:{" "}
                  <span className="font-bold text-slate-600">
                    {formatCurrency(Math.max(0, s.balance - Number(paymentData.amount)))}{" "}
                    ج.م
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, notes: e.target.value })
                }
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                placeholder="رقم الشيك أو مرجع التحويل..."
              />
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                تأكيد السداد
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════
  return (
    <div className="supplier-page p-4 md:p-5 space-y-4" dir="rtl">
      {/* Top Header (only in list view) */}
      {activeTab === "list" && (
        <div className="supplier-page-header">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="supplier-back-button" title="رجوع"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <span className="supplier-page-icon"><Truck className="w-5 h-5" /></span>
                إدارة الموردين
              </h1>
              <p className="supplier-page-subtitle">سجل الموردين وحساباتهم وكشوفات الحساب</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onViewReports && (
              <button
                onClick={onViewReports}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-xs md:text-sm flex items-center gap-2 border border-slate-200 transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                تقارير وحسابات الموردين
              </button>
            )}
            <button
              onClick={handleOpenCreate}
              className="supplier-primary-button"
            >
              <Plus className="w-5 h-5" />
              إضافة مورد
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === "list" && renderListView()}
      {activeTab === "detail" && renderDetailView()}
      {activeTab === "statement" && renderStatementView()}

      {/* Modals */}
      {renderFormModal()}
      {renderPaymentModal()}
    </div>
  );
}