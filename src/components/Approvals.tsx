import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, CheckCircle, XCircle, Clock, AlertTriangle,
  Search, Filter, ChevronDown, Eye, Check, X, Settings,
  History, Bell, Package, DollarSign, FileText, TrendingUp,
  ChevronLeft, ChevronRight, RotateCcw, MessageSquare, Sparkles,
} from "lucide-react";
import { api } from "../utils/api";

// ─── Types ───
interface ApprovalRequest {
  id: number;
  module_type: string;
  module_label?: string;
  reference_id: number;
  title: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  approval_notes: string | null;
  metadata: any;
  details?: any;
}

interface DashboardStats {
  pending_count: number;
  approved_today: number;
  rejected_count: number;
  total_count: number;
  by_module: { module_type: string; status: string; count: string }[];
}

interface ApprovalSetting {
  id: number;
  module_type: string;
  module_label?: string;
  requires_approval: boolean;
  min_approver_role: string;
  auto_approve_below: number;
  notify_on_request: boolean;
  notify_on_approve: boolean;
}

// ─── Status Config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "قيد الانتظار", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Clock },
  approved: { label: "تمت الموافقة", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  rejected: { label: "مرفوض", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: XCircle },
  canceled: { label: "ملغي", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", icon: RotateCcw },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "منخفض", color: "text-slate-500", bg: "bg-slate-100" },
  normal: { label: "عادي", color: "text-blue-600", bg: "bg-blue-50" },
  high: { label: "عالي", color: "text-orange-600", bg: "bg-orange-50" },
  urgent: { label: "عاجل", color: "text-red-600", bg: "bg-red-50" },
};

const MODULE_ICONS: Record<string, any> = {
  purchase_order: Package,
  purchase_return: Package,
  operating_cost: DollarSign,
  sales_return: FileText,
  journal_entry: FileText,
  treasury_transaction: DollarSign,
  hr_leave: Clock,
};

type TabType = "pending" | "history" | "settings";

interface ApprovalsProps {
  onBack: () => void;
  initialTab?: string;
}

export function Approvals({ onBack, initialTab = "pending" }: ApprovalsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab as TabType || "pending");
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<ApprovalSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [filterModule, setFilterModule] = useState<string>("");
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending count
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await api.get("/api/approvals/pending-count");
      const data = await res.json();
      setPendingCount(data.count || 0);
    } catch (_e) { /* silent */ }
  }, []);

  // Fetch dashboard
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get("/api/approvals/dashboard");
      const data = await res.json();
      setDashboard(data);
    } catch (_e) { /* silent */ }
  }, []);

  // Fetch approvals list
  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterModule) params.set("module_type", filterModule);
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await api.get(`/api/approvals?${params.toString()}`);
      const data = await res.json();
      setApprovals(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (_e) { /* silent */ }
    setLoading(false);
  }, [filterStatus, filterModule, search, page]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get("/api/approvals/settings");
      const data = await res.json();
      setSettings(data);
    } catch (_e) { /* silent */ }
  }, []);

  // Approve action
  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      const username = localStorage.getItem("username") || "admin";
      const res = await api.put(`/api/approvals/${id}/approve`, {
        approved_by: username,
        notes: approvalNotes || null,
      });
      if (res.ok) {
        setSelectedApproval(null);
        setApprovalNotes("");
        fetchApprovals();
        fetchDashboard();
        fetchPendingCount();
      }
    } catch (_e) { /* silent */ }
    setActionLoading(false);
  };

  // Reject action
  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      const username = localStorage.getItem("username") || "admin";
      const res = await api.put(`/api/approvals/${rejectModal.id}/reject`, {
        approved_by: username,
        reason: rejectionReason,
      });
      if (res.ok) {
        setRejectModal({ open: false, id: 0 });
        setRejectionReason("");
        setSelectedApproval(null);
        fetchApprovals();
        fetchDashboard();
        fetchPendingCount();
      }
    } catch (_e) { /* silent */ }
    setActionLoading(false);
  };

  // Cancel action
  const handleCancel = async (id: number) => {
    setActionLoading(true);
    try {
      const username = localStorage.getItem("username") || "admin";
      const res = await api.put(`/api/approvals/${id}/cancel`, { canceled_by: username });
      if (res.ok) {
        setSelectedApproval(null);
        fetchApprovals();
        fetchDashboard();
        fetchPendingCount();
      }
    } catch (_e) { /* silent */ }
    setActionLoading(false);
  };

  // Update setting
  const handleUpdateSetting = async (id: number, field: string, value: any) => {
    try {
      const res = await api.put(`/api/approvals/settings/${id}`, { [field]: value });
      if (res.ok) fetchSettings();
    } catch (_e) { /* silent */ }
  };

  // Effects
  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  // Fetch branches and departments for filters
  useEffect(() => {
    api.get("/api/branches").then(async (res) => {
      if (res.ok) { const d = await res.json(); setBranches(Array.isArray(d) ? d : []); }
    }).catch(() => {});
    api.get("/api/hr/departments").then(async (res) => {
      if (res.ok) { const d = await res.json(); setDepartments(Array.isArray(d) ? d : []); }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchDashboard(); fetchApprovals(); }, [fetchDashboard, fetchApprovals]);
  useEffect(() => { if (activeTab === "settings") fetchSettings(); }, [activeTab, fetchSettings]);

  useEffect(() => { setPage(1); }, [filterStatus, filterModule, filterBranch, filterDepartment, search]);

  // ─── Tabs ───
  const tabs: { id: TabType; label: string; icon: any; badge?: number }[] = [
    { id: "pending", label: "طلبات الموافقة", icon: Bell },
    { id: "history", label: "سجل الموافقات", icon: History },
    { id: "settings", label: "إعدادات الموافقات", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-violet-600" />
              إدارة الموافقات
              {pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">مراجعة واعتماد المستندات والعمليات</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedApproval(null); }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-violet-500 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "pending" && pendingCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === "pending" ? "bg-violet-100 text-violet-700" : "bg-red-100 text-red-700"
                }`}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ═══ PENDING TAB ═══ */}
        {activeTab === "pending" && (
          <div className="space-y-6">
            {/* Dashboard Cards */}
            {dashboard && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">بانتظار الموافقة</p>
                      <p className="text-3xl font-bold text-amber-600 mt-1">{dashboard.pending_count}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">تمت الموافقة اليوم</p>
                      <p className="text-3xl font-bold text-emerald-600 mt-1">{dashboard.approved_today}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">مرفوضة</p>
                      <p className="text-3xl font-bold text-red-600 mt-1">{dashboard.rejected_count}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-red-500" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">إجمالي الطلبات</p>
                      <p className="text-3xl font-bold text-violet-600 mt-1">{dashboard.total_count}</p>
                    </div>
                    <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-violet-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو الكود أو العنوان..."
                    value={search ?? ""}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterStatus ?? ""}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="approved">تمت الموافقة</option>
                  <option value="rejected">مرفوض</option>
                  <option value="canceled">ملغي</option>
                  <option value="">الكل</option>
                </select>
                <select
                  value={filterModule ?? ""}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">كل الموديولات</option>
                  <option value="hr_leave">طلبات الإجازات</option>
                  <option value="purchase_order">أوامر الشراء</option>
                  <option value="purchase_return">مرتجعات المشتريات</option>
                  <option value="operating_cost">التكاليف التشغيلية</option>
                  <option value="sales_return">مرتجعات المبيعات</option>
                  <option value="journal_entry">قيود اليومية</option>
                  <option value="treasury_transaction">حركات الخزينة</option>
                  <option value="hr_employee">الموارد البشرية</option>
                  <option value="payroll_adjustment">تعديل مرتب</option>
                  <option value="attendance_edit">تعديل بصمة</option>
                  <option value="inventory_transfer">تحويل مخزني</option>
                  <option value="customer_credit">آجل عميل</option>
                </select>
                <select
                  value={filterBranch ?? ""}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  title="تصفية بالفرع"
                >
                  <option value="">كل الفروع</option>
                  {branches.map((b, bIdx) => (
                    <option key={`appr-branch-${b.id ?? bIdx}-${bIdx}`} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select
                  value={filterDepartment ?? ""}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  title="تصفية بالقسم"
                >
                  <option value="">كل الأقسام</option>
                  {departments.map((d, dIdx) => (
                    <option key={`appr-dept-${d.id ?? dIdx}-${dIdx}`} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Approvals List + Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* List */}
              <div className="lg:col-span-2 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : approvals.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">لا توجد طلبات موافقة</p>
                    <p className="text-slate-400 text-sm mt-1">جميع الطلبات تمت مراجعتها</p>
                  </div>
                ) : (
                  approvals.map((item, itemIdx) => {
                    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    const priorityCfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.normal;
                    const ModuleIcon = MODULE_ICONS[item.module_type] || FileText;
                    const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata || "{}") : item.metadata || {};

                    return (
                      <div
                        key={`appr-card-${item.id ?? itemIdx}-${itemIdx}`}
                        onClick={() => setSelectedApproval(item)}
                        className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                          selectedApproval?.id === item.id
                            ? "border-violet-500 shadow-md"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              item.module_type === "purchase_order" ? "bg-emerald-50 text-emerald-600" :
                              item.module_type === "operating_cost" ? "bg-orange-50 text-orange-600" :
                              "bg-violet-50 text-violet-600"
                            }`}>
                              <ModuleIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-800 text-sm">{item.title}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                                  {priorityCfg.label}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                <span>#{item.id}</span>
                                <span>{item.requested_by}</span>
                                <span>{new Date(item.requested_at).toLocaleDateString("ar-EG")}</span>
                                {meta.total_amount && (
                                  <span className="font-bold text-slate-600">{Number(meta.total_amount || 0).toLocaleString()} ج.م</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-slate-600 px-3">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-1">
                {selectedApproval ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-4">
                    {/* Detail Header */}
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                          (STATUS_CONFIG[selectedApproval.status] || STATUS_CONFIG.pending).bg
                        } ${(STATUS_CONFIG[selectedApproval.status] || STATUS_CONFIG.pending).color}`}>
                          {(STATUS_CONFIG[selectedApproval.status] || STATUS_CONFIG.pending).label}
                        </span>
                        <span className="text-xs text-slate-400">#{selectedApproval.id}</span>
                      </div>
                      <h3 className="font-bold text-slate-800">{selectedApproval.title}</h3>
                      {selectedApproval.description && (
                        <p className="text-sm text-slate-500 mt-1">{selectedApproval.description}</p>
                      )}
                    </div>

                    {/* Detail Info */}
                    <div className="p-5 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">نوع المستند</span>
                        <span className="font-medium text-slate-700">{selectedApproval.module_label || selectedApproval.module_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">رقم المرجع</span>
                        <span className="font-medium text-slate-700">#{selectedApproval.reference_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">مقدم الطلب</span>
                        <span className="font-medium text-slate-700">{selectedApproval.requested_by}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">تاريخ الطلب</span>
                        <span className="font-medium text-slate-700">{new Date(selectedApproval.requested_at).toLocaleDateString("ar-EG")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">الأولوية</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          (PRIORITY_CONFIG[selectedApproval.priority] || PRIORITY_CONFIG.normal).bg
                        } ${(PRIORITY_CONFIG[selectedApproval.priority] || PRIORITY_CONFIG.normal).color}`}>
                          {(PRIORITY_CONFIG[selectedApproval.priority] || PRIORITY_CONFIG.normal).label}
                        </span>
                      </div>

                      {selectedApproval.approved_by && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">بواسطة</span>
                            <span className="font-medium text-slate-700">{selectedApproval.approved_by}</span>
                          </div>
                          {selectedApproval.approved_at && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">تاريخ الموافقة</span>
                              <span className="font-medium text-slate-700">{new Date(selectedApproval.approved_at).toLocaleDateString("ar-EG")}</span>
                            </div>
                          )}
                        </>
                      )}

                      {selectedApproval.rejection_reason && (
                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                          <p className="text-xs text-red-500 font-medium mb-1">سبب الرفض</p>
                          <p className="text-sm text-red-700">{selectedApproval.rejection_reason}</p>
                        </div>
                      )}
                    </div>

                    {/* Purchase Order Details */}
                    {selectedApproval.details && selectedApproval.module_type === "purchase_order" && (
                      <div className="p-5 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-3">تفاصيل أمر الشراء</h4>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">المورد</span>
                            <span className="font-medium">{selectedApproval.details.supplier_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">تاريخ التسليم</span>
                            <span className="font-medium">{selectedApproval.details.delivery_date || "غير محدد"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">الإجمالي</span>
                            <span className="font-bold text-emerald-600">{Number(selectedApproval.details.total_amount || 0).toLocaleString()} ج.م</span>
                          </div>
                          {selectedApproval.details.notes && (
                            <div className="mt-2 text-slate-600 bg-slate-50 rounded-lg p-2">{selectedApproval.details.notes}</div>
                          )}
                        </div>

                        {/* Items table */}
                        {selectedApproval.details.items && selectedApproval.details.items.length > 0 && (
                          <div className="mt-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-right py-1.5 text-slate-500 font-medium">الصنف</th>
                                  <th className="text-center py-1.5 text-slate-500 font-medium">الكمية</th>
                                  <th className="text-left py-1.5 text-slate-500 font-medium">السعر</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.isArray(selectedApproval?.details?.items) && selectedApproval.details.items.map((item: any, i: number) => (
                                  <tr key={i} className="border-b border-slate-50">
                                    <td className="py-1.5 text-slate-700">{item.ingredient_name || `صنف #${item.ingredient_id}`}</td>
                                    <td className="py-1.5 text-center text-slate-600">{item.quantity}</td>
                                    <td className="py-1.5 text-left text-slate-600">{Number(item.unit_price || 0).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* HR Leave Request Details */}
                    {selectedApproval.module_type === "hr_leave" && (
                      <div className="p-5 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-3">تفاصيل طلب الإجازة</h4>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">الموظف</span>
                            <span className="font-bold text-slate-800">{selectedApproval.requested_by}</span>
                          </div>
                          {selectedApproval.metadata && (
                            <>
                              {selectedApproval.metadata.days_count !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">عدد الأيام المطلوبة</span>
                                  <span className="font-bold text-blue-600">{selectedApproval.metadata.days_count} يوم</span>
                                </div>
                              )}
                              {selectedApproval.metadata.policy_name && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">نوع الإجازة / السياسة</span>
                                  <span className="font-medium text-slate-700">{selectedApproval.metadata.policy_name}</span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">البيان / السبب</span>
                            <span className="font-medium text-slate-700">{selectedApproval.description || "طلب إجازة اعتيادي"}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Operating Cost Details */}
                    {selectedApproval.details && selectedApproval.module_type === "operating_cost" && (
                      <div className="p-5 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-3">تفاصيل التكلفة</h4>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">الفرع</span>
                            <span className="font-medium">{selectedApproval.details.branch}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">القسم</span>
                            <span className="font-medium">{selectedApproval.details.department}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">المبلغ</span>
                            <span className="font-bold text-orange-600">{Number(selectedApproval.details.amount || 0).toLocaleString()} ج.م</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">طريقة الدفع</span>
                            <span className="font-medium">{selectedApproval.details.payment_method}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Notes */}
                    {selectedApproval.status === "pending" && (
                      <div className="p-5 border-t border-slate-100">
                        <label className="text-sm font-medium text-slate-600 block mb-2">ملاحظات (اختياري)</label>
                        <textarea
                          value={approvalNotes ?? ""}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          placeholder="أضف ملاحظاتك هنا..."
                          className="w-full border border-slate-200 rounded-lg text-sm p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    {selectedApproval.status === "pending" && (
                      <div className="p-5 border-t border-slate-100 flex gap-3">
                        <button
                          onClick={() => handleApprove(selectedApproval.id)}
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          موافقة
                        </button>
                        <button
                          onClick={() => setRejectModal({ open: true, id: selectedApproval.id })}
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          رفض
                        </button>
                      </div>
                    )}

                    {selectedApproval.status === "pending" && (
                      <div className="px-5 pb-5">
                        <button
                          onClick={() => handleCancel(selectedApproval.id)}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 py-2 text-sm transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          إلغاء الطلب
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center sticky top-4">
                    <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">اختر طلب موافقة لعرض التفاصيل</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === "history" && (
          <HistoryTab />
        )}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === "settings" && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-violet-600" />
                  إعدادات نظام الموافقات
                </h2>
                <p className="text-sm text-slate-500 mt-1">تحكم في الموديولات التي تتطلب موافقة والشروط المطلوبة</p>
              </div>
              <div className="divide-y divide-slate-100">
                {settings.map((s, sIdx) => {
                  const ModuleIcon = MODULE_ICONS[s.module_type] || FileText;
                  return (
                    <div key={`appr-setting-${s.id ?? s.module_type}-${sIdx}`} className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                            <ModuleIcon className="w-5 h-5 text-violet-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800">{s.module_label || s.module_type}</h3>
                            <p className="text-xs text-slate-400">{s.module_type}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.requires_approval}
                            onChange={(e) => handleUpdateSetting(s.id, "requires_approval", e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                      </div>
                      {s.requires_approval && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pr-13">
                          <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">أقل صلاحية للموافقة</label>
                            <select
                              value={s.min_approver_role ?? ""}
                              onChange={(e) => handleUpdateSetting(s.id, "min_approver_role", e.target.value)}
                              className="w-full border border-slate-200 rounded-lg text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                            >
                              <option value="admin">مدير النظام</option>
                              <option value="manager">مدير</option>
                              <option value="accountant">محاسب</option>
                              <option value="supervisor">مشرف</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 block mb-1">اعتماد تلقائي أقل من (ج.م)</label>
                            <input
                              type="number"
                              value={s.auto_approve_below || 0}
                              onChange={(e) => handleUpdateSetting(s.id, "auto_approve_below", parseFloat(e.target.value) || 0)}
                              className="w-full border border-slate-200 rounded-lg text-sm p-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                              min={0}
                            />
                            <p className="text-xs text-slate-400 mt-1">المبالغ الأقل من هذا الرقم تُعتمد تلقائياً</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Reject Modal ─── */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir="rtl">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                رفض طلب الموافقة
              </h3>
              <p className="text-sm text-slate-500 mt-1">يرجى توضيح سبب الرفض</p>
            </div>
            <div className="p-6">
              <textarea
                value={rejectionReason ?? ""}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="اكتب سبب الرفض هنا..."
                className="w-full border border-slate-200 rounded-lg text-sm p-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || actionLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
              <button
                onClick={() => { setRejectModal({ open: false, id: 0 }); setRejectionReason(""); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Tab Component ───
function HistoryTab() {
  const [history, setHistory] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterModule, setFilterModule] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterModule) params.set("module_type", filterModule);
        const res = await api.get(`/api/approvals/history?${params.toString()}`);
        const data = await res.json();
        setHistory(data);
      } catch (_e) { /* silent */ }
      setLoading(false);
    };
    fetchHistory();
  }, [filterModule]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filterModule ?? ""}
          onChange={(e) => setFilterModule(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">كل الموديولات</option>
          <option value="hr_leave">طلبات الإجازات</option>
          <option value="purchase_order">أوامر الشراء</option>
          <option value="operating_cost">التكاليف التشغيلية</option>
          <option value="purchase_return">مرتجعات المشتريات</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">لا يوجد سجل موافقات بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-right px-4 py-3 font-medium text-slate-600">#</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">العنوان</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">مقدم الطلب</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">المعتمد</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, hIdx) => {
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={`appr-history-${item.id ?? hIdx}-${hIdx}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500">{item.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.title}</td>
                    <td className="px-4 py-3 text-slate-600">{item.module_label || item.module_type}</td>
                    <td className="px-4 py-3 text-slate-600">{item.requested_by}</td>
                    <td className="px-4 py-3 text-slate-600">{item.approved_by || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(item.requested_at).toLocaleDateString("ar-EG")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}