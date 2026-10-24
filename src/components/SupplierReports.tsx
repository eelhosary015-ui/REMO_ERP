import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Download,
  FileText,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  RotateCcw,
  Clock3,
  Star,
  CreditCard,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Eye,
  Package,
  Building,
  Tag,
  DollarSign,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Truck,
  Hash,
  ListFilter,
  Layers2,
  Table as TableIcon
} from "lucide-react";
import { api } from "../utils/api";
import { useLanguage } from "../contexts/LanguageContext";
import * as XLSX from "xlsx";

interface Supplier {
  id: number;
  supplier_code?: string | null;
  name: string;
  name_en?: string | null;
  phone?: string | null;
  status?: string;
  balance?: number;
  credit_limit?: number;
  total_purchases?: number;
  total_paid?: number;
  total_payments?: number;
  total_returns?: number;
  purchase_count?: number;
  rating?: number;
  payment_terms?: string;
  opening_balance?: number;
}

interface DetailedItemRow {
  item_id: number;
  purchase_id: number;
  ingredient_id?: number | null;
  product_id?: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_name: string;
  item_code: string;
  unit: string;
  invoice_number: string;
  supplier_invoice_number?: string | null;
  internal_invoice_number?: string | null;
  invoice_date: string;
  due_date?: string | null;
  invoice_status?: string | null;
  payment_status?: string | null;
  invoice_total_amount: number;
  invoice_paid_amount: number;
  invoice_remaining_amount: number;
  invoice_tax_amount?: number;
  invoice_discount_amount?: number;
  invoice_notes?: string | null;
  warehouse_name?: string | null;
  supplier_id: number;
  supplier_name: string;
  supplier_name_en?: string | null;
  supplier_code?: string | null;
  supplier_phone?: string | null;
  supplier_tax_number?: string | null;
  supplier_payment_terms?: string | null;
  supplier_credit_limit: number;
  supplier_opening_balance: number;
  supplier_current_balance: number;
  supplier_status?: string | null;
  supplier_rating: number;
}

interface DetailedInvoiceSummary {
  purchase_id: number;
  supplier_id: number;
  supplier_name: string;
  invoice_number: string;
  supplier_invoice_number?: string | null;
  invoice_date: string;
  due_date?: string | null;
  invoice_status?: string | null;
  payment_status?: string | null;
  warehouse_name?: string | null;
  invoice_notes?: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  items_count: number;
}

interface DetailedSupplierSummary {
  supplier_id: number;
  supplier_name: string;
  supplier_name_en?: string | null;
  supplier_code?: string | null;
  supplier_phone?: string | null;
  supplier_tax_number?: string | null;
  supplier_payment_terms?: string | null;
  supplier_credit_limit: number;
  supplier_opening_balance: number;
  supplier_current_balance: number;
  supplier_status?: string | null;
  supplier_rating: number;
  invoices_count: number;
  items_count: number;
  total_purchases: number;
  total_paid: number;
  total_remaining: number;
  total_quantity: number;
}

interface SupplierItemSummary {
  supplier_id: number;
  supplier_name: string;
  supplier_code?: string | null;
  item_name: string;
  item_code: string;
  unit: string;
  invoices_count: number;
  total_quantity: number;
  avg_unit_price: number;
  min_unit_price: number;
  max_unit_price: number;
  total_amount: number;
  last_supplied_date?: string | null;
}

type ReportTab =
  | "detailed"
  | "overview"
  | "aging"
  | "overdue"
  | "top"
  | "payments"
  | "returns"
  | "performance"
  | "prices"
  | "monthly";

type DetailedViewMode = "grouped" | "table" | "items_breakdown";

const num = (v: any) =>
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

const int = (v: any) => Number(v || 0).toLocaleString("en-US");

const formatDate = (d: any) => {
  if (!d) return "-";
  return String(d).slice(0, 10);
};

