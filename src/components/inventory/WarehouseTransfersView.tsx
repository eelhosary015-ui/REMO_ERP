import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  ArrowLeftRight, 
  Plus, 
  RotateCcw, 
  Printer, 
  FileSpreadsheet, 
  Building2, 
  Truck, 
  PackageCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Boxes, 
  Calendar, 
  ArrowRight,
  ShieldCheck,
  Tag,
  Search,
  Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../../utils/api";
import { 
  WarehouseTransfer, 
  TransferItem, 
  TransferStats, 
  TransferStatus, 
  TransferType, 
  TransferPriority 
} from "./transfers/TransferTypes";
import { TransferKpiCards } from "./transfers/TransferKpiCards";
import { TransferFilterBar } from "./transfers/TransferFilterBar";
import { TransferCreateModal } from "./transfers/TransferCreateModal";
import { TransferApprovalModal } from "./transfers/TransferApprovalModal";
import { TransferDispatchModal } from "./transfers/TransferDispatchModal";
import { TransferReceiveModal } from "./transfers/TransferReceiveModal";
import { TransferDetailsModal } from "./transfers/TransferDetailsModal";
import { TransferPrintVoucher } from "./transfers/TransferPrintVoucher";

interface WarehouseOption {
  id: number;
  name: string;
  code: string;
  manager?: string;
  is_transit?: boolean;
}

interface IngredientOption {
  id: number;
  name: string;
  code: string;
  unit: string;
  barcode?: string;
  category?: string;
  avg_cost?: number;
  last_purchase_price?: number;
}

