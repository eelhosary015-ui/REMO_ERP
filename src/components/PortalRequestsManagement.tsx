import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, FileText, Download, X, MessageSquare, ExternalLink, RefreshCcw, ShieldCheck, Crown, Send, Bell } from "lucide-react";
import { api } from "../utils/api";
import { LeaveApprovalsWorkflow } from "./LeaveApprovalsWorkflow";
import { SendEmployeeMessageModal } from "./SendEmployeeMessageModal";

interface PortalRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  job_title: string;
  department_name: string;
  branch_name: string;
  request_type: "leave" | "advance" | "memo" | "complaint";
  title: string;
  amount: number;
  notes: string;
  attachment: string | null;
  status: "pending" | "approved" | "rejected";
  admin_response: string | null;
  created_at: string;
}

export function PortalRequestsManagement() {
  const [activeTab, setActiveTab] = useState<"leave_approvals" | "portal_memos">("leave_approvals");
  const [departments, setDepartments] = useState<any[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  const [respondModal, setRespondModal] = useState<{ open: boolean; request: PortalRequest | null }>({
    open: false,
    request: null,
  });
  const [adminResponse, setAdminResponse] = useState("");
  const [respondStatus, setRespondStatus] = useState<"approved" | "rejected">("approved");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Send Message Modal State
  const [sendMessageModalOpen, setSendMessageModalOpen] = useState(false);
  const [preselectedEmpId, setPreselectedEmpId] = useState<number | null>(null);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);

  const fetchAuxData = async () => {
    try {
      const [empRes, branchRes] = await Promise.all([
        api.get("/api/hr/employees"),
        api.get("/api/hr/branches")
      ]);
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployeesList(Array.isArray(empData) ? empData : []);
      }
      if (branchRes.ok) {
        const branchData = await branchRes.json();
        const arr = Array.isArray(branchData) ? branchData : [];
        const seen = new Set();
        const deduped = arr.filter((item: any) => {
          const k = item?.id !== undefined && item?.id !== null ? item.id : item?.name;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setBranchesList(deduped);
      }
    } catch (e) {
      console.error("Failed to fetch auxiliary HR data", e);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/api/hr/departments");
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        const seen = new Set();
        const deduped = arr.filter((item: any) => {
          const k = item?.id !== undefined && item?.id !== null ? item.id : item?.name;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setDepartments(deduped);
      }
    } catch (e) {}
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/hr/portal-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchDepartments();
    fetchAuxData();
  }, []);

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondModal.request) return;
    
    setIsSubmitting(true);
    try {
      const res = await api.put(`/api/hr/portal-requests/${respondModal.request.id}/respond`, {
        status: respondStatus,
        admin_response: adminResponse,
      });

      if (res.ok) {
        setRespondModal({ open: false, request: null });
        setAdminResponse("");
        fetchRequests();
      } else {
        alert("فشل تحديث الطلب");
      }
    } catch (err) {
      console.error("Failed to respond", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const typeMatch = filterType === "all" || req.request_type === filterType;
    const statusMatch = filterStatus === "all" || req.status === filterStatus;
    return typeMatch && statusMatch;
  });

  return (
    <div className="space-y-6 font-sans text-right animate-fadeIn" dir="rtl">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl max-w-2xl border border-slate-300/50">
        <button
          onClick={() => setActiveTab("leave_approvals")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === "leave_approvals"
              ? "bg-white text-purple-900 shadow-sm border border-purple-200 ring-2 ring-purple-500/10"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          دورة موافقات الإجازات (رؤساء الأقسام ➔ الموارد البشرية)
        </button>

        <button
          onClick={() => setActiveTab("portal_memos")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === "portal_memos"
              ? "bg-white text-indigo-900 shadow-sm border border-indigo-200 ring-2 ring-indigo-500/10"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-600" />
          موافقات مذكرات وطلبات تطبيق الموبايل ({requests.length})
        </button>
      </div>

      {activeTab === "leave_approvals" ? (
        <LeaveApprovalsWorkflow departments={departments} onRefresh={fetchRequests} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                موافقات التطبيق والمذكرات
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                مراجعة والموافقة على مذكرات وطلبات الموظفين المرفوعة من تطبيق الموبايل (إجازات، سلف، شكاوى).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPreselectedEmpId(null);
                  setSendMessageModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-extrabold text-xs transition-all shadow-md shadow-purple-600/20"
              >
                <Bell className="w-4 h-4 animate-bounce" />
                <span>إرسال تنبيه ورسالة للموظفين 🔔</span>
              </button>

              <button
                onClick={fetchRequests}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>تحديث</span>
              </button>
            </div>
          </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">نوع الطلب</label>
            <select
              value={filterType ?? ""}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">الكل</option>
              <option value="leave">إجازات</option>
              <option value="advance">سلف</option>
              <option value="memo">مذكرات عمل</option>
              <option value="complaint">شكاوى ومقترحات</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-600 mb-1.5">حالة الطلب</label>
            <select
              value={filterStatus ?? ""}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">الكل</option>
              <option value="pending">قيد الانتظار</option>
              <option value="approved">تمت الموافقة</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">جاري تحميل الطلبات...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            لا توجد طلبات أو مذكرات تطابق شروط البحث الحالية.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map((req, idx) => (
              <div key={`portal-req-${req.id}-${idx}`} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-800">{req.employee_name}</span>
                    <span className="text-xs text-slate-500">{req.job_title} - {req.department_name}</span>
                    <span className="text-[10px] text-slate-400">{new Date((req.created_at) || 0).toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap \${
                      req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {req.status === 'pending' && 'قيد الانتظار'}
                      {req.status === 'approved' && 'تمت الموافقة'}
                      {req.status === 'rejected' && 'مرفوض'}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap \${
                      req.request_type === 'leave' ? 'bg-blue-100 text-blue-700' :
                      req.request_type === 'advance' ? 'bg-amber-100 text-amber-700' :
                      req.request_type === 'memo' ? 'bg-purple-100 text-purple-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {req.request_type === 'leave' && 'طلب إجازة'}
                      {req.request_type === 'advance' && 'طلب سلفة'}
                      {req.request_type === 'memo' && 'مذكرة عمل'}
                      {req.request_type === 'complaint' && 'شكوى / مقترح'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block mb-1">الموضوع</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-relaxed">{req.title}</h4>
                  </div>
                  
                  {req.amount && Number(req.amount) > 0 ? (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">المبلغ المطلوب</span>
                      <span className="font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg text-sm">{Number(req.amount || 0).toLocaleString()} ج.م</span>
                    </div>
                  ) : null}

                  {req.notes && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {req.notes}
                    </div>
                  )}

                  {req.attachment && (
                    <div>
                      <button
                        onClick={() => setSelectedPhoto(req.attachment)}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors w-max"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        عرض المرفق
                      </button>
                    </div>
                  )}

                  {req.admin_response && (
                    <div className="mt-auto pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                        <MessageSquare className="w-3 h-3" />
                        رد الإدارة:
                      </span>
                      <p className="text-xs font-semibold text-slate-700 bg-indigo-50/50 p-2 rounded-lg">
                        {req.admin_response}
                      </p>
                    </div>
                  )}
                </div>

                {req.status === 'pending' ? (
                  <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                    <button
                      onClick={() => {
                        setRespondStatus("approved");
                        setAdminResponse("");
                        setRespondModal({ open: true, request: req });
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                    >
                      اتخاذ قرار (موافقة / رفض)
                    </button>
                    <button
                      onClick={() => {
                        setPreselectedEmpId(req.employee_id);
                        setSendMessageModalOpen(true);
                      }}
                      className="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5 text-purple-600" />
                      <span>إرسال إشعار فوري للموظف 💬</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setPreselectedEmpId(req.employee_id);
                        setSendMessageModalOpen(true);
                      }}
                      className="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5 text-purple-600" />
                      <span>إرسال إشعار فوري للموظف 💬</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">عرض المرفق</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full shadow-sm transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-100 min-h-[50vh]">
              <img src={selectedPhoto} alt="Attachment" className="max-w-full max-h-[70vh] rounded-xl shadow-sm object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Respond Modal */}
      {respondModal.open && respondModal.request && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">قرار الإدارة</h3>
                <p className="text-xs text-slate-500 mt-1">الرد على طلب الموظف {respondModal.request.employee_name}</p>
              </div>
              <button
                onClick={() => setRespondModal({ open: false, request: null })}
                className="p-1.5 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full shadow-sm transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRespond} className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">القرار النهائي</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRespondStatus("approved")}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all \${
                      respondStatus === "approved"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    موافقة
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondStatus("rejected")}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all \${
                      respondStatus === "rejected"
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <XCircle className="w-5 h-5" />
                    رفض
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  تعليق الإدارة (سيظهر للموظف في الإشعارات)
                </label>
                <textarea
                  value={adminResponse ?? ""}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 min-h-[100px] text-sm"
                  placeholder="اكتب ردك أو مبررات القرار هنا ليراها الموظف..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "جاري الحفظ..." : "حفظ وإرسال الإشعار"}
                </button>
                <button
                  type="button"
                  onClick={() => setRespondModal({ open: false, request: null })}
                  className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR Send Employee Message / Notification Modal */}
      <SendEmployeeMessageModal
        isOpen={sendMessageModalOpen}
        onClose={() => setSendMessageModalOpen(false)}
        preselectedEmployeeId={preselectedEmpId}
        employees={employeesList}
        branches={branchesList}
        departments={departments}
      />
    </div>
  );
}
