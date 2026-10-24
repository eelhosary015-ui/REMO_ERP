import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Crown,
  UserCheck,
  Building2,
  Calendar,
  FileText,
  AlertCircle,
  Filter,
  Search,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Send,
  Users,
  ShieldCheck,
  Check,
  X,
  ArrowRight,
  Info
} from "lucide-react";
import { api } from "../utils/api";

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  job_title?: string;
  branch_name?: string;
  department_name?: string;
  department_id?: number;
  role_level?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  notes?: string;
  status: "pending" | "pending_head" | "pending_hr" | "approved" | "rejected";
  head_status?: "pending" | "approved" | "rejected";
  head_notes?: string;
  head_approved_by?: string;
  head_action_at?: string;
  hr_status?: "pending" | "approved" | "rejected";
  hr_notes?: string;
  hr_approved_by?: string;
  hr_action_at?: string;
  created_at?: string;
}

interface Props {
  departments?: any[];
  branches?: any[];
  onRefresh?: () => void;
}

export function LeaveApprovalsWorkflow({ departments = [], branches = [], onRefresh }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<"head" | "hr" | "history">("head");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // Action Modals
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    request: LeaveRequest | null;
    stage: "head" | "hr";
    action: "approved" | "rejected";
  }>({
    open: false,
    request: null,
    stage: "head",
    action: "approved"
  });

  const [notesInput, setNotesInput] = useState("");
  const [approverName, setApproverName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/hr/leave-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch leave requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleOpenActionModal = (request: LeaveRequest, stage: "head" | "hr", action: "approved" | "rejected") => {
    setActionModal({
      open: true,
      request,
      stage,
      action
    });
    setNotesInput("");
    setApproverName(stage === "head" ? "رئيس القسم" : "مسئول الموارد البشرية");
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.request) return;

    setSubmitting(true);
    setAlertMsg(null);

    try {
      const payload: any = {
        stage: actionModal.stage,
        notes: notesInput,
        approved_by: approverName,
      };

      if (actionModal.stage === "head") {
        payload.head_status = actionModal.action;
        payload.head_notes = notesInput;
        payload.head_approved_by = approverName;
      } else {
        payload.hr_status = actionModal.action;
        payload.hr_notes = notesInput;
        payload.hr_approved_by = approverName;
        payload.status = actionModal.action;
      }

      const res = await api.put(`/api/hr/leave-requests/${actionModal.request.id}`, payload);

      if (res.ok) {
        setAlertMsg({
          type: "success",
          text: actionModal.stage === "head"
            ? `تم ${actionModal.action === "approved" ? "قبول" : "رفض"} الطلب من رئيس القسم وتحويله لمسئول الموارد البشرية بنجاح.`
            : `تم ${actionModal.action === "approved" ? "الاعتماد النهائي وتطبيق الإجازة على الموظف" : "رفض الإجازة نهائياً"} بنجاح.`
        });
        setActionModal({ open: false, request: null, stage: "head", action: "approved" });
        setNotesInput("");
        fetchRequests();
        if (onRefresh) onRefresh();
      } else {
        setAlertMsg({ type: "error", text: "حدث خطأ أثناء معالجة طلب الإجازة." });
      }
    } catch (err) {
      console.error("Error confirming action", err);
      setAlertMsg({ type: "error", text: "فشل الاتصال بالخادم." });
    } finally {
      setSubmitting(false);
    }
  };

  // Stage 1 Requests: Status pending or pending_head
  const headPendingRequests = requests.filter(r => {
    const isStage1 = r.status === "pending_head" || r.status === "pending" || (!r.head_status || r.head_status === "pending");
    const deptMatch = !selectedDepartment || String(r.department_id) === String(selectedDepartment);
    const searchMatch = !searchQuery || r.employee_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return isStage1 && deptMatch && searchMatch;
  });

  // Stage 2 Requests: Head responded (approved or rejected) and waiting for HR decision
  const hrPendingRequests = requests.filter(r => {
    const isStage2 = r.status === "pending_hr" || (r.head_status && r.head_status !== "pending" && r.status !== "approved" && r.status !== "rejected");
    const deptMatch = !selectedDepartment || String(r.department_id) === String(selectedDepartment);
    const searchMatch = !searchQuery || r.employee_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return isStage2 && deptMatch && searchMatch;
  });

  // Completed Requests
  const historyRequests = requests.filter(r => {
    const isCompleted = r.status === "approved" || r.status === "rejected";
    const deptMatch = !selectedDepartment || String(r.department_id) === String(selectedDepartment);
    const searchMatch = !searchQuery || r.employee_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return isCompleted && deptMatch && searchMatch;
  });

  return (
    <div className="space-y-6 font-sans text-right animate-fadeIn" dir="rtl">
      {/* Top Banner & Stats */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-700 font-extrabold text-sm mb-1">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <span>دورة موافقات الإجازات الهيكلية (رؤساء الأقسام ➔ الموارد البشرية)</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">
              إدارة موافقات وطلبات الإجازات
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              تمر طلبات الإجازات أولاً برئيس القسم/المشرف للقبول أو الرفض وإضافة التعليق، ثم تحول لمسئول الموارد البشرية للاعتماد النهائي وتطبيق الإجازة على الموظف.
            </p>
          </div>

          <button
            onClick={fetchRequests}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث البيانات
          </button>
        </div>

        {alertMsg && (
          <div className={`p-4 mb-6 rounded-2xl flex items-center justify-between text-xs font-bold ${
            alertMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            <div className="flex items-center gap-2">
              {alertMsg.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
              <span>{alertMsg.text}</span>
            </div>
            <button onClick={() => setAlertMsg(null)} className="p-1 hover:bg-white/50 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveStage("head")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeStage === "head"
                ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                : "bg-amber-50/50 border-amber-100 hover:bg-amber-50"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-600" />
                المرحلة 1: رؤساء الأقسام
              </span>
              <span className="px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-black shadow-xs">
                {headPendingRequests.length}
              </span>
            </div>
            <p className="text-2xl font-black text-amber-900">{headPendingRequests.length} طلب</p>
            <p className="text-[11px] text-amber-700/80 mt-1">تنتظر قبول/رفض رئيس القسم</p>
          </div>

          <div
            onClick={() => setActiveStage("hr")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeStage === "hr"
                ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                : "bg-blue-50/50 border-blue-100 hover:bg-blue-50"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                المرحلة 2: الموارد البشرية
              </span>
              <span className="px-2.5 py-1 bg-blue-600 text-white rounded-full text-xs font-black shadow-xs">
                {hrPendingRequests.length}
              </span>
            </div>
            <p className="text-2xl font-black text-blue-900">{hrPendingRequests.length} طلب</p>
            <p className="text-[11px] text-blue-700/80 mt-1">محولة من رئيس القسم للاعتماد وتطبيق الإجازة</p>
          </div>

          <div
            onClick={() => setActiveStage("history")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeStage === "history"
                ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                المطلوبة والمعتمدة
              </span>
              <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-xs font-black shadow-xs">
                {historyRequests.filter(r => r.status === "approved").length}
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-900">{historyRequests.filter(r => r.status === "approved").length} إجازة</p>
            <p className="text-[11px] text-emerald-700/80 mt-1">تمت الموافقة وتطبيق الخصم من الرصيد</p>
          </div>

          <div
            onClick={() => setActiveStage("history")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeStage === "history"
                ? "bg-red-500/10 border-red-500 ring-2 ring-red-500/20 shadow-md"
                : "bg-red-50/50 border-red-100 hover:bg-red-50"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600" />
                الطلبات المرفوضة
              </span>
              <span className="px-2.5 py-1 bg-red-600 text-white rounded-full text-xs font-black shadow-xs">
                {historyRequests.filter(r => r.status === "rejected").length}
              </span>
            </div>
            <p className="text-2xl font-black text-red-900">{historyRequests.filter(r => r.status === "rejected").length} طلب</p>
            <p className="text-[11px] text-red-700/80 mt-1">مرفوضة من رئيس القسم أو الموارد البشرية</p>
          </div>
        </div>

        {/* Stage Selector Tabs & Filters */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveStage("head")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeStage === "head"
                  ? "bg-white text-amber-900 shadow-sm border border-amber-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Crown className="w-4 h-4 text-amber-500" />
              موافقات رؤساء الأقسام ({headPendingRequests.length})
            </button>

            <button
              onClick={() => setActiveStage("hr")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeStage === "hr"
                  ? "bg-white text-blue-900 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              اعتماد الموارد البشرية ({hrPendingRequests.length})
            </button>

            <button
              onClick={() => setActiveStage("history")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeStage === "history"
                  ? "bg-white text-purple-900 shadow-sm border border-purple-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4 text-purple-600" />
              سجل المكتملة ({historyRequests.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث باسم الموظف..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={selectedDepartment ?? ""}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
            >
              <option value="">جميع الأقسام</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل طلبات الإجازات...</p>
        </div>
      ) : activeStage === "head" ? (
        /* STAGE 1: DEPARTMENT HEAD APPROVALS */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-xs font-bold">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <span>طلبات الإجازات بانتظار قرار رئيس القسم / المشرف مباشرة.</span>
            </div>
            <span className="text-[11px] bg-white/80 px-2.5 py-1 rounded-lg border border-amber-300">
              عدد الطلبات المعلقة: {headPendingRequests.length}
            </span>
          </div>

          {headPendingRequests.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 text-sm">لا توجد طلبات إجازة معلقة لمرحلة رئيس القسم</h4>
              <p className="text-xs text-slate-400 mt-1">جميع الطلبات الجديدة تمت معالجتها أو تحويلها للموارد البشرية.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {headPendingRequests.map((req) => (
                <div key={req.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    {/* Header: Employee Info */}
                    <div className="flex justify-between items-start pb-3 mb-3 border-b border-slate-100">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base">{req.employee_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          {req.job_title && <span>{req.job_title}</span>}
                          {req.department_name && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {req.department_name}
                            </span>
                          )}
                          {req.branch_name && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px]">
                              {req.branch_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" /> قيد نظر رئيس القسم
                      </span>
                    </div>

                    {/* Leave Details */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 mb-4 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">نوع الإجازة المطلوبة:</span>
                        <span className="font-extrabold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                          {req.leave_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                        <div>
                          <p className="text-[10px] text-slate-400">من تاريخ</p>
                          <p className="font-bold text-slate-800">{req.start_date}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">إلى تاريخ</p>
                          <p className="font-bold text-slate-800">{req.end_date}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-xs">
                        <span className="text-slate-500">المدة الإجمالية:</span>
                        <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {req.days_count} يوم
                        </span>
                      </div>
                    </div>

                    {req.notes && (
                      <div className="mb-4 bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 text-xs text-slate-700">
                        <p className="text-[10px] font-bold text-amber-800 mb-0.5">ملاحظات وسبب الموظف:</p>
                        <p className="italic">"{req.notes}"</p>
                      </div>
                    )}
                  </div>

                  {/* Actions for Dept Head */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenActionModal(req, "head", "approved")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all flex justify-center items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      <Check className="w-4 h-4" /> قبول وتمرير للموارد البشرية
                    </button>

                    <button
                      onClick={() => handleOpenActionModal(req, "head", "rejected")}
                      className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-600 font-extrabold text-xs py-2.5 rounded-xl transition-all flex justify-center items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> رفض وتمرير للموارد البشرية
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeStage === "hr" ? (
        /* STAGE 2: HR OFFICIAL FINAL APPROVAL & APPLICATION */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 text-xs font-bold">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>اعتماد مسئول الموارد البشرية النهائي - عند القبول سيتم خصم أيام الإجازة تلقائياً من رصيد الموظف.</span>
            </div>
            <span className="text-[11px] bg-white/80 px-2.5 py-1 rounded-lg border border-blue-300">
              عدد الطلبات بانتظار الاعتماد: {hrPendingRequests.length}
            </span>
          </div>

          {hrPendingRequests.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 text-sm">لا توجد طلبات معلقة بانتظار اعتماد الموارد البشرية</h4>
              <p className="text-xs text-slate-400 mt-1">جميع الطلبات المحولة من رؤساء الأقسام قد تمت معالجتها.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {hrPendingRequests.map((req) => (
                <div key={req.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start pb-3 mb-3 border-b border-slate-100">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base">{req.employee_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          {req.job_title && <span>{req.job_title}</span>}
                          {req.department_name && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {req.department_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> بانتظار اعتماد HR
                      </span>
                    </div>

                    {/* Department Head Decision Box */}
                    <div className={`p-3 rounded-2xl border mb-3 text-xs ${
                      req.head_status === "approved"
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                        : "bg-red-50/70 border-red-200 text-red-900"
                    }`}>
                      <div className="flex items-center justify-between font-extrabold mb-1">
                        <span className="flex items-center gap-1.5">
                          <Crown className="w-4 h-4" />
                          قرار رئيس القسم ({req.head_approved_by || "رئيس القسم"}):
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          req.head_status === "approved" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                        }`}>
                          {req.head_status === "approved" ? "موافق عليه 🟢" : "مرفوض 🔴"}
                        </span>
                      </div>
                      <p className="text-[11px] italic mt-1 bg-white/70 p-2 rounded-xl border border-black/5">
                        "{req.head_notes || "لا توجد ملاحظات من رئيس القسم"}"
                      </p>
                    </div>

                    {/* Leave Details */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">نوع الإجازة:</span>
                        <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {req.leave_type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">الفترة:</span>
                        <span className="font-bold text-slate-800">{req.start_date} ➔ {req.end_date}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">المدة المحسوبة:</span>
                        <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{req.days_count} أيام</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for HR */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenActionModal(req, "hr", "approved")}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all flex justify-center items-center gap-1.5 shadow-md shadow-blue-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> اعتماد وتطبيق الإجازة
                    </button>

                    <button
                      onClick={() => handleOpenActionModal(req, "hr", "rejected")}
                      className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-600 font-extrabold text-xs py-2.5 rounded-xl transition-all flex justify-center items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> رفض نهائي
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* STAGE 3: HISTORY LOG */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-x-auto">
            <h4 className="font-extrabold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              سجل الطلبات والإجازات المكتملة
            </h4>

            {historyRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                لا توجد طلبات إجازة مكتملة في السجل حتى الآن.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="p-3 rounded-r-xl">الموظف</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3">نوع الإجازة</th>
                    <th className="p-3">الفترة والمدة</th>
                    <th className="p-3">قرار رئيس القسم</th>
                    <th className="p-3">اعتماد الموارد البشرية</th>
                    <th className="p-3 rounded-l-xl">الحالة النهائية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{req.employee_name}</td>
                      <td className="p-3 text-slate-600">{req.department_name || "-"}</td>
                      <td className="p-3">
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">
                          {req.leave_type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">
                        {req.start_date} ➔ {req.end_date} ({req.days_count} يوم)
                      </td>
                      <td className="p-3">
                        {req.head_status === "approved" ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 block text-[10px]">
                            موافق ({req.head_approved_by || "الرئيس"})
                            {req.head_notes && <span className="block font-normal text-[9px] text-slate-500">"{req.head_notes}"</span>}
                          </span>
                        ) : req.head_status === "rejected" ? (
                          <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 block text-[10px]">
                            مرفوض ({req.head_approved_by || "الرئيس"})
                            {req.head_notes && <span className="block font-normal text-[9px] text-slate-500">"{req.head_notes}"</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {req.hr_status === "approved" ? (
                          <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block text-[10px]">
                            معتمد ({req.hr_approved_by || "HR"})
                            {req.hr_notes && <span className="block font-normal text-[9px] text-slate-500">"{req.hr_notes}"</span>}
                          </span>
                        ) : req.hr_status === "rejected" ? (
                          <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 block text-[10px]">
                            مرفوض ({req.hr_approved_by || "HR"})
                            {req.hr_notes && <span className="block font-normal text-[9px] text-slate-500">"{req.hr_notes}"</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {req.status === "approved" ? (
                          <span className="bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3" /> مقبول ومطبق على الرصيد
                          </span>
                        ) : (
                          <span className="bg-red-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1 shadow-xs">
                            <XCircle className="w-3 h-3" /> مرفوض نهائياً
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal.open && actionModal.request && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-fadeIn" dir="rtl">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                {actionModal.action === "approved" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                {actionModal.stage === "head"
                  ? `${actionModal.action === "approved" ? "قبول وتمرير" : "رفض وتمرير"} طلب الإجازة (رئيس القسم)`
                  : `${actionModal.action === "approved" ? "الاعتماد النهائي وتطبيق الإجازة" : "الرفض النهائي"} (الموارد البشرية)`}
              </h3>
              <button
                onClick={() => setActionModal({ open: false, request: null, stage: "head", action: "approved" })}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAction} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs space-y-1">
                <p><span className="text-slate-500">اسم الموظف:</span> <strong className="text-slate-900">{actionModal.request.employee_name}</strong></p>
                <p><span className="text-slate-500">نوع الإجازة والمدة:</span> <strong className="text-purple-700">{actionModal.request.leave_type} ({actionModal.request.days_count} يوم)</strong></p>
                <p><span className="text-slate-500">التاريخ:</span> <span className="text-slate-800">{actionModal.request.start_date} ➔ {actionModal.request.end_date}</span></p>
              </div>

              {actionModal.stage === "hr" && actionModal.action === "approved" && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <Info className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>تنويه هام: عند تأكيد الموافقة، سيقوم النظام تلقائياً بتطبيق الإجازة وخصم {actionModal.request.days_count} يوم من رصيد الموظف.</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  صفة/اسم المعتمد:
                </label>
                <input
                  type="text"
                  required
                  value={approverName ?? ""}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  placeholder="مثلاً: رئيس قسم المبيعات / مدير الموارد البشرية"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  ملاحظات وتعليق القرار:
                </label>
                <textarea
                  rows={3}
                  value={notesInput ?? ""}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={
                    actionModal.action === "approved"
                      ? "اكتب أي ملاحظة أو تعليمات مع القبول (اختياري)..."
                      : "سبب رفض طلب الإجازة..."
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ open: false, request: null, stage: "head", action: "approved" })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 ${
                    actionModal.action === "approved"
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                      : "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                  }`}
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  تأكيد القرار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
