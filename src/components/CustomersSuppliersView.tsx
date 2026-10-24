import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  Filter,
  Download,
  RotateCcw,
  DollarSign,
  X,
  AlertCircle,
  Eye,
  Link2,
  MoreHorizontal,
  Briefcase,
  TrendingUp,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Building,
  UserCheck,
  ShoppingCart,
  Clock,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  Layers,
  Printer,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import * as XLSX from "xlsx";

export interface ExtendedClient {
  id: number;
  supplier_code?: string;
  name: string;
  name_en?: string;
  phone: string;
  phone_2?: string;
  address: string;
  notes?: string;
  salesperson?: string;
  salespersonId?: number | null;
  clientType?: string;
  groupName?: string;
  creditLimit?: number;
  status?: "نشط" | "متوقف";
  totalSpent?: number;
  totalOrders?: number;
  totalPurchases?: number;
  totalPaid?: number;
  purchaseCount?: number;
  balance?: number;
  paymentTerms?: string;
  taxNumber?: string;
  commercialRegister?: string;
}

interface SalesRepresentative {
  id: number;
  name: string;
  status?: string;
}

function customerTransactionAmounts(transaction: any): { debit: number; credit: number } {
  const amount = Math.abs(Number(transaction.amount) || 0);
  switch (transaction.type) {
    case "invoice":
    case "debit":
    case "disbursement":
      return { debit: amount, credit: 0 };
    case "payment":
    case "credit":
    case "reversal":
      return { debit: 0, credit: amount };
    case "adjustment":
      return Number(transaction.amount) >= 0
        ? { debit: amount, credit: 0 }
        : { debit: 0, credit: amount };
    default:
      return { debit: 0, credit: 0 };
  }
}

interface CustomersSuppliersViewProps {
  onNavigateModule?: (moduleName: string) => void;
}

