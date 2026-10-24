import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  UserCheck,
  Calendar,
  Sparkles,
  AlertCircle,
  Building2,
  Briefcase,
  DollarSign,
  Edit3,
  RefreshCw,
  Info,
  ShieldCheck,
} from "lucide-react";
import { api } from "../utils/api";

interface AnnualIncrease {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code?: string;
  job_title?: string;
  department_name?: string;
  branch_name?: string;
  years_of_service: number;
  hire_date?: string;
  due_date?: string;
  old_salary: number;
  increase_pct: number;
  increase_amount: number;
  new_salary: number;
  status: "pending" | "approved" | "rejected";
  approval_notes?: string;
  approved_by?: string;
  approved_at?: string;
  current_basic_salary?: number;
  emp_hire_date?: string;
}

export const AnnualIncreasesManagement: React.FC = () => {
  const [increases, setIncreases] = useState<AnnualIncrease[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionModal, setActionModal] = useState<{
    type: "approve" | "reject" | "edit";
    item: AnnualIncrease;
  } | null>(null);

  const [notesInput, setNotesInput] = useState("");
  const [customPctInput, setCustomPctInput] = useState<number | "">(10);
  const [customSalaryInput, setCustomSalaryInput] = useState<number | "">(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchIncreases = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/hr/annual-increases");
      if (res.ok) {
        const data = await res.json();
        setIncreases(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch annual increases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncreases();
  }, []);

  const openApproveModal = (item: AnnualIncrease) => {
    setActionModal({ type: "approve", item });
    setNotesInput("تم الاعتماد والموافقة على الزيادة السنوية المستحقة.");
    setCustomPctInput(Number(item.increase_pct || 10));
    setCustomSalaryInput(Number(item.new_salary || Number(item.old_salary) * 1.1));
  };

  const openRejectModal = (item: AnnualIncrease) => {
    setActionModal({ type: "reject", item });
    setNotesInput("");
  };

  const openEditModal = (item: AnnualIncrease) => {
    setActionModal({ type: "edit", item });
    setCustomPctInput(Number(item.increase_pct || 10));
    setCustomSalaryInput(Number(item.new_salary || Number(item.old_salary) * 1.1));
  };

  const handleApprove = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/hr/annual-increases/${actionModal.item.id}/approve`, {
        notes: notesInput,
        custom_increase_pct: customPctInput,
        custom_new_salary: customSalaryInput,
      });
      if (res.ok) {
        setActionModal(null);
        await fetchIncreases();
      } else {
        const err = await res.json();
        alert("خطأ: " + (err.error || "فشل الاعتماد"));
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء الاعتماد: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/hr/annual-increases/${actionModal.item.id}/reject`, {
        notes: notesInput || "تم رفض الزيادة السنوية بقرار من إدارة HR",
      });
      if (res.ok) {
        setActionModal(null);
        await fetchIncreases();
      } else {
        const err = await res.json();
        alert("خطأ: " + (err.error || "فشل الرفض"));
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء الرفض: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePct = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      const res = await api.put(`/api/hr/annual-increases/${actionModal.item.id}/update-pct`, {
        increase_pct: customPctInput,
      });
      if (res.ok) {
        setActionModal(null);
        await fetchIncreases();
      } else {
        const err = await res.json();
        alert("خطأ: " + (err.error || "فشل التحديث"));
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء التحديث: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = increases.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      String(item.employee_name || "").toLowerCase().includes(q) ||
      String(item.employee_code || "").toLowerCase().includes(q) ||
      String(item.job_title || "").toLowerCase().includes(q) ||
      String(item.branch_name || "").toLowerCase().includes(q) ||
      String(item.department_name || "").toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const pendingCount = increases.filter((i) => i.status === "pending").length;
  const approvedCount = increases.filter((i) => i.status === "approved").length;
  const rejectedCount = increases.filter((i) => i.status === "rejected").length;
  const totalApprovedAmount = increases
    .filter((i) => i.status === "approved")
    .reduce((sum, i) => sum + Number(i.increase_amount || 0), 0);

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 dir-rtl" dir="rtl">
      {/* Header section */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                منظومة الزيادات السنوية المستحقة
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              إدارة وموافقات الزيادات السنوية للموظفين
            </h1>
            <p className="text-purple-200 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              تُستحق الزيادة السنوية للموظف تلقائياً عند مرور سنة كاملة (365 يوماً) من تاريخ بداية التعيين، وتتطلب موافقة أو رفض مدير الموارد البشرية لتنفيذها وتعديل الراتب الأساسي.
            </p>
          </div>

          <button
            onClick={fetchIncreases}
            disabled={loading}
            className="self-start md:self-center flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">في انتظار قرار مدير HR</p>
            <h3 className="text-2xl font-extrabold text-amber-600">{pendingCount} موظف</h3>
            <p className="text-[10px] text-amber-700/80 mt-0.5">أتموا سنة عمل ومستحقون</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">الزيادات المعتمدة</p>
            <h3 className="text-2xl font-extrabold text-emerald-600">{approvedCount} موظف</h3>
            <p className="text-[10px] text-emerald-700/80 mt-0.5">تم تعديل رواتبهم الأساسية</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">الزيادات المرفوضة/المؤجلة</p>
            <h3 className="text-2xl font-extrabold text-rose-600">{rejectedCount} موظف</h3>
            <p className="text-[10px] text-rose-700/80 mt-0.5">تم الإبقاء على الراتب الحالي</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-purple-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">إجمالي تكلفة الزيادة المعتمدة</p>
            <h3 className="text-xl font-extrabold text-purple-700">
              +{Number(totalApprovedAmount || 0).toLocaleString()} <span className="text-xs">ج.م</span>
            </h3>
            <p className="text-[10px] text-purple-600/80 mt-0.5">زيادات شهرية مضافة للرواتب</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute right-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم الموظف، الكود، الوظيفة، الفرع..."
            value={searchQuery ?? ""}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> تصفية بالحالة:
          </span>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ينتظر القرار ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === "approved"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            مقبول ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter("rejected")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === "rejected"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            مرفوض ({rejectedCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === "all"
                ? "bg-purple-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            الكل ({increases.length})
          </button>
        </div>
      </div>

      {/* Main Table / Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">جاري فحص استحقاقات الزيادة السنوية للموظفين...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <Info className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">لا توجد طلبات زيادة سنوية مطابقة</h4>
          <p className="text-xs text-slate-500 mt-1">
            لم يتم العثور على أي موظفين مستحقين للزيادة السنوية بناءً على معايير البحث والتصفية المحددة.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">الموظف والوظيفة</th>
                  <th className="p-3.5">الفرع / القسم</th>
                  <th className="p-3.5">تاريخ التعيين والخدمة</th>
                  <th className="p-3.5">الراتب الحالي</th>
                  <th className="p-3.5">نسبة الزيادة</th>
                  <th className="p-3.5">قيمة الزيادة</th>
                  <th className="p-3.5">الراتب الجديد المقترح</th>
                  <th className="p-3.5">قرار مدير الموارد البشرية</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((item) => {
                  const oldSal = Number(item.old_salary || item.current_basic_salary || 0);
                  const pct = Number(item.increase_pct || 10);
                  const incAmt = Number(item.increase_amount || Math.round(oldSal * (pct / 100)));
                  const newSal = Number(item.new_salary || oldSal + incAmt);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-sm">{item.employee_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {item.employee_code && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">كود: {item.employee_code}</span>}
                          <span>{item.job_title || "موظف"}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600">
                        <div className="flex items-center gap-1 font-semibold">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {item.branch_name || "الفرع الرئيسي"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.department_name || "-"}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          {item.hire_date || item.emp_hire_date || "غير محدد"}
                        </div>
                        <span className="inline-block mt-1 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          🎯 أكمل {item.years_of_service} سنة عمل
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-700">
                        {Number(oldSal || 0).toLocaleString()} ج.م
                      </td>

                      <td className="p-3.5">
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg font-extrabold text-xs">
                          {pct}%
                        </span>
                      </td>

                      <td className="p-3.5 font-extrabold text-emerald-600">
                        +{Number(incAmt || 0).toLocaleString()} ج.م
                      </td>

                      <td className="p-3.5 font-black text-purple-900 text-sm">
                        {Number(newSal || 0).toLocaleString()} ج.م
                      </td>

                      <td className="p-3.5">
                        {item.status === "pending" && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1 w-fit">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            في انتظار قرار مدير HR
                          </span>
                        )}
                        {item.status === "approved" && (
                          <div>
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              تم الاعتماد والتعديل
                            </span>
                            {item.approved_by && (
                              <p className="text-[10px] text-slate-400 mt-1">بواسطة: {item.approved_by}</p>
                            )}
                          </div>
                        )}
                        {item.status === "rejected" && (
                          <div>
                            <span className="bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1 w-fit">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              زيادة مرفوضة
                            </span>
                            {item.approval_notes && (
                              <p className="text-[10px] text-rose-600 mt-1 max-w-xs">{item.approval_notes}</p>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {item.status === "pending" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openApproveModal(item)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              موافقة HR
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-1.5 rounded-xl text-xs border border-slate-300 transition-all"
                              title="تعديل النسبة"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openRejectModal(item)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-rose-200 transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              رفض
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold">تم اتخاذ القرار</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            {actionModal.type === "approve" && (
              <div>
                <div className="flex items-center gap-3 text-emerald-700 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">موافقة مدير HR على الزيادة السنوية</h3>
                    <p className="text-xs text-slate-500">سيتم تحديث الراتب الأساسي للموظف فوراً</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs mb-4 space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>الموظف:</span>
                    <span className="text-purple-900 font-black">{actionModal.item.employee_name}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>تاريخ التعيين:</span>
                    <span>{actionModal.item.hire_date || actionModal.item.emp_hire_date || "غير محدد"}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>الراتب الأساسي الحالي:</span>
                    <span className="font-bold">{Number(actionModal.item.old_salary || actionModal.item.current_basic_salary || 0).toLocaleString()} ج.م</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نسبة الزيادة المعتمدة (%)</label>
                    <input
                      type="number"
                      value={customPctInput ?? ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCustomPctInput(val);
                        const oldS = Number(actionModal.item.old_salary || actionModal.item.current_basic_salary || 0);
                        setCustomSalaryInput(oldS + Math.round(oldS * (val / 100)));
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الجديد النهائي (ج.م)</label>
                    <input
                      type="number"
                      value={customSalaryInput ?? ""}
                      onChange={(e) => setCustomSalaryInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات وقرار الاعتماد</label>
                    <textarea
                      rows={2}
                      value={notesInput ?? ""}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="أدخل أي ملاحظات خاصة بقرار الزيادة..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-md"
                  >
                    {submitting ? "جاري الحفظ..." : "تأكيد الموافقة وتحديث الراتب"}
                  </button>
                </div>
              </div>
            )}

            {actionModal.type === "reject" && (
              <div>
                <div className="flex items-center gap-3 text-rose-700 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-rose-700" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">رفض / تأجيل الزيادة السنوية</h3>
                    <p className="text-xs text-slate-500">سيظل الراتب الأساسي للموظف دون تغيير</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-3">
                  هل أنت أكتأكد من رفض تطبيق الزيادة السنوية للموظف{" "}
                  <strong className="text-slate-900">{actionModal.item.employee_name}</strong>؟
                </p>

                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب الرفض / الملاحظات (مطلوب)</label>
                  <textarea
                    rows={3}
                    value={notesInput ?? ""}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="مثال: أداء غير مرضٍ / تأخير التقييم / اتفاق استثنائي..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1.5 shadow-md"
                  >
                    {submitting ? "جاري الحفظ..." : "تأكيد رفض الزيادة"}
                  </button>
                </div>
              </div>
            )}

            {actionModal.type === "edit" && (
              <div>
                <div className="flex items-center gap-3 text-indigo-700 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <Edit3 className="w-6 h-6 text-indigo-700" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">تعديل نسبة الزيادة السنوية</h3>
                    <p className="text-xs text-slate-500">للموظف: {actionModal.item.employee_name}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">النسبة الجديدة (%)</label>
                  <input
                    type="number"
                    value={customPctInput ?? ""}
                    onChange={(e) => setCustomPctInput(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleUpdatePct}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 shadow-md"
                  >
                    {submitting ? "جاري التحديث..." : "حفظ النسبة الجديدة"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
