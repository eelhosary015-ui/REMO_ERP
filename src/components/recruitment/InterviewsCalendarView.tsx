import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Search,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Star,
  MapPin,
  MessageSquare,
  FileText,
  Printer,
  FileSpreadsheet,
  Building2,
  X,
  Edit,
  ExternalLink,
  Sparkles
} from "lucide-react";
import * as XLSX from "xlsx";
import { Application } from "../RecruitmentSuite";
import { CandidateSheetModal } from "./CandidateSheetModal";

export interface Interview {
  id: number;
  application_id?: number;
  candidate_name: string;
  job_title: string;
  department_name?: string;
  phone?: string;
  interview_date: string;
  interview_time: string;
  interviewer_name?: string;
  interview_type?: string;
  location?: string;
  status: "scheduled" | "completed" | "passed" | "failed" | "cancelled";
  rating?: number;
  recommendation?: string;
  notes?: string;
  created_at?: string;
}

interface InterviewsCalendarViewProps {
  applications: Application[];
  showToast: (msg: string, type?: "success" | "error") => void;
  getAuthHeaders: () => Record<string, string>;
  onRefreshApplications: () => void;
  onConvertEmployee?: (candidate: Application) => void;
}

export const InterviewsCalendarView: React.FC<InterviewsCalendarViewProps> = ({
  applications,
  showToast,
  getAuthHeaders,
  onRefreshApplications,
  onConvertEmployee
}) => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Today's date YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showEvalModal, setShowEvalModal] = useState<boolean>(false);
  const [selectedInterviewForEval, setSelectedInterviewForEval] = useState<Interview | null>(null);

  const [selectedCandidateSheet, setSelectedCandidateSheet] = useState<Application | null>(null);

  // Forms
  const [scheduleForm, setScheduleForm] = useState({
    application_id: "",
    candidate_name: "",
    job_title: "",
    department_name: "",
    phone: "",
    interview_date: todayStr,
    interview_time: "10:30 AM",
    interviewer_name: "مسؤول الموارد البشرية",
    interview_type: "personal",
    location: "المقر الرئيسي - قاعة المقابلات",
    notes: ""
  });

  const [evalForm, setEvalForm] = useState({
    status: "passed" as "passed" | "failed" | "completed",
    rating: 4,
    recommendation: "مرشح ممتاز وتتوفر فيه كافة الشروط والمهارات المطلوبة",
    notes: "تم إجراء المقابلة واجتياز التقييم بنجاح."
  });

  // Fetch interviews from backend API
  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/interviews", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInterviews(data);
      }
    } catch (err) {
      console.error("Failed to load interviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  // Filter interviews
  const filteredInterviews = interviews.filter((inv) => {
    const matchesDate = !selectedDate || inv.interview_date === selectedDate;
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesSearch =
      inv.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.phone && inv.phone.includes(searchQuery));

    return matchesDate && matchesStatus && matchesSearch;
  });

  // Today's Stats
  const todayInterviews = interviews.filter((i) => i.interview_date === selectedDate);
  const todayTotal = todayInterviews.length;
  const todayScheduled = todayInterviews.filter((i) => i.status === "scheduled").length;
  const todayPassed = todayInterviews.filter((i) => i.status === "passed").length;
  const todayFailed = todayInterviews.filter((i) => i.status === "failed" || i.status === "cancelled").length;

  // Handle schedule interview submit
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.candidate_name || !scheduleForm.interview_date) {
      showToast("يرجى ملء اسم المتقدم وتاريخ المقابلة", "error");
      return;
    }

    try {
      const payload = {
        application_id: scheduleForm.application_id ? Number(scheduleForm.application_id) : null,
        candidate_name: scheduleForm.candidate_name,
        job_title: scheduleForm.job_title || "متقدم للعمل",
        department_name: scheduleForm.department_name,
        phone: scheduleForm.phone,
        interview_date: scheduleForm.interview_date,
        interview_time: scheduleForm.interview_time,
        interviewer_name: scheduleForm.interviewer_name,
        interview_type: scheduleForm.interview_type,
        location: scheduleForm.location,
        notes: scheduleForm.notes,
        status: "scheduled"
      };

      const res = await fetch("/api/hr/interviews", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("تم إضافة الموعد إلى جدول المقابلات اليومية بنجاح 📅");
        setShowScheduleModal(false);
        setScheduleForm({
          application_id: "",
          candidate_name: "",
          job_title: "",
          department_name: "",
          phone: "",
          interview_date: todayStr,
          interview_time: "10:30 AM",
          interviewer_name: "مسؤول الموارد البشرية",
          interview_type: "personal",
          location: "المقر الرئيسي - قاعة المقابلات",
          notes: ""
        });
        fetchInterviews();
      } else {
        showToast("فشل حفظ الموعد", "error");
      }
    } catch (err) {
      showToast("خطأ أثناء الاتصال بالخادم", "error");
    }
  };

  // Select Application to prefill schedule form
  const handleSelectApplicationForInterview = (appIdStr: string) => {
    const app = applications.find((a) => String(a.id) === appIdStr);
    if (app) {
      setScheduleForm((prev) => ({
        ...prev,
        application_id: String(app.id),
        candidate_name: app.candidate_name,
        job_title: app.job_title,
        department_name: app.department_name || "",
        phone: app.phone
      }));
    }
  };

  // Submit evaluation result
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterviewForEval) return;

    try {
      const res = await fetch(`/api/hr/interviews/${selectedInterviewForEval.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: evalForm.status,
          rating: evalForm.rating,
          recommendation: evalForm.recommendation,
          notes: evalForm.notes
        })
      });

      if (res.ok) {
        showToast(`تم حفظ تقييم المقابلة بنجاح! النتيجة: ${evalForm.status === "passed" ? "مقبول 🎉" : "غير مناسب"}`);
        setShowEvalModal(false);

        // Also update application status if linked
        if (selectedInterviewForEval.application_id) {
          const newAppStatus = evalForm.status === "passed" ? "offered" : evalForm.status === "failed" ? "rejected" : "interview";
          await fetch(`/api/hr/applications/${selectedInterviewForEval.application_id}/status`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              status: newAppStatus,
              notes: `تقييم المقابلة: ${evalForm.notes}`
            })
          });
          onRefreshApplications();
        }

        fetchInterviews();
      }
    } catch (err) {
      showToast("فشل تحديث التقييم", "error");
    }
  };

  // Export Daily Schedule to Excel
  const handleExportScheduleExcel = () => {
    const exportData = filteredInterviews.map((i, idx) => ({
      "م": idx + 1,
      "اسم المتقدم": i.candidate_name,
      "رقم الموبايل": i.phone || "-",
      "الوظيفة المطلوبة": i.job_title,
      "تاريخ المقابلة": i.interview_date,
      "توقيت المقابلة": i.interview_time,
      "مسؤول المقابلة": i.interviewer_name || "-",
      "المكان / القاعة": i.location || "-",
      "نوع المقابلة": i.interview_type === "personal" ? "حضورية" : "أونلاين",
      "الحالة": i.status === "scheduled" ? "مجدولة" : i.status === "passed" ? "مقبول" : i.status === "failed" ? "غير مناسب" : "مكتملة",
      "التقييم": i.rating ? `${i.rating}/5` : "-",
      "ملاحظات التقييم": i.notes || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "جدول المقابلات");
    XLSX.writeFile(workbook, `Daily_Interviews_${selectedDate || "all"}.xlsx`);
    showToast("تم تصدير شيت جدول المقابلات لملف Excel بنجاح 📊");
  };

  // Open candidate sheet
  const handleOpenCandidateSheet = (inv: Interview) => {
    // Check if application object exists
    let app = applications.find((a) => a.id === inv.application_id || a.candidate_name === inv.candidate_name);
    if (!app) {
      app = {
        id: inv.id,
        candidate_name: inv.candidate_name,
        phone: inv.phone || "",
        job_title: inv.job_title,
        department_name: inv.department_name,
        experience_years: 2,
        ai_match_score: 85,
        status: inv.status === "passed" ? "offered" : "interview",
        notes: inv.notes
      };
    }
    setSelectedCandidateSheet(app);
  };

  return (
    <div className="space-y-6 text-right dir-rtl font-cairo">
      {/* Candidate Profile Sheet Modal if selected */}
      {selectedCandidateSheet && (
        <CandidateSheetModal
          candidate={selectedCandidateSheet}
          onClose={() => setSelectedCandidateSheet(null)}
          onConvertEmployee={onConvertEmployee}
        />
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-purple-300 shadow-inner">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>جدول مواعيد المقابلات اليومية (Daily Interview Schedule)</span>
              <span className="bg-emerald-400 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-bold">
                HR Live Schedule
              </span>
            </h2>
            <p className="text-xs text-purple-200 mt-1">
              متابعة واستعراض المتقدمين المقرر عمل مقابلة شخصية لهم اليوم، وتسجيل التقييم واستخراج شيت البيانات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ جدولة مقابلة جديدة</span>
          </button>

          <button
            onClick={handleExportScheduleExcel}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-sm transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير جدول اليوم لـ Excel</span>
          </button>
        </div>
      </div>

      {/* Date Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">إجمالي مقابلات اليوم</span>
            <span className="text-2xl font-black text-slate-900">{todayTotal}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-black">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-600 block">المقابلات المتبقية / المجدولة</span>
            <span className="text-2xl font-black text-amber-700">{todayScheduled}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-black">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 block">المقبولين اليوم</span>
            <span className="text-2xl font-black text-emerald-700">{todayPassed}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-black">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-red-500 block">غير المناسبين / ملغاة</span>
            <span className="text-2xl font-black text-red-600">{todayFailed}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 font-black">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Date Selector Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Quick Date Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDate === todayStr ? "bg-white text-purple-900 shadow-sm font-black" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => {
                const tmr = new Date();
                tmr.setDate(tmr.getDate() + 1);
                setSelectedDate(tmr.toISOString().split("T")[0]);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              الغد
            </button>
            <button
              onClick={() => setSelectedDate("")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDate === "" ? "bg-white text-purple-900 shadow-sm font-black" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              كافة المواعيد
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-800">
            <Calendar className="w-4 h-4 text-purple-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالمتقدم أو الوظيفة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl py-1.5 pr-9 pl-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-600"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl py-1.5 px-3 text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="scheduled">مجدولة فقط</option>
            <option value="passed">مقبولين</option>
            <option value="failed">غير مناسبين</option>
            <option value="completed">مكتملة</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500">
          عدد المقابلات: <span className="text-purple-600 font-black">{filteredInterviews.length}</span>
        </div>
      </div>

      {/* Interviews List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-xs text-slate-500 font-bold mt-2">جاري تحميل جدول المقابلات...</p>
          </div>
        ) : filteredInterviews.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-extrabold text-slate-800 text-sm">لا توجد مقابلات محددة لهذا التاريخ</h3>
            <p className="text-xs text-slate-500 mt-1">يمكنك جدولة مقابلة جديدة لأي متقدم بسهولة.</p>
          </div>
        ) : (
          filteredInterviews.map((inv) => (
            <div
              key={inv.id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* Candidate & Job Info */}
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-black text-sm shrink-0">
                  {inv.candidate_name ? inv.candidate_name.charAt(0) : "M"}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-slate-900">{inv.candidate_name}</h3>
                    {inv.status === "scheduled" && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        ⏳ مجدولة
                      </span>
                    )}
                    {inv.status === "passed" && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        🎉 مقبول
                      </span>
                    )}
                    {inv.status === "failed" && (
                      <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        ❌ غير مناسب
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 font-bold">
                    <span className="text-purple-700">{inv.job_title}</span>
                    {inv.department_name && <span>• {inv.department_name}</span>}
                    {inv.phone && (
                      <span className="font-mono text-slate-700 dir-ltr" dir="ltr">
                        📞 {inv.phone}
                      </span>
                    )}
                  </div>

                  {inv.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 border border-slate-100">
                      ملاحظات: {inv.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Time & Location Details */}
              <div className="flex flex-wrap md:flex-nowrap items-center gap-4 border-t md:border-t-0 md:border-r border-slate-100 pt-3 md:pt-0 md:pr-4">
                <div className="text-right space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>توقيت المقابلة: <strong className="text-purple-900">{inv.interview_time}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>المكان: {inv.location || "المقر الرئيسي"}</span>
                  </div>

                  {inv.interviewer_name && (
                    <div className="text-[10px] text-slate-500">
                      المحاور: <strong className="text-slate-800">{inv.interviewer_name}</strong>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedInterviewForEval(inv);
                      setShowEvalModal(true);
                    }}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>تسجيل النتيجة</span>
                  </button>

                  <button
                    onClick={() => handleOpenCandidateSheet(inv)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>طباعة الشيت</span>
                  </button>

                  {inv.phone && (
                    <a
                      href={`https://wa.me/${inv.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                      title="تواصل واتساب"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: SCHEDULE NEW INTERVIEW */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">جدولة موعد مقابلة جديد</h3>
                  <p className="text-xs text-slate-400">تحديد تاريخ الموعد والمحاور ومكان المقابلة</p>
                </div>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3 text-xs">
              {/* Select candidate from existing applications if available */}
              {applications.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اختر متقدم من السجل (اختياري)</label>
                  <select
                    value={scheduleForm.application_id}
                    onChange={(e) => handleSelectApplicationForInterview(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  >
                    <option value="">-- أو أدخل بيانات المتقدم يدوي بالأسفل --</option>
                    {applications.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.candidate_name} ({a.job_title})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المتقدم بالكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="اسم المتقدم"
                  value={scheduleForm.candidate_name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, candidate_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الوظيفة *</label>
                  <input
                    type="text"
                    required
                    placeholder="الوظيفة المتقدم لها"
                    value={scheduleForm.job_title}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, job_title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="رقم الموبايل"
                    value={scheduleForm.phone}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ المقابلة *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.interview_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interview_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توقيت المقابلة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 11:30 AM"
                    value={scheduleForm.interview_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interview_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المحاور / القائم بالمقابلة</label>
                <input
                  type="text"
                  placeholder="مدير الموارد البشرية / الشيف التنفيذي"
                  value={scheduleForm.interviewer_name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مكان / قاعة المقابلة</label>
                <input
                  type="text"
                  placeholder="المقر الرئيسي - قاعة الاجتماعات A"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs hover:bg-purple-700 shadow-md"
                >
                  حفظ الموعد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INTERVIEW EVALUATION RECORD */}
      {showEvalModal && selectedInterviewForEval && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">تسجيل نتيجة وتقييم المقابلة</h3>
                <p className="text-xs text-purple-600 font-bold">المتقدم: {selectedInterviewForEval.candidate_name}</p>
              </div>
              <button onClick={() => setShowEvalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">النتيجة النهائية *</label>
                <select
                  value={evalForm.status}
                  onChange={(e: any) => setEvalForm({ ...evalForm, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none"
                >
                  <option value="passed">🎉 مقبول ومتوافق مع الوظيفة</option>
                  <option value="failed">❌ غير مناسب / مرفوض</option>
                  <option value="completed">🔄 مكتملة وفي انتظار القرار</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التقييم من 5 نجوم</label>
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setEvalForm({ ...evalForm, rating: star })}
                      className="p-1 focus:outline-none"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= evalForm.rating ? "text-amber-400 fill-amber-400" : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التوصية والملخص</label>
                <textarea
                  rows={3}
                  value={evalForm.notes}
                  onChange={(e) => setEvalForm({ ...evalForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 font-bold focus:outline-none focus:border-purple-600"
                  placeholder="اكتب انطباعات المقابلة وتفاصيل التقييم..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs hover:bg-purple-700 shadow-md"
                >
                  حفظ التقييم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