export const CustomersSuppliersView: React.FC<CustomersSuppliersViewProps> = ({
  onNavigateModule,
}) => {
  const [csTab, setCsTab] = useState<"customers" | "suppliers">("suppliers");
  const [customers, setCustomers] = useState<ExtendedClient[]>([]);
  const [suppliers, setSuppliers] = useState<ExtendedClient[]>([]);
  const [salesRepresentatives, setSalesRepresentatives] = useState<SalesRepresentative[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState("الكل");
  const [selectedClientType, setSelectedClientType] = useState("الكل");
  const [selectedGroup, setSelectedGroup] = useState("الكل");
  const [selectedStatus, setSelectedStatus] = useState("الكل");

  // Selection & Action state
  const [selectedRow, setSelectedRow] = useState<ExtendedClient | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtendedClient | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Account Ledger modal state
  const [showAccountLedgerModal, setShowAccountLedgerModal] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<{
    opening_balance: number;
    transactions: any[];
    current_balance: number;
    total_debit: number;
    total_credit: number;
  } | null>(null);

  // Supplier Link Modal state (ربط مديول الموردين)
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    phone: "",
    phone_2: "",
    address: "",
    notes: "",
    salesperson: "",
    salespersonId: "",
    clientType: "شركة",
    groupName: "موردين رئيسيين",
    creditLimit: "300000",
    status: "نشط",
    payment_terms: "cash",
  });

  // Fetch real data from APIs directly linking with Suppliers Module
  const fetchData = async () => {
    setLoading(true);
    try {
      const repsRes = await api.get("/api/v2/sales/sales-reps");
      if (!repsRes.ok) {
        throw new Error(`Failed to fetch sales representatives: HTTP ${repsRes.status}`);
      }
      const repsData = await repsRes.json();
      const reps = Array.isArray(repsData) ? repsData : [];
      setSalesRepresentatives(reps);
      const salesRepNames = new Map<number, string>(
        reps.map((rep: SalesRepresentative) => [Number(rep.id), rep.name]),
      );

      // 1. Fetch from /api/suppliers (Suppliers module shared database)
      const suppRes = await api.get("/api/suppliers");
      let suppData: any[] = [];
      if (suppRes.ok) {
        suppData = await suppRes.json();
      }

      const mappedSuppliers: ExtendedClient[] = (Array.isArray(suppData) ? suppData : []).map(
        (s: any) => ({
          id: s.id,
          supplier_code: s.supplier_code || `SUP-${String(s.id).padStart(6, "0")}`,
          name: s.name,
          name_en: s.name_en || "",
          phone: s.phone || "",
          phone_2: s.phone_2 || "",
          address: s.address || "",
          notes: s.notes || "",
          salesperson: s.contact_person || "",
          clientType: s.commercial_register ? "شركة" : "مؤسسة",
          groupName: s.group_name || "موردين رئيسيين",
          creditLimit: Number(s.credit_limit || 0),
          status: s.status === "inactive" ? "متوقف" : "نشط",
          balance: Number(s.balance || 0),
          totalPurchases: Number(s.total_purchases || 0),
          totalPaid: Number(s.total_paid || 0),
          purchaseCount: Number(s.purchase_count || 0),
          paymentTerms: s.payment_terms || "cash",
          taxNumber: s.tax_number || "",
          commercialRegister: s.commercial_register || "",
        })
      );

      // 2. Fetch from /api/customers
      let mappedCustomers: ExtendedClient[] = [];
      try {
        const custRes = await api.get("/api/customers");
        if (custRes.ok) {
          const custData = await custRes.json();
          if (Array.isArray(custData) && custData.length > 0) {
            mappedCustomers = custData.map((c: any) => ({
              id: c.id,
              supplier_code: `CUST-${String(c.id).padStart(4, "0")}`,
              name: c.name,
              phone: c.phone || "",
              phone_2: c.phone_2 || "",
              address: c.address || "",
              notes: c.notes || "",
              salespersonId: c.sales_rep_id ? Number(c.sales_rep_id) : null,
              salesperson: salesRepNames.get(Number(c.sales_rep_id)) || "",
              clientType: "شركة",
              groupName: "عملاء رئيسيين",
              creditLimit: 300000,
              status: "نشط",
              totalSpent: Number(c.sales_total_spent ?? c.total_spent ?? 0),
              totalOrders: Number(c.total_orders || 0),
              balance: Number(c.balance || 0),
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to load customers from API, using fallback", err);
      }

      setSuppliers(mappedSuppliers);
      setCustomers(mappedCustomers);

      // Set default selected row
      if (csTab === "suppliers") {
        setSelectedRow(mappedSuppliers[0] || null);
      } else {
        setSelectedRow(mappedCustomers[0] || null);
      }
    } catch (e) {
      console.error("Failed to fetch integrated Customers & Suppliers data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch ledger data when opening modal
  useEffect(() => {
    if (!showAccountLedgerModal || !selectedRow) {
      setLedgerData(null);
      return;
    }

    const fetchLedger = async () => {
      setLedgerLoading(true);
      try {
        if (csTab === "suppliers") {
          const res = await api.get(`/api/suppliers/${selectedRow.id}/statement`);
          if (res.ok) {
            const data = await res.json();
            setLedgerData({
              opening_balance: Number(data.summary?.opening_balance || data.opening_balance || 0),
              transactions: Array.isArray(data.transactions) ? data.transactions : [],
              current_balance: Number(data.current_balance ?? selectedRow.balance ?? 0),
              total_debit: Number(data.summary?.total_debit || 0),
              total_credit: Number(data.summary?.total_credit || 0),
            });
          }
        } else {
          const res = await api.get(`/api/customers/${selectedRow.id}/transactions`);
          if (res.ok) {
            const txs = await res.json();
            const transactions = Array.isArray(txs) ? txs : [];
            const totals = transactions.reduce(
              (acc: { debit: number; credit: number }, transaction: any) => {
                const amounts = customerTransactionAmounts(transaction);
                return {
                  debit: acc.debit + amounts.debit,
                  credit: acc.credit + amounts.credit,
                };
              },
              { debit: 0, credit: 0 },
            );
            setLedgerData({
              opening_balance: 0,
              transactions,
              current_balance: Number(
                transactions[0]?.running_balance ?? selectedRow.balance ?? 0,
              ),
              total_debit: totals.debit,
              total_credit: totals.credit,
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch statement", e);
      } finally {
        setLedgerLoading(false);
      }
    };

    fetchLedger();
  }, [showAccountLedgerModal, selectedRow?.id, csTab]);

  // Save (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      alert("يرجى إدخال اسم " + (csTab === "customers" ? "العميل" : "المورد"));
      return;
    }

    const isCust = csTab === "customers";

    try {
      let res;
      if (isCust) {
        if (selectedItem) {
          res = await api.put(`/api/customers/${selectedItem.id}`, {
            name: formData.name.trim(),
            phone: formData.phone || null,
            phone_2: formData.phone_2 || null,
            address: formData.address || null,
            notes: formData.notes || null,
            sales_rep_id: formData.salespersonId ? Number(formData.salespersonId) : null,
          });
        } else {
          res = await api.post("/api/customers", {
            name: formData.name.trim(),
            phone: formData.phone || null,
            phone_2: formData.phone_2 || null,
            address: formData.address || null,
            notes: formData.notes || null,
            sales_rep_id: formData.salespersonId ? Number(formData.salespersonId) : null,
          });
        }
      } else {
        // DIRECT INTEGRATION WITH SUPPLIERS MODULE
        if (selectedItem) {
          res = await api.put(`/api/suppliers/${selectedItem.id}`, {
            name: formData.name.trim(),
            name_en: formData.name_en || null,
            phone: formData.phone || null,
            phone_2: formData.phone_2 || null,
            address: formData.address || null,
            notes: formData.notes || null,
            contact_person: formData.salesperson || null,
            group_name: formData.groupName || null,
            credit_limit: Number(formData.creditLimit) || 0,
            status: formData.status === "نشط" ? "active" : "inactive",
            payment_terms: formData.payment_terms || "cash",
          });
        } else {
          res = await api.post("/api/suppliers", {
            name: formData.name.trim(),
            name_en: formData.name_en || null,
            phone: formData.phone || null,
            phone_2: formData.phone_2 || null,
            address: formData.address || null,
            notes: formData.notes || null,
            contact_person: formData.salesperson || null,
            group_name: formData.groupName || null,
            credit_limit: Number(formData.creditLimit) || 0,
            status: formData.status === "نشط" ? "active" : "inactive",
            opening_balance: 0,
            payment_terms: formData.payment_terms || "cash",
          });
        }
      }

      if (res && res.ok) {
        setShowModal(false);
        setSelectedItem(null);
        await fetchData();
      } else {
        const errData = res ? await res.json().catch(() => ({})) : {};
        alert(errData.error || "فشل حفظ السجل في قاعدة البيانات.");
      }
    } catch (error) {
      alert("فشل الاتصال بالخادم لحفظ البيانات.");
    }
  };

  // Delete
  const handleDelete = async (item: ExtendedClient) => {
    const isCust = csTab === "customers";
    const label = isCust ? "العميل" : "المورد";
    if (!confirm(`هل أنت متأكد من حذف ${label}: ${item.name}؟`)) return;

    try {
      const url = isCust ? `/api/customers/${item.id}` : `/api/suppliers/${item.id}`;
      const res = await api.delete(url);
      if (res.ok) {
        if (selectedRow?.id === item.id) {
          setSelectedRow(null);
        }
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `فشل حذف ${label}`);
      }
    } catch (e) {
      alert(`حدث خطأ أثناء حذف ${label}`);
    }
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow) return;

    const amt = Number(paymentAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("يرجى إدخال مبلغ دفع صالح أكبر من الصفر");
      return;
    }

    setPaymentLoading(true);
    const isCust = csTab === "customers";

    try {
      if (isCust) {
        const res = await api.post("/api/customers/transactions", {
          customer_id: selectedRow.id,
          type: "payment",
          amount: amt,
          notes: paymentNotes || "تحصيل نقدي مقيد من الحسابات العامة",
        });
        if (!res.ok) throw new Error("فشل تسجيل سند التحصيل");
      } else {
        // Direct Supplier Payment recorded in supplier_transactions and updates balance
        const res = await api.post(`/api/suppliers/${selectedRow.id}/payments`, {
          amount: amt,
          payment_method: "cash",
          notes: paymentNotes || "سداد نقدي مقيد من شاشة الحسابات العامة",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "فشل تسجيل سند السداد للمورد");
        }
      }

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNotes("");
      await fetchData();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء تسجيل الدفعة");
    } finally {
      setPaymentLoading(false);
    }
  };

  // Dynamic filter dropdown options
  const salespersons = useMemo(() => {
    const list = csTab === "customers" ? customers : suppliers;
    const names = Array.from(new Set(list.map((x) => x.salesperson).filter(Boolean)));
    return ["الكل", ...names];
  }, [csTab, customers, suppliers]);

  const clientTypes = useMemo(() => {
    const list = csTab === "customers" ? customers : suppliers;
    const types = Array.from(new Set(list.map((x) => x.clientType).filter(Boolean)));
    return ["الكل", ...(types.length ? types : ["شركة", "مؤسسة", "تاجر"])];
  }, [csTab, customers, suppliers]);

  const groups = useMemo(() => {
    const list = csTab === "customers" ? customers : suppliers;
    const grps = Array.from(new Set(list.map((x) => x.groupName).filter(Boolean)));
    return ["الكل", ...(grps.length ? grps : ["موردين رئيسيين", "موردين محليين"])];
  }, [csTab, customers, suppliers]);

  const statuses = ["الكل", "نشط", "متوقف"];

  // Filter list
  const currentList = csTab === "customers" ? customers : suppliers;
  const filteredList = useMemo(() => {
    return currentList.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        item.name?.toLowerCase().includes(q) ||
        item.name_en?.toLowerCase().includes(q) ||
        (item.supplier_code && item.supplier_code.toLowerCase().includes(q)) ||
        (item.phone && item.phone.includes(q)) ||
        (item.address && item.address.toLowerCase().includes(q));

      const matchSales =
        selectedSalesperson === "الكل" || item.salesperson === selectedSalesperson;
      const matchType =
        selectedClientType === "الكل" || item.clientType === selectedClientType;
      const matchGrp =
        selectedGroup === "الكل" || item.groupName === selectedGroup;
      const matchStat =
        selectedStatus === "الكل" || item.status === selectedStatus;

      return matchSearch && matchSales && matchType && matchGrp && matchStat;
    });
  }, [
    currentList,
    searchQuery,
    selectedSalesperson,
    selectedClientType,
    selectedGroup,
    selectedStatus,
  ]);

  // Tab change
  const handleTabChange = (tab: "customers" | "suppliers") => {
    setCsTab(tab);
    resetFilters();
    const nextList = tab === "customers" ? customers : suppliers;
    setSelectedRow(nextList[0] || null);
  };

  // Dynamic KPI Stats based on real filtered data
  const stats = useMemo(() => {
    const totalCount = filteredList.length;
    const totalBalances = filteredList.reduce((acc, c) => acc + (Number(c.balance) || 0), 0);
    const activeCount = filteredList.filter((c) => c.status === "نشط").length;
    const inactiveCount = filteredList.filter((c) => c.status === "متوقف").length;

    return {
      totalCount,
      totalBalances,
      activeCount,
      inactiveCount,
    };
  }, [filteredList]);

  // Paginated list
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedSalesperson("الكل");
    setSelectedClientType("الكل");
    setSelectedGroup("الكل");
    setSelectedStatus("الكل");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const dataToExport = filteredList.map((item, index) => ({
      "#": index + 1,
      "كود المورد/العميل":
        item.supplier_code ||
        (csTab === "customers"
          ? `CUST-${String(item.id).padStart(4, "0")}`
          : `SUP-${String(item.id).padStart(6, "0")}`),
      الاسم: item.name,
      الهاتف: item.phone,
      النوع: item.clientType,
      المجموعة: item.groupName,
      المندوب: item.salesperson,
      "الحد الائتماني": item.creditLimit,
      "الرصيد المالي الحالي": item.balance,
      الحالة: item.status,
      العنوان: item.address,
      ملاحظات: item.notes,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      csTab === "customers" ? "العملاء" : "الموردين"
    );
    XLSX.writeFile(
      wb,
      csTab === "customers"
        ? "تقرير_احصاء_العملاء.xlsx"
        : "تقرير_احصاء_الموردين.xlsx"
    );
  };

  return (
    <div className="space-y-6 pb-12 text-right rtl" dir="rtl">
      {/* Integration Banner when on Suppliers Tab */}
      {csTab === "suppliers" && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-right">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-blue-900">
                  ربط مباشر مع مديول الموردين
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  متزامن لحظياً
                </span>
              </div>
              <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                تظهر هنا سجلات الموردين الفعلية المسجلة بمديول المشتريات والموردين مع أرصدتها وحركاتها وحسابات الأستاذ العام
              </p>
            </div>
          </div>
          {onNavigateModule && (
            <button
              onClick={() => onNavigateModule("suppliers")}
              className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>فتح مديول الموردين</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 1. Header & Upper Segment with Pills & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        {/* Toggle Option Pills */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/80">
          <button
            onClick={() => handleTabChange("suppliers")}
            className={`px-10 py-3 rounded-xl font-black text-sm transition-all focus:outline-none cursor-pointer ${
              csTab === "suppliers"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-950 bg-transparent"
            }`}
          >
            الموردين
          </button>
          <button
            onClick={() => handleTabChange("customers")}
            className={`px-10 py-3 rounded-xl font-black text-sm transition-all focus:outline-none cursor-pointer ${
              csTab === "customers"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-950 bg-transparent"
            }`}
          >
            العملاء
          </button>
        </div>

        {/* Action Controls Side: + مورد جديد, تصدير, تحديث */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="p-3 bg-white hover:bg-slate-50 text-slate-500 rounded-2xl border border-slate-200 shadow-sm transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Export to Excel */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-2xl border border-slate-200 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            تصدير Excel
          </button>

          {/* Create Button */}
          <button
            onClick={() => {
              setSelectedItem(null);
              setFormData({
                name: "",
                name_en: "",
                phone: "",
                phone_2: "",
                address: "",
                notes: "",
                salesperson: "",
                salespersonId: "",
                clientType: csTab === "customers" ? "شركة" : "مؤسسة",
                groupName:
                  csTab === "customers" ? "عملاء رئيسيين" : "موردين رئيسيين",
                creditLimit: "300000",
                status: "نشط",
                payment_terms: "cash",
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {csTab === "customers" ? "عميل جديد" : "مورد جديد"}
          </button>
        </div>
      </div>

      {/* 2. Premium Stat Widgets with Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-blue-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers"
                ? "إجمالي عدد العملاء"
                : "إجمالي عدد الموردين"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {stats.totalCount}
              </span>
              <span className="text-[10px] font-black text-slate-500">
                {csTab === "customers" ? "عميل" : "مورد"}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* Widget 2 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-rose-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers"
                ? "إجمالي المديونية المستحقة"
                : "إجمالي رصيد المديونية"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">
                {stats.totalBalances.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-[10px] font-black text-rose-600">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* Widget 3 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-emerald-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers" ? "العملاء النشطون" : "الموردون النشطون"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {stats.activeCount}
              </span>
              <span className="text-[10px] font-black text-slate-500">
                {csTab === "customers" ? "عميل" : "مورد"}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Widget 4 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-amber-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers"
                ? "العملاء المتوقفون"
                : "الموردون المتوقفون"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {stats.inactiveCount}
              </span>
              <span className="text-[10px] font-black text-slate-500 font-mono">
                {csTab === "customers" ? "عميل" : "مورد"}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Inline Search and Funnel Filter Bar */}
      <div className="bg-white p-4 border border-slate-200/80 rounded-[2rem] shadow-xs space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-2.5">
          {/* Main search bar */}
          <div className="relative xl:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                csTab === "customers"
                  ? "بحث بكود أو اسم أو هاتف العميل..."
                  : "بحث بكود أو اسم أو هاتف المورد..."
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-11 pl-4 text-right text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Mandoub Filter */}
          <div>
            <select
              value={selectedSalesperson ?? ""}
              onChange={(e) => {
                setSelectedSalesperson(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">
                {csTab === "customers"
                  ? "مندوب المبيعات (الكل)"
                  : "مندوب المشتريات (الكل)"}
              </option>
              {salespersons
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-sp-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Supplier Type Filter */}
          <div>
            <select
              value={selectedClientType ?? ""}
              onChange={(e) => {
                setSelectedClientType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">
                {csTab === "customers"
                  ? "نوع العميل (الكل)"
                  : "نوع المورد (الكل)"}
              </option>
              {clientTypes
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-type-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Group Classification Filter */}
          <div>
            <select
              value={selectedGroup ?? ""}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">المجموعة (الكل)</option>
              {groups
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-group-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus ?? ""}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">الحالة (الكل)</option>
              {statuses
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-status-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>

            <button
              onClick={resetFilters}
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
              title="إعادة ضبط فلاتر البحث"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Tabular block */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 text-xs font-bold mt-4">
              جاري مزامنة قاعدة بيانات {csTab === "customers" ? "العملاء" : "الموردين"}...
            </p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-bold">لا توجد سجلات مطابقة للبحث</p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80">
                  <th className="p-4 text-xs font-black text-slate-400 text-center w-12">
                    #
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    کود {csTab === "customers" ? "العميل" : "المورد"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    اسم {csTab === "customers" ? "العميل" : "المورد"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    نوع {csTab === "customers" ? "العميل" : "المورد"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    رقم الهاتف
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    الرصيد المالي
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    حد الائتمان
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400 text-center">
                    الحالة
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    {csTab === "customers" ? "مندوب المبيعات" : "مسؤول المشتريات"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400 text-center">
                    ربط {csTab === "customers" ? "المبيعات" : "المشتريات"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400 text-center w-36">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedList.map((item, index) => {
                  const sNo = (currentPage - 1) * itemsPerPage + index + 1;
                  const itemCode =
                    item.supplier_code ||
                    (csTab === "customers"
                      ? `CUST-${String(item.id).padStart(4, "0")}`
                      : `SUP-${String(item.id).padStart(6, "0")}`);

                  const isSelected = selectedRow?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRow(item)}
                      className={`transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/50 hover:bg-blue-50 border-r-4 border-blue-600"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Serial */}
                      <td className="p-4 font-mono text-xs text-slate-400 text-center">
                        {sNo}
                      </td>

                      {/* Code */}
                      <td className="p-4 font-mono text-xs font-extrabold text-blue-600">
                        {itemCode}
                      </td>

                      {/* Name */}
                      <td className="p-4">
                        <span className="font-extrabold text-slate-900 block">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block max-w-xs truncate">
                          {item.address || "لا يوجد عنوان مسجل"}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="p-4">
                        <span className="text-xs font-extrabold text-slate-600">
                          {item.clientType || "مؤسسة"}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="p-4">
                        <span className="text-xs font-extrabold text-slate-700 font-mono">
                          {item.phone || "-"}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="p-4">
                        <div className="font-mono font-black text-sm">
                          {item.balance !== undefined && item.balance !== null && Number(item.balance) !== 0 ? (
                            <span
                              className={
                                Number(item.balance) > 0
                                  ? "text-rose-600"
                                  : "text-emerald-600"
                              }
                            >
                              {Number(item.balance || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              ج.م
                            </span>
                          ) : (
                            <span className="text-slate-400">0.00 ج.م</span>
                          )}
                        </div>
                      </td>

                      {/* Credit Limit */}
                      <td className="p-4 text-xs font-mono font-bold text-slate-500">
                        {Number(item.creditLimit || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        ج.م
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            item.status === "نشط"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === "نشط" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {item.status || "نشط"}
                        </span>
                      </td>

                      {/* Procurement/Sales Agent */}
                      <td className="p-4 text-xs font-bold text-slate-600">
                        {item.salesperson || "غير معين"}
                      </td>

                      {/* Linking Column with Blue Icon 🔗 */}
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRow(item);
                            setShowLinkModal(true);
                          }}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                          }`}
                          title={`تفاصيل ربط ${csTab === "customers" ? "العميل" : "المورد"} بقاعدة البيانات`}
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Actions Column */}
                      <td
                        className="p-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedRow(item);
                              setPaymentAmount("");
                              setPaymentNotes("");
                              setShowPaymentModal(true);
                            }}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors cursor-pointer"
                            title="تسجيل دفعة جديدة"
                          >
                            <DollarSign className="w-4 h-4 stroke-[2.2]" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedRow(item);
                              setSelectedItem(item);
                              setFormData({
                                name: item.name,
                                name_en: item.name_en || "",
                                phone: item.phone,
                                phone_2: item.phone_2 || "",
                                address: item.address || "",
                                notes: item.notes || "",
                                salesperson: item.salesperson || "",
                                salespersonId: item.salespersonId ? String(item.salespersonId) : "",
                                clientType: item.clientType || "شركة",
                                groupName: item.groupName || "موردين رئيسيين",
                                creditLimit: String(item.creditLimit || 300000),
                                status: item.status || "نشط",
                                payment_terms: item.paymentTerms || "cash",
                              });
                              setShowModal(true);
                            }}
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors cursor-pointer"
                            title="تعديل السجل"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedRow(item);
                              setShowAccountLedgerModal(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                            title="معاينة حركة الأستاذ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom Pagination */}
        {!loading && filteredList.length > 0 && (
          <div className="p-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-right">
            {/* Right side info */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 order-2 md:order-1">
              <span>عرض الصفحة {currentPage} من أصل {totalPages}</span>
              <span>•</span>
              <span>
                إجمالي <strong className="text-slate-900">{filteredList.length}</strong> سجل
              </span>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-1 order-1 md:order-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                الأول
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                السابق
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      currentPage === p
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                التالي
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                الأخير
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Direct Module Link Modal (ربط مديول الموردين والمشتريات) */}
      <AnimatePresence>
        {showLinkModal && selectedRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md">
                    <Link2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">
                      حالة الربط مع {csTab === "suppliers" ? "مديول الموردين والمشتريات" : "مديول المبيعات"}
                    </h3>
                    <p className="text-xs text-blue-700 font-bold">
                      {selectedRow.name} ({selectedRow.supplier_code})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="p-2 hover:bg-white/60 text-slate-500 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Synchronization status banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="text-xs text-emerald-900 font-bold leading-relaxed">
                    هذا الحساب مربوط ومزامن بالكامل في قاعدة البيانات المركزية لـ{" "}
                    {csTab === "suppliers" ? "الموردين والمشتريات" : "العملاء والمبيعات"}. أي فواتير أو سندات أو مدفوعات تنعكس تلقائياً هنا في الحسابات العامة.
                  </div>
                </div>

                {/* Key supplier info cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400">کود السيستم</span>
                    <p className="font-mono text-sm font-black text-blue-700">
                      {selectedRow.supplier_code}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400">شروط السداد</span>
                    <p className="text-sm font-black text-slate-800">
                      {selectedRow.paymentTerms === "credit_30"
                        ? "آجل 30 يوم"
                        : selectedRow.paymentTerms === "credit_60"
                        ? "آجل 60 يوم"
                        : selectedRow.paymentTerms === "credit_90"
                        ? "آجل 90 يوم"
                        : "نقدي (كاش)"}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400">الرصيد المالي الحالي</span>
                    <p className={`font-mono text-sm font-black ${Number(selectedRow.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {Number(selectedRow.balance || 0).toLocaleString()} ج.م
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400">الحد الائتماني</span>
                    <p className="font-mono text-sm font-black text-slate-800">
                      {Number(selectedRow.creditLimit || 0).toLocaleString()} ج.م
                    </p>
                  </div>
                  {csTab === "suppliers" && (
                    <>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[11px] font-bold text-slate-400">إجمالي المشتريات التراكمية</span>
                        <p className="font-mono text-sm font-black text-slate-800">
                          {Number(selectedRow.totalPurchases || 0).toLocaleString()} ج.م
                        </p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[11px] font-bold text-slate-400">إجمالي السدادات المدفوعة</span>
                        <p className="font-mono text-sm font-black text-emerald-600">
                          {Number(selectedRow.totalPaid || 0).toLocaleString()} ج.م
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick actions row */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-black text-slate-700 block">إجراءات الربط السريعة:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShowLinkModal(false);
                        setShowAccountLedgerModal(true);
                      }}
                      className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-slate-600" />
                      <span>كشف حساب الأستاذ</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowLinkModal(false);
                        setShowPaymentModal(true);
                      }}
                      className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>تسجيل دفعة سداد</span>
                    </button>
                    {onNavigateModule && csTab === "suppliers" && (
                      <>
                        <button
                          onClick={() => {
                            setShowLinkModal(false);
                            onNavigateModule("suppliers");
                          }}
                          className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          <Building className="w-4 h-4" />
                          <span>الانتقال لمديول الموردين</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowLinkModal(false);
                            onNavigateModule("suppliers_report");
                          }}
                          className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>تقارير الموردين المفصلة</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Dynamic Account Ledger preview report modal */}
      <AnimatePresence>
        {showAccountLedgerModal && selectedRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">
                      كشف الحساب التفصيلي للأستاذ العام
                    </h3>
                    <p className="text-xs text-slate-500 font-bold">
                      الحساب: {selectedRow.name} ({selectedRow.supplier_code || (csTab === "customers" ? `CUST-${selectedRow.id}` : `SUP-${selectedRow.id}`)})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountLedgerModal(false)}
                  className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      الرصيد الافتتاحي
                    </span>
                    <strong className="text-xs font-black text-slate-700">
                      {Number(ledgerData?.opening_balance || 0).toLocaleString()} ج.م
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      حساب الأستاذ
                    </span>
                    <strong className="text-sm font-black text-emerald-600">
                      {csTab === "customers" ? "120101 (عملاء)" : "210101 (موردين)"}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      الرصيد الحالي المستحق
                    </span>
                    <strong className="text-xs font-black text-rose-600">
                      {Number(ledgerData?.current_balance ?? selectedRow.balance ?? 0).toLocaleString()} ج.م
                    </strong>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  {ledgerLoading ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-xs font-bold mt-2">جاري استرجاع قيود الأستاذ العام...</p>
                    </div>
                  ) : ledgerData && ledgerData.transactions && ledgerData.transactions.length > 0 ? (
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 font-bold">
                          <th className="p-3 text-slate-500">التاريخ</th>
                          <th className="p-3 text-slate-500">رقم السند/المرجع</th>
                          <th className="p-3 text-slate-500">البيان / التفصيل</th>
                          <th className="p-3 text-slate-500 text-left">مدين (ج.م)</th>
                          <th className="p-3 text-slate-500 text-left">دائن (ج.م)</th>
                          <th className="p-3 text-slate-500 text-left">الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {ledgerData.transactions.map((tx: any, idx: number) => {
                          const amounts = customerTransactionAmounts(tx);
                          return (
                            <tr key={`tx-${tx.id || idx}`} className="hover:bg-slate-50">
                            <td className="p-3 font-mono text-slate-600">
                              {tx.transaction_date || tx.date || tx.timestamp
                                ? String(tx.transaction_date || tx.date || tx.timestamp).split("T")[0]
                                : "-"}
                            </td>
                            <td className="p-3 font-mono font-bold text-blue-600">
                              {tx.fin_number || tx.document_number || tx.reference_number || (tx.id ? `TRX-${tx.id}` : "-")}
                            </td>
                            <td className="p-3 text-slate-800">
                              {tx.notes ||
                                tx.description ||
                                (tx.type === "invoice"
                                  ? "فاتورة مبيعات آجلة"
                                  : tx.type === "payment"
                                    ? "سند تحصيل مالي"
                                    : "تسوية حساب")}
                            </td>
                            <td className="p-3 text-left font-mono">
                              {amounts.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-left font-mono">
                              {amounts.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-left font-mono font-bold text-slate-900">
                              {Number(tx.running_balance ?? selectedRow.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                              ج.م
                            </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">
                        لا توجد حركات تفصيلية مسجلة بعد في كشف حساب هذا {csTab === "customers" ? "العميل" : "المورد"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        الرصيد الدفتري الحالي: {Number(ledgerData?.current_balance ?? selectedRow.balance ?? 0).toLocaleString()} ج.م
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة كشف الحساب</span>
                </button>
                <button
                  onClick={() => setShowAccountLedgerModal(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl cursor-pointer"
                >
                  حسناً، إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Modal for Add/Edit Client or Supplier */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3 text-right">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {selectedItem
                      ? "تعديل البيانات التفصيلية"
                      : csTab === "customers"
                      ? "إضافة عميل جديد"
                      : "إضافة مورد جديد في قاعدة البيانات"}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    يربط السجل مباشرة مع مديول {csTab === "customers" ? "العملاء والمبيعات" : "الموردين والمشتريات"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Form */}
            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-8 space-y-6 text-right"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    اسم {csTab === "customers" ? "العميل" : "المورد"} الكامل *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    placeholder="نموذج: شركة النور للتوريدات واللوجستيات"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    رقم الهاتف الأساسي *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm text-left"
                    placeholder="01xxxxxxxxx"
                  />
                </div>

                {/* Phone 2 */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    رقم الهاتف الثانوي / الأرضي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formData.phone_2 ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone_2: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm text-left"
                    placeholder="02xxxxxxxx"
                  />
                </div>

                {/* Type client/supplier */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    نوع الكيان
                  </label>
                  <select
                    value={formData.clientType ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        clientType: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                  >
                    <option value="شركة">شركة مساهمة / ذ.م.م</option>
                    <option value="مؤسسة">مؤسسة فردية</option>
                    <option value="مصنع">مصنع مباشر</option>
                    <option value="تاجر">تاجر ومستورد</option>
                  </select>
                </div>

                {/* Group Dropdowns */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    مجموعة التصنيف
                  </label>
                  <select
                    value={formData.groupName ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        groupName: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                  >
                    {csTab === "customers" ? (
                      <>
                        <option value="عملاء رئيسيين">عملاء رئيسيين</option>
                        <option value="عملاء جملة">عملاء جملة ومؤسسات</option>
                        <option value="عملاء أفراد">عملاء أفراد ومستهلكين</option>
                      </>
                    ) : (
                      <>
                        <option value="موردين رئيسيين">موردين رئيسيين وخامات</option>
                        <option value="موردين محليين">موردين خدمات لوجستية ومحليين</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Salesperson / Procurement Contact */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    {csTab === "customers" ? "مندوب المبيعات" : "مسؤول المشتريات / جهة الاتصال"}
                  </label>
                  {csTab === "customers" ? (
                    <select
                      value={formData.salespersonId ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          salespersonId: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    >
                      <option value="">غير معين</option>
                      {salesRepresentatives.map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.name}{rep.status && !["نشط", "active"].includes(rep.status.toLowerCase()) ? ` (${rep.status})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.salesperson ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          salesperson: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                      placeholder="اسم المسؤول..."
                    />
                  )}
                </div>

                {/* Credit Limit */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    الحد الائتماني الأقصى (ج.م)
                  </label>
                  <input
                    type="number"
                    value={formData.creditLimit ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        creditLimit: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm text-left"
                    placeholder="300000"
                  />
                </div>

                {/* Payment Terms (for suppliers) */}
                {csTab === "suppliers" && (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-2">
                      شروط الدفع
                    </label>
                    <select
                      value={formData.payment_terms ?? "cash"}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          payment_terms: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    >
                      <option value="cash">نقدي (كاش)</option>
                      <option value="credit_30">آجل 30 يوم</option>
                      <option value="credit_60">آجل 60 يوم</option>
                      <option value="credit_90">آجل 90 يوم</option>
                    </select>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    حالة الحساب بالنظام
                  </label>
                  <select
                    value={formData.status ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value as any,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                  >
                    <option value="نشط">نشط (مسموح بالعمليات والترحيل)</option>
                    <option value="متوقف">متوقف مؤقتاً (مغلق)</option>
                  </select>
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    العنوان الجغرافي
                  </label>
                  <input
                    type="text"
                    value={formData.address ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    placeholder="أمثلة: المنطقة الصناعية، التجمع الخامس، القاهرة"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    ملاحظات توضيحية إضافية
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    placeholder="أي ملاحظات عامة تخص شروط التوريد أو التعاملات المالية..."
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-colors"
                >
                  حفظ البيانات والترحيل
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 8. Record Payment Transaction Modal */}
      {showPaymentModal && selectedRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    تسجيل دفعة مالية جديدة
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    الحساب: {selectedRow.name} ({selectedRow.supplier_code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRecordPayment} className="p-8 space-y-6">
              {/* Financial Status Banner */}
              <div className="p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 rounded-2xl flex items-center gap-3 transition-colors">
                <AlertCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="text-xs text-emerald-800 font-bold leading-relaxed">
                  الرصيد الحالي المقيد بالنظام للحساب هو:{" "}
                  <strong>{Number(selectedRow?.balance || 0).toLocaleString()} ج.م</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  قيمة الدفعة (ج.م) *
                </label>
                <input
                  type="number"
                  required
                  value={paymentAmount ?? ""}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500 font-mono font-bold text-sm text-left"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  ملاحظات وتفاصيل الترحيل
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes ?? ""}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 font-bold text-sm"
                  placeholder="أدخل رقم الشيك أو إيصال السداد أو رقم القيد..."
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-md transition-colors cursor-pointer"
                >
                  {paymentLoading ? "جاري الترحيل..." : "تسجيل وترحيل الدفعة"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
