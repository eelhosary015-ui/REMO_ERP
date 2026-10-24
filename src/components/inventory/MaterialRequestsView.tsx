import React, { useState, useEffect, useMemo } from "react";
import {
  FileText, Plus, Search, RefreshCw, Send, CheckCircle2,
  XCircle, Clock, AlertTriangle, Building, Briefcase, UserCheck,
  PackageCheck, AlertCircle, Calendar, Printer, Eye, Check,
  Layers, Flame, SlidersHorizontal, Trash2,
  Warehouse, Hash, User, CheckCheck, FileSpreadsheet, ShieldAlert,
  ArrowRightLeft, Sparkles, HelpCircle, ChevronDown, Download
} from "lucide-react";
import { apiFetch } from "../../utils/api";
import { CreateMaterialRequestPage } from "./CreateMaterialRequestPage";

interface MaterialRequestsViewProps {
  warehouses: any[];
  ingredients: any[];
  onNotify: (msg: string, type: "success" | "error") => void;
}

export const MaterialRequestsView: React.FC<MaterialRequestsViewProps> = ({
  warehouses = [],
  ingredients = [],
  onNotify
}) => {
  // State
  const [requests, setRequests] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({
    total_month: 0,
    pending_approval: 0,
    pending_issue: 0,
    urgent_overdue: 0,
    total_month_value: 0
  });
  const [loading, setLoading] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedWh, setSelectedWh] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Modals & full-page views
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [activeDetailsId, setActiveDetailsId] = useState<number | null>(null);
  const [detailedRequest, setDetailedRequest] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueFormData, setIssueFormData] = useState<{
    recipient_name: string;
    notes: string;
    items: { [itemId: number]: number };
  }>({
    recipient_name: "",
    notes: "",
    items: {}
  });

  const openCreatePage = () => setShowCreatePage(true);

  // Fetch KPIs
  const fetchKpis = async () => {
    setKpiLoading(true);
    try {
      const kpiParams = selectedWh !== "all" ? `?warehouse_id=${selectedWh}` : "";
      const res = await apiFetch(`/api/material-requests/kpis${kpiParams}`);
      const data = await res.json();
      if (data.success && data.kpis) {
        setKpis(data.kpis);
      }
    } catch {
      // ignore silently
    } finally {
      setKpiLoading(false);
    }
  };

  // Fetch Material Requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedWh !== "all") params.append("warehouse_id", selectedWh);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("request_type", typeFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (search) params.append("search", search);
      if (dateFrom) params.append("start_date", dateFrom);
      if (dateTo) params.append("end_date", dateTo);

      const res = await apiFetch(`/api/material-requests?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.material_requests || []);
      } else {
        onNotify(data.error || "تعذر جلب طلبات المواد", "error");
      }
    } catch {
      onNotify("فشل تحميل طلبات المواد من الخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
    fetchRequests();
  }, [selectedWh, statusFilter, typeFilter, priorityFilter, dateFrom, dateTo]);

  // Fetch Single Request Details
  const openRequestDetails = async (id: number) => {
    setActiveDetailsId(id);
    setLoadingDetails(true);
    try {
      const res = await apiFetch(`/api/material-requests/${id}`);
      const data = await res.json();
      if (data.success && data.request) {
        setDetailedRequest({
          ...data.request,
          items: data.items || []
        });
      } else {
        onNotify(data.error || "تعذر تحميل تفاصيل الطلب", "error");
      }
    } catch {
      onNotify("خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Issue Modal
  const openIssueModal = (req: any) => {
    setDetailedRequest(req);
    const initialItems: { [itemId: number]: number } = {};
    (req.items || []).forEach((it: any) => {
      const remaining = Math.max(0, Number(it.approved_qty || it.requested_qty || 0) - Number(it.issued_qty || 0));
      initialItems[it.id] = remaining;
    });
    setIssueFormData({
      recipient_name: req.department || "",
      notes: "صرف المواد للمستلم بناءً على الاعتماد",
      items: initialItems
    });
    setShowIssueModal(true);
  };

  // Action: Approve Dept
  const handleApproveDept = async (id: number) => {
    try {
      const res = await apiFetch(`/api/material-requests/${id}/approve-dept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "مدير القسم / التشغيل" })
      });
      const data = await res.json();
      if (data.success) {
        onNotify("تم اعتماد الطلب من مدير القسم وإحالته للمخزن", "success");
        fetchKpis();
        fetchRequests();
        if (activeDetailsId === id) openRequestDetails(id);
      } else {
        onNotify(data.error || "فشل الاعتماد", "error");
      }
    } catch {
      onNotify("خطأ في الاتصال بالخادم", "error");
    }
  };

  // Action: Approve Warehouse
  const handleApproveWh = async (id: number) => {
    try {
      const res = await apiFetch(`/api/material-requests/${id}/approve-wh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "مدير المخازن" })
      });
      const data = await res.json();
      if (data.success) {
        onNotify("تم اعتماد الطلب مخزنياً وتثبيت حجز الكميات بنجاح", "success");
        fetchKpis();
        fetchRequests();
        if (activeDetailsId === id) openRequestDetails(id);
      } else {
        onNotify(data.error || "فشل الاعتماد المخزني", "error");
      }
    } catch {
      onNotify("خطأ في الاتصال بالخادم", "error");
    }
  };

  // Action: Issue Materials
  const handleExecuteIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedRequest) return;
    try {
      const itemsPayload = Object.entries(issueFormData.items).map(([itemId, qty]) => ({
        id: Number(itemId),
        issue_qty: Number(qty)
      })).filter(it => it.issue_qty > 0);

      if (itemsPayload.length === 0) {
        onNotify("يرجى تحديد كمية صالحة للصرف لواحد أو أكثر من الأصناف", "error");
        return;
      }

      const res = await apiFetch(`/api/material-requests/${detailedRequest.id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: "أمين المخزن",
          recipient_name: issueFormData.recipient_name,
          notes: issueFormData.notes,
          items: itemsPayload
        })
      });
      const data = await res.json();
      if (data.success) {
        onNotify(data.message || "تم صرف المواد بنجاح وخصمها من رصيد المخزن وتسجيل القيد", "success");
        setShowIssueModal(false);
        fetchKpis();
        fetchRequests();
        // Reload the sheet so the approved/issued quantities are not stale.
        setActiveDetailsId(detailedRequest.id);
        openRequestDetails(detailedRequest.id);
      } else {
        onNotify(data.error || "فشل تنفيذ الصرف", "error");
      }
    } catch {
      onNotify("خطأ أثناء تنفيذ الصرف", "error");
    }
  };

  // Helper Labels & Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200"><Clock className="w-3 h-3" /> مسودة</span>;
      case "pending_dept":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"><Clock className="w-3 h-3 text-amber-600" /> بانتظار اعتماد القسم</span>;
      case "pending_wh":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200"><Warehouse className="w-3 h-3 text-blue-600" /> بانتظار اعتماد المخزن</span>;
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200"><PackageCheck className="w-3 h-3 text-indigo-600" /> معتمد / جاهز للصرف</span>;
      case "partially_issued":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200"><ArrowRightLeft className="w-3 h-3 text-cyan-600" /> تم الصرف جزئياً</span>;
      case "issued":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> تم الصرف كلياً</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200"><XCircle className="w-3 h-3 text-red-600" /> مرفوض</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200"><XCircle className="w-3 h-3 text-slate-400" /> ملغي</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string, isOverdue: boolean) => {
    if (priority === "urgent" || isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-800 border border-red-300 animate-pulse">
          <Flame className="w-3 h-3 text-red-600 fill-red-500" /> عاجل {isOverdue ? "(متأخر!)" : ""}
        </span>
      );
    }
    if (priority === "high") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
          <AlertCircle className="w-3 h-3 text-orange-600" /> مرتفع
        </span>
      );
    }
    if (priority === "medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
          متوسط
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        عادي
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "production":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><Layers className="w-3 h-3" /> تشغيل وإنتاج</span>;
      case "operational":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><Building className="w-3 h-3" /> استهلاك تشغيلي</span>;
      case "maintenance":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" /> صيانة وإصلاح</span>;
      case "custody":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><UserCheck className="w-3 h-3" /> صرف عهدة</span>;
      case "project":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200"><Briefcase className="w-3 h-3" /> مشروع / فرع جديد</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">{type || "صرف عام"}</span>;
    }
  };

  // Client-side quick filter
  const filteredList = useMemo(() => {
    return requests.filter(r => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        r.request_no?.toLowerCase().includes(s) ||
        r.department?.toLowerCase().includes(s) ||
        r.cost_center?.toLowerCase().includes(s) ||
        r.work_order_no?.toLowerCase().includes(s) ||
        r.notes?.toLowerCase().includes(s)
      );
    });
  }, [requests, search]);

  if (showCreatePage) {
    return (
      <CreateMaterialRequestPage
        warehouses={warehouses}
        onBack={() => setShowCreatePage(false)}
        onCreated={() => {
          setShowCreatePage(false);
          fetchKpis();
          fetchRequests();
        }}
        onNotify={onNotify}
      />
    );
  }

  return (
    <div className="space-y-6" dir="rtl" id="material-requests-page">
      {/* ── Top Header Bar ── */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">طلبات وصرف المواد للأقسام والتشغيل</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-black rounded-md">Material Requisitions</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة طلبات الصرف الدورية، أوامر الشغل، مراكز التكلفة، والصيانة مع دورة اعتماد وحجز وصرف مخزني لحظي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreatePage}
            id="btn-new-material-request"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm transition-all shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> طلب صرف مواد جديد
          </button>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="material-requests-kpis">
        {/* Total Month */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500">إجمالي طلبات الشهر</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{kpis.total_month || 0}</span>
              <span className="text-xs font-semibold text-slate-400">طلب</span>
            </div>
            <p className="text-[11px] text-blue-600 font-medium font-mono">
              قيمة: {Number(kpis.total_month_value || 0).toLocaleString()} ج.م
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-700">بانتظار الاعتماد</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-800">{kpis.pending_approval || 0}</span>
              <span className="text-xs font-semibold text-amber-600">طلب</span>
            </div>
            <p className="text-[11px] text-amber-600">اعتماد قسم أو مخزن</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Issue */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-700">معتمد وجاهز للصرف</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-900">{kpis.pending_issue || 0}</span>
              <span className="text-xs font-semibold text-indigo-600">طلب</span>
            </div>
            <p className="text-[11px] text-indigo-600">محجوز وبانتظار الإخراج</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Urgent & Overdue */}
        <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-red-700">طلبات عاجلة / متأخرة</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-red-800">{kpis.urgent_overdue || 0}</span>
              <span className="text-xs font-semibold text-red-600">طلب حرِج</span>
            </div>
            <p className="text-[11px] text-red-600 font-bold">تتطلب إجراءً فورياً</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center border border-red-200">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3" id="material-requests-filter-bar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث برقم الطلب، القسم، مركز التكلفة، أمر الشغل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Warehouse */}
          <div>
            <select
              value={selectedWh}
              onChange={(e) => setSelectedWh(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white outline-none"
            >
              <option value="all">🏢 جميع المخازن</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white outline-none"
            >
              <option value="all">⚡ جميع الحالات</option>
              <option value="draft">مسودة (Draft)</option>
              <option value="pending_dept">بانتظار اعتماد القسم</option>
              <option value="pending_wh">بانتظار اعتماد المخزن</option>
              <option value="approved">معتمد / جاهز للصرف</option>
              <option value="partially_issued">تم الصرف جزئياً</option>
              <option value="issued">تم الصرف كلياً</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>

          {/* Request Type */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white outline-none"
            >
              <option value="all">📋 نوع الطلب (الكل)</option>
              <option value="production">تشغيل وإنتاج</option>
              <option value="operational">استهلاك تشغيلي</option>
              <option value="maintenance">صيانة وإصلاح</option>
              <option value="custody">صرف عهدة</option>
              <option value="project">مشروع / توسع</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white outline-none"
            >
              <option value="all">🎯 الأولوية (الكل)</option>
              <option value="urgent">🔥 عاجل جداً</option>
              <option value="high">⚡ مرتفع</option>
              <option value="medium">متوسط</option>
              <option value="low">عادي / منخفض</option>
            </select>
          </div>
        </div>

        {/* Date Row & Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>من تاريخ:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none"
            />
            <span>إلى تاريخ:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none"
            />
            {(dateFrom || dateTo || statusFilter !== "all" || typeFilter !== "all" || priorityFilter !== "all" || selectedWh !== "all" || search) && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedWh("all");
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setPriorityFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-red-500 hover:text-red-700 font-bold mr-2 text-[11px]"
              >
                إعادة ضبط الفلاتر ✕
              </button>
            )}
          </div>

          <button
            onClick={() => {
              fetchKpis();
              fetchRequests();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* ── Material Requests Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="material-requests-table">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 text-xs font-black border-b border-slate-200">
                <th className="p-4">رقم الطلب</th>
                <th className="p-4">التاريخ والاحتياج</th>
                <th className="p-4">المخزن المطلوب منه</th>
                <th className="p-4">القسم / مركز التكلفة</th>
                <th className="p-4">نوع الطلب</th>
                <th className="p-4">الأصناف / الكمية</th>
                <th className="p-4">الأولوية</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    جاري تحميل طلبات صرف المواد...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100">
                        <FileText className="w-8 h-8 opacity-60" />
                      </div>
                      <h4 className="text-base font-bold text-slate-800">لا توجد طلبات صرف مطابقة</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        لم يتم العثور على طلبات صرف تطابق معايير البحث والفلترة المحددة. اضغط على زر "طلب صرف مواد جديد" لإنشاء طلب لقسمك.
                      </p>
                      <button
                        onClick={openCreatePage}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> إنشاء طلب صرف الآن
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((r) => {
                  const isUrgent = r.priority === "urgent";
                  const isOverdue = Boolean(r.is_overdue);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        isUrgent ? "bg-red-50/20" : isOverdue ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Request No */}
                      <td className="p-4">
                        <button
                          onClick={() => openRequestDetails(r.id)}
                          className="font-mono font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                          title="عرض تفاصيل الطلب"
                        >
                          <Hash className="w-3.5 h-3.5 text-blue-400" />
                          <span>{r.request_no}</span>
                        </button>
                        {r.work_order_no && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono block mt-1 w-fit">
                            شغل: {r.work_order_no}
                          </span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-800 font-bold block">
                            {new Date(r.request_date || r.created_at).toLocaleDateString("ar-EG")}
                          </span>
                          {r.needed_date && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              مطلوب: {new Date(r.needed_date).toLocaleDateString("ar-EG")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Warehouse */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Warehouse className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-800 text-xs">{r.warehouse_name || "المخزن الرئيسي"}</span>
                        </div>
                      </td>

                      {/* Department / Cost Center */}
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block text-xs">{r.department || "عام"}</span>
                        {r.cost_center && (
                          <span className="text-[11px] font-mono text-slate-500 block">
                            {r.cost_center}
                          </span>
                        )}
                      </td>

                      {/* Request Type */}
                      <td className="p-4">
                        {getTypeBadge(r.request_type)}
                      </td>

                      {/* Items Count & Total Qty */}
                      <td className="p-4">
                        <div className="font-mono text-xs">
                          <span className="font-bold text-slate-800">{r.items_count || 0} صنف</span>
                          <span className="text-slate-500 block text-[11px]">
                            ({Number(r.total_qty || 0).toLocaleString()} وحدة)
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="p-4">
                        {getPriorityBadge(r.priority, isOverdue)}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {getStatusBadge(r.status)}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View details button */}
                          <button
                            onClick={() => openRequestDetails(r.id)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="عرض تفاصيل الطلب"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Dept Approval */}
                          {r.status === "pending_dept" && (
                            <button
                              onClick={() => handleApproveDept(r.id)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                              title="اعتماد مدير القسم"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> اعتماد قسم
                            </button>
                          )}

                          {/* WH Approval */}
                          {r.status === "pending_wh" && (
                            <button
                              onClick={() => handleApproveWh(r.id)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                              title="اعتماد وحجز المخزون"
                            >
                              <PackageCheck className="w-3.5 h-3.5" /> اعتماد مخزن
                            </button>
                          )}

                          {/* Issue Button */}
                          {(r.status === "approved" || r.status === "partially_issued") && (
                            <button
                              onClick={() => openIssueModal(r)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                              title="صرف المواد للمستلم"
                            >
                              <Send className="w-3.5 h-3.5" /> صرف المواد
                            </button>
                          )}
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

      {/* ── Modal: Request Details & Lifecycle ── */}
      {detailedRequest && !showIssueModal && !showPrintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">تفاصيل طلب صرف المواد {detailedRequest.request_no}</h3>
                    {getStatusBadge(detailedRequest.status)}
                  </div>
                  <p className="text-xs text-slate-500">
                    تاريخ الطلب: {new Date(detailedRequest.request_date || detailedRequest.created_at).toLocaleDateString("ar-EG")} | المخزن: {detailedRequest.warehouse_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailedRequest(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">القسم / مركز التكلفة</span>
                <span className="font-bold text-slate-800">{detailedRequest.department}</span>
                {detailedRequest.cost_center && <span className="font-mono text-slate-500 block text-[10px]">{detailedRequest.cost_center}</span>}
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">نوع الطلب</span>
                <span className="font-bold text-slate-800">{detailedRequest.request_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">أمر الشغل / الصيانة</span>
                <span className="font-mono font-bold text-slate-800">{detailedRequest.work_order_no || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">الأولوية</span>
                <span className="font-bold text-slate-800">{getPriorityBadge(detailedRequest.priority, Boolean(detailedRequest.is_overdue))}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" /> الأصناف والكميات
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">الصنف</th>
                      <th className="p-3 text-center">الكمية المطلوبة</th>
                      <th className="p-3 text-center">الكمية المعتمدة</th>
                      <th className="p-3 text-center">الكمية المصروفة</th>
                      <th className="p-3 text-center">المخزون المتاح</th>
                      <th className="p-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(detailedRequest.items || []).map((it: any, idx: number) => {
                      const onHand = Number(it.on_hand_qty ?? it.available_qty ?? 0);
                      const isStockShortage = onHand < Number(it.requested_qty || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">
                            {it.ingredient_name || it.item_name}
                            <span className="text-[10px] text-slate-400 font-mono block">{it.ingredient_code || it.item_code || ""}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-800">
                            {it.requested_qty} {it.uom || it.ingredient_unit}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-blue-600">
                            {it.approved_qty ?? it.requested_qty} {it.uom || it.ingredient_unit}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">
                            {it.issued_qty || 0} {it.uom || it.ingredient_unit}
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${isStockShortage ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {onHand}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">{it.purpose || it.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval Workflow Trail */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
                <CheckCheck className="w-4 h-4 text-blue-600" /> مسار وسجل الاعتماد
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">1. إنشاء الطلب</span>
                  <span className="font-bold text-slate-800 block">{detailedRequest.department}</span>
                  <span className="text-[10px] text-slate-400">{new Date(detailedRequest.created_at).toLocaleTimeString("ar-EG")}</span>
                </div>
                <div className={`p-2.5 rounded-xl border ${detailedRequest.approved_by_dept ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-slate-100"}`}>
                  <span className="text-[10px] text-slate-400 block">2. اعتماد مدير القسم</span>
                  <span className="font-bold text-slate-800 block">{detailedRequest.approved_by_dept || "قيد الانتظار"}</span>
                  {detailedRequest.approved_dept_at && <span className="text-[10px] text-slate-400">{new Date(detailedRequest.approved_dept_at).toLocaleTimeString("ar-EG")}</span>}
                </div>
                <div className={`p-2.5 rounded-xl border ${detailedRequest.approved_by_wh ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-slate-100"}`}>
                  <span className="text-[10px] text-slate-400 block">3. اعتماد مدير المخزن وحجز الرصيد</span>
                  <span className="font-bold text-slate-800 block">{detailedRequest.approved_by_wh || "قيد الانتظار"}</span>
                  {detailedRequest.approved_wh_at && <span className="text-[10px] text-slate-400">{new Date(detailedRequest.approved_wh_at).toLocaleTimeString("ar-EG")}</span>}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPrintModal(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> طباعة إذن الصرف
              </button>

              <div className="flex items-center gap-2">
                {detailedRequest.status === "pending_dept" && (
                  <button
                    onClick={() => handleApproveDept(detailedRequest.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" /> اعتماد مدير القسم
                  </button>
                )}

                {detailedRequest.status === "pending_wh" && (
                  <button
                    onClick={() => handleApproveWh(detailedRequest.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" /> اعتماد وتثبيت حجز المخزون
                  </button>
                )}

                {(detailedRequest.status === "approved" || detailedRequest.status === "partially_issued") && (
                  <button
                    onClick={() => openIssueModal(detailedRequest)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Send className="w-4 h-4" /> صرف المواد وخصم المخزون
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Issue Material & Deduction ── */}
      {showIssueModal && detailedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تنفيذ صرف المواد وإخراجها من المخزن</h3>
                  <p className="text-xs text-slate-500">طلب رقم: {detailedRequest.request_no}</p>
                </div>
              </div>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-700 p-2">✕</button>
            </div>

            <form onSubmit={handleExecuteIssue} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المستلم الفعلي *</label>
                  <input
                    type="text"
                    required
                    value={issueFormData.recipient_name}
                    onChange={(e) => setIssueFormData({ ...issueFormData, recipient_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    placeholder="مثال: أحمد عبد الله (مشرف الوردية)"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات سند الإخراج</label>
                  <input
                    type="text"
                    value={issueFormData.notes}
                    onChange={(e) => setIssueFormData({ ...issueFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    placeholder="ملاحظات الصرف..."
                  />
                </div>
              </div>

              {/* Items Qty to Issue */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">الكميات المحددة للصرف الآن:</label>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 font-bold border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-3">الصنف</th>
                        <th className="p-3 text-center">المعتمد</th>
                        <th className="p-3 text-center">المصروف سابقاً</th>
                        <th className="p-3 text-center">الكمية للصرف الآن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailedRequest.items || []).map((it: any) => {
                        const approved = Number(it.approved_qty || it.requested_qty || 0);
                        const alreadyIssued = Number(it.issued_qty || 0);
                        const maxRemaining = Math.max(0, approved - alreadyIssued);

                        return (
                          <tr key={it.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{it.ingredient_name || it.item_name}</td>
                            <td className="p-3 text-center font-mono">{approved} {it.uom || it.ingredient_unit}</td>
                            <td className="p-3 text-center font-mono text-emerald-600">{alreadyIssued}</td>
                            <td className="p-3 text-center w-36">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={maxRemaining}
                                value={issueFormData.items[it.id] ?? maxRemaining}
                                onChange={(e) => setIssueFormData({
                                  ...issueFormData,
                                  items: {
                                    ...issueFormData.items,
                                    [it.id]: Number(e.target.value)
                                  }
                                })}
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-emerald-700"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md"
                >
                  ✓ تأكيد الصرف وخصم المخزون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Print Voucher / Requisition Slip ── */}
      {showPrintModal && detailedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border border-slate-200 text-slate-900" id="printable-requisition-slip">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-base">إذن صرف مواد ومهمات (Material Issue Slip)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                >
                  طباعة
                </button>
                <button onClick={() => setShowPrintModal(false)} className="text-slate-400 p-1">✕</button>
              </div>
            </div>

            <div className="p-4 border border-slate-300 rounded-xl space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-black text-sm">شركة المطاعم والضيافة الحديثة</h4>
                  <p className="text-slate-500">إدارة المخازن والمستودعات</p>
                </div>
                <div className="text-left font-mono">
                  <p className="font-black text-sm text-blue-600">{detailedRequest.request_no}</p>
                  <p className="text-slate-500">التاريخ: {new Date(detailedRequest.request_date || detailedRequest.created_at).toLocaleDateString("ar-EG")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <p><strong>المخزن المنصرف منه:</strong> {detailedRequest.warehouse_name}</p>
                <p><strong>القسم الطالب:</strong> {detailedRequest.department}</p>
                <p><strong>مركز التكلفة:</strong> {detailedRequest.cost_center || "—"}</p>
                <p><strong>أمر الشغل / الصيانة:</strong> {detailedRequest.work_order_no || "—"}</p>
              </div>

              <table className="w-full text-right border border-slate-300 text-xs">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="p-2 border border-slate-300">م</th>
                    <th className="p-2 border border-slate-300">الصنف</th>
                    <th className="p-2 border border-slate-300 text-center">المطلوب</th>
                    <th className="p-2 border border-slate-300 text-center">المصروف</th>
                    <th className="p-2 border border-slate-300">الوحدة</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailedRequest.items || []).map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 border border-slate-300 text-center font-mono">{i + 1}</td>
                      <td className="p-2 border border-slate-300 font-bold">{it.ingredient_name || it.item_name}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{it.requested_qty}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">{it.issued_qty || it.approved_qty || it.requested_qty}</td>
                      <td className="p-2 border border-slate-300">{it.uom || it.ingredient_unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-4 pt-6 text-center border-t border-slate-200">
                <div className="space-y-4">
                  <p className="font-bold">مقدم الطلب</p>
                  <p className="text-slate-400">..................</p>
                </div>
                <div className="space-y-4">
                  <p className="font-bold">أمين المخزن</p>
                  <p className="text-slate-400">..................</p>
                </div>
                <div className="space-y-4">
                  <p className="font-bold">المستلم الفعلي</p>
                  <p className="text-slate-400">..................</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