interface WarehouseTransfersViewProps {
  warehouses: WarehouseOption[];
  ingredients: IngredientOption[];
  onNotify?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const WarehouseTransfersView: React.FC<WarehouseTransfersViewProps> = ({
  warehouses,
  ingredients,
  onNotify,
}) => {
  const onNotifyRef = useRef(onNotify);
  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const notify = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    if (onNotifyRef.current) onNotifyRef.current(msg, type);
  }, []);

  // Main Data State
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [stats, setStats] = useState<TransferStats>({
    total: 0,
    pending_count: 0,
    approved_count: 0,
    in_transit_count: 0,
    receiving_count: 0,
    completed_count: 0,
    cancelled_count: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filter State
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("all");
  const [toWarehouseId, setToWarehouseId] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Modals State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState<boolean>(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);

  // Fetch Transfers Function
  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        tab: activeTab,
      });

      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      if (fromWarehouseId !== "all") params.append("from_warehouse_id", fromWarehouseId);
      if (toWarehouseId !== "all") params.append("to_warehouse_id", toWarehouseId);
      if (type !== "all") params.append("type", type);
      if (priority !== "all") params.append("priority", priority);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);

      const res = await api.get(`/api/enterprise/warehouse-transfers?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const transferList = data.transfers || data.data || [];
        setTransfers(transferList);
        if (data.stats) setStats(data.stats);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.total || 0);
        }
      } else {
        notify(data.error || "فشل في تحميل التحويلات المخزنية", "error");
      }
    } catch (err: any) {
      console.error("Error fetching warehouse transfers:", err);
      notify("حدث خطأ أثناء الاتصال بالخادم", "error");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, activeTab, debouncedSearch, fromWarehouseId, toWarehouseId, type, priority, dateFrom, dateTo, notify]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Tab change handler (resets page)
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setFromWarehouseId("all");
    setToWarehouseId("all");
    setType("all");
    setPriority("all");
    setDateFrom("");
    setDateTo("");
    setActiveTab("all");
    setPage(1);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (transfers.length === 0) {
      notify("لا توجد بيانات متاحة للتصدير", "info");
      return;
    }

    const rows = transfers.map((t, idx) => ({
      "#": idx + 1,
      "رقم التحويل": t.transfer_number || t.transfer_no,
      "التاريخ": t.date,
      "من مخزن": t.from_warehouse_name,
      "إلى مخزن": t.to_warehouse_name,
      "النوع": t.type,
      "الأولوية": t.priority,
      "الحالة": t.status,
      "عدد البنود": t.items_count,
      "إجمالي الكمية": t.total_qty,
      "السائق": t.driver_name || "",
      "بوليصة الشحن": t.waybill_no || "",
      "المستخدم": t.user || "",
      "ملاحظات": t.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التحويلات المخزنية");
    XLSX.writeFile(wb, `warehouse_transfers_${new Date().toISOString().split("T")[0]}.xlsx`);
    notify("تم تصدير ملف الإكسيل بنجاح", "success");
  };

  // Workflow Handlers
  const handleCreateSubmit = async (payload: any) => {
    const res = await api.post("/api/enterprise/warehouse-transfers", payload);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل في حفظ التحويل");
    }
    if (data.posted) {
      notify("تم اعتماد التحويل وترحيل الأصناف إلى المخزن المستهدف بنجاح", "success");
    } else {
      notify("تم حفظ وإرسال طلب التحويل بنجاح", "success");
    }
    await fetchTransfers();
  };

  const handleApprove = async (id: number, payload: any) => {
    const res = await api.put(`/api/enterprise/warehouse-transfers/${id}/approve`, payload);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل في اعتماد التحويل");
    }
    notify("تم اعتماد التحويل المخزني بنجاح وجاهز للصرف", "success");
    fetchTransfers();
  };

  const handleReject = async (id: number, reason: string) => {
    const res = await api.put(`/api/enterprise/warehouse-transfers/${id}/reject`, { reason });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل في رفض التحويل");
    }
    notify("تم رفض طلب التحويل وتسجيل السبب في سجل التدقيق", "info");
    fetchTransfers();
  };

  const handleDispatch = async (id: number, payload: any) => {
    const res = await api.put(`/api/enterprise/warehouse-transfers/${id}/dispatch`, payload);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل في صرف وتحويل الشحنة");
    }
    notify("تم تأكيد الصرف وبدء النقل (In-Transit) بنجاح", "success");
    fetchTransfers();
  };

  const handleReceive = async (id: number, payload: any) => {
    const res = await api.put(`/api/enterprise/warehouse-transfers/${id}/receive`, payload);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل في تسجيل استلام وفحص الشحنة");
    }
    notify("تم استلام وفحص الشحنة وإيداع الأرصدة بالمخزن المستلم بنجاح", "success");
    fetchTransfers();
  };

  const handleCancel = async (id: number, reason: string) => {
    const res = await api.put(`/api/enterprise/warehouse-transfers/${id}/cancel`, { reason });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل في إلغاء التحويل");
    }
    notify("تم إلغاء وعكس التحويل المخزني بنجاح", "success");
    fetchTransfers();
  };

  // Status Styling Helpers
  const getStatusBadge = (status: TransferStatus | string) => {
    switch (status) {
      case "draft":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground"><Clock className="w-3 h-3" /> مسودة</span>;
      case "requested":
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300"><Clock className="w-3 h-3" /> قيد المراجعة والاعتماد</span>;
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"><CheckCircle2 className="w-3 h-3" /> معتمد - جاهز للتجهيز</span>;
      case "picking":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300"><Boxes className="w-3 h-3" /> قيد التجهيز والصرف</span>;
      case "dispatched":
      case "in_transit":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 animate-pulse"><Truck className="w-3 h-3" /> في الطريق (In-Transit)</span>;
      case "receiving":
      case "qc_inspection":
      case "received_partially":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-700 dark:text-teal-300"><PackageCheck className="w-3 h-3" /> قيد الاستلام وفحص QC</span>;
      case "received":
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" /> مكتمل ومودع</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300"><XCircle className="w-3 h-3" /> مرفوض</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive"><XCircle className="w-3 h-3" /> ملغي ومسترد</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{status}</span>;
    }
  };

  const getPriorityBadge = (p: TransferPriority | string) => {
    switch (p) {
      case "urgent":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300">طارئ</span>;
      case "high":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">عالي</span>;
      case "low":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">منخفض</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300">عادي</span>;
    }
  };

  const getTypeLabel = (t: string) => {
    switch (t) {
      case "standard": return "قياسي";
      case "urgent": return "طارئ";
      case "replenishment": return "تموين دوري";
      case "inter_branch": return "بين الفروع";
      case "department_issue": return "صرف تشغيلي";
      case "return_to_hub": return "إرجاع للمركزي";
      case "damaged_transfer": return "توالف / حجر";
      default: return t || "قياسي";
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl" id="enterprise-warehouse-transfers-view">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white shadow-md">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-foreground tracking-tight">
                التحويل بين المخازن (Warehouse Transfer Management)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                نظام التحويلات المتقدم (Enterprise End-to-End)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              إدارة وتتبع دورة حياة التحويلات المخزنية: طلب ← اعتماد ← تجهيز وصرف ← نقل بالأركود ← فحص الجودة (QC) ← إيداع بالمخزن
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-top-new-transfer"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer hover:scale-[1.02] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>طلب تحويل جديد</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <TransferKpiCards
        stats={stats}
        activeTab={activeTab}
        onTabSelect={handleTabChange}
      />

      {/* Filter Bar */}
      <TransferFilterBar
        search={search}
        onSearchChange={setSearch}
        fromWarehouseId={fromWarehouseId}
        onFromWarehouseChange={setFromWarehouseId}
        toWarehouseId={toWarehouseId}
        onToWarehouseChange={setToWarehouseId}
        type={type}
        onTypeChange={setType}
        priority={priority}
        onPriorityChange={setPriority}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        warehouses={warehouses}
        onResetFilters={handleResetFilters}
        onRefresh={fetchTransfers}
        onNewTransfer={() => setIsCreateOpen(true)}
        onExportExcel={handleExportExcel}
        isLoading={isLoading}
      />

      {/* Main Transfers Data Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-muted/40 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            <span>سجل وأوامر التحويل المخزني</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono">
              {totalCount} تحويل
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>جاري تحميل البيانات...</span>
            </div>
          )}
        </div>

        {transfers.length === 0 && !isLoading ? (
          <div className="p-14 text-center text-muted-foreground flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm border border-primary/20">
              <ArrowLeftRight className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-foreground">لا توجد تحويلات مخزنية مطابقة</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
              لم يتم العثور على أي أوامر تحويل في هذه الفئة أو وفق خيارات التصفية الحالية. يمكنك البدء بإنشاء أول أمر تحويل مخزني الآن.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء أول طلب تحويل</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b border-border font-semibold">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[150px]">رقم التحويل والتاريخ</th>
                  <th className="py-3 px-4 min-w-[220px]">مسار التحويل (من ← إلى)</th>
                  <th className="py-3 px-4 min-w-[120px]">النوع والأولوية</th>
                  <th className="py-3 px-4 w-28 text-center">البنود والكميات</th>
                  <th className="py-3 px-4 min-w-[140px]">البيانات اللوجستية</th>
                  <th className="py-3 px-4 min-w-[160px]">حالة التحويل والمرحلة</th>
                  <th className="py-3 px-4 min-w-[140px] text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transfers.map((t, idx) => {
                  const itemsList = typeof t.items === "string" ? JSON.parse(t.items || "[]") : (t.items || []);
                  const itemsCount = t.items_count ?? itemsList.length;
                  const totalQty = t.total_qty ?? itemsList.reduce((s: number, i: any) => s + Number(i.requested_qty || i.quantity || 0), 0);

                  return (
                    <tr 
                      key={t.id ? `transfer-${t.id}-${idx}` : `transfer-row-${idx}`} 
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedTransfer(t);
                        setIsDetailsOpen(true);
                      }}
                    >
                      {/* Row Index */}
                      <td className="py-3 px-4 text-center text-muted-foreground font-mono">
                        {(page - 1) * limit + idx + 1}
                      </td>

                      {/* Transfer No & Date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-foreground font-mono text-xs group-hover:text-primary transition-colors">
                            {t.transfer_number || t.transfer_no}
                          </strong>
                          {getPriorityBadge(t.priority)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span className="font-mono">{t.date}</span>
                        </div>
                      </td>

                      {/* Route (From -> To) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block">المصدر (الصرف):</span>
                            <strong className="text-foreground text-xs block">{t.from_warehouse_name || `مخزن #${t.from_warehouse_id}`}</strong>
                          </div>

                          <div className="px-1 text-primary">
                            <ArrowRight className="w-4 h-4 rotate-180" />
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block">المستهدف (الاستلام):</span>
                            <strong className="text-foreground text-xs block">{t.to_warehouse_name || `مخزن #${t.to_warehouse_id}`}</strong>
                          </div>
                        </div>
                      </td>

                      {/* Type & Priority */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-foreground font-medium block">
                          {getTypeLabel(t.type)}
                        </span>
                        {t.department && (
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[120px]">
                            {t.department}
                          </span>
                        )}
                      </td>

                      {/* Items & Qty */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground font-mono font-bold text-xs">
                          <Boxes className="w-3 h-3 text-muted-foreground" />
                          {itemsCount} بنود
                        </span>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          الكمية: {totalQty}
                        </div>
                      </td>

                      {/* Logistics Info */}
                      <td className="py-3 px-4">
                        {t.driver_name ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-xs text-foreground font-medium">
                              <Truck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span className="truncate max-w-[110px]">{t.driver_name}</span>
                            </div>
                            {t.waybill_no && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                بوليصة: {t.waybill_no}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(t.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* Contextual Action Button based on status */}
                          {["draft", "requested", "pending"].includes(t.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTransfer(t);
                                setIsApproveOpen(true);
                              }}
                              className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="مراجعة واعتماد التحويل"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {["approved", "picking"].includes(t.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTransfer(t);
                                setIsDispatchOpen(true);
                              }}
                              className="p-1.5 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="تجهيز وصرف الشحنة (Dispatch)"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          )}

                          {["dispatched", "in_transit", "receiving", "qc_inspection", "received_partially"].includes(t.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTransfer(t);
                                setIsReceiveOpen(true);
                              }}
                              className="p-1.5 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="استلام وفحص الجودة (Receive & QC)"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Print Voucher */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTransfer(t);
                              setIsPrintOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                            title="طباعة سند التحويل والبوليصة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* View Details Drawer */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTransfer(t);
                              setIsDetailsOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                            title="عرض التفاصيل وسجل المراجعة"
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
        )}

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-border bg-muted/20 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>عرض</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="py-1 px-2 bg-background border border-border rounded text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>من إجمالي {totalCount} سجل</span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 border border-border hover:bg-muted text-foreground rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-mono font-medium text-foreground">
                صفحة {page} من {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 border border-border hover:bg-muted text-foreground rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals & Drawers */}
      <TransferCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        warehouses={warehouses}
        ingredients={ingredients}
        onNotify={notify}
      />

      <TransferApprovalModal
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        transfer={selectedTransfer}
        onApprove={handleApprove}
        onReject={handleReject}
        onNotify={notify}
      />

      <TransferDispatchModal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        transfer={selectedTransfer}
        onDispatch={handleDispatch}
        onNotify={notify}
      />

      <TransferReceiveModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        transfer={selectedTransfer}
        onReceive={handleReceive}
        onNotify={notify}
      />

      <TransferDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        transfer={selectedTransfer}
        onPrint={(t) => {
          setSelectedTransfer(t);
          setIsPrintOpen(true);
        }}
        onOpenApproveModal={(t) => {
          setSelectedTransfer(t);
          setIsApproveOpen(true);
        }}
        onOpenDispatchModal={(t) => {
          setSelectedTransfer(t);
          setIsDispatchOpen(true);
        }}
        onOpenReceiveModal={(t) => {
          setSelectedTransfer(t);
          setIsReceiveOpen(true);
        }}
        onCancelTransfer={handleCancel}
        onNotify={notify}
      />

      <TransferPrintVoucher
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        transfer={selectedTransfer}
      />

    </div>
  );
};
