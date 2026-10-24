import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Building2,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Sparkles,
  Upload,
  CheckCircle2,
  FileText,
  Globe,
  Search,
  Info,
  X,
  Phone,
  Mail,
  BookOpen,
  ArrowRight,
  Send,
  AlertCircle,
  ChevronLeft
} from "lucide-react";

export interface JobPosting {
  id: number;
  title: string;
  department_id?: number;
  department_name?: string;
  branch_id?: number;
  branch_name?: string;
  vacancies_count: number;
  salary_min: number;
  salary_max: number;
  employment_type: string;
  experience_years: number;
  required_skills?: string;
  job_description?: string;
  responsibilities?: string;
  benefits?: string;
  shift_info?: string;
  work_location?: string;
  status: "published" | "draft" | "closed";
  created_at?: string;
}

interface PublicCareersPortalProps {
  onBackToErp?: () => void;
}

export const PublicCareersPortal: React.FC<PublicCareersPortalProps> = ({ onBackToErp }) => {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobPosting | null>(null);
  const [selectedPostingForApply, setSelectedPostingForApply] = useState<JobPosting | null>(null);

  const [uploadingCvFile, setUploadingCvFile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [applyForm, setApplyForm] = useState({
    job_posting_id: null as number | null,
    job_title: "",
    department_name: "",
    candidate_name: "",
    phone: "",
    email: "",
    age: 25,
    english_level: "good",
    last_title: "",
    current_employer: "",
    address: "",
    reason_for_leaving: "",
    current_salary: 0,
    expected_salary: 0,
    salary_condition: "",
    experience_years: 2,
    qualification: "مؤهل عالي",
    candidate_skills: "",
    cover_letter: "",
    cv_text: "",
    cv_file_url: ""
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Public Job Postings
  const fetchJobPostings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/job-postings", { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        // Only keep published job postings for external applicants
        const published = Array.isArray(data)
          ? data.filter((j: JobPosting) => j.status === "published")
          : [];
        setJobPostings(published);
      }
    } catch (err) {
      console.error("Error fetching job postings:", err);
      showToast("تعذر جلب إعلانات الوظائف العامة", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobPostings();
  }, []);

  // Handle CV File Upload and Auto Parse via AI Gemini
  const handleFileUploadAndParse = async (file: File) => {
    setUploadingCvFile(true);
    try {
      const formData = new FormData();
      formData.append("cv_file", file);
      if (selectedPostingForApply) {
        formData.append("job_title", selectedPostingForApply.title);
        formData.append("required_skills", selectedPostingForApply.required_skills || "");
        formData.append("job_description", selectedPostingForApply.job_description || "");
      }

      const res = await fetch("/api/hr/parse-cv-file", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const a = data.analysis || {};
        setApplyForm((prev) => ({
          ...prev,
          candidate_name: a.candidate_name || prev.candidate_name || "",
          phone: a.phone || prev.phone || "",
          email: a.email || prev.email || "",
          age: a.age || prev.age,
          qualification: a.qualification || prev.qualification || "",
          experience_years: a.experience_years || prev.experience_years,
          english_level: a.english_level || prev.english_level || "",
          last_title: a.last_title || prev.last_title || "",
          current_employer: a.current_employer || prev.current_employer || "",
          address: a.address || prev.address || "",
          candidate_skills: Array.isArray(a.strengths)
            ? a.strengths.join(", ")
            : a.candidate_skills || prev.candidate_skills,
          cover_letter: a.ai_summary || prev.cover_letter,
          cv_text: data.extractedText || prev.cv_text || ""
        }));
        showToast("تم قراءة واستخراج كافة بيانات السيرة الذاتية بـ AI بنجاح ✨");
      } else {
        throw new Error(data.error || "تم رفع الملف بنجاح، يمكنك ملء البيانات المتبقية يدوياً");
      }
    } catch (err) {
      console.error("File parse error, using local offline fallback:", err);
      
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").replace(/\b(cv|resume|sira|zaty|job|apply)\b/gi, "").trim();
      setApplyForm((prev) => ({
        ...prev,
        candidate_name: prev.candidate_name || cleanName || "متقدم جديد",
        cv_file_url: URL.createObjectURL(file)
      }));
      
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b01[0125]\d{8}\b|\b05\d{8}\b|\b\+?\d{9,14}\b/);
            setApplyForm(prev => ({
              ...prev,
              email: emailMatch ? emailMatch[0].trim() : prev.email,
              phone: phoneMatch ? phoneMatch[0].trim() : prev.phone
            }));
          }
        };
        reader.readAsText(file);
      } catch (readErr) {}
      
      showToast("تعذر الاتصال بالخادم الذكي (وضع محلي). تم سحب الاسم بنجاح.", "success");
    } finally {
      setUploadingCvFile(false);
    }
  };

  // Submit Application
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.candidate_name.trim() || !applyForm.phone.trim()) {
      showToast("يرجى كتابة الاسم الكامل ورقم الهاتف على الأقل", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...applyForm,
        job_posting_id: selectedPostingForApply?.id || applyForm.job_posting_id || null,
        job_title: selectedPostingForApply?.title || applyForm.job_title || "متقدم عام",
        department_name: selectedPostingForApply?.department_name || applyForm.department_name
      };

      const res = await fetch("/api/hr/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSubmitSuccess(true);
        showToast("تم إرسال طلب التوظيف بنجاح! وسيتواصل معك مسؤولو HR قريباً");
      } else {
        const errObj = await res.json();
        showToast(errObj.error || "فشل إرسال الطلب، يرجى المحاولة لاحقاً", "error");
      }
    } catch (err) {
      console.error("Submit error:", err);
      showToast("تعذر الإتصال بالخادم، يرجى إعادة المحاولة", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openApplyForJob = (job: JobPosting | null) => {
    setSelectedPostingForApply(job);
    setApplyForm({
      job_posting_id: job ? job.id : null,
      job_title: job ? job.title : "",
      department_name: job ? job.department_name || "" : "",
      candidate_name: "",
      phone: "",
      email: "",
      age: 25,
      english_level: "good",
      last_title: "",
      current_employer: "",
      address: "",
      reason_for_leaving: "",
      current_salary: 0,
      expected_salary: 0,
      salary_condition: "",
      experience_years: job ? job.experience_years : 2,
      qualification: "مؤهل عالي",
      candidate_skills: job ? job.required_skills || "" : "",
      cover_letter: "",
      cv_text: "",
      cv_file_url: ""
    });
    setSubmitSuccess(false);
    setIsApplying(true);
  };

  // Filter Jobs
  const filteredJobs = jobPostings.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.department_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.required_skills || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.branch_name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept =
      selectedDeptFilter === "all" || job.department_name === selectedDeptFilter;

    return matchesSearch && matchesDept;
  });

  const departmentsList = Array.from(
    new Set(jobPostings.map((j) => j.department_name).filter(Boolean))
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 dir-rtl font-sans pb-16">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[150] px-6 py-3 rounded-2xl shadow-2xl text-white flex items-center gap-2 text-sm font-bold animate-bounce ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Navigation Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-purple-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>بوابة إعلانات الوظائف والفرص المتاحة</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  الوظائف الشاغرة
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                منظومة التوظيف الرقمية المباشرة مع استخراج بيانات السيرة الذاتية بـ AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openApplyForJob(null)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>تقديم طلب توظيف عام</span>
            </button>

            {onBackToErp && (
              <button
                onClick={onBackToErp}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>العودة للنظام</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-purple-950 via-slate-900 to-slate-900 border-b border-slate-800/80 py-12 px-4 text-center">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-3xl mx-auto space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>نظام التقديم والفرز التلقائي للسير الذاتية</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
            انضم إلى فريق عملنا المتميز وساهم في بناء المستقبل
          </h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
            استعرض كافة الفرص الوظيفية المتاحة وقدم طلبك بسهولة من خلال رفع ملف السيرة الذاتية الخاصة بك (PDF, Word, Excel, صورة) ليقوم الذكاء الاصطناعي بتعبئة كافة البيانات بدقة متناهية.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        {/* Search & Department Filters */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-5 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث عن مسمى وظيفي، مهارات مطلوبة، أو فرع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-400 font-bold focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedDeptFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedDeptFilter === "all"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-black"
                  : "bg-slate-900/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              جميع الأقسام ({jobPostings.length})
            </button>
            {departmentsList.map((dept, deptIdx) => (
              <button
                key={`career-dept-${dept || deptIdx}-${deptIdx}`}
                onClick={() => setSelectedDeptFilter(dept as string)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedDeptFilter === dept
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-black"
                    : "bg-slate-900/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Job Postings Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-slate-400 text-xs font-bold">جاري تحميل إعلانات الوظائف المتاحة...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/80 rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400 mx-auto border border-slate-700">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">لا توجد إعلانات وظائف مطابقة حالياً</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              تصفح الأقسام الأخرى أو قم بالتقديم المباشر من خلال نموذج التقديم العام المتاح بالأعلى ليتم حفظ بياناتك في قاعدة بيانات التوظيف.
            </p>
            <button
              onClick={() => openApplyForJob(null)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>تقديم طلب توظيف عام الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-800/80 border border-slate-700/90 hover:border-purple-500/50 rounded-3xl p-6 transition-all shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Category & Location Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {job.department_name || "قسم عام"}
                    </span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      متاح للتقديم
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-black text-white group-hover:text-purple-300 transition-colors">
                    {job.title}
                  </h3>

                  {/* Brief Specs */}
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>الفرع / الموقع: {job.branch_name || job.work_location || "جميع الفروع"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>العدد المطلوب: {job.vacancies_count} شواغر</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-emerald-300">
                        الراتب المتوقع: {Number(job.salary_min || 0 || 0).toLocaleString()} - {Number(job.salary_max || 0 || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>الخبرة المطلوبة: {job.experience_years} سنوات على الأقل</span>
                    </div>
                  </div>

                  {/* Skills Badges */}
                  {job.required_skills && (
                    <div className="pt-3 border-t border-slate-700/60">
                      <p className="text-[10px] font-bold text-slate-400 mb-1.5">المهارات المطلوبة:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.required_skills.split(",").map((sk, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/70"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-slate-700/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedJobDetail(job)}
                    className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 hover:underline"
                  >
                    <Info className="w-4 h-4 text-purple-400" />
                    <span>تفاصيل المزايا والشروط</span>
                  </button>

                  <button
                    onClick={() => openApplyForJob(job)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>قدّم الآن</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL 1: JOB DETAILS & REQUIREMENTS MODAL */}
      {selectedJobDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-6 bg-gradient-to-r from-purple-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {selectedJobDetail.department_name || "قسم عام"}
                </span>
                <h3 className="text-xl font-black text-white mt-2">{selectedJobDetail.title}</h3>
              </div>
              <button
                onClick={() => setSelectedJobDetail(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/80 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs text-slate-300 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">عدد الشواغر</span>
                  <span className="text-sm font-black text-white">{selectedJobDetail.vacancies_count} متاح</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">الراتب المتوقع</span>
                  <span className="text-sm font-black text-emerald-400">
                    {selectedJobDetail.salary_min} - {selectedJobDetail.salary_max} ج.م
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">سنوات الخبرة</span>
                  <span className="text-sm font-black text-white">{selectedJobDetail.experience_years}+ سنوات</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">مقر العمل</span>
                  <span className="text-sm font-black text-purple-300">
                    {selectedJobDetail.branch_name || selectedJobDetail.work_location || "الرئيسي"}
                  </span>
                </div>
              </div>

              {selectedJobDetail.job_description && (
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>الوصف الوظيفي العامة:</span>
                  </h4>
                  <p className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60 leading-relaxed font-medium">
                    {selectedJobDetail.job_description}
                  </p>
                </div>
              )}

              {selectedJobDetail.responsibilities && (
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>المهام والمسؤوليات الرئيسية:</span>
                  </h4>
                  <p className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60 leading-relaxed whitespace-pre-line font-medium">
                    {selectedJobDetail.responsibilities}
                  </p>
                </div>
              )}

              {selectedJobDetail.benefits && (
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>المزايا الوظيفية والحوافز:</span>
                  </h4>
                  <p className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60 leading-relaxed font-medium text-amber-200">
                    {selectedJobDetail.benefits}
                  </p>
                </div>
              )}

              {selectedJobDetail.shift_info && (
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>نظام الشفتات ومواعيد العمل:</span>
                  </h4>
                  <p className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60 leading-relaxed font-medium">
                    {selectedJobDetail.shift_info}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => setSelectedJobDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
              >
                إغلاق
              </button>
              <button
                onClick={() => {
                  const j = selectedJobDetail;
                  setSelectedJobDetail(null);
                  openApplyForJob(j);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs shadow-lg flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>قدّم على هذه الوظيفة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPLICATION FORM MODAL (WITH AI CV PARSER) */}
      {isApplying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
            <div className="p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  نموذج التقديم المباشر
                </span>
                <h3 className="text-xl font-black text-white mt-1">
                  {selectedPostingForApply ? `التقديم على وظيفة: ${selectedPostingForApply.title}` : "تقديم طلب توظيف عام"}
                </h3>
              </div>
              <button
                onClick={() => { setSelectedPostingForApply(null); setIsApplying(false); }}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/80 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
              {submitSuccess ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-3xl flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <h3 className="text-xl font-black text-white">تم استلام طلب التوظيف الخاص بك بنجاح!</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    نشكرك على اهتمامك بالانضمام لفريقنا. سيقوم فريق الموارد البشرية (HR) بمراجعة مؤهلاتك والتواصل معك عبر رقم الهاتف المدخل في أقرب وقت.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedPostingForApply(null);
                      setSubmitSuccess(false);
    setIsApplying(false);
                    }}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs"
                  >
                    تم، إغلاق النافذة
                  </button>
                </div>
              ) : (
                <>
                  {/* AI CV Dropzone File Parser */}
                  <div className="p-6 bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-purple-950/80 border-2 border-dashed border-purple-500/50 rounded-3xl text-center space-y-3 relative">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUploadAndParse(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/40 rounded-2xl flex items-center justify-center text-purple-300 mx-auto">
                      {uploadingCvFile ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">
                        {uploadingCvFile
                          ? "جاري رفع وقراءة السيرة الذاتية واستخراج البيانات بـ AI..."
                          : "ارفع ملف السيرة الذاتية (CV) لتعبئة كافة الحقول تلقائياً"}
                      </h4>
                      <p className="text-xs text-purple-300 mt-1 font-medium">
                        يدعم جميع الأنواع: Word (.docx/.doc)، Excel (.xlsx)، PDF، الصور، والملفات النصية
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitApplication} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          الاسم بالكامل (Name) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: أحمد محمود علي"
                          value={applyForm.candidate_name}
                          onChange={(e) => setApplyForm({ ...applyForm, candidate_name: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          رقم الموبايل / الهاتف *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="010XXXXXXXX"
                          value={applyForm.phone}
                          onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          البريد الإلكتروني
                        </label>
                        <input
                          type="email"
                          placeholder="candidate@example.com"
                          value={applyForm.email}
                          onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">الوظيفة المتقدم لها</label>
                        <input
                          type="text"
                          value={applyForm.job_title}
                          onChange={(e) => setApplyForm({ ...applyForm, job_title: e.target.value })}
                          placeholder="مثال: محاسب تكاليف"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">المؤهل الدراسي</label>
                        <input
                          type="text"
                          value={applyForm.qualification}
                          onChange={(e) => setApplyForm({ ...applyForm, qualification: e.target.value })}
                          placeholder="بكالوريوس تجارة"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">سنوات الخبرة</label>
                        <input
                          type="number"
                          value={applyForm.experience_years}
                          onChange={(e) => setApplyForm({ ...applyForm, experience_years: Number(e.target.value) })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">العمر</label>
                        <input
                          type="number"
                          value={applyForm.age}
                          onChange={(e) => setApplyForm({ ...applyForm, age: Number(e.target.value) })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">مستوى الإنجليزية</label>
                        <select
                          value={applyForm.english_level}
                          onChange={(e) => setApplyForm({ ...applyForm, english_level: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        >
                          <option value="basic">مبتدئ (Basic)</option>
                          <option value="good">جيد (Good)</option>
                          <option value="very_good">جيد جداً (Very Good)</option>
                          <option value="fluent">ممتاز / طليق (Fluent)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">آخر مسمى وظيفي</label>
                        <input
                          type="text"
                          value={applyForm.last_title}
                          onChange={(e) => setApplyForm({ ...applyForm, last_title: e.target.value })}
                          placeholder="محاسب أول"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">آخر جهة عمل (الشركة)</label>
                        <input
                          type="text"
                          value={applyForm.current_employer}
                          onChange={(e) => setApplyForm({ ...applyForm, current_employer: e.target.value })}
                          placeholder="شركة النور للتجارة"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">الراتب الحالي (ج.م)</label>
                        <input
                          type="number"
                          value={applyForm.current_salary}
                          onChange={(e) => setApplyForm({ ...applyForm, current_salary: Number(e.target.value) })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">الراتب المتوقع (ج.م)</label>
                        <input
                          type="number"
                          value={applyForm.expected_salary}
                          onChange={(e) => setApplyForm({ ...applyForm, expected_salary: Number(e.target.value) })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">العنوان والمحافظة</label>
                        <input
                          type="text"
                          value={applyForm.address}
                          onChange={(e) => setApplyForm({ ...applyForm, address: e.target.value })}
                          placeholder="القاهرة - مدينة نصر"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">المهارات والخبرات الرئيسية</label>
                      <input
                        type="text"
                        value={applyForm.candidate_skills}
                        onChange={(e) => setApplyForm({ ...applyForm, candidate_skills: e.target.value })}
                        placeholder="Excel, SAP, إعداد القوائم المالية, القيادة..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">نبذة أو ملاحظات إضافية (Cover Letter)</label>
                      <textarea
                        rows={3}
                        value={applyForm.cover_letter}
                        onChange={(e) => setApplyForm({ ...applyForm, cover_letter: e.target.value })}
                        placeholder="اكتب نبذة مختارات عن خبراتك وسبب اهتمامك بهذة الوظيفة..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => { setSelectedPostingForApply(null); setIsApplying(false); }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                      >
                        إلغاء
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2"
                      >
                        {isSubmitting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>إرسال طلب التوظيف الآن</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