export function SupplierReports({
  onBack,
  initialTab,
}: {
  onBack: () => void;
  initialTab?: ReportTab;
}) {
  const { language } = useLanguage();
  const en = language === "en";

  // State
  const [tab, setTab] = useState<ReportTab>(initialTab || "detailed");
  const [detailedViewMode, setDetailedViewMode] =
    useState<DetailedViewMode>("grouped");
  const [loading, setLoading] = useState(true);

  // Filter state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [query, setQuery] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState("");
  const [supplierNameFilter, setSupplierNameFilter] = useState("");

  // Data state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [aging, setAging] = useState<any[]>([]);
  const [report, setReport] = useState<any>({});
  const [paymentsTotalAmount, setPaymentsTotalAmount] = useState(0);
  
  // Detailed Report Data state
  const [detailedData, setDetailedData] = useState<{
    kpis: {
      total_invoices_amount: number;
      total_paid_amount: number;
      total_remaining_amount: number;
      total_items_quantity: number;
      total_items_price: number;
      invoices_count: number;
      items_count: number;
      suppliers_count: number;
    };
    items: DetailedItemRow[];
    invoices: DetailedInvoiceSummary[];
    suppliers_summary: DetailedSupplierSummary[];
    supplier_items_breakdown: SupplierItemSummary[];
  }>({
    kpis: {
      total_invoices_amount: 0,
      total_paid_amount: 0,
      total_remaining_amount: 0,
      total_items_quantity: 0,
      total_items_price: 0,
      invoices_count: 0,
      items_count: 0,
      suppliers_count: 0,
    },
    items: [],
    invoices: [],
    suppliers_summary: [],
    supplier_items_breakdown: [],
  });

  // Expand/collapse state for grouped view
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<number>>(
    new Set()
  );
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(
    new Set()
  );

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  // Invoice details modal opened from the "عرض" (view) button
  const [viewInvoiceModal, setViewInvoiceModal] = useState<any | null>(null);
  const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
  // Supplier invoices list modal opened from the summary table ("عرض الفاتورة")
  const [supplierInvoicesModal, setSupplierInvoicesModal] = useState<any | null>(null);

  // Helper setter that resets page
  const handleTabChange = (newTab: ReportTab) => {
    setTab(newTab);
    setPage(1);
    setTotalRecords(0);
  };

  const handleModeChange = (newMode: DetailedViewMode) => {
    setDetailedViewMode(newMode);
    setPage(1);
  };

  // Load General and Detailed Report Data
  const load = async () => {
    setLoading(true);
    try {
      // 1. Always load the static supplier list once for the filter dropdown
      if (suppliers.length === 0) {
        const sRes = await api.get("/api/suppliers");
        const sd = await sRes.json();
        setSuppliers(Array.isArray(sd) ? sd : []);
      }

      // 2. Fetch data based on the active tab and mode
      if (tab === "detailed") {
        const detailedParams = new URLSearchParams({
          from: startDate,
          to: endDate,
          supplier_id: selectedSupplierId || "",
          supplier_name: supplierNameFilter || "",
          invoice_number: invoiceNumberFilter || "",
          search: query || "",
          page: String(page),
          limit: String(pageSize),
        });
        const dRes = await api.get(`/api/suppliers-detailed-report?${detailedParams.toString()}`);
        const dd = await dRes.json();

        if (dd && !dd.error) {
          setDetailedData({
            kpis: dd.kpis || {
              total_invoices_amount: 0,
              total_paid_amount: 0,
              total_remaining_amount: 0,
              total_items_quantity: 0,
              total_items_price: 0,
              invoices_count: 0,
              items_count: 0,
              suppliers_count: 0,
            },
            items: Array.isArray(dd.items) ? dd.items : [],
            invoices: Array.isArray(dd.invoices) ? dd.invoices : [],
            suppliers_summary: Array.isArray(dd.suppliers_summary)
              ? dd.suppliers_summary
              : [],
            supplier_items_breakdown: Array.isArray(dd.supplier_items_breakdown)
              ? dd.supplier_items_breakdown
              : [],
          });

          // Set total records count based on mode
          const totalRecs = detailedViewMode === "items_breakdown"
            ? (dd.kpis?.total_breakdown_count || 0)
            : (dd.kpis?.items_count || 0);
          setTotalRecords(totalRecs);

          // Auto-expand first 3 suppliers in grouped view
          if (Array.isArray(dd.suppliers_summary) && dd.suppliers_summary.length > 0) {
            const initialExpandedSuppliers = new Set<number>(
              dd.suppliers_summary.slice(0, 3).map((s: any) => s.supplier_id)
            );
            setExpandedSuppliers(initialExpandedSuppliers);

            // Auto-expand first 5 invoices
            if (Array.isArray(dd.invoices) && dd.invoices.length > 0) {
              const initialExpandedInvoices = new Set<number>(
                dd.invoices.slice(0, 5).map((inv: any) => inv.purchase_id)
              );
              setExpandedInvoices(initialExpandedInvoices);
            }
          }
        }
      } else if (tab === "aging") {
        const aRes = await api.get(`/api/suppliers-aging?as_of=${endDate}&search=${query}&page=${page}&limit=${pageSize}`);
        const ad = await aRes.json();
        setAging(Array.isArray(ad.rows) ? ad.rows : []);
        setTotalRecords(ad.total_records || 0);
      } else if (tab === "overview") {
        const oRes = await api.get(`/api/suppliers-reports?type=overview&from=${startDate}&to=${endDate}&supplier_id=${selectedSupplierId || ""}&search=${query}&page=${page}&limit=${pageSize}`);
        const od = await oRes.json();
        setReport((prev: any) => ({ ...prev, overview: od.rows || [] }));
        setTotalRecords(od.total_records || 0);
      } else if (tab === "payments") {
        const pRes = await api.get(`/api/suppliers-reports?type=payments&from=${startDate}&to=${endDate}&supplier_id=${selectedSupplierId || ""}&search=${query}&page=${page}&limit=${pageSize}`);
        const pd = await pRes.json();
        const gRes = await api.get(`/api/suppliers-reports?from=${startDate}&to=${endDate}`);
        const gd = await gRes.json();
        setReport((prev: any) => ({ ...prev, payment_methods: gd.payment_methods || [], payments: pd.rows || [] }));
        setPaymentsTotalAmount(Number(pd.total_amount || 0));
        setTotalRecords(pd.total_records || 0);
      } else if (tab === "monthly") {
        const rRes = await api.get(`/api/suppliers-reports?from=${startDate}&to=${endDate}`);
        const rd = await rRes.json();
        setReport(rd || {});
        setTotalRecords(Array.isArray(rd.monthly) ? rd.monthly.length : 0);
      } else {
        // One of the specific paginated tabs: overdue, top, returns, performance, prices
        const reportTypeMap: Record<string, string> = {
          overdue: "overdue",
          top: "top",
          returns: "returns",
          performance: "performance",
          prices: "prices",
        };
        const reportType = reportTypeMap[tab];
        if (reportType) {
          const rRes = await api.get(`/api/suppliers-reports?from=${startDate}&to=${endDate}&supplier_id=${selectedSupplierId || ""}&search=${query}&type=${reportType}&page=${page}&limit=${pageSize}`);
          const rd = await rRes.json();
          // Update the specific part of report state
          setReport((prev: any) => {
            const next = { ...prev };
            if (reportType === "returns") next.returns = rd.rows || [];
            else if (reportType === "top") next.top_suppliers = rd.rows || [];
            else if (reportType === "overdue") next.overdue_suppliers = rd.rows || [];
            else if (reportType === "performance") next.performance = rd.rows || [];
            else if (reportType === "prices") next.price_history = rd.rows || [];
            return next;
          });
          setTotalRecords(rd.total_records || 0);
        }
      }
    } catch (e) {
      console.error("Error loading supplier reports:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [
    tab,
    detailedViewMode,
    startDate,
    endDate,
    selectedSupplierId,
    invoiceNumberFilter,
    supplierNameFilter,
    query,
    page,
    pageSize,
  ]);

  // Quick date presets
  const applyDatePreset = (preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "today") {
      start = now;
      end = now;
    } else if (preset === "week") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (preset === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    } else if (preset === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
    } else if (preset === "all") {
      start = new Date(2020, 0, 1);
      end = now;
    }

    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  // Reset filters
  const resetFilters = () => {
    const d = new Date();
    setStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10));
    setSelectedSupplierId("");
    setInvoiceNumberFilter("");
    setSupplierNameFilter("");
    setQuery("");
    setPage(1);
  };

  // Filtered suppliers for general overview
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = query.trim().toLowerCase();
      return (
        !q ||
        [s.name, s.name_en, s.supplier_code, s.phone].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      );
    });
  }, [suppliers, query]);

  const overviewTotals = useMemo(
    () => ({
      count: filteredSuppliers.length,
      payable: filteredSuppliers.reduce(
        (a, s) => a + Math.max(Number(s.balance || 0), 0),
        0
      ),
      credit: filteredSuppliers.reduce(
        (a, s) => a + Math.max(-Number(s.balance || 0), 0),
        0
      ),
      purchases: filteredSuppliers.reduce(
        (a, s) => a + Number(s.total_purchases || 0),
        0
      ),
      paid: filteredSuppliers.reduce(
        (a, s) => a + Number(s.total_paid || s.total_payments || 0),
        0
      ),
      returns: filteredSuppliers.reduce(
        (a, s) => a + Number(s.total_returns || 0),
        0
      ),
    }),
    [filteredSuppliers]
  );

  const fAging = useMemo(
    () =>
      aging.filter(
        (x) =>
          !query ||
          String(x.name || x.supplier_name || "")
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [aging, query]
  );

  const labels: Record<ReportTab, string> = {
    detailed: en
      ? "Detailed Supplier & Item Purchases"
      : "تقرير تفصيلي لحسابات وبنود الموردين",
    overview: en ? "Supplier Summary" : "ملخص الموردين",
    aging: en ? "Aging & Overdue" : "أعمار الديون",
    overdue: en ? "Overdue Suppliers" : "الموردون المتأخرون",
    top: en ? "Top Suppliers" : "أفضل الموردين",
    payments: en ? "Payment Report" : "تقرير المدفوعات",
    returns: en ? "Purchase Returns" : "مرتجعات المشتريات",
    performance: en ? "Supplier Performance" : "أداء الموردين",
    prices: en ? "Purchase Price History" : "تاريخ أسعار الشراء",
    monthly: en ? "Monthly Trend" : "الحركة الشهرية",
  };

  // Group detailed data for Hierarchical view: Supplier -> Invoices -> Items
  const groupedTree = useMemo(() => {
    const map = new Map<
      number,
      {
        supplier: DetailedSupplierSummary;
        invoices: Map<
          number,
          {
            invoice: DetailedInvoiceSummary;
            items: DetailedItemRow[];
          }
        >;
      }
    >();

    // Seed suppliers
    detailedData.suppliers_summary.forEach((s) => {
      map.set(s.supplier_id, {
        supplier: s,
        invoices: new Map(),
      });
    });

    // Populate invoices and items
    detailedData.items.forEach((item) => {
      if (!map.has(item.supplier_id)) {
        map.set(item.supplier_id, {
          supplier: {
            supplier_id: item.supplier_id,
            supplier_name: item.supplier_name,
            supplier_name_en: item.supplier_name_en,
            supplier_code: item.supplier_code,
            supplier_phone: item.supplier_phone,
            supplier_tax_number: item.supplier_tax_number,
            supplier_payment_terms: item.supplier_payment_terms,
            supplier_credit_limit: item.supplier_credit_limit,
            supplier_opening_balance: item.supplier_opening_balance,
            supplier_current_balance: item.supplier_current_balance,
            supplier_status: item.supplier_status,
            supplier_rating: item.supplier_rating,
            invoices_count: 0,
            items_count: 0,
            total_purchases: 0,
            total_paid: 0,
            total_remaining: 0,
            total_quantity: 0,
          },
          invoices: new Map(),
        });
      }

      const suppNode = map.get(item.supplier_id)!;
      if (!suppNode.invoices.has(item.purchase_id)) {
        suppNode.invoices.set(item.purchase_id, {
          invoice: {
            purchase_id: item.purchase_id,
            supplier_id: item.supplier_id,
            supplier_name: item.supplier_name,
            invoice_number: item.invoice_number,
            supplier_invoice_number: item.supplier_invoice_number,
            invoice_date: item.invoice_date,
            due_date: item.due_date,
            invoice_status: item.invoice_status,
            payment_status: item.payment_status,
            warehouse_name: item.warehouse_name,
            invoice_notes: item.invoice_notes,
            total_amount: item.invoice_total_amount,
            paid_amount: item.invoice_paid_amount,
            remaining_amount: item.invoice_remaining_amount,
            items_count: 0,
          },
          items: [],
        });
      }

      const invNode = suppNode.invoices.get(item.purchase_id)!;
      invNode.items.push(item);
    });

    return Array.from(map.values()).map((sn) => ({
      ...sn,
      invoicesList: Array.from(sn.invoices.values()),
    }));
  }, [detailedData]);

  // Paginated flat items (already paginated on the server)
  const paginatedItems = detailedData.items;

  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  const PaginationControls = () => {
    if (totalRecords <= 0) return null;

    const fromItem = (page - 1) * pageSize + 1;
    const toItem = Math.min(page * pageSize, totalRecords);

    // Generate page numbers to show
    const pageNumbers: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mt-4 print:hidden">
        {/* Total stats */}
        <div className="text-xs font-bold text-slate-500">
          {en 
            ? `Showing ${fromItem}–${toItem} of ${totalRecords} records` 
            : `عرض ${fromItem}–${toItem} من إجمالي ${totalRecords} سجل`}
        </div>

        {/* Buttons and numbers */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* First page */}
          <button
            disabled={page <= 1}
            onClick={() => setPage(1)}
            className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 text-slate-600 font-bold text-xs"
            title={en ? "First Page" : "الصفحة الأولى"}
          >
            {"<<"}
          </button>

          {/* Previous page */}
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            <span>{en ? "Previous" : "السابق"}</span>
          </button>

          {/* Page numbers */}
          {pageNumbers.map((pNum) => (
            <button
              key={pNum}
              onClick={() => setPage(pNum)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                page === pNum
                  ? "bg-orange-500 text-white font-black"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {pNum}
            </button>
          ))}

          {/* Next page */}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1"
          >
            <span>{en ? "Next" : "التالي"}</span>
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>

          {/* Last page */}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 text-slate-600 font-bold text-xs"
            title={en ? "Last Page" : "الصفحة الأخيرة"}
          >
            {">>"}
          </button>
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">
            {en ? "Rows per page:" : "عدد الصفوف بالصفحة:"}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-200 bg-white text-slate-700"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    );
  };

  // Toggle helpers
  const toggleSupplier = (id: number) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInvoice = (id: number) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open the list of a supplier's invoices from the summary table
  const openSupplierInvoices = async (supplier: any) => {
    const id = Number(supplier?.supplier_id ?? supplier?.id);
    if (!id) return;
    setSupplierInvoicesModal({ loading: true, supplier, invoices: [] });
    try {
      const res = await api.get(`/api/purchases?supplier_id=${id}`);
      const data = await res.json();
      const invoices = Array.isArray(data) ? data : (data?.rows || []);
      setSupplierInvoicesModal({ supplier, invoices });
    } catch (e: any) {
      alert(e?.message || "تعذر تحميل فواتير المورد");
      setSupplierInvoicesModal(null);
    }
  };

  // Open the full invoice (header, items, returns) in a modal from the report
  const openInvoiceView = async (purchaseId?: number | string) => {
    const id = Number(purchaseId);
    if (!id) return;
    setViewInvoiceLoading(true);
    setViewInvoiceModal({ loading: true, id });
    try {
      const res = await api.get(`/api/purchases/${id}`);
      if (!res.ok) throw new Error("تعذر تحميل بيانات الفاتورة");
      const data = await res.json();
      setViewInvoiceModal(data);
    } catch (e: any) {
      alert(e?.message || "تعذر تحميل بيانات الفاتورة");
      setViewInvoiceModal(null);
    } finally {
      setViewInvoiceLoading(false);
    }
  };

  const expandAll = () => {
    setExpandedSuppliers(new Set(detailedData.suppliers_summary.map((s) => s.supplier_id)));
    setExpandedInvoices(new Set(detailedData.invoices.map((inv) => inv.purchase_id)));
  };

  const collapseAll = () => {
    setExpandedSuppliers(new Set());
    setExpandedInvoices(new Set());
  };

  // Export to Excel
  const exportDetailedReportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detailed Items
    const itemsRows = detailedData.items.map((it, idx) => ({
      "م": idx + 1,
      "كود المورد": it.supplier_code || `SUP-${String(it.supplier_id).padStart(6, "0")}`,
      "اسم المورد": en ? it.supplier_name_en || it.supplier_name : it.supplier_name,
      "هاتف المورد": it.supplier_phone || "",
      "شروط السداد": it.supplier_payment_terms || "",
      "رقم الفاتورة": it.invoice_number,
      "فاتورة المورد": it.supplier_invoice_number || "",
      "تاريخ الفاتورة": formatDate(it.invoice_date),
      "حالة السداد": it.payment_status || "معلق",
      "إجمالي الفاتورة": Number(it.invoice_total_amount || 0),
      "مدفوع الفاتورة": Number(it.invoice_paid_amount || 0),
      "متبقي الفاتورة": Number(it.invoice_remaining_amount || 0),
      "كود الصنف": it.item_code || "",
      "اسم الصنف المورد": it.item_name,
      "الوحدة": it.unit,
      "الكمية الموردة": Number(it.quantity || 0),
      "سعر الوحدة": Number(it.unit_price || 0),
      "إجمالي البند": Number(it.total_price || 0),
      "المخزن": it.warehouse_name || "",
      "الرصيد الدفتري الحالي للمورد": Number(it.supplier_current_balance || 0),
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(itemsRows),
      en ? "Detailed Items" : "بنود الفواتير التفصيلية"
    );

    // Sheet 2: Supplier Items Aggregated Breakdown ("ما جابه كل مورد")
    const breakdownRows = detailedData.supplier_items_breakdown.map((sb, idx) => ({
      "م": idx + 1,
      "كود المورد": sb.supplier_code || "",
      "اسم المورد": sb.supplier_name,
      "كود الصنف": sb.item_code,
      "اسم الصنف": sb.item_name,
      "الوحدة": sb.unit,
      "عدد الفواتير": Number(sb.invoices_count || 0),
      "إجمالي الكمية الموردة": Number(sb.total_quantity || 0),
      "متوسط سعر الوحدة": Number(sb.avg_unit_price || 0),
      "أدنى سعر شراء": Number(sb.min_unit_price || 0),
      "أعلى سعر شراء": Number(sb.max_unit_price || 0),
      "إجمالي المبالغ المنفقة": Number(sb.total_amount || 0),
      "تاريخ آخر توريد": formatDate(sb.last_supplied_date),
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(breakdownRows),
      en ? "Supplied Items Summary" : "ملخص ما ورده المورد"
    );

    // Sheet 3: Supplier Accounts Summary
    const accountsRows = detailedData.suppliers_summary.map((ss, idx) => ({
      "م": idx + 1,
      "كود المورد": ss.supplier_code || "",
      "اسم المورد": en ? ss.supplier_name_en || ss.supplier_name : ss.supplier_name,
      "الهاتف": ss.supplier_phone || "",
      "الرقم الضريبي": ss.supplier_tax_number || "",
      "شروط السداد": ss.supplier_payment_terms || "",
      "الرصيد الافتتاحي": Number(ss.supplier_opening_balance || 0),
      "إجمالي المشتريات بالفترة": Number(ss.total_purchases || 0),
      "إجمالي المدفوع بالفترة": Number(ss.total_paid || 0),
      "المتبقي بالفترة": Number(ss.total_remaining || 0),
      "الرصيد الحالي المستحق": Number(ss.supplier_current_balance || 0),
      "الحد الائتماني": Number(ss.supplier_credit_limit || 0),
      "عدد الفواتير": Number(ss.invoices_count || 0),
      "عدد البنود الموردة": Number(ss.items_count || 0),
      "إجمالي الكمية": Number(ss.total_quantity || 0),
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(accountsRows),
      en ? "Supplier Accounts" : "حسابات الموردين"
    );

    XLSX.writeFile(
      wb,
      `detailed-supplier-report-${startDate}-to-${endDate}.xlsx`
    );
  };

  // General export handler
  const exportRows = () => {
    if (tab === "detailed") {
      exportDetailedReportToExcel();
      return;
    }

    let rows: any[] = [];
    if (tab === "overview") {
      rows = filteredSuppliers.map((s, i) => ({
        No: i + 1,
        Code: s.supplier_code || `SUP-${String(s.id).padStart(6, "0")}`,
        Supplier: en ? s.name_en || s.name : s.name,
        Phone: s.phone || "",
        Purchases: Number(s.total_purchases || 0),
        Paid: Number(s.total_paid || s.total_payments || 0),
        Returns: Number(s.total_returns || 0),
        Payable: Math.max(Number(s.balance || 0), 0),
        Credit: Math.max(-Number(s.balance || 0), 0),
        Rating: Number(s.rating || 0),
      }));
    } else if (tab === "aging") {
      rows = fAging.map((x, i) => ({
        No: i + 1,
        Supplier: en ? x.name_en || x.name : x.name,
        Outstanding: Number(x.outstanding || 0),
        Current: Number(x.current_amount || 0),
        "1-30": Number(x.bucket_1_30 || 0),
        "31-60": Number(x.bucket_31_60 || 0),
        "61-90": Number(x.bucket_61_90 || 0),
        "90+": Number(x.bucket_over_90 || 0),
      }));
    } else if (tab === "overdue") {
      rows = (report.overdue_suppliers || []).map((x: any, i: number) => ({
        No: i + 1,
        Supplier: en ? x.name_en || x.name : x.name,
        Outstanding: Number(x.outstanding || 0),
        Overdue: Number(x.overdue || 0),
        CreditLimit: Number(x.credit_limit || 0),
        Balance: Number(x.balance || 0),
      }));
    } else if (tab === "top") {
      rows = (report.top_suppliers || []).map((x: any, i: number) => ({
        No: i + 1,
        Supplier: en ? x.name_en || x.name : x.name,
        Purchases: Number(x.total_purchases || 0),
        Count: Number(x.purchase_count || 0),
        Paid: Number(x.paid_amount || 0),
        Returns: Number(x.return_amount || 0),
        Balance: Number(x.balance || 0),
      }));
    } else if (tab === "payments") {
      rows = (report.payment_methods || []).map((x: any) => ({
        Method: x.payment_method,
        Count: Number(x.count || 0),
        Amount: Number(x.amount || 0),
      }));
    } else if (tab === "returns") {
      rows = (report.returns || []).map((x: any) => ({
        Number: x.return_number,
        Supplier: x.supplier_name,
        Invoice: x.invoice_number || "",
        Date: x.return_date,
        Amount: Number(x.total_amount || 0),
        Status: x.status,
      }));
    } else if (tab === "performance") {
      rows = (report.performance || []).map((x: any) => ({
        Supplier: en ? x.name_en || x.name : x.name,
        Overall: Number(x.overall_score || 0),
        Quality: Number(x.quality_score || 0),
        Delivery: Number(x.delivery_score || 0),
        Price: Number(x.price_score || 0),
        Service: Number(x.service_score || 0),
        Evaluations: Number(x.evaluations || 0),
      }));
    } else if (tab === "prices") {
      rows = (report.price_history || []).map((x: any) => ({
        Item: x.ingredient_name || "",
        Supplier: x.supplier_name,
        AvgPrice: Number(x.avg_price || 0),
        MinPrice: Number(x.min_price || 0),
        MaxPrice: Number(x.max_price || 0),
        Quantity: Number(x.quantity || 0),
        LastPurchase: x.last_purchase_date || "",
      }));
    } else {
      rows = (report.monthly || []).map((x: any) => ({
        Month: x.month,
        Purchases: Number(x.purchases || 0),
        Payments: Number(x.payments || 0),
        Returns: Number(x.returns || 0),
      }));
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      en ? "Supplier Report" : "تقرير الموردين"
    );
    XLSX.writeFile(wb, `supplier-report-${tab}-${startDate}-${endDate}.xlsx`);
  };

  const print = () => window.print();

  const card = (
    icon: any,
    title: string,
    value: any,
    subtext?: string,
    cls?: string
  ) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 font-bold">{title}</div>
          <div
            className={`mt-1.5 text-xl lg:text-2xl font-black tracking-tight tabular-nums font-mono ${cls || "text-slate-900"}`}
          >
            {value}
          </div>
          {subtext && (
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {subtext}
            </div>
          )}
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          {icon}
        </div>
      </div>
    </div>
  );

  const supplierName = (s: any) =>
    en ? s.name_en || s.name || "-" : s.name || "-";

  return (
    <div className="space-y-5 pb-16" dir={en ? "ltr" : "rtl"}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
            title={en ? "Back" : "رجوع"}
          >
            <ArrowRight className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <span className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                <Truck className="w-5 h-5" />
              </span>
              {en ? "Supplier Reports & Analytics" : "تقارير وتحليلات الموردين"}
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-1">
              {en
                ? "Detailed accounts, itemized purchase invoices, price trends, and financial aging"
                : "كشف حسابات تفصيلي لكل مورد، كل ما تم توريده، وبنود الفواتير مع فلاتر التاريخ والمورد والفاتورة"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-colors text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-500" : ""}`} />
            {en ? "Refresh" : "تحديث"}
          </button>
          <button
            onClick={print}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-colors text-slate-700"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            {en ? "Print" : "طباعة"}
          </button>
          <button
            onClick={exportRows}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            {en ? "Export Excel" : "تصدير Excel"}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex gap-1.5 overflow-x-auto shadow-sm print:hidden">
        {(Object.keys(labels) as ReportTab[]).map((k) => (
          <button
            key={k}
            onClick={() => handleTabChange(k)}
            className={`px-4 py-2.5 rounded-xl whitespace-nowrap text-xs md:text-sm font-black transition-all flex items-center gap-1.5 ${
              tab === k
                ? "bg-orange-500 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {k === "detailed" ? (
              <FileSpreadsheet className="w-4 h-4" />
            ) : k === "overview" ? (
              <Users className="w-4 h-4" />
            ) : k === "aging" ? (
              <Clock3 className="w-4 h-4" />
            ) : k === "prices" ? (
              <Tag className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {labels[k]}
          </button>
        ))}
      </div>

      {/* Main Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-700">
            <Filter className="w-4 h-4 text-orange-500" />
            {en ? "Filters & Date Range" : "الفلاتر والبحث المتقدم للفترة"}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "today", label: en ? "Today" : "اليوم" },
              { id: "week", label: en ? "7 Days" : "أسبوع" },
              { id: "month", label: en ? "This Month" : "هذا الشهر" },
              { id: "last_month", label: en ? "Last Month" : "الشهر السابق" },
              { id: "year", label: en ? "This Year" : "هذه السنة" },
              { id: "all", label: en ? "All" : "الكل" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyDatePreset(p.id)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={resetFilters}
              className="px-2.5 py-1 text-xs font-bold rounded-lg text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {en ? "Reset" : "إعادة ضبط"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date from/to */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {en ? "From Date" : "من تاريخ"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {en ? "To Date" : "إلى تاريخ"}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          {/* Supplier Select / Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {en ? "Filter by Supplier" : "فلترة باسم المورد"}
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-200 bg-white"
            >
              <option value="">{en ? "All Suppliers" : "جميع الموردين"}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_code ? `[${s.supplier_code}] ` : ""}
                  {supplierName(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Number Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {en ? "Invoice Number" : "برقم الفاتورة (مشتريات أو مورد)"}
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={invoiceNumberFilter}
                onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                placeholder={en ? "e.g. PINV-0001, INV-449" : "مثال: PINV-0001 أو رقم فاتورة المورد"}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 font-mono"
              />
            </div>
          </div>

          {/* Search Item or General Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {en ? "Search Item / Supplier" : "بحث بالصنف أو الكود أو الملاحظات"}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={en ? "Search items, codes, notes..." : "ابحث عن صنف، كود، أو بند..."}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards based on Tab */}
      {tab === "detailed" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {card(
            <Wallet className="w-5 h-5 text-orange-600" />,
            en ? "Total Invoiced" : "إجمالي المشتريات",
            num(detailedData.kpis.total_invoices_amount) + " ج.م",
            `${int(detailedData.kpis.invoices_count)} ${en ? "Invoices" : "فاتورة"}`
          )}
          {card(
            <CheckCircle className="w-5 h-5 text-emerald-600" />,
            en ? "Total Paid" : "إجمالي المدفوع",
            num(detailedData.kpis.total_paid_amount) + " ج.م",
            `${Math.round(
              ((detailedData.kpis.total_paid_amount || 0) /
                (detailedData.kpis.total_invoices_amount || 1)) *
                100
            )}% ${en ? "Settled" : "مسدد"}`
          )}
          {card(
            <TrendingDown className="w-5 h-5 text-rose-600" />,
            en ? "Total Outstanding" : "المتبقي / المستحق",
            num(detailedData.kpis.total_remaining_amount) + " ج.م",
            undefined,
            "text-rose-600"
          )}
          {card(
            <Package className="w-5 h-5 text-blue-600" />,
            en ? "Total Quantities" : "إجمالي كميات البنود",
            num(detailedData.kpis.total_items_quantity),
            `${int(detailedData.kpis.items_count)} ${en ? "Line items" : "بند شراء"}`
          )}
          {card(
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />,
            en ? "Total Line Items" : "عدد بنود الشراء",
            int(detailedData.kpis.items_count),
            `${int(detailedData.kpis.invoices_count)} ${en ? "Invoices" : "فاتورة"}`
          )}
          {card(
            <Users className="w-5 h-5 text-teal-600" />,
            en ? "Suppliers Count" : "عدد الموردين بالتقرير",
            int(detailedData.kpis.suppliers_count),
            en ? "Active in period" : "خلال الفترة المحددة"
          )}
        </div>
      ) : tab === "payments" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {card(
            <CheckCircle className="w-5 h-5 text-emerald-600" />,
            en ? "Total Payments (Period)" : "إجمالي المدفوعات بالفترة",
            num(paymentsTotalAmount) + " ج.م",
            `${int(totalRecords)} ${en ? "transactions" : "معاملة"}`,
            "text-emerald-600"
          )}
          {card(
            <Wallet className="w-5 h-5 text-blue-600" />,
            en ? "Cash Payments" : "مدفوعات نقدية",
            num((report.payment_methods || []).find((m: any) => m.payment_method === "cash")?.amount || 0) + " ج.م",
            `${int((report.payment_methods || []).find((m: any) => m.payment_method === "cash")?.count || 0)} ${en ? "transactions" : "معاملة"}`
          )}
          {card(
            <CreditCard className="w-5 h-5 text-indigo-600" />,
            en ? "Bank Transfer / Cheque" : "تحويل بنكي / شيك",
            num(
              (report.payment_methods || [])
                .filter((m: any) => m.payment_method !== "cash")
                .reduce((a: number, m: any) => a + Number(m.amount || 0), 0)
            ) + " ج.م",
            `${int(
              (report.payment_methods || [])
                .filter((m: any) => m.payment_method !== "cash")
                .reduce((a: number, m: any) => a + Number(m.count || 0), 0)
            )} ${en ? "transactions" : "معاملة"}`
          )}
          {card(
            <Users className="w-5 h-5 text-orange-600" />,
            en ? "Suppliers Paid" : "عدد الموردين المدفوع لهم",
            int(new Set((report.payments || []).map((p: any) => p.supplier_id)).size),
            en ? "in selected period" : "خلال الفترة المختارة"
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          {card(
            <Users className="w-5 h-5 text-blue-600" />,
            en ? "Suppliers" : "عدد الموردين",
            int(overviewTotals.count),
            ""
          )}
          {card(
            <Wallet className="w-5 h-5 text-rose-600" />,
            en ? "Payable" : "المستحق",
            num(overviewTotals.payable) + " ج.م",
            undefined,
            "text-rose-600"
          )}
          {card(
            <TrendingUp className="w-5 h-5 text-emerald-600" />,
            en ? "Purchases" : "المشتريات",
            num(overviewTotals.purchases) + " ج.م",
            ""
          )}
          {card(
            <TrendingDown className="w-5 h-5 text-blue-600" />,
            en ? "Paid" : "المدفوع",
            num(overviewTotals.paid) + " ج.م",
            undefined,
            "text-blue-600"
          )}
          {card(
            <RotateCcw className="w-5 h-5 text-amber-600" />,
            en ? "Returns" : "المرتجعات",
            num(overviewTotals.returns) + " ج.م",
            undefined,
            "text-amber-600"
          )}
          {card(
            <CreditCard className="w-5 h-5 text-emerald-600" />,
            en ? "Supplier Credit" : "الرصيد الدائن",
            num(overviewTotals.credit) + " ج.م",
            undefined,
            "text-emerald-600"
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DETAILED SUPPLIER & PURCHASES REPORT TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "detailed" && (
        <div className="space-y-4">
          {/* Sub-view switcher for detailed report */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {en ? "Display Mode:" : "طريقة العرض:"}
              </span>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => handleModeChange("grouped")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    detailedViewMode === "grouped"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers2 className="w-3.5 h-3.5" />
                  {en ? "Grouped (Supplier → Invoice → Items)" : "شجري (مورد ← فواتير ← بنود)"}
                </button>
                <button
                  onClick={() => handleModeChange("table")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    detailedViewMode === "table"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  {en ? "Itemized Table (All Lines)" : "جدول تفصيلي شامل لكل بند شراء"}
                </button>
                <button
                  onClick={() => handleModeChange("items_breakdown")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    detailedViewMode === "items_breakdown"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  {en ? "What Each Supplier Brought" : "ملخص ما ورده كل مورد"}
                </button>
              </div>
            </div>

            {detailedViewMode === "grouped" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  {en ? "Expand All" : "توسيع الكل"}
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  {en ? "Collapse All" : "طي الكل"}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
              <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
              <div className="font-black text-slate-700">
                {en ? "Loading detailed report..." : "جاري استخراج التقرير التفصيلي بحسابات وبنود الموردين..."}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {en ? "Compiling invoice lines and supplier balances" : "يتم تجميع بنود الفواتير وحسابات الموردين بدقة"}
              </p>
            </div>
          ) : detailedData.items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="text-base font-black text-slate-700">
                {en ? "No purchase items found" : "لا توجد بنود فواتير شراء مطابقة للفلاتر"}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {en
                  ? "Try changing the date range, clearing the supplier or invoice search filters to view more records."
                  : "جرب تغيير الفترة الزمنية، أو مسح فلاتر اسم المورد أو رقم الفاتورة لعرض المزيد من البيانات."}
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {en ? "Reset All Filters" : "إعادة تعيين كافة الفلاتر"}
              </button>
            </div>
          ) : (
            <>
              {/* MODE 1: HIERARCHICAL GROUPED VIEW */}
              {detailedViewMode === "grouped" && (
                <div className="space-y-4">
                  {groupedTree.map((group) => {
                    const supp = group.supplier;
                    const isSuppExpanded = expandedSuppliers.has(supp.supplier_id);

                    return (
                      <div
                        key={supp.supplier_id}
                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300"
                      >
                        {/* Supplier Card Header */}
                        <div
                          onClick={() => toggleSupplier(supp.supplier_id)}
                          className="p-4 bg-slate-50 border-b border-slate-200 cursor-pointer flex flex-wrap items-center justify-between gap-3 select-none hover:bg-slate-100/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-white rounded-xl border border-slate-200 text-orange-600 shadow-xs">
                              {isSuppExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-slate-900 text-base">
                                  {supplierName(supp)}
                                </h3>
                                <span className="font-mono text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold">
                                  {supp.supplier_code || `SUP-${String(supp.supplier_id).padStart(6, "0")}`}
                                </span>
                                {supp.supplier_phone && (
                                  <span className="text-xs text-slate-500 font-mono">
                                    📞 {supp.supplier_phone}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                                <span>
                                  {en ? "Invoices in period:" : "عدد الفواتير بالفترة:"}{" "}
                                  <b className="text-slate-800 font-mono font-bold">
                                    {supp.invoices_count}
                                  </b>
                                </span>
                                <span>•</span>
                                <span>
                                  {en ? "Line items:" : "إجمالي البنود:"}{" "}
                                  <b className="text-slate-800 font-mono font-bold">
                                    {supp.items_count}
                                  </b>
                                </span>
                                <span>•</span>
                                <span>
                                  {en ? "Terms:" : "شروط الدفع:"}{" "}
                                  <b className="text-slate-700">
                                    {supp.supplier_payment_terms || "نقدي"}
                                  </b>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Supplier Account Financials */}
                          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                            <div className="text-right">
                              <span className="block text-[10px] text-slate-400 font-sans font-bold">
                                {en ? "Invoiced" : "إجمالي المشتريات"}
                              </span>
                              <span className="font-black text-slate-800 text-sm">
                                {num(supp.total_purchases)} ج.م
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[10px] text-slate-400 font-sans font-bold">
                                {en ? "Paid" : "إجمالي المدفوع"}
                              </span>
                              <span className="font-black text-emerald-600 text-sm">
                                {num(supp.total_paid)} ج.م
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[10px] text-slate-400 font-sans font-bold">
                                {en ? "Remaining" : "المتبقي بالفترة"}
                              </span>
                              <span className="font-black text-rose-600 text-sm">
                                {num(supp.total_remaining)} ج.م
                              </span>
                            </div>
                            <div className="border-r border-slate-200 pr-4 text-right">
                              <span className="block text-[10px] text-slate-400 font-sans font-bold">
                                {en ? "Current Balance" : "الرصيد الدفتري الحالي"}
                              </span>
                              <span
                                className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                                  (supp.supplier_current_balance || 0) > 0
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {num(supp.supplier_current_balance)} ج.م
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Invoices List under Supplier */}
                        {isSuppExpanded && (
                          <div className="p-4 space-y-3 bg-white">
                            {group.invoicesList.length === 0 ? (
                              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                                {en ? "No invoices found for this supplier in the selected period" : "لا توجد فواتير لهذا المورد بالفترة"}
                              </div>
                            ) : (
                              group.invoicesList.map((invNode) => {
                                const inv = invNode.invoice;
                                const isInvExpanded = expandedInvoices.has(inv.purchase_id);

                                return (
                                  <div
                                    key={inv.purchase_id}
                                    className="border border-slate-200 rounded-xl overflow-hidden transition-all"
                                  >
                                    {/* Invoice Header */}
                                    <div
                                      onClick={() => toggleInvoice(inv.purchase_id)}
                                      className="p-3 bg-slate-50/70 hover:bg-slate-100 cursor-pointer flex flex-wrap items-center justify-between gap-2 border-b border-slate-100"
                                    >
                                      <div className="flex items-center gap-2">
                                        <button className="text-slate-400">
                                          {isInvExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-orange-500" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </button>
                                        <span className="font-mono font-black text-slate-800 text-sm">
                                          {inv.invoice_number}
                                        </span>
                                        {inv.supplier_invoice_number && (
                                          <span className="text-[11px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                                            {en ? "Supplier Inv:" : "فاتورة المورد:"}{" "}
                                            {inv.supplier_invoice_number}
                                          </span>
                                        )}
                                        <span className="text-xs text-slate-500 font-mono">
                                          📅 {formatDate(inv.invoice_date)}
                                        </span>
                                        {inv.warehouse_name && (
                                          <span className="text-xs text-slate-500 font-bold">
                                            🏢 {inv.warehouse_name}
                                          </span>
                                        )}
                                      </div>

                                      {/* Invoice Totals & Status */}
                                      <div className="flex items-center gap-3 text-xs font-mono">
                                        <span
                                          className={`px-2 py-0.5 rounded-md font-sans text-[11px] font-bold ${
                                            inv.payment_status === "paid"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : inv.payment_status === "partial" || inv.payment_status === "partially_paid"
                                              ? "bg-amber-100 text-amber-700"
                                              : "bg-rose-100 text-rose-700"
                                          }`}
                                        >
                                          {inv.payment_status === "paid"
                                            ? "مسدد بالكامل"
                                            : inv.payment_status === "partial" || inv.payment_status === "partially_paid"
                                            ? "مسدد جزئياً"
                                            : "غير مسدد"}
                                        </span>
                                        <span className="text-slate-700">
                                          {en ? "Total:" : "الإجمالي:"}{" "}
                                          <b className="text-slate-900 font-bold">
                                            {num(inv.total_amount)} ج.م
                                          </b>
                                        </span>
                                        <span className="text-emerald-600">
                                          {en ? "Paid:" : "المدفوع:"}{" "}
                                          <b>{num(inv.paid_amount)}</b>
                                        </span>
                                        <span className="text-rose-600">
                                          {en ? "Remaining:" : "المتبقي:"}{" "}
                                          <b>{num(inv.remaining_amount)}</b>
                                        </span>
                                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold font-sans">
                                          {invNode.items.length}{" "}
                                          {en ? "Items" : "بنود"}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openInvoiceView(inv.purchase_id); }}
                                          title={en ? "View invoice" : "عرض الفاتورة"}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold font-sans text-[11px]"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          {en ? "View" : "عرض"}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Items Table within Invoice */}
                                    {isInvExpanded && (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-right text-xs">
                                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                                            <tr>
                                              <th className="p-2.5 px-4">#</th>
                                              <th className="p-2.5 px-4">{en ? "Item Code" : "كود الصنف"}</th>
                                              <th className="p-2.5 px-4">{en ? "Item Name" : "اسم الصنف المورد"}</th>
                                              <th className="p-2.5 px-4">{en ? "Unit" : "الوحدة"}</th>
                                              <th className="p-2.5 px-4">{en ? "Quantity" : "الكمية"}</th>
                                              <th className="p-2.5 px-4">{en ? "Unit Price" : "سعر الوحدة"}</th>
                                              <th className="p-2.5 px-4">{en ? "Total Price" : "إجمالي البند"}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {invNode.items.map((it, itIdx) => (
                                              <tr key={it.item_id} className="hover:bg-orange-50/30">
                                                <td className="p-2.5 px-4 font-mono text-slate-400">
                                                  {itIdx + 1}
                                                </td>
                                                <td className="p-2.5 px-4 font-mono font-bold text-slate-700">
                                                  {it.item_code || "-"}
                                                </td>
                                                <td className="p-2.5 px-4 font-black text-slate-800">
                                                  {it.item_name}
                                                </td>
                                                <td className="p-2.5 px-4 text-slate-600">
                                                  {it.unit}
                                                </td>
                                                <td className="p-2.5 px-4 font-mono font-bold text-blue-600">
                                                  {num(it.quantity)}
                                                </td>
                                                <td className="p-2.5 px-4 font-mono font-bold text-slate-700">
                                                  {num(it.unit_price)} ج.م
                                                </td>
                                                <td className="p-2.5 px-4 font-mono font-black text-slate-900">
                                                  {num(it.total_price)} ج.م
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODE 2: FLAT ITEMIZED TABLE */}
              {detailedViewMode === "table" && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">
                        {en ? "Itemized Purchase Lines" : "جدول تفصيلي شامل لكل بنود فواتير الشراء"}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">
                        {en
                          ? `Showing ${paginatedItems.length} of ${detailedData.items.length} records`
                          : `يتم عرض ${paginatedItems.length} من إجمالي ${detailedData.items.length} حركة شراء`}
                      </p>
                    </div>

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span>
                          {en ? "Page" : "صفحة"} {page} {en ? "of" : "من"} {totalPages}
                        </span>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3 px-4">#</th>
                          <th className="p-3 px-4">{en ? "Date" : "التاريخ"}</th>
                          <th className="p-3 px-4">{en ? "Invoice No." : "رقم الفاتورة"}</th>
                          <th className="p-3 px-4">{en ? "Supplier" : "المورد"}</th>
                          <th className="p-3 px-4">{en ? "Item Code" : "كود الصنف"}</th>
                          <th className="p-3 px-4">{en ? "Item Name" : "اسم الصنف المورد"}</th>
                          <th className="p-3 px-4">{en ? "Unit" : "الوحدة"}</th>
                          <th className="p-3 px-4">{en ? "Quantity" : "الكمية"}</th>
                          <th className="p-3 px-4">{en ? "Unit Price" : "سعر الوحدة"}</th>
                          <th className="p-3 px-4">{en ? "Item Total" : "إجمالي البند"}</th>
                          <th className="p-3 px-4">{en ? "Invoice Total" : "إجمالي الفاتورة"}</th>
                          <th className="p-3 px-4">{en ? "Paid" : "المدفوع"}</th>
                          <th className="p-3 px-4">{en ? "Remaining" : "المتبقي"}</th>
                          <th className="p-3 px-4">{en ? "Payment Status" : "حالة السداد"}</th>
                          <th className="p-3 px-4">{en ? "Supplier Balance" : "رصيد المورد المستحق"}</th>
                          <th className="p-3 px-4 text-center">{en ? "View" : "عرض"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedItems.map((it, idx) => (
                          <tr key={it.item_id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 px-4 font-mono text-slate-400">
                              {(page - 1) * pageSize + idx + 1}
                            </td>
                            <td className="p-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {formatDate(it.invoice_date)}
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {it.invoice_number}
                              {it.supplier_invoice_number && (
                                <span className="block text-[10px] text-slate-400">
                                  {it.supplier_invoice_number}
                                </span>
                              )}
                            </td>
                            <td className="p-3 px-4 font-black text-slate-800 whitespace-nowrap">
                              {it.supplier_name}
                              <span className="block font-mono text-[10px] text-slate-400 font-normal">
                                {it.supplier_code || `SUP-${String(it.supplier_id).padStart(6, "0")}`}
                              </span>
                            </td>
                            <td className="p-3 px-4 font-mono text-slate-600">
                              {it.item_code || "-"}
                            </td>
                            <td className="p-3 px-4 font-black text-slate-900">
                              {it.item_name}
                            </td>
                            <td className="p-3 px-4 text-slate-600 whitespace-nowrap">
                              {it.unit}
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-blue-600">
                              {num(it.quantity)}
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                              {num(it.unit_price)} ج.م
                            </td>
                            <td className="p-3 px-4 font-mono font-black text-slate-900 whitespace-nowrap">
                              {num(it.total_price)} ج.م
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                              {num(it.invoice_total_amount)} ج.م
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {num(it.invoice_paid_amount)} ج.م
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-rose-600 whitespace-nowrap">
                              {num(it.invoice_remaining_amount)} ج.م
                            </td>
                            <td className="p-3 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  it.payment_status === "paid"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : it.payment_status === "partial" || it.payment_status === "partially_paid"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {it.payment_status === "paid"
                                  ? "مسدد"
                                  : it.payment_status === "partial" || it.payment_status === "partially_paid"
                                  ? "جزئي"
                                  : "غير مسدد"}
                              </span>
                            </td>
                            <td className="p-3 px-4 font-mono font-black whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  (it.supplier_current_balance || 0) > 0
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {num(it.supplier_current_balance)} ج.م
                              </span>
                            </td>
                            <td className="p-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openInvoiceView(it.purchase_id)}
                                title={en ? "View invoice" : "عرض الفاتورة"}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold text-[11px]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {en ? "View" : "عرض"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODE 3: WHAT EACH SUPPLIER BROUGHT BREAKDOWN */}
              {detailedViewMode === "items_breakdown" && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">
                        {en ? "Supplied Items Summary per Supplier" : "ملخص ما ورده كل مورد (الأصناف، الكميات، الأسعار، والإجماليات)"}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">
                        {en
                          ? "Aggregate quantities and purchase prices grouped by supplier and product"
                          : "تجميع دقيق لكل صنف قام كل مورد بتوريده مع متوسط الأسعار وآخر تاريخ توريد"}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3 px-4">#</th>
                          <th className="p-3 px-4">{en ? "Supplier" : "المورد"}</th>
                          <th className="p-3 px-4">{en ? "Item Code" : "كود الصنف"}</th>
                          <th className="p-3 px-4">{en ? "Item Name" : "اسم الصنف"}</th>
                          <th className="p-3 px-4">{en ? "Unit" : "الوحدة"}</th>
                          <th className="p-3 px-4">{en ? "Invoices Count" : "عدد الفواتير"}</th>
                          <th className="p-3 px-4">{en ? "Total Quantity" : "إجمالي الكمية الموردة"}</th>
                          <th className="p-3 px-4">{en ? "Avg Price" : "متوسط السعر"}</th>
                          <th className="p-3 px-4">{en ? "Min Price" : "أدنى سعر"}</th>
                          <th className="p-3 px-4">{en ? "Max Price" : "أعلى سعر"}</th>
                          <th className="p-3 px-4">{en ? "Total Spent" : "إجمالي المبالغ المنفقة"}</th>
                          <th className="p-3 px-4">{en ? "Last Supplied Date" : "تاريخ آخر توريد"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailedData.supplier_items_breakdown.map((sb, idx) => (
                          <tr key={`${sb.supplier_id}-${sb.item_name}-${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 px-4 font-black text-slate-900 whitespace-nowrap">
                              {sb.supplier_name}
                              <span className="block font-mono text-[10px] text-slate-400 font-normal">
                                {sb.supplier_code || `SUP-${String(sb.supplier_id).padStart(6, "0")}`}
                              </span>
                            </td>
                            <td className="p-3 px-4 font-mono text-slate-600">{sb.item_code || "-"}</td>
                            <td className="p-3 px-4 font-black text-slate-800">{sb.item_name}</td>
                            <td className="p-3 px-4 text-slate-600 whitespace-nowrap">{sb.unit}</td>
                            <td className="p-3 px-4 font-mono text-center font-bold text-slate-700">{sb.invoices_count}</td>
                            <td className="p-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">{num(sb.total_quantity)}</td>
                            <td className="p-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">{num(sb.avg_unit_price)} ج.م</td>
                            <td className="p-3 px-4 font-mono text-slate-500 whitespace-nowrap">{num(sb.min_unit_price)} ج.م</td>
                            <td className="p-3 px-4 font-mono text-slate-500 whitespace-nowrap">{num(sb.max_unit_price)} ج.م</td>
                            <td className="p-3 px-4 font-mono font-black text-slate-900 whitespace-nowrap">{num(sb.total_amount)} ج.م</td>
                            <td className="p-3 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDate(sb.last_supplied_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          <PaginationControls />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          OTHER EXISTING TABS (Overview, Aging, Overdue, Top, Returns, etc.)
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab !== "detailed" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-lg text-slate-900">{labels[tab]}</h2>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                {startDate} → {endDate}
              </div>
            </div>
            <FileText className="w-5 h-5 text-orange-500" />
          </div>

          {loading ? (
            <div className="p-16 text-center font-bold text-slate-400">
              {en ? "Loading report..." : "جاري تحميل التقرير..."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  {tab === "overview" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Purchases" : "المشتريات"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Paid" : "المدفوع"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Returns" : "المرتجعات"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Payable" : "المستحق"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Credit" : "الدائن"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Rating" : "التقييم"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-center">{en ? "View Invoice" : "عرض الفاتورة"}</th>
                    </tr>
                  )}
                  {tab === "aging" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Outstanding" : "المستحق"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Current" : "حالي"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">1-30</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">31-60</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">61-90</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">90+</th>
                    </tr>
                  )}
                  {tab === "overdue" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Outstanding" : "المستحق"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Overdue" : "المتأخر"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Credit Limit" : "الحد الائتماني"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Balance" : "الرصيد"}</th>
                    </tr>
                  )}
                  {tab === "top" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Purchases" : "المشتريات"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Invoices" : "الفواتير"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Paid" : "المدفوع"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Returns" : "المرتجعات"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Balance" : "الرصيد"}</th>
                    </tr>
                  )}
                  {tab === "payments" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{report.payments && report.payments.length > 0 ? (en ? "Supplier" : "المورد") : (en ? "Payment Method" : "طريقة الدفع")}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Amount" : "المبلغ"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{report.payments && report.payments.length > 0 ? (en ? "Method" : "طريقة الدفع") : (en ? "Count" : "العدد")}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{report.payments && report.payments.length > 0 ? (en ? "Notes" : "البيان / الملاحظات") : "-"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{report.payments && report.payments.length > 0 ? (en ? "Date" : "التاريخ والوقت") : "-"}</th>
                    </tr>
                  )}
                  {tab === "returns" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Return No." : "رقم المرتجع"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Invoice" : "الفاتورة"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Date" : "التاريخ"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Amount" : "المبلغ"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Status" : "الحالة"}</th>
                    </tr>
                  )}
                  {tab === "performance" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Overall" : "الإجمالي"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Quality" : "الجودة"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Delivery" : "التوريد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Price" : "السعر"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Service" : "الخدمة"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Evaluations" : "التقييمات"}</th>
                    </tr>
                  )}
                  {tab === "prices" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Item" : "الصنف"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Supplier" : "المورد"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Average" : "المتوسط"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Min" : "الأدنى"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Max" : "الأعلى"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Quantity" : "الكمية"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Last Purchase" : "آخر شراء"}</th>
                    </tr>
                  )}
                  {tab === "monthly" && (
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">#</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Month" : "الشهر"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Purchases" : "المشتريات"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Payments" : "المدفوعات"}</th>
                      <th className="px-4 py-4 font-black text-slate-700 text-right">{en ? "Returns" : "المرتجعات"}</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tab === "overview" &&
                    (report.overview && report.overview.length > 0 ? report.overview : filteredSuppliers).map((s: any, i: number) => {
                      const b = Number(s.balance || 0);
                      return (
                        <tr key={s.id || i} className="hover:bg-slate-50">
                          <td className="px-4 py-4 font-mono text-slate-400 font-bold">{(page - 1) * pageSize + i + 1}</td>
                          <td className="px-4 py-4 font-black">
                            {supplierName(s)}
                            <span className="block text-xs text-slate-400 font-mono font-normal">
                              {s.supplier_code || `SUP-${String(s.id).padStart(6, "0")}`}
                            </span>
                          </td>
                          {[
                            s.total_purchases,
                            s.total_paid || s.paid_amount || s.total_payments,
                            s.total_returns || s.return_amount,
                            Math.max(b, 0),
                            Math.max(-b, 0),
                          ].map((v, j) => (
                            <td
                              key={j}
                              className="px-4 py-4 font-mono tabular-nums font-bold"
                            >
                              {num(v)} ج.م
                            </td>
                          ))}
                          <td className="px-4 py-4 font-mono tabular-nums">
                            {num(s.rating)}/5 ⭐
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openSupplierInvoices(s)}
                              title={en ? "View supplier invoices" : "عرض فواتير المورد"}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {en ? "View Invoice" : "عرض الفاتورة"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {tab === "aging" &&
                    aging.map((x, i) => (
                      <tr key={x.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono text-slate-400 font-bold">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-black">{supplierName(x)}</td>
                        {[
                          x.outstanding,
                          x.current_amount,
                          x.bucket_1_30,
                          x.bucket_31_60,
                          x.bucket_61_90,
                          x.bucket_over_90,
                        ].map((v, j) => (
                          <td
                            key={j}
                            className="px-4 py-4 font-mono tabular-nums font-bold"
                          >
                            {num(v)} ج.م
                          </td>
                        ))}
                      </tr>
                    ))}

                  {tab === "overdue" &&
                    (report.overdue_suppliers || []).map((x: any, i: number) => (
                      <tr key={x.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono text-slate-400 font-bold">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-black">{supplierName(x)}</td>
                        {[x.outstanding, x.overdue, x.credit_limit, x.balance].map(
                          (v, j) => (
                            <td
                              key={j}
                              className="px-4 py-4 font-mono tabular-nums font-bold"
                            >
                              {num(v)} ج.م
                            </td>
                          )
                        )}
                      </tr>
                    ))}

                  {tab === "top" &&
                    (report.top_suppliers || []).map((x: any, i: number) => (
                      <tr key={x.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono text-slate-400 font-bold">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-black">{supplierName(x)}</td>
                        {[
                          x.total_purchases,
                          x.purchase_count,
                          x.paid_amount,
                          x.return_amount,
                          x.balance,
                        ].map((v, j) => (
                          <td
                            key={j}
                            className="px-4 py-4 font-mono tabular-nums font-bold"
                          >
                            {j === 1 ? int(v) : `${num(v)} ج.م`}
                          </td>
                        ))}
                      </tr>
                    ))}

                  {tab === "payments" &&
                    (report.payments && report.payments.length > 0 ? (
                      <>
                        {report.payments.map((p: any, i: number) => (
                          <tr key={p.id || i} className="hover:bg-slate-50">
                            <td className="px-4 py-4 font-mono text-slate-400 font-bold">{(page - 1) * pageSize + i + 1}</td>
                            <td className="px-4 py-4 font-black">{p.supplier_name || "-"}</td>
                            <td className="px-4 py-4 font-mono tabular-nums font-black text-emerald-600">
                              {num(p.amount)} ج.م
                            </td>
                            <td className="px-4 py-4 font-bold">{p.payment_method || "نقدي"}</td>
                            <td className="px-4 py-4 text-slate-600">{p.notes || "-"}</td>
                            <td className="px-4 py-4 font-mono text-xs">{formatDate(p.timestamp)}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-black">
                          <td className="px-4 py-3 text-emerald-700 font-black text-xs" colSpan={2}>
                            {en ? `Total (all ${int(totalRecords)} transactions)` : `الإجمالي (جميع ${int(totalRecords)} معاملة)`}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-emerald-700 font-black text-base">
                            {num(paymentsTotalAmount)} ج.م
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs" colSpan={3}>
                            {en ? "* Total covers all pages, not just current page" : "* الإجمالي يشمل كل الصفحات وليس الصفحة الحالية فقط"}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        {(report.payment_methods || []).map((x: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-4 font-mono text-slate-400 font-bold">{i + 1}</td>
                            <td className="px-4 py-4 font-bold">{x.payment_method}</td>
                            <td className="px-4 py-4 font-mono tabular-nums font-black">
                              {num(x.amount)} ج.م
                            </td>
                            <td className="px-4 py-4 font-mono tabular-nums">
                              {int(x.count)}
                            </td>
                            <td className="px-4 py-4 text-slate-400">-</td>
                            <td className="px-4 py-4 text-slate-400">-</td>
                          </tr>
                        ))}
                        {(report.payment_methods || []).length > 0 && (
                          <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-black">
                            <td className="px-4 py-3 text-emerald-700 font-black text-xs" colSpan={2}>
                              {en ? "Grand Total" : "الإجمالي الكلي"}
                            </td>
                            <td className="px-4 py-3 font-mono tabular-nums text-emerald-700 font-black text-base">
                              {num((report.payment_methods || []).reduce((a: number, m: any) => a + Number(m.amount || 0), 0))} ج.م
                            </td>
                            <td className="px-4 py-3 font-mono tabular-nums text-slate-600 font-bold">
                              {int((report.payment_methods || []).reduce((a: number, m: any) => a + Number(m.count || 0), 0))}
                            </td>
                            <td className="px-4 py-3" colSpan={2}></td>
                          </tr>
                        )}
                      </>
                    ))}

                  {tab === "returns" &&
                    (report.returns || []).map((x: any, i: number) => (
                      <tr key={x.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono font-bold text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-mono">{x.return_number}</td>
                        <td className="px-4 py-4 font-bold">{x.supplier_name || "-"}</td>
                        <td className="px-4 py-4 font-mono">{x.invoice_number || "-"}</td>
                        <td className="px-4 py-4 font-mono">{formatDate(x.return_date)}</td>
                        <td className="px-4 py-4 font-mono tabular-nums font-black">
                          {num(x.total_amount)} ج.م
                        </td>
                        <td className="px-4 py-4">{x.status || "-"}</td>
                      </tr>
                    ))}

                  {tab === "performance" &&
                    (report.performance || []).map((x: any, i: number) => (
                      <tr key={x.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono font-bold text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-black">{supplierName(x)}</td>
                        {[
                          x.overall_score,
                          x.quality_score,
                          x.delivery_score,
                          x.price_score,
                          x.service_score,
                          x.evaluations,
                        ].map((v, j) => (
                          <td
                            key={j}
                            className="px-4 py-4 font-mono tabular-nums font-bold"
                          >
                            {j === 5 ? int(v) : `${num(v)}/5`}
                          </td>
                        ))}
                      </tr>
                    ))}

                  {tab === "prices" &&
                    (report.price_history || []).map((x: any, i: number) => (
                      <tr key={`${x.id}-${x.supplier_id}-${i}`} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono font-bold text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-bold">{x.ingredient_name || "-"}</td>
                        <td className="px-4 py-4 font-bold">{x.supplier_name || "-"}</td>
                        {[x.avg_price, x.min_price, x.max_price, x.quantity].map(
                          (v, j) => (
                            <td
                              key={j}
                              className="px-4 py-4 font-mono tabular-nums font-bold"
                            >
                              {j === 3 ? num(v) : `${num(v)} ج.م`}
                            </td>
                          )
                        )}
                        <td className="px-4 py-4 font-mono">
                          {formatDate(x.last_purchase_date)}
                        </td>
                      </tr>
                    ))}

                  {tab === "monthly" &&
                    (report.monthly || []).map((x: any, i: number) => (
                      <tr key={x.month || i} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-mono font-bold text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-4 py-4 font-mono font-black">{x.month}</td>
                        {[x.purchases, x.payments, x.returns].map((v, j) => (
                          <td
                            key={j}
                            className="px-4 py-4 font-mono tabular-nums font-black"
                          >
                            {num(v)} ج.م
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <PaginationControls />
          </>
        )}
        </div>
      )}

      {/* Supplier Invoices List Modal (opened from the summary table) */}
      {supplierInvoicesModal && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center p-4 print:hidden"
          onClick={() => setSupplierInvoicesModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 bg-slate-50">
              <div className="text-right">
                <h3 className="text-lg font-black text-slate-900">
                  {en ? "Supplier Invoices" : "فواتير المورد"}
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  {supplierInvoicesModal.supplier ? supplierName(supplierInvoicesModal.supplier) : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierInvoicesModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-200"
                title={en ? "Close" : "إغلاق"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {supplierInvoicesModal.loading ? (
                <div className="p-8 text-center text-slate-500 font-bold">
                  {en ? "Loading invoices..." : "جاري تحميل فواتير المورد..."}
                </div>
              ) : (supplierInvoicesModal.invoices || []).length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  {en ? "No invoices for this supplier" : "لا توجد فواتير لهذا المورد"}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2.5 px-4">{en ? "Invoice No." : "رقم الفاتورة"}</th>
                        <th className="p-2.5 px-4">{en ? "Date" : "التاريخ"}</th>
                        <th className="p-2.5 px-4">{en ? "Total" : "الإجمالي"}</th>
                        <th className="p-2.5 px-4">{en ? "Paid" : "المدفوع"}</th>
                        <th className="p-2.5 px-4">{en ? "Remaining" : "المتبقي"}</th>
                        <th className="p-2.5 px-4">{en ? "Status" : "الحالة"}</th>
                        <th className="p-2.5 px-4 text-center">{en ? "View" : "عرض"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(supplierInvoicesModal.invoices || []).map((inv: any, i: number) => {
                        const total = Number(inv.total_amount || 0);
                        const paid = Number(inv.paid_amount || 0);
                        const remaining = Math.max(0, total - paid);
                        return (
                          <tr key={inv.id || i} className="hover:bg-orange-50/30">
                            <td className="p-2.5 px-4 font-mono font-bold text-slate-900">
                              {inv.invoice_number || `PINV-${String(inv.id).padStart(6, "0")}`}
                            </td>
                            <td className="p-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDate(inv.date)}</td>
                            <td className="p-2.5 px-4 font-mono text-slate-800">{num(total)} ج.م</td>
                            <td className="p-2.5 px-4 font-mono text-emerald-600">{num(paid)} ج.م</td>
                            <td className="p-2.5 px-4 font-mono text-rose-600">{num(remaining)} ج.م</td>
                            <td className="p-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  inv.payment_status === "paid"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : inv.payment_status === "partial" || inv.payment_status === "partially_paid"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {inv.payment_status === "paid"
                                  ? "مسدد"
                                  : inv.payment_status === "partial" || inv.payment_status === "partially_paid"
                                  ? "جزئي"
                                  : "غير مسدد"}
                              </span>
                            </td>
                            <td className="p-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => openInvoiceView(inv.id)}
                                title={en ? "View invoice" : "عرض الفاتورة"}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold text-[11px]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {en ? "View" : "عرض"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal (opened from the "عرض" button) */}
      {viewInvoiceModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 print:hidden"
          onClick={() => !viewInvoiceLoading && setViewInvoiceModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {viewInvoiceModal.loading ? (
              <div className="p-10 text-center text-slate-500 font-bold">
                {en ? "Loading invoice..." : "جاري تحميل الفاتورة..."}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 bg-slate-50">
                  <div className="text-right">
                    <h3 className="text-lg font-black text-slate-900">
                      {en ? "Purchase Invoice" : "فاتورة مشتريات"}{" "}
                      <span className="font-mono text-orange-600">
                        {viewInvoiceModal.invoice_number || `#${viewInvoiceModal.id}`}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                      {viewInvoiceModal.supplier_name || "-"}
                      {viewInvoiceModal.warehouse_name ? ` • 🏢 ${viewInvoiceModal.warehouse_name}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewInvoiceModal(null)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-200"
                    title={en ? "Close" : "إغلاق"}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto space-y-4 text-right">
                  {/* Meta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Invoice Date" : "تاريخ الفاتورة"}</div>
                      <div className="font-mono font-black text-slate-800 mt-1">{formatDate(viewInvoiceModal.date)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Due Date" : "تاريخ الاستحقاق"}</div>
                      <div className="font-mono font-black text-slate-800 mt-1">{viewInvoiceModal.due_date ? formatDate(viewInvoiceModal.due_date) : "-"}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Supplier Invoice No." : "فاتورة المورد"}</div>
                      <div className="font-mono font-black text-slate-800 mt-1">{viewInvoiceModal.supplier_invoice_number || "-"}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Payment Status" : "حالة السداد"}</div>
                      <div className="mt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            viewInvoiceModal.payment_status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : viewInvoiceModal.payment_status === "partial" || viewInvoiceModal.payment_status === "partially_paid"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {viewInvoiceModal.payment_status === "paid"
                            ? (en ? "Paid" : "مسدد بالكامل")
                            : viewInvoiceModal.payment_status === "partial" || viewInvoiceModal.payment_status === "partially_paid"
                            ? (en ? "Partially Paid" : "مسدد جزئياً")
                            : (en ? "Unpaid" : "غير مسدد")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Total" : "إجمالي الفاتورة"}</div>
                      <div className="font-mono font-black text-slate-900 mt-1">{num(viewInvoiceModal.total_amount)} ج.م</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Paid" : "المدفوع"}</div>
                      <div className="font-mono font-black text-emerald-600 mt-1">{num(viewInvoiceModal.paid_amount)} ج.م</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Remaining" : "المتبقي"}</div>
                      <div className="font-mono font-black text-rose-600 mt-1">
                        {num(Math.max(0, Number(viewInvoiceModal.total_amount || 0) - Number(viewInvoiceModal.paid_amount || 0)))} ج.م
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="text-slate-400 font-bold">{en ? "Tax" : "الضريبة"}</div>
                      <div className="font-mono font-black text-slate-700 mt-1">{num(viewInvoiceModal.tax_amount)} ج.م</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold">
                        <tr>
                          <th className="p-2.5 px-4">#</th>
                          <th className="p-2.5 px-4">{en ? "Item Code" : "كود الصنف"}</th>
                          <th className="p-2.5 px-4">{en ? "Item Name" : "اسم الصنف"}</th>
                          <th className="p-2.5 px-4">{en ? "Unit" : "الوحدة"}</th>
                          <th className="p-2.5 px-4">{en ? "Quantity" : "الكمية"}</th>
                          <th className="p-2.5 px-4">{en ? "Unit Price" : "سعر الوحدة"}</th>
                          <th className="p-2.5 px-4">{en ? "Total" : "الإجمالي"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(viewInvoiceModal.items || []).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                              {en ? "No items" : "لا توجد بنود"}
                            </td>
                          </tr>
                        ) : (
                          (viewInvoiceModal.items || []).map((it: any, i: number) => (
                            <tr key={it.id || i} className="hover:bg-orange-50/30">
                              <td className="p-2.5 px-4 font-mono text-slate-400">{i + 1}</td>
                              <td className="p-2.5 px-4 font-mono text-slate-600">{it.item_code || "-"}</td>
                              <td className="p-2.5 px-4 font-black text-slate-800">{it.ingredient_name || it.item_name || "-"}</td>
                              <td className="p-2.5 px-4 text-slate-600">{it.unit || "-"}</td>
                              <td className="p-2.5 px-4 font-mono font-bold text-blue-600">{num(it.quantity)}</td>
                              <td className="p-2.5 px-4 font-mono text-slate-700">{num(it.unit_price)} ج.م</td>
                              <td className="p-2.5 px-4 font-mono font-black text-slate-900">{num(it.total_price)} ج.م</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {(viewInvoiceModal.returns || []).length > 0 && (
                    <div className="text-xs bg-rose-50 border border-rose-200 rounded-xl p-3">
                      <b className="text-rose-700">{en ? "Returns" : "المرتجعات"}:</b>{" "}
                      {viewInvoiceModal.returns.map((r: any) => (
                        <span key={r.id} className="inline-block ml-2">
                          {r.return_number} ({num(r.total_amount)} ج.م) — {r.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .print\\:hidden { display: none !important; }
          .shadow-sm, .shadow-md { box-shadow: none !important; }
          table { font-size: 11px !important; width: 100% !important; }
          th, td { padding: 6px 8px !important; }
          .font-mono { font-family: Arial, sans-serif !important; }
        }
      `}</style>
    </div>
  );
}
