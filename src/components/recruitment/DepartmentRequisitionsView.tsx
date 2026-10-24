import React, { useState } from "react";
import {
  Briefcase,
  Plus,
  Users,
  Building2,
  Clock,
  Award,
  GraduationCap,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  X,
  FileText,
  DollarSign
} from "lucide-react";
import { JobPosting, Application } from "../RecruitmentSuite";

interface DepartmentRequisitionsViewProps {
  jobPostings: JobPosting[];
  departments: any[];
  onRefresh: () => void;
  onOpenApplyForPosting: (posting: JobPosting) => void;
  onFilterApplicationsForPosting: (postingId: number) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  getAuthHeaders: () => Record<string, string>;
}

export const DepartmentRequisitionsView: React.FC<DepartmentRequisitionsViewProps> = ({
  jobPostings,
  departments,
  onRefresh,
  onOpenApplyForPosting,
  onFilterApplicationsForPosting,
  showToast,
  getAuthHeaders
}) => {
  const [showRequisitionModal, setShowRequisitionModal] = useState<boolean>(false);
  const [reqForm, setReqForm] = useState({
    title: "",
    department_name: "قسم المطبخ والطهي",
    requester_name: "رئيس قسم المطبخ / الشيف التنفيذي",
    vacancies_count: 2,
    qualification_required: "مؤهل عالي / دبلوم سياحة وفنادق",
    experience_required: "من 2 إلى 5 سنوات خبرة في مطاعم كبرى",
    required_skills: "إعداد القوائم، سرعة التنفيذ، معايير سلامة الغذاء HACCP",
    salary_min: 6000,
    salary_max: 9000,
    job_description: "مطلوب طهاة وجبات شرقية وغربية للعمل بفرع الشركة الرئيسي.",
    responsibilities: "1. إعداد الوجبات والتجهيزات اليومية\n2. المتابعة مع أطقم العمل والمخازن\n3. النظافة العامة والسلامة",
    urgency: "urgent" as "normal" | "urgent" | "high",
    status: "pending_approval"
  });

  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqForm.title || !reqForm.requester_name) {
      showToast("يرجى ملء الوظيفة المطلوبة واسم رئيس القسم الطالب", "error");
      return;
    }

    try {
      const res = await fetch("/api/hr/job-postings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...reqForm,
          requisition_type: "head_of_dept",
          created_by: reqForm.requester_name
        })
      });

      if (res.ok) {
        showToast("تم إرسال طلب الاحتياج الوظيفي من رئيس القسم بنجاح 🎉");
        setShowRequisitionModal(false);
        setReqForm({
          title: "",
          department_name: "قسم المطبخ والطهي",
          requester_name: "",
          vacancies_count: 1,
          qualification_required: "مؤهل عالي",
          experience_required: "",
          required_skills: "",
          salary_min: 5000,
          salary_max: 8000,
          job_description: "",
          responsibilities: "",
          urgency: "urgent",
          status: "pending_approval"
        });
        onRefresh();
      } else {
        const err = await res.json();
        showToast(err.error || "فشل تسجيل طلب الاحتياج", "error");
      }
    } catch (err) {
      showToast("خطأ أثناء تسجيل الطلب", "error");
    }
  };

  const handleApproveAndPublish = async (reqId: number) => {
    try {
      const res = await fetch(`/api/hr/job-postings/${reqId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: "published"
        })
      });

      if (res.ok) {
        showToast("تم اعتماد طلب الاحتياج وتحويله لإعلان توظيف عام بنجاح! ✨");
        onRefresh();
      }
    } catch (err) {
      showToast("فشل تحديث حالة الطلب", "error");
    }
  };

  return (
    <div className="space-y-6 text-right dir-rtl font-cairo">
      {/* Top Banner & Action */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>طلبات الاحتياج الوظيفي (رؤساء الأقسام)</span>
              <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                Head of Dept Requisitions
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              تقديم واستعراض احتياجات الأقسام من الأفراد والمهارات والشهادات المطلوبة وتعيين المتقدمين مباشرة
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowRequisitionModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>+ تقديم طلب احتياج أفراد جديد</span>
        </button>
      </div>

      {/* Requisitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {jobPostings.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-extrabold text-slate-800 text-sm">لا توجد طلبات احتياج وظيفي حالياً</h3>
            <p className="text-xs text-slate-500 mt-1">يمكن لرؤساء الأقسام تقديم طلبات احتياج موظفين جديدة بسهولة.</p>
          </div>
        ) : (
          jobPostings.map((jp) => {
            const isApproved = jp.status === "published";

            return (
              <div
                key={jp.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Header info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                        {jp.department_name || "قسم عام"}
                      </span>
                      <h3 className="font-black text-base text-slate-900 mt-1.5">{jp.title}</h3>
                    </div>

                    <div className="text-left">
                      {jp.urgency === "urgent" || jp.urgency === "high" ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          احتياج عاجل
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                          طلب عادي
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Manager / Vacancies Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">رئيس القسم الطالب:</span>
                      <span className="font-extrabold text-slate-800">{jp.requester_name || jp.created_by || "الإدارة"}</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">عدد الأفراد المطلوبين:</span>
                      <span className="font-black text-purple-700">{jp.vacancies_count} أشخاص</span>
                    </div>
                  </div>

                  {/* Qualification & Experience */}
                  <div className="space-y-1.5 text-xs">
                    {jp.qualification_required && (
                      <div className="flex items-start gap-1.5 text-slate-700">
                        <GraduationCap className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span className="font-bold">المؤهل: {jp.qualification_required}</span>
                      </div>
                    )}

                    {jp.experience_required && (
                      <div className="flex items-start gap-1.5 text-slate-700">
                        <Award className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span className="font-bold">الخبرة: {jp.experience_required}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags */}
                  {jp.required_skills && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 block">المهارات المطلوبة:</span>
                      <div className="flex flex-wrap gap-1">
                        {jp.required_skills.split(",").map((s, i) => (
                          <span key={i} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Salary range */}
                  {(jp.salary_min > 0 || jp.salary_max > 0) && (
                    <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                      <span className="font-bold text-emerald-800">الراتب المرصود:</span>
                      <span className="font-extrabold text-emerald-900">
                        {jp.salary_min} - {jp.salary_max}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenApplyForPosting(jp)}
                    className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>رفع CV / إضافة متقدم</span>
                  </button>

                  <button
                    onClick={() => onFilterApplicationsForPosting(jp.id)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    عرض المتقدمين ({jp.applications_count || 0})
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Requisition Creation Modal */}
      {showRequisitionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    تقديم طلب احتیاج وظيفي جديد (رؤساء الأقسام)
                  </h3>
                  <p className="text-xs text-slate-400">تحديد الوظيفة والمهارات والمؤهل العلمي والعدد المطلوب</p>
                </div>
              </div>
              <button onClick={() => setShowRequisitionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequisition} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">الوظيفة المطلوبة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: طاهي وجبات شرقية / مشرف صالة"
                    value={reqForm.title}
                    onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">القسم الطالب *</label>
                  <select
                    value={reqForm.department_name}
                    onChange={(e) => setReqForm({ ...reqForm, department_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  >
                    <option value="قسم المطبخ والطهي">قسم المطبخ والطهي</option>
                    <option value="قسم الصالة والخدمة">قسم الصالة والخدمة</option>
                    <option value="قسم الحسابات والمالية">قسم الحسابات والمالية</option>
                    <option value="قسم الموارد البشرية">قسم الموارد البشرية</option>
                    <option value="قسم الدليفري والتوصيل">قسم الدليفري والتوصيل</option>
                    <option value="قسم الصيانات والتشغيل">قسم الصيانات والتشغيل</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">اسم رئيس القسم الطالب *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم الشيف/المدير صاحب الطلب"
                    value={reqForm.requester_name}
                    onChange={(e) => setReqForm({ ...reqForm, requester_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">عدد الأشخاص المطلوبين *</label>
                  <input
                    type="number"
                    min={1}
                    value={reqForm.vacancies_count}
                    onChange={(e) => setReqForm({ ...reqForm, vacancies_count: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block font-extrabold text-slate-800 mb-1">المؤهل والشهادة التعليمية المطلوبة</label>
                  <input
                    type="text"
                    placeholder="مثال: بكالوريوس سياحة وفنادق / مؤهل عالي مناسب"
                    value={reqForm.qualification_required}
                    onChange={(e) => setReqForm({ ...reqForm, qualification_required: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block font-extrabold text-slate-800 mb-1">الخبرات المطلوبة بالسنوات والتخصص</label>
                  <input
                    type="text"
                    placeholder="مثال: خبرة من 3 إلى 5 سنوات في المطاعم الفندقية"
                    value={reqForm.experience_required}
                    onChange={(e) => setReqForm({ ...reqForm, experience_required: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block font-extrabold text-slate-800 mb-1">المهارات المطلوبة (مفصولة بفواصل)</label>
                  <input
                    type="text"
                    placeholder="إعداد القوائم, سرعة الأداء, معايير السلامة, القيادة"
                    value={reqForm.required_skills}
                    onChange={(e) => setReqForm({ ...reqForm, required_skills: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">الراتب المتوقع (الحد أدنى)</label>
                  <input
                    type="number"
                    value={reqForm.salary_min}
                    onChange={(e) => setReqForm({ ...reqForm, salary_min: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">الراتب المتوقع (الحد أقصى)</label>
                  <input
                    type="number"
                    value={reqForm.salary_max}
                    onChange={(e) => setReqForm({ ...reqForm, salary_max: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block font-extrabold text-slate-800 mb-1">تفاصيل المهام والمسؤوليات</label>
                  <textarea
                    rows={3}
                    placeholder="اكتب المهام اليومية المطلوبة من الموظف..."
                    value={reqForm.job_description}
                    onChange={(e) => setReqForm({ ...reqForm, job_description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  ></textarea>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequisitionModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                >
                  إرسال طلب الاحتياج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
