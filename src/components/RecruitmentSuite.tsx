import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Briefcase,
  Users,
  Search,
  Filter,
  Sparkles,
  Plus,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Trash2,
  Edit,
  Download,
  Upload,
  ChevronRight,
  Star,
  MessageSquare,
  TrendingUp,
  Award,
  RefreshCw,
  Send,
  FileSpreadsheet,
  Globe,
  Copy,
  ExternalLink,
  Layers,
  ArrowRight,
  Phone,
  Mail,
  Check,
  X,
  Calendar,
  HelpCircle,
  Info,
  ListCheck,
  Gift,
  Sun,
  Printer
} from "lucide-react";
import * as XLSX from "xlsx";
import { CandidateSheetModal } from "./recruitment/CandidateSheetModal";
import { DepartmentRequisitionsView } from "./recruitment/DepartmentRequisitionsView";
import { InterviewsCalendarView } from "./recruitment/InterviewsCalendarView";

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
  created_by?: string;
  created_at?: string;
  applications_count?: number;
  rejected_count?: number;
  hired_count?: number;
  requisition_type?: "job_posting" | "head_of_dept";
  requester_name?: string;
  qualification_required?: string;
  experience_required?: string;
  urgency?: "normal" | "urgent" | "high";
}

export interface Application {
  id: number;
  job_posting_id?: number;
  job_title: string;
  department_name?: string;
  candidate_name: string;
  phone: string;
  email?: string;
  age?: number;
  experience_years: number;
  english_level?: string;
  last_title?: string;
  current_employer?: string;
  address?: string;
  reason_for_leaving?: string;
  current_salary?: number;
  expected_salary?: number;
  salary_condition?: string;
  qualification?: string;
  candidate_skills?: string;
  cover_letter?: string;
  cv_text?: string;
  cv_file_url?: string;
  ai_match_score: number;
  ai_summary?: string;
  ai_recommendation?: string;
  ai_strengths?: string;
  ai_gaps?: string;
  status: "submitted" | "reviewing" | "interview" | "offered" | "hired" | "rejected";
  rejection_reason?: string;
  rating?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface RecruitmentSuiteProps {
  departments?: any[];
  branches?: any[];
  onRefreshEmployees?: () => void;
}

export const RecruitmentSuite: React.FC<RecruitmentSuiteProps> = ({
  departments = [],
  branches = [],
  onRefreshEmployees
}) => {
  const [activeTab, setActiveTab] = useState<
    "ats" | "applicants" | "postings" | "requisitions" | "interviews_calendar" | "apply_page" | "rejected_dashboard" | "ai_cv_tester"
  >("ats");

  const [selectedCandidateForSheetModal, setSelectedCandidateForSheetModal] = useState<Application | null>(null);

  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [skillsSearchFilter, setSkillsSearchFilter] = useState<string>("");

  // Modals & Detail Views
  const [showJobModal, setShowJobModal] = useState<boolean>(false);
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobPosting | null>(null);
  const [showJobDetailModal, setShowJobDetailModal] = useState<boolean>(false);

  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [selectedPostingForApply, setSelectedPostingForApply] = useState<JobPosting | null>(null);

  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showAppDetailModal, setShowAppDetailModal] = useState<boolean>(false);

  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [appToReject, setAppToReject] = useState<Application | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>("");

  // Applicant File Management States
  const [hasFileFilter, setHasFileFilter] = useState<"all" | "with_file" | "without_file">("all");
  const [previewFileModal, setPreviewFileModal] = useState<{ url: string; candidateName: string; title: string } | null>(null);
  const [uploadingForAppId, setUploadingForAppId] = useState<number | null>(null);

  // Attach / Upload File directly to an Applicant
  const handleAttachFileToApplicant = async (appId: number, file: File) => {
    setUploadingForAppId(appId);
    try {
      const formData = new FormData();
      formData.append("cv_file", file);
      formData.append("file", file);

      let fileUrl = "";
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token") || localStorage.getItem("jwt_token") || "";

      try {
        const uploadRes = await fetch("/api/hr/parse-cv-file", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          fileUrl = data.file_url || data.cv_file_url || (data.file ? `/uploads/${data.file.filename}` : "");
        }
      } catch (e) {
        console.warn("Parse API failed, trying upload endpoint...", e);
      }

      if (!fileUrl) {
        try {
          const fallbackRes = await fetch("/api/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            fileUrl = fallbackData.url || "";
          }
        } catch (e) {
          console.warn("Upload API failed", e);
        }
      }

      if (!fileUrl) {
        fileUrl = URL.createObjectURL(file);
      }

      const updateRes = await fetch(`/api/hr/applications/${appId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ cv_file_url: fileUrl })
      });

      if (updateRes.ok || fileUrl) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, cv_file_url: fileUrl } : a))
        );
        showToast("تم إرفاق ملف السيرة الذاتية والمستند للمتقدم بنجاح 📁✨");
      }
    } catch (err) {
      console.error("Error attaching file to applicant:", err);
      showToast("حدث خطأ أثناء رفع ملف السيرة الذاتية للمتقدم", "error");
    } finally {
      setUploadingForAppId(null);
    }
  };

  // Job Posting Form
  const [jobForm, setJobForm] = useState({
    title: "",
    department_name: "",
    branch_name: "",
    vacancies_count: 1,
    salary_min: 5000,
    salary_max: 8000,
    employment_type: "full_time",
    experience_years: 2,
    required_skills: "إدارة الوقت، التواصل، المهارات الفنية، العمل الجماعي",
    job_description: "توفير بيئة عمل ممتازة وتحقيق أهداف القسم بكفاءة عالية.",
    responsibilities: "1. الإشراف والمتابعة اليومية\n2. تقديم التقارير للإدارة\n3. الالتزام بمعايير الجودة والسلامة",
    benefits: "تأمين طبي شامل، حوافز شهرية، بدل سكن وانتقالات، وجبة يومية",
    shift_info: "8 ساعات يومياً - نظام ورديات متغير مع يوم راحة أسبوعية",
    work_location: "الفرع الرئيسي / فرع التجمع الخامس",
    status: "published"
  });

  // Application Form
  const [applyForm, setApplyForm] = useState({
    candidate_name: "",
    phone: "",
    email: "",
    age: 25,
    english_level: "Good",
    last_title: "",
    job_title: "",
    department_name: "",
    current_employer: "",
    address: "",
    reason_for_leaving: "",
    current_salary: 0,
    expected_salary: 0,
    salary_condition: "قابل للتفاوض",
    experience_years: 1,
    qualification: "مؤهل عالي",
    candidate_skills: "",
    cover_letter: "",
    cv_text: "",
    cv_file_url: ""
  });

  // AI CV Parser States
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [uploadingCvFile, setUploadingCvFile] = useState<boolean>(false);
  const [aiTestCvText, setAiTestCvText] = useState<string>("");
  const [aiTestResult, setAiTestResult] = useState<any>(null);

  // File Upload & AI Parse Handler (Word, Excel, PDF, Images, Text)
  const handleFileUploadAndParse = async (file: File) => {
    if (!file) return;
    setUploadingCvFile(true);
    try {
      const formData = new FormData();
      formData.append("cv_file", file);
      if (selectedPostingForApply?.title) {
        formData.append("job_title", selectedPostingForApply.title);
        formData.append("required_skills", selectedPostingForApply.required_skills || "");
      } else if (applyForm.job_title) {
        formData.append("job_title", applyForm.job_title);
      }

      const headers: Record<string, string> = {};
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token") || localStorage.getItem("jwt_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/hr/parse-cv-file", {
        method: "POST",
        headers,
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success && data.analysis) {
        const a = data.analysis;
        setApplyForm((prev) => ({
          ...prev,
          candidate_name: a.candidate_name || prev.candidate_name || "",
          phone: a.phone || prev.phone || "",
          email: a.email || prev.email || "",
          age: a.age || prev.age || 25,
          english_level: a.english_level || prev.english_level || "Good",
          last_title: a.last_title || prev.last_title || "",
          job_title: a.applying_title || prev.job_title || selectedPostingForApply?.title || "",
          current_employer: a.current_employer || prev.current_employer || "",
          address: a.address || prev.address || "",
          reason_for_leaving: a.reason_for_leaving || prev.reason_for_leaving || "",
          current_salary: a.current_salary != null ? a.current_salary : prev.current_salary,
          expected_salary: a.expected_salary != null ? a.expected_salary : prev.expected_salary,
          salary_condition: a.salary_condition || prev.salary_condition || "",
          experience_years: a.experience_years != null ? a.experience_years : prev.experience_years,
          qualification: a.qualification || prev.qualification || "",
          candidate_skills: a.candidate_skills || prev.candidate_skills || "",
          cover_letter: a.cover_letter || prev.cover_letter || "",
          cv_file_url: data.file_url || prev.cv_file_url || "",
          cv_text: prev.cv_text || ""
        }));
        setActiveTab("apply_page");
        showToast("تم رفع وتحليل السيرة الذاتية وتعبئة كافة حقول النموذج بالذكاء الاصطناعي بنجاح ✨");
      } else {
        throw new Error(data.message || data.error || "فشل استخراج البيانات من الملف");
      }
    } catch (err) {
      console.error("File upload parse failed, using local offline fallback:", err);
      
      // Client-side Offline Fallback (Local System Mode)
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").replace(/\b(cv|resume|sira|zaty|job|apply)\b/gi, "").trim();
      
      setApplyForm((prev) => ({
        ...prev,
        candidate_name: prev.candidate_name || cleanName || "متقدم جديد",
        cv_file_url: URL.createObjectURL(file)
      }));
      
      // Try to extract basic text locally (works for some pdfs/docs and all txt/csv)
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
      } catch (readErr) {
        // ignore
      }

      setActiveTab("apply_page");
      showToast("تم سحب البيانات محلياً (الوضع المحلي/الاحتياطي) بنجاح.", "success");
    } finally {
      setUploadingCvFile(false);
    }
  };

  // Notification Banner
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token") || localStorage.getItem("auth_token") || localStorage.getItem("jwt_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch Recruitment Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, appsRes] = await Promise.all([
        fetch("/api/hr/job-postings", { headers: getAuthHeaders() }),
        fetch("/api/hr/applications", { headers: getAuthHeaders() })
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobPostings(jobsData);
      }
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApplications(appsData);
      }
    } catch (err) {
      console.error("Error loading recruitment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save Job Posting (With Detailed Requirements)
  const handleSaveJobPosting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.title) {
      showToast("يرجى إدخال مسمى الوظيفة", "error");
      return;
    }

    try {
      const res = await fetch("/api/hr/job-postings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(jobForm)
      });

      if (res.ok) {
        showToast("تم نشر إعلان الوظيفة مع التفاصيل الكاملة بنجاح ✨");
        setShowJobModal(false);
        setJobForm({
          title: "",
          department_name: "",
          branch_name: "",
          vacancies_count: 1,
          salary_min: 5000,
          salary_max: 8000,
          employment_type: "full_time",
          experience_years: 2,
          required_skills: "",
          job_description: "",
          responsibilities: "",
          benefits: "",
          shift_info: "",
          work_location: "",
          status: "published"
        });
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || "فشل نشر الوظيفة", "error");
      }
    } catch (err) {
      showToast("خطأ في الاتصال بالخادم", "error");
    }
  };

  // Analyze CV with AI
  const handleAnalyzeCvWithAi = async () => {
    if (!applyForm.cv_text) {
      showToast("يرجى لصق نص السيرة الذاتية أو المهارات للتحليل", "error");
      return;
    }

    setIsAiAnalyzing(true);
    try {
      const res = await fetch("/api/hr/parse-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv_text: applyForm.cv_text,
          job_title: applyForm.job_title || selectedPostingForApply?.title,
          required_skills: selectedPostingForApply?.required_skills,
          job_description: selectedPostingForApply?.job_description
        })
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        const a = data.analysis;
        setApplyForm((prev) => ({
          ...prev,
          candidate_name: prev.candidate_name || a.candidate_name || "",
          phone: prev.phone || a.phone || "",
          email: prev.email || a.email || "",
          experience_years: a.experience_years || prev.experience_years,
          qualification: a.qualification || prev.qualification,
          candidate_skills: Array.isArray(a.strengths)
            ? a.strengths.join(", ")
            : prev.candidate_skills
        }));
        showToast("تم تحليل ومطابقة السيرة الذاتية بالذكاء الاصطناعي بنجاح ✨");
      }
    } catch (err) {
      showToast("تعذر الاتصال بخدمة AI للتحليل", "error");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Submit Application
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.candidate_name || !applyForm.phone) {
      showToast("يرجى ملء اسم المتقدم ورقم الهاتف", "error");
      return;
    }

    try {
      let aiData: any = {};
      if (applyForm.cv_text && !applyForm.candidate_skills) {
        const parseRes = await fetch("/api/hr/parse-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cv_text: applyForm.cv_text,
            job_title: applyForm.job_title || selectedPostingForApply?.title,
            required_skills: selectedPostingForApply?.required_skills
          })
        });
        if (parseRes.ok) {
          const resObj = await parseRes.json();
          aiData = resObj.analysis || {};
        }
      }

      const payload = {
        job_posting_id: selectedPostingForApply?.id || null,
        job_title: selectedPostingForApply?.title || applyForm.job_title || "متقدم عام",
        department_name: selectedPostingForApply?.department_name || applyForm.department_name,
        candidate_name: applyForm.candidate_name,
        phone: applyForm.phone,
        email: applyForm.email,
        age: applyForm.age,
        english_level: applyForm.english_level,
        last_title: applyForm.last_title,
        current_employer: applyForm.current_employer,
        address: applyForm.address,
        reason_for_leaving: applyForm.reason_for_leaving,
        current_salary: applyForm.current_salary,
        expected_salary: applyForm.expected_salary,
        salary_condition: applyForm.salary_condition,
        experience_years: applyForm.experience_years,
        qualification: applyForm.qualification,
        candidate_skills: applyForm.candidate_skills,
        cover_letter: applyForm.cover_letter,
        cv_text: applyForm.cv_text,
        cv_file_url: applyForm.cv_file_url,
        ai_match_score: aiData.match_score || 85,
        ai_summary: aiData.summary || "تم تسليم وتحليل بيانات المتقدم بنجاح.",
        ai_recommendation: aiData.fit_recommendation || "مناسب جداً للوظيفة",
        ai_strengths: Array.isArray(aiData.strengths) ? aiData.strengths.join(", ") : aiData.strengths,
        ai_gaps: Array.isArray(aiData.gaps) ? aiData.gaps.join(", ") : aiData.gaps
      };

      const res = await fetch("/api/hr/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("تم إرسال طلب التوظيف واستخراج بيانات شيت المتقدمين بنجاح! 🎉");
        setShowApplyModal(false);
        setApplyForm({
          candidate_name: "",
          phone: "",
          email: "",
          age: 25,
          english_level: "Good",
          last_title: "",
          job_title: "",
          department_name: "",
          current_employer: "",
          address: "",
          reason_for_leaving: "",
          current_salary: 0,
          expected_salary: 0,
          salary_condition: "قابل للتفاوض",
          experience_years: 1,
          qualification: "مؤهل عالي",
          candidate_skills: "",
          cover_letter: "",
          cv_text: "",
          cv_file_url: ""
        });
        fetchData();
      } else {
        showToast("فشل تقديم الطلب", "error");
      }
    } catch (err) {
      showToast("خطأ أثناء تسجيل الطلب", "error");
    }
  };

  // Update Status in ATS Pipeline
  const handleUpdateStatus = async (appId: number, newStatus: string, rejectionReason?: string) => {
    try {
      const res = await fetch(`/api/hr/applications/${appId}/status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: newStatus,
          rejection_reason: rejectionReason
        })
      });

      if (res.ok) {
        showToast(`تم تحديث حالة الطلب إلى: ${getStageLabel(newStatus)}`);
        setShowRejectModal(false);
        setRejectionReasonInput("");
        fetchData();
      }
    } catch (err) {
      showToast("فشل تحديث حالة الطلب", "error");
    }
  };

  // Hire Applicant directly into HR Employees
  const handleConvertCandidateToEmployee = async (app: Application) => {
    if (!confirm(`هل أنت تأكد من نقل المتقدم "${app.candidate_name}" إلى قائمة الموظفين النشطين بالشركة؟`)) return;

    try {
      const res = await fetch(`/api/hr/applications/${app.id}/hire-to-employee`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          basic_salary: app.expected_salary || app.current_salary || 5000
        })
      });

      if (res.ok) {
        showToast("🎉 تم نقل المتقدم إلى سجل الموظفين وتعيينه رسمياً بنجاح!");
        fetchData();
        if (onRefreshEmployees) onRefreshEmployees();
      } else {
        const err = await res.json();
        showToast(err.error || "فشل تحويل المتقدم لموظف", "error");
      }
    } catch (err) {
      showToast("خطأ أثناء تحويل المتقدم", "error");
    }
  };

  // Export to Excel (Standard & Exact AP Candidates Sheet format matching user request)
  const handleExportApplicationsExcel = (dataToExport = applications, fileName = "AP_Candidates_Sheet.xlsx") => {
    const exportRows = dataToExport.map((a, idx) => ({
      "N": idx + 1,
      "Name": a.candidate_name,
      "Age": a.age || "-",
      "Mail": a.email || "-",
      "Mobile Number": a.phone,
      "years of exp": a.experience_years || 0,
      "English level": a.english_level || "-",
      "Last title": a.last_title || "-",
      "Applying Titlre": a.job_title || "-",
      "Current / Last Employer": a.current_employer || "-",
      "Address": a.address || "-",
      "Reason": a.reason_for_leaving || "-",
      "current salary": a.current_salary || 0,
      "Expected Salary": a.expected_salary || 0,
      "Salary condition": a.salary_condition || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AP Candidates");
    XLSX.writeFile(workbook, fileName);
    showToast("تم تحويل وتصدير شيت المتقدمين AP Candidates Sheet إلى ملف Excel بنجاح 📊");
  };

  const getStageLabel = (st: string) => {
    switch (st) {
      case "submitted":
        return "مقدم حديثاً";
      case "reviewing":
        return "قيد الفحص والمراجعة";
      case "interview":
        return "مقابلة شخصية";
      case "offered":
        return "عرض عمل متاح";
      case "hired":
        return "مقبول وتعين كـ موظف";
      case "rejected":
        return "مرفوض / غير مناسب";
      default:
        return st;
    }
  };

  // Filter Applicants
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.phone.includes(searchQuery) ||
      app.job_title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSkills =
      !skillsSearchFilter ||
      (app.candidate_skills &&
        app.candidate_skills.toLowerCase().includes(skillsSearchFilter.toLowerCase()));

    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesJob = selectedJobFilter === "all" || String(app.job_posting_id) === selectedJobFilter;

    const matchesFile =
      hasFileFilter === "all" ||
      (hasFileFilter === "with_file" && Boolean(app.cv_file_url || app.cv_text)) ||
      (hasFileFilter === "without_file" && !app.cv_file_url && !app.cv_text);

    return matchesSearch && matchesSkills && matchesStatus && matchesJob && matchesFile;
  });

  const rejectedApps = applications.filter((app) => app.status === "rejected");

  return (
    <div className="space-y-6 text-right dir-rtl font-cairo">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 left-6 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white transition-all transform animate-bounce ${
            notification.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <AlertCircle className="w-6 h-6" />
          )}
          <span className="font-bold text-sm">{notification.msg}</span>
        </div>
      )}

      {/* Hero Header & Module Tabs */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-purple-300 shadow-inner">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <span>منظومة التوظيف والفرز الذكي</span>
                  <span className="bg-amber-400 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-slate-950" />
                    AI ATS & Recruitment
                  </span>
                </h1>
                <p className="text-xs text-purple-200 mt-1">
                  إعلانات الوظائف التفصيلية، دليل المتقدمين والمهارات، الفرز الآلي للسير الذاتية، وسجل المرفوضين
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowJobModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إعلان وظيفة جديدة</span>
            </button>
            <button
              onClick={() => handleExportApplicationsExcel()}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير المتقدمين لـ Excel</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pt-2 border-t border-white/10">
          <button
            onClick={() => setActiveTab("ats")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "ats"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>نظام تتبع المتقدمين (ATS Kanban)</span>
            <span className="bg-purple-100 text-purple-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {applications.filter((a) => a.status !== "rejected").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("applicants")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "applicants"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>صفحة جدول المتقدمين والمهارات</span>
            <span className="bg-indigo-100 text-indigo-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {applications.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("requisitions")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "requisitions"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>طلبات الاحتياج (رؤساء الأقسام)</span>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {jobPostings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("interviews_calendar")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "interviews_calendar"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>مواعيد المقابلات اليومية</span>
            <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {applications.filter((a) => a.status === "interview").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("postings")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "postings"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>إعلانات الوظائف العامة</span>
          </button>

          <button
            onClick={() => setActiveTab("rejected_dashboard")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "rejected_dashboard"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <XCircle className="w-4 h-4 text-red-400" />
            <span>سجل المتقدمين المرفوضين</span>
            <span className="bg-red-100 text-red-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {rejectedApps.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("apply_page")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "apply_page"
                ? "bg-white text-purple-900 shadow-md font-black"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>صفحة تقديم المتقدمين المباشرة</span>
          </button>

          <button
            onClick={() => setActiveTab("ai_cv_tester")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "ai_cv_tester"
                ? "bg-amber-400 text-slate-950 shadow-md font-black"
                : "text-amber-200 hover:bg-white/10"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>محلل السير الذاتية بـ AI</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-slate-500 font-bold mt-4">جاري استعلام بيانات التوظيف والمتقدمين...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ATS KANBAN PIPELINE */}
          {activeTab === "ats" && (
            <div className="space-y-6">
              {/* Filter and Search Bar */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث بالاسم أو الهاتف أو الوظيفة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 pr-10 pl-4 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="تصفية حسب مهارات المتقدم..."
                    value={skillsSearchFilter}
                    onChange={(e) => setSkillsSearchFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl py-2 px-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-purple-500"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl py-2 px-3 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="all">كل المراحل</option>
                    <option value="submitted">مقدم حديثاً</option>
                    <option value="reviewing">قيد الفحص والمراجعة</option>
                    <option value="interview">مقابلة شخصية</option>
                    <option value="offered">عرض عمل</option>
                    <option value="hired">مقبول وتعيين</option>
                  </select>

                  <select
                    value={selectedJobFilter}
                    onChange={(e) => setSelectedJobFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl py-2 px-3 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="all">كل إعلانات الوظائف</option>
                    {jobPostings.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs font-bold text-slate-500">
                  عرض <span className="text-purple-600 font-black">{filteredApps.length}</span> متقدم
                </div>
              </div>

              {/* Kanban View */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { id: "submitted", title: "📥 مقدم حديثاً", color: "border-blue-300 bg-blue-50/30" },
                  { id: "reviewing", title: "🔍 قيد الفحص والتصفية", color: "border-purple-300 bg-purple-50/30" },
                  { id: "interview", title: "📅 مقابلات شخصية", color: "border-amber-300 bg-amber-50/30" },
                  { id: "offered", title: "✉️ عروض العمل", color: "border-teal-300 bg-teal-50/30" },
                  { id: "hired", title: "🎉 مقبولين وتعيين", color: "border-emerald-300 bg-emerald-50/30" }
                ].map((col) => {
                  const stageApps = filteredApps.filter((a) => a.status === col.id);

                  return (
                    <div key={col.id} className={`p-4 rounded-3xl border ${col.color} flex flex-col min-h-[500px]`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                          {col.title}
                        </h3>
                        <span className="w-5 h-5 rounded-full bg-white text-slate-700 font-black text-[10px] flex items-center justify-center shadow-sm border border-slate-200">
                          {stageApps.length}
                        </span>
                      </div>

                      <div className="space-y-3 flex-1 overflow-y-auto">
                        {stageApps.length === 0 ? (
                          <div className="p-8 text-center border-2 border-dashed border-slate-200/60 rounded-2xl">
                            <p className="text-[11px] text-slate-400 font-bold">لا يوجد متقدمين في هذه المرحلة</p>
                          </div>
                        ) : (
                          stageApps.map((app) => (
                            <div
                              key={app.id}
                              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-purple-600 transition-colors">
                                    {app.candidate_name}
                                  </h4>
                                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">{app.job_title}</p>
                                </div>

                                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-black text-amber-700">
                                  <Sparkles className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  <span>{app.ai_match_score || 0}%</span>
                                </div>
                              </div>

                              <div className="mt-2 text-[10px] text-slate-500 space-y-1">
                                <p className="font-mono">{app.phone}</p>
                                <p>الخبرة: {app.experience_years} سنوات</p>
                              </div>

                              {/* Candidate Skills List */}
                              {app.candidate_skills && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {app.candidate_skills.split(",").slice(0, 3).map((sk, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md"
                                    >
                                      {sk.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Candidate File Indicator & Attachment Badge */}
                              <div className="mt-2">
                                {app.cv_file_url ? (
                                  <button
                                    onClick={() =>
                                      setPreviewFileModal({
                                        url: app.cv_file_url!,
                                        candidateName: app.candidate_name,
                                        title: app.job_title
                                      })
                                    }
                                    className="w-full text-left bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 px-2 py-1 rounded-lg text-[9px] font-bold flex items-center justify-between transition-all"
                                  >
                                    <span className="flex items-center gap-1">
                                      <FileText className="w-3 h-3 text-purple-600" />
                                      <span>سيرة ذاتية مرفقة</span>
                                    </span>
                                    <span className="text-[8px] text-purple-700 underline font-black">معاينة 👁️</span>
                                  </button>
                                ) : (
                                  <label className="w-full bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-700 border border-dashed border-slate-300 hover:border-purple-300 px-2 py-1 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all">
                                    <Upload className="w-3 h-3" />
                                    <span>+ إرفاق ملف CV</span>
                                    <input
                                      type="file"
                                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                                      className="hidden"
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleAttachFileToApplicant(app.id, e.target.files[0]);
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>

                              {/* Action Bar */}
                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setShowAppDetailModal(true);
                                  }}
                                  className="text-[10px] font-bold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>الملف والمهارات</span>
                                </button>

                                <div className="flex items-center gap-1">
                                  {col.id === "hired" ? (
                                    <button
                                      onClick={() => handleConvertCandidateToEmployee(app)}
                                      className="text-[9px] font-black bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition-all shadow-sm"
                                    >
                                      + تعيين كموظف
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setAppToReject(app);
                                          setShowRejectModal(true);
                                        }}
                                        className="text-[10px] font-bold text-red-600 hover:bg-red-50 p-1 rounded-lg"
                                        title="رفض المتقدم"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </button>

                                      <select
                                        value={app.status}
                                        onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                        className="text-[9px] font-bold bg-slate-100 border border-slate-200 rounded-lg p-1 text-slate-700 focus:outline-none"
                                      >
                                        <option value="submitted">مقدم</option>
                                        <option value="reviewing">مراجعة</option>
                                        <option value="interview">مقابلة</option>
                                        <option value="offered">عرض</option>
                                        <option value="hired">قبول</option>
                                      </select>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DEDICATED APPLICANTS DIRECTORY & AP CANDIDATES SHEET PAGE */}
          {activeTab === "applicants" && (
            <div className="space-y-6">
              {/* Top Dossier Files Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">إجمالي سجلات المتقدمين</span>
                    <span className="text-xl font-black text-slate-900">{applications.length} متقدم</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center font-bold">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">متقدمين بملفات وسير ذاتية</span>
                    <span className="text-xl font-black text-purple-700">
                      {applications.filter((a) => Boolean(a.cv_file_url || a.cv_text)).length} ملف
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">سجلات بدون ملفات مرفقة</span>
                    <span className="text-xl font-black text-amber-600">
                      {applications.filter((a) => !a.cv_file_url && !a.cv_text).length} متقدم
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">نسبة اكتمال أوراق المتقدمين</span>
                    <span className="text-xs font-black text-emerald-600">
                      {applications.length > 0
                        ? Math.round(
                            (applications.filter((a) => Boolean(a.cv_file_url)).length / applications.length) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mt-2">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          applications.length > 0
                            ? Math.round(
                                (applications.filter((a) => Boolean(a.cv_file_url)).length / applications.length) * 100
                              )
                            : 0
                        }%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Toolbar Header & Search & Filters */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <span>دليل وشيت المتقدمين وملفات الوثائق والسير الذاتية (AP Candidates Sheet & Files)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    جدول تفصيلي بكافة أوراق وبيانات المتقدمين مع إمكانية إرفاق ومعاينة الملفات وتصدير شيت Excel
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث باسم المتقدم أو المهارة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-2xl py-2 pr-9 pl-4 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl py-2 px-3 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="submitted">مقدم حديثاً</option>
                    <option value="reviewing">قيد المراجعة</option>
                    <option value="interview">مقابلة شخصية</option>
                    <option value="offered">عرض عمل</option>
                    <option value="hired">مقبول وتعين</option>
                    <option value="rejected">مرفوض</option>
                  </select>

                  <select
                    value={hasFileFilter}
                    onChange={(e: any) => setHasFileFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl py-2 px-3 text-xs font-bold text-purple-900 border-purple-200 focus:outline-none"
                  >
                    <option value="all">📁 جميع الملفات</option>
                    <option value="with_file">📄 بملفات وسيرة ذاتية</option>
                    <option value="without_file">⚠️ بدون ملفات مرفقة</option>
                  </select>

                  <button
                    onClick={() => handleExportApplicationsExcel(filteredApps, "AP_Candidates_Sheet.xlsx")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير AP Candidates Sheet لـ Excel 📊</span>
                  </button>
                </div>
              </div>

              {/* Drag-and-Drop Quick CV Extractor Dropzone */}
              <div className="p-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl border border-purple-800 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600/30 border border-purple-400/30 rounded-2xl flex items-center justify-center text-purple-300">
                    {uploadingCvFile ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-300"></div>
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white">
                      {uploadingCvFile
                        ? "جاري استخراج وتفريغ كافة بيانات السيرة الذاتية..."
                        : "اسحب وأسقط ملف السيرة الذاتية (Word, PDF, Excel, صورة) لتفريغه مباشرة هنا ⚡"}
                    </h3>
                    <p className="text-[10px] text-purple-200 mt-0.5 font-medium">
                      سيقوم الذكاء الاصطناعي باستخراج الاسم، الرقم، الميل، العمر، الخبرة، الراتب الحالي والمستهدف وتفريغها تلقائياً في الشيت
                    </p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-purple-500/20 border border-purple-400/40 rounded-xl text-[11px] font-bold text-purple-200 pointer-events-none whitespace-nowrap">
                  {uploadingCvFile ? "جاري التحليل..." : "اضغط أو اسحب الملف هنا"}
                </div>
              </div>

              {/* Applicants Data Table - High Density 16 Columns AP Candidates Sheet + Files */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[1300px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-bold">
                      <th className="p-3 text-center w-10">N</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Age</th>
                      <th className="p-3">Mail</th>
                      <th className="p-3">Mobile Number</th>
                      <th className="p-3">years of exp</th>
                      <th className="p-3">English level</th>
                      <th className="p-3">Last title</th>
                      <th className="p-3">Applying Title</th>
                      <th className="p-3">Current / Last Employer</th>
                      <th className="p-3">Address</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">current salary</th>
                      <th className="p-3">Expected Salary</th>
                      <th className="p-3">Salary condition</th>
                      <th className="p-3 text-center min-w-[140px]">ملف السيرة والوثائق</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {filteredApps.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="p-12 text-center text-slate-400 font-bold">
                          لا يوجد متقدمين مسجلين يطابقون خيارات البحث والفلترة حالياً
                        </td>
                      </tr>
                    ) : (
                      filteredApps.map((app, idx) => (
                        <tr key={app.id} className="hover:bg-purple-50/40 transition-colors">
                          <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-extrabold text-slate-900 whitespace-nowrap">{app.candidate_name}</td>
                          <td className="p-3 text-slate-700 font-bold">{app.age || "-"}</td>
                          <td className="p-3 font-mono text-slate-500 text-[10px]">{app.email || "-"}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{app.phone}</td>
                          <td className="p-3 text-center font-bold text-indigo-700">{app.experience_years}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {app.english_level || "Good"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-bold whitespace-nowrap">{app.last_title || "-"}</td>
                          <td className="p-3 font-extrabold text-purple-700 whitespace-nowrap">{app.job_title}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{app.current_employer || "-"}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{app.address || "-"}</td>
                          <td className="p-3 text-slate-500 text-[10px] max-w-[120px] truncate">
                            {app.reason_for_leaving || "-"}
                          </td>
                          <td className="p-3 font-mono text-slate-700 font-bold">
                            {app.current_salary ? `${app.current_salary} ج.م` : "-"}
                          </td>
                          <td className="p-3 font-mono text-emerald-700 font-black">
                            {app.expected_salary ? `${app.expected_salary} ج.م` : "-"}
                          </td>
                          <td className="p-3 text-slate-600 text-[10px] whitespace-nowrap">
                            {app.salary_condition || "-"}
                          </td>

                          {/* Candidate File & CV Column */}
                          <td className="p-3 text-center whitespace-nowrap">
                            {app.cv_file_url ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() =>
                                    setPreviewFileModal({
                                      url: app.cv_file_url!,
                                      candidateName: app.candidate_name,
                                      title: app.job_title
                                    })
                                  }
                                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border border-purple-300"
                                  title="معاينة السيرة الذاتية داخل المنظومة"
                                >
                                  <FileText className="w-3 h-3 text-purple-700" />
                                  <span>معاينة</span>
                                </button>

                                <a
                                  href={app.cv_file_url}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-slate-600 hover:text-purple-700 hover:bg-slate-100 rounded-lg"
                                  title="تنزيل الملف"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>

                                <label
                                  className="p-1 text-slate-400 hover:text-purple-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  title="إعادة رفع / تغيير الملف"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleAttachFileToApplicant(app.id, e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                                {uploadingForAppId === app.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                                ) : (
                                  <Upload className="w-3 h-3 text-slate-500" />
                                )}
                                <span>{uploadingForAppId === app.id ? "جاري الرفع..." : "+ إرفاق CV"}</span>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleAttachFileToApplicant(app.id, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedCandidateForSheetModal(app)}
                                className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 rounded-lg font-bold transition-all text-[10px] flex items-center gap-1 shadow-sm"
                                title="عرض استمارة المتقدم وطباعتها أونلاين أو تصديرها Word/Excel"
                              >
                                <Printer className="w-3 h-3" />
                                <span>الشيت والطباعة</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedApplication(app);
                                  setShowAppDetailModal(true);
                                }}
                                className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-bold transition-all text-[10px] flex items-center gap-1 border border-purple-200"
                              >
                                <Eye className="w-3 h-3" />
                                <span>عرض</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DEPARTMENT HEAD REQUISITIONS */}
          {activeTab === "requisitions" && (
            <DepartmentRequisitionsView
              jobPostings={jobPostings}
              departments={departments}
              onRefresh={fetchData}
              onOpenApplyForPosting={(posting) => {
                setSelectedPostingForApply(posting);
                setApplyForm((prev) => ({
                  ...prev,
                  job_title: posting.title,
                  department_name: posting.department_name || ""
                }));
                setShowApplyModal(true);
              }}
              onFilterApplicationsForPosting={(postingId) => {
                setSelectedJobFilter(String(postingId));
                setActiveTab("applicants");
              }}
              showToast={showToast}
              getAuthHeaders={getAuthHeaders}
            />
          )}

          {/* TAB: DAILY INTERVIEWS CALENDAR */}
          {activeTab === "interviews_calendar" && (
            <InterviewsCalendarView
              applications={applications}
              showToast={showToast}
              getAuthHeaders={getAuthHeaders}
              onRefreshApplications={fetchData}
              onConvertEmployee={handleConvertCandidateToEmployee}
            />
          )}

          {/* TAB 3: JOB POSTINGS & REQUIREMENTS (إعلانات الوظائف العامة) */}
          {activeTab === "postings" && (
            <div className="space-y-6">
              {/* Public Portal Banner & Sharing Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Globe className="w-4 h-4" />
                    <span>رابط بوابّة إعلانات الوظائف العامة المباشرة</span>
                  </div>
                  <p className="text-xs text-purple-200">
                    يمكنك مشاركة هذا الرابط مع المتقدمين خارج المنظومة للتصفح والتقديم المباشر مع دعم الرفع التلقائي للـ CV
                  </p>
                  <div className="mt-2 bg-slate-950/80 px-3.5 py-1.5 rounded-xl text-xs font-mono text-purple-300 border border-slate-800 inline-block">
                    {window.location.origin}/careers
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/careers`);
                      showToast("تم نسخ رابط بوابة الوظائف العامة للجمهور بنجاح 📋");
                    }}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ رابط التقديم</span>
                  </button>

                  <button
                    onClick={() => window.open("/careers", "_blank")}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4 text-purple-300" />
                    <span>معاينة البوابة العامة</span>
                  </button>

                  <button
                    onClick={() => setShowJobModal(true)}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة إعلان جديد</span>
                  </button>
                </div>
              </div>

              {jobPostings.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="font-extrabold text-slate-800 text-base">لا توجد إعلانات وظائف مضافة حالياً</h3>
                  <p className="text-xs text-slate-500">اضغط على زر "إضافة إعلان جديد" بالأعلى لنشر أول إعلان وظيفة</p>
                  <button
                    onClick={() => setShowJobModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة إعلان وظيفة</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {jobPostings.map((job) => (
                    <div
                      key={job.id}
                      className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            {job.department_name || "قسم عام"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              job.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {job.status === "published" ? "نشط ومعلن للجمهور" : "مسودة مؤقتة"}
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 mt-3">{job.title}</h3>

                        {/* Detailed Job Information */}
                        <div className="mt-4 space-y-2 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span>الفرع: {job.branch_name || job.work_location || "جميع الفروع"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span>العدد المطلوب: {job.vacancies_count} شواغر</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                            <span className="font-bold text-slate-800">
                              الراتب: {job.salary_min} - {job.salary_max} ج.م
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>الخبرة المطلوبة: {job.experience_years} سنوات على الأقل</span>
                          </div>
                        </div>

                        {/* Required Skills Badges */}
                        {job.required_skills && (
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">المهارات المطلوبة للوظيفة:</p>
                            <div className="flex flex-wrap gap-1">
                              {job.required_skills.split(",").map((s, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                                >
                                  {s.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              setSelectedJobDetail(job);
                              setShowJobDetailModal(true);
                            }}
                            className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
                          >
                            <Info className="w-4 h-4" />
                            <span>تفاصيل الوظيفة والمسؤوليات</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPostingForApply(job);
                              setApplyForm((prev) => ({
                                ...prev,
                                job_title: job.title,
                                department_name: job.department_name || ""
                              }));
                              setShowApplyModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>تقديم متقدم</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px]">
                          <button
                            onClick={async () => {
                              const newStatus = job.status === "published" ? "draft" : "published";
                              try {
                                const res = await fetch(`/api/hr/job-postings/${job.id}`, {
                                  method: "PUT",
                                  headers: getAuthHeaders(),
                                  body: JSON.stringify({ status: newStatus })
                                });
                                if (res.ok) {
                                  showToast(`تم تغيير حالة الإعلان إلى: ${newStatus === "published" ? "معلن للجمهور" : "مسودة"}`);
                                  fetchData();
                                }
                              } catch (e) {
                                showToast("فشل تغيير الحالة", "error");
                              }
                            }}
                            className="text-slate-600 hover:text-purple-700 font-bold"
                          >
                            {job.status === "published" ? "تحويل لمسودة" : "تفعيل ونشر للجمهور"}
                          </button>

                          <button
                            onClick={async () => {
                              if (window.confirm("هل أنت تأكد من حذف إعلان الوظيفة هذا؟")) {
                                try {
                                  const res = await fetch(`/api/hr/job-postings/${job.id}`, {
                                    method: "DELETE",
                                    headers: getAuthHeaders()
                                  });
                                  if (res.ok) {
                                    showToast("تم حذف إعلان الوظيفة بنجاح");
                                    fetchData();
                                  }
                                } catch (e) {
                                  showToast("فشل حذف الإعلان", "error");
                                }
                              }
                            }}
                            className="text-rose-600 hover:text-rose-700 font-bold"
                          >
                            حذف الإعلان
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PUBLIC / DIRECT APPLY PAGE & CV FILE PARSER */}
          {activeTab === "apply_page" && (
            <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="border-b border-slate-100 pb-6 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-3xl flex items-center justify-center text-purple-600 mx-auto mb-3">
                  <UserPlus className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900">نموذج تقديم طلب التوظيف واستخراج بيانات السيرة الذاتية</h2>
                <p className="text-xs text-slate-500 mt-1">
                  قم برفع ملف السيرة الذاتية (Word, Excel, PDF, صورة, أو نص) وسيقوم الذكاء الاصطناعي باستخراج كافة بيانات الشيت تلقائياً
                </p>
              </div>

              {/* CV File Upload & Drag-and-Drop Dropzone */}
              <div className="p-6 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-2 border-dashed border-purple-300 rounded-3xl text-center space-y-3 relative">
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
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-purple-600 mx-auto shadow-sm">
                  {uploadingCvFile ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-black text-purple-950">
                    {uploadingCvFile ? "جاري رفع وقراءة واستخراج بيانات السيرة الذاتية..." : "اضغط هنا أو اسحب ملف السيرة الذاتية (CV)"}
                  </h3>
                  <p className="text-[11px] text-purple-700 mt-1 font-bold">
                    يدعم جميع الأنواع: Word (.docx/.doc)، Excel (.xlsx/.xls)، PDF، الصور (PNG/JPG)، والنصوص
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitApplication} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم المتقدم بالكامل (Name) *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد محمود علي"
                      value={applyForm.candidate_name}
                      onChange={(e) => setApplyForm({ ...applyForm, candidate_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (Mobile Number) *</label>
                    <input
                      type="text"
                      required
                      placeholder="010XXXXXXXX"
                      value={applyForm.phone}
                      onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني (Mail)</label>
                    <input
                      type="email"
                      placeholder="example@email.com"
                      value={applyForm.email}
                      onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">العمر (Age)</label>
                    <input
                      type="number"
                      placeholder="28"
                      value={applyForm.age}
                      onChange={(e) => setApplyForm({ ...applyForm, age: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">سنوات الخبرة (Years of Exp)</label>
                    <input
                      type="number"
                      value={applyForm.experience_years}
                      onChange={(e) =>
                        setApplyForm({ ...applyForm, experience_years: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">مستوى اللغة الإنجليزية (English Level)</label>
                    <select
                      value={applyForm.english_level}
                      onChange={(e) => setApplyForm({ ...applyForm, english_level: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none"
                    >
                      <option value="Fluent">Fluent (ممتاز / طليق)</option>
                      <option value="Very Good">Very Good (جيد جداً)</option>
                      <option value="Good">Good (جيد)</option>
                      <option value="Fair">Fair (مقبول)</option>
                      <option value="Basic">Basic (مبتدئ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي الأخير (Last Title)</label>
                    <input
                      type="text"
                      placeholder="مثال: Senior Accountant"
                      value={applyForm.last_title}
                      onChange={(e) => setApplyForm({ ...applyForm, last_title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الوظيفة المتقدم لها (Applying Title)</label>
                    <input
                      type="text"
                      placeholder="شيف / محاسب / مدير صالة..."
                      value={applyForm.job_title}
                      onChange={(e) => setApplyForm({ ...applyForm, job_title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">جهة العمل الحالية / الأخيرة (Current/Last Employer)</label>
                    <input
                      type="text"
                      placeholder="اسم الشركة أو المؤسسة"
                      value={applyForm.current_employer}
                      onChange={(e) => setApplyForm({ ...applyForm, current_employer: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">العنوان السكني (Address)</label>
                    <input
                      type="text"
                      placeholder="القاهرة / التجمع الخامس"
                      value={applyForm.address}
                      onChange={(e) => setApplyForm({ ...applyForm, address: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">سبب ترك العمل السابق (Reason for leaving)</label>
                    <input
                      type="text"
                      placeholder="البحث عن فرصة أفضل"
                      value={applyForm.reason_for_leaving}
                      onChange={(e) => setApplyForm({ ...applyForm, reason_for_leaving: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الحالي (Current Salary)</label>
                    <input
                      type="number"
                      placeholder="8000"
                      value={applyForm.current_salary}
                      onChange={(e) => setApplyForm({ ...applyForm, current_salary: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الراتب المتوقع (Expected Salary)</label>
                    <input
                      type="number"
                      placeholder="12000"
                      value={applyForm.expected_salary}
                      onChange={(e) => setApplyForm({ ...applyForm, expected_salary: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">شروط وملاحظات الراتب (Salary Condition)</label>
                    <input
                      type="text"
                      placeholder="شامل البدلات / قابل للتفاوض"
                      value={applyForm.salary_condition}
                      onChange={(e) => setApplyForm({ ...applyForm, salary_condition: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      مهارات المتقدم (الفنية والشخصية)
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: Excel, قيادة الفريق, المبيعات, اللغة الإنجليزية"
                      value={applyForm.candidate_skills}
                      onChange={(e) => setApplyForm({ ...applyForm, candidate_skills: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      نص الـ CV / نبذة تفصيلية
                    </label>
                    <button
                      type="button"
                      onClick={handleAnalyzeCvWithAi}
                      disabled={isAiAnalyzing}
                      className="text-[10px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-xl transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{isAiAnalyzing ? "جاري الفرز..." : "فحص بـ AI"}</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="ألصق نص الـ CV أو اكتب نبذة عن خبراته السابقة والمهارات والإنجازات..."
                    value={applyForm.cv_text}
                    onChange={(e) => setApplyForm({ ...applyForm, cv_text: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>حفظ وتحويل المتقدم إلى شيت AP Candidates</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: REJECTED CANDIDATES DASHBOARD */}
          {activeTab === "rejected_dashboard" && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-red-950">سجل المتقدمين والموظفين المرفوضين</h2>
                    <p className="text-xs text-red-700 mt-0.5">
                      أسباب الرفض المسجلة وملاحظات التقييم مع إمكانية إعادة القبول
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleExportApplicationsExcel(rejectedApps, "سجل_المرفوضين.xlsx")}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير المرفوضين Excel</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold">
                      <th className="p-4">الكود</th>
                      <th className="p-4">اسم المتقدم</th>
                      <th className="p-4">الوظيفة</th>
                      <th className="p-4">مهارات المتقدم</th>
                      <th className="p-4">سبب الرفض</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {rejectedApps.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">
                          لا يوجد متقدمين مرفوضين
                        </td>
                      </tr>
                    ) : (
                      rejectedApps.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-400">#APP-{app.id}</td>
                          <td className="p-4 font-extrabold text-slate-900">{app.candidate_name}</td>
                          <td className="p-4 text-slate-600">{app.job_title}</td>
                          <td className="p-4 text-slate-600">{app.candidate_skills || "-"}</td>
                          <td className="p-4 text-red-700 font-bold bg-red-50/50 rounded-xl">
                            {app.rejection_reason || "غير مطابق للخبرات والاشتراطات"}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleUpdateStatus(app.id, "reviewing")}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl font-bold transition-all"
                            >
                              ↻ إعادة القبول والمراجعة
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: AI CV TESTER & UNIVERSAL FILE ANALYZER */}
          {activeTab === "ai_cv_tester" && (
            <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs">
                    📄
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>محلل وفرّاز السير الذاتية الذكي (All Formats CV Analyzer)</span>
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                        Gemini AI Powered ⚡
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      رفع وتفريغ واستخراج بيانات السيرة الذاتية بجميع الصيغ (PDF, Word, TXT, الصور PNG/JPG, Excel)
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload & Select Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Upload Box */}
                <div className="p-6 border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 relative hover:bg-amber-50 transition-all">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsAiAnalyzing(true);
                      try {
                        const formData = new FormData();
                        formData.append("cv_file", file);
                        const token = localStorage.getItem("token") || localStorage.getItem("auth_token") || localStorage.getItem("jwt_token") || "";
                        const res = await fetch("/api/hr/parse-cv-file", {
                          method: "POST",
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          body: formData
                        });
                        const data = await res.json();
                        if (res.ok && data.analysis) {
                          setAiTestResult({
                            ...data.analysis,
                            file_url: data.file_url || data.cv_file_url,
                            file_name: data.file_name || file.name
                          });
                        } else {
                          showToast(data.error || "فشل تحليل ملف السيرة الذاتية", "error");
                        }
                      } catch (err) {
                        console.error(err);
                        showToast("حدث خطأ أثناء رفع الملف وتحليله", "error");
                      } finally {
                        setIsAiAnalyzing(false);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">اسحب السيرة الذاتية أو انقر للرفع</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      يدعم: <span className="font-mono font-bold text-amber-800">PDF, DOCX, DOC, TXT, PNG, JPG, JPEG, XLSX</span>
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-amber-200/60 text-amber-900 rounded-full text-[11px] font-bold">
                    حجم الملف الأقصى: 15 ميجابايت
                  </div>
                </div>

                {/* Text Input Fallback / Manual Text Box */}
                <div className="space-y-2 flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      أو ألصق نص السيرة الذاتية هنا مباشرة:
                    </label>
                    <textarea
                      rows={5}
                      placeholder="ألصق النص، الخبرات، أو المؤهلات هنا للفرز والتقييم..."
                      value={aiTestCvText}
                      onChange={(e) => setAiTestCvText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
                    ></textarea>
                  </div>
                  <button
                    onClick={async () => {
                      if (!aiTestCvText) return;
                      setIsAiAnalyzing(true);
                      try {
                        const res = await fetch("/api/hr/parse-cv", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ cv_text: aiTestCvText })
                        });
                        const data = await res.json();
                        setAiTestResult(data.analysis);
                      } catch {
                        showToast("فشل التحليل", "error");
                      } finally {
                        setIsAiAnalyzing(false);
                      }
                    }}
                    disabled={isAiAnalyzing}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAiAnalyzing ? "جاري التحليل واستخراج البيانات..." : "تحليل النص الملصق بالذكاء الاصطناعي"}</span>
                  </button>
                </div>
              </div>

              {/* Loader */}
              {isAiAnalyzing && (
                <div className="p-8 bg-amber-50/50 border border-amber-200 rounded-3xl flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
                  <div className="font-extrabold text-sm text-amber-900">جاري قراءة الملف وتفكيك النصوص ومطابقتها بالذكاء الاصطناعي...</div>
                  <div className="text-xs text-amber-700">تغطي عمليات الاستخراج: الاسم، رقم الهاتف، الخبرات، التوصيات والمهارات.</div>
                </div>
              )}

              {/* Analysis Results Display */}
              {aiTestResult && !isAiAnalyzing && (
                <div className="bg-gradient-to-br from-amber-50/80 via-white to-slate-50 border border-amber-200 rounded-3xl p-6 space-y-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>نتيجة تحليل السيرة الذاتية المطلوبة:</span>
                    </h3>

                    {aiTestResult.file_url && (
                      <a
                        href={aiTestResult.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:text-amber-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>معاينة الملف المرفوع</span>
                      </a>
                    )}
                  </div>

                  {/* Summary Grid Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
                    <div className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
                      <span className="text-slate-400 block text-[10px]">الاسم الكامل:</span>
                      <span className="text-slate-900 font-extrabold">{aiTestResult.candidate_name || "غير محدد"}</span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
                      <span className="text-slate-400 block text-[10px]">سنوات الخبرة:</span>
                      <span className="text-slate-900">{aiTestResult.experience_years || 0} سنوات</span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
                      <span className="text-slate-400 block text-[10px]">نسبة التوافق المطلوبة:</span>
                      <span className="text-amber-700 font-black text-sm">{aiTestResult.match_score || aiTestResult.ai_match_score || 85}%</span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
                      <span className="text-slate-400 block text-[10px]">التقييم والتوصية:</span>
                      <span className="text-emerald-700">{aiTestResult.fit_recommendation || aiTestResult.ai_recommendation || "مناسب للمقابلة"}</span>
                    </div>
                  </div>

                  {/* Detailed Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-medium">
                    <div className="p-3 bg-white rounded-2xl border border-slate-200">
                      <span className="font-bold text-slate-500 block text-[10px]">رقم الجوال:</span>
                      <span className="font-mono text-slate-800 dir-ltr">{aiTestResult.phone || "غير مذكور"}</span>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-slate-200">
                      <span className="font-bold text-slate-500 block text-[10px]">البريد الإلكتروني:</span>
                      <span className="font-mono text-slate-800">{aiTestResult.email || "غير مذكور"}</span>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-slate-200">
                      <span className="font-bold text-slate-500 block text-[10px]">المسمى الأخير / الحالي:</span>
                      <span className="text-slate-800">{aiTestResult.last_title || aiTestResult.current_employer || "غير مذكور"}</span>
                    </div>
                  </div>

                  {/* Strengths & Summary */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-xs text-slate-800">الملخص والمهارات المستخرجة:</h4>
                    <p className="text-xs text-slate-700 bg-white p-3.5 rounded-2xl border border-amber-200/80 leading-relaxed font-medium">
                      {aiTestResult.summary || aiTestResult.ai_summary || "تم تحليل بيانات السيرة الذاتية بنجاح واستخراج الخبرات والمهارات الحيوية للمرشح."}
                    </p>
                  </div>

                  {/* Save as Candidate Action */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/hr/applications", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              candidate_name: aiTestResult.candidate_name || "مرشح سير ذاتية",
                              phone: aiTestResult.phone || "01000000000",
                              email: aiTestResult.email || "",
                              job_title: aiTestResult.last_title || "متقدم جديد",
                              experience_years: aiTestResult.experience_years || 1,
                              candidate_skills: aiTestResult.skills || aiTestResult.candidate_skills || "",
                              cv_text: aiTestCvText || aiTestResult.summary || "",
                              cv_file_url: aiTestResult.file_url || "",
                              ai_match_score: aiTestResult.match_score || 85,
                              ai_summary: aiTestResult.summary || ""
                            })
                          });
                          if (res.ok) {
                            showToast("تم إضافة المتقدم إلى قائمة طلبات التوظيف بنجاح! 🚀", "success");
                          } else {
                            showToast("فشل الحفظ في قاعدة المتقدمين", "error");
                          }
                        } catch {
                          showToast("خطأ أثناء حفظ المتقدم", "error");
                        }
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>حفظ البيانات مباشرة إلى قائمة المتقدمين (Save Candidate)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL 1: CREATE NEW JOB POSTING WITH EXTENDED DETAILS (طلب تفاصيل إضافية حول الوظيفة) */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                <span>نشر وإعلان وظيفة جديدة بتفاصيل شاملة</span>
              </h3>
              <button onClick={() => setShowJobModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJobPosting} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شيف عمومي / رئيس الحسابات"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم التابع</label>
                  <select
                    value={jobForm.department_name}
                    onChange={(e) => setJobForm({ ...jobForm, department_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                  >
                    <option value="">اختر القسم...</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عدد الشواغر المطلوبة</label>
                  <input
                    type="number"
                    value={jobForm.vacancies_count}
                    onChange={(e) => setJobForm({ ...jobForm, vacancies_count: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الفرع / مكان العمل التفصيلي</label>
                  <input
                    type="text"
                    placeholder="مثال: فرع التجمع / الفرع الرئيسي"
                    value={jobForm.work_location}
                    onChange={(e) => setJobForm({ ...jobForm, work_location: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأدنى للراتب (ج.م)</label>
                  <input
                    type="number"
                    value={jobForm.salary_min}
                    onChange={(e) => setJobForm({ ...jobForm, salary_min: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى للراتب (ج.م)</label>
                  <input
                    type="number"
                    value={jobForm.salary_max}
                    onChange={(e) => setJobForm({ ...jobForm, salary_max: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سنوات الخبرة المطلوبة</label>
                  <input
                    type="number"
                    value={jobForm.experience_years}
                    onChange={(e) => setJobForm({ ...jobForm, experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نظام الورديات والمواعيد</label>
                  <input
                    type="text"
                    placeholder="8 ساعات - وردية صباحية/مسائية"
                    value={jobForm.shift_info}
                    onChange={(e) => setJobForm({ ...jobForm, shift_info: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المهارات الواجب توافرها في المتقدم</label>
                <input
                  type="text"
                  placeholder="افصل بين المهارات بفاصلة..."
                  value={jobForm.required_skills}
                  onChange={(e) => setJobForm({ ...jobForm, required_skills: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المهام والمسؤوليات الرئيسية</label>
                <textarea
                  rows={3}
                  placeholder="اكتب المهام اليومية المطلوبة من الموظف..."
                  value={jobForm.responsibilities}
                  onChange={(e) => setJobForm({ ...jobForm, responsibilities: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المزايا والحوافز والتأمين</label>
                <input
                  type="text"
                  placeholder="تأمين طبي، حوافز، بدل انتقال..."
                  value={jobForm.benefits}
                  onChange={(e) => setJobForm({ ...jobForm, benefits: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs shadow-md hover:bg-purple-700"
                >
                  نشر إعلان الوظيفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW FULL JOB DETAILS (توضيح معلومات الوظيفة الشاملة) */}
      {showJobDetailModal && selectedJobDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{selectedJobDetail.title}</h3>
                <p className="text-xs text-purple-600 font-bold mt-0.5">
                  القسم: {selectedJobDetail.department_name || "عام"}
                </p>
              </div>
              <button onClick={() => setShowJobDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">نطاق الراتب:</span>
                  <span className="font-extrabold text-emerald-700">
                    {selectedJobDetail.salary_min} - {selectedJobDetail.salary_max} ج.م
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">الخبرة المطلوبة:</span>
                  <span className="font-extrabold text-slate-800">
                    {selectedJobDetail.experience_years} سنوات على الأقل
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">العدد المطلوب:</span>
                  <span className="font-extrabold text-slate-800">
                    {selectedJobDetail.vacancies_count} شواغر
                  </span>
                </div>
              </div>

              {selectedJobDetail.work_location && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    <span>مكان العمل والفرع:</span>
                  </h4>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {selectedJobDetail.work_location}
                  </p>
                </div>
              )}

              {selectedJobDetail.responsibilities && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <ListCheck className="w-4 h-4 text-purple-600" />
                    <span>المهام والمسؤوليات الأساسية:</span>
                  </h4>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-line">
                    {selectedJobDetail.responsibilities}
                  </p>
                </div>
              )}

              {selectedJobDetail.required_skills && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">المهارات المطلوبة:</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedJobDetail.required_skills.split(",").map((s, i) => (
                      <span key={i} className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-xl font-bold border border-purple-200">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedJobDetail.benefits && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Gift className="w-4 h-4 text-emerald-600" />
                    <span>المزايا والحوافز:</span>
                  </h4>
                  <p className="text-slate-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                    {selectedJobDetail.benefits}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowJobDetailModal(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: APPLICANT DOSSIER & SKILLS (عرض ملف المتقدم والمهارات التفصيلية) */}
      {showAppDetailModal && selectedApplication && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-base text-slate-900">{selectedApplication.candidate_name}</h3>
                <p className="text-xs text-purple-600 font-bold mt-0.5">
                  الوظيفة: {selectedApplication.job_title}
                </p>
              </div>
              <button onClick={() => setShowAppDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">رقم الهاتف:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedApplication.phone}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">نسبة التوافق بالذكاء الاصطناعي:</span>
                  <span className="font-black text-amber-700">{selectedApplication.ai_match_score || 0}%</span>
                </div>
              </div>

              {/* Mention Applicant Skills Prominently */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span>مهارات المتقدم المسجلة:</span>
                </h4>
                {selectedApplication.candidate_skills ? (
                  <div className="flex flex-wrap gap-1.5 bg-purple-50/50 p-3 rounded-2xl border border-purple-200">
                    {selectedApplication.candidate_skills.split(",").map((sk, idx) => (
                      <span
                        key={idx}
                        className="bg-white text-purple-900 border border-purple-300 px-3 py-1 rounded-xl font-extrabold shadow-sm"
                      >
                        {sk.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">لم يتم إدخال قائمة المهارات الفردية.</p>
                )}
              </div>

              {selectedApplication.ai_summary && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>ملخص تقييم Gemini AI:</span>
                  </h4>
                  <p className="text-slate-700 bg-amber-50/60 p-3 rounded-2xl border border-amber-200">
                    {selectedApplication.ai_summary}
                  </p>
                </div>
              )}

              {/* Candidate Attached File / CV Section */}
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-700" />
                    <span>ملف السيرة الذاتية ووثائق المتقدم (CV & Dossier File)</span>
                  </h4>

                  {selectedApplication.cv_file_url && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                      مرفق ورسمي ✓
                    </span>
                  )}
                </div>

                {selectedApplication.cv_file_url ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">السيرة الذاتية لمتقدم الوظيفة</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {selectedApplication.cv_file_url.split("/").pop()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setPreviewFileModal({
                            url: selectedApplication.cv_file_url!,
                            candidateName: selectedApplication.candidate_name,
                            title: selectedApplication.job_title
                          })
                        }
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة داخل النظام</span>
                      </button>

                      <a
                        href={selectedApplication.cv_file_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تنزيل</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-center p-4 bg-white rounded-xl border border-dashed border-purple-200 space-y-2">
                    <p className="text-xs font-bold text-slate-500">لا يوجد ملف سيرة ذاتية مرفق لهذا المتقدم حالياً</p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>إرفاق سيرة ذاتية / مستند للتحميل</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleAttachFileToApplicant(selectedApplication.id, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {selectedApplication.cv_text && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">نص السيرة الذاتية المستخرج:</h4>
                  <p className="text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-36 overflow-y-auto">
                    {selectedApplication.cv_text}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleConvertCandidateToEmployee(selectedApplication)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
              >
                + نقل المتقدم وتعيينه كموظف
              </button>

              <button
                onClick={() => setShowAppDetailModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: REJECTION REASON INPUT */}
      {showRejectModal && appToReject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-red-700 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>تسجيل سبب رفض المتقدم</span>
            </h3>

            <p className="text-xs text-slate-600 font-bold">
              المتقدم: <span className="text-slate-900">{appToReject.candidate_name}</span>
            </p>

            <textarea
              rows={3}
              placeholder="اكتب سبب الرفض بالتفصيل للتوثيق..."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-red-500"
            ></textarea>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleUpdateStatus(appToReject.id, "rejected", rejectionReasonInput)}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 shadow-md"
              >
                تأكيد الرفض والتحويل للسجل
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 5: CANDIDATE PROFESSIONAL PRINT SHEET MODAL */}
      {selectedCandidateForSheetModal && (
        <CandidateSheetModal
          candidate={selectedCandidateForSheetModal}
          onClose={() => setSelectedCandidateForSheetModal(null)}
          onConvertEmployee={handleConvertCandidateToEmployee}
        />
      )}

      {/* MODAL 6: IN-APP CANDIDATE DOSSIER & CV FILE PREVIEWER */}
      {previewFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-900 to-slate-900 text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/40 border border-purple-400/30 flex items-center justify-center text-purple-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>معاينة ملف السيرة الذاتية:</span>
                    <span className="text-purple-300">{previewFileModal.candidateName}</span>
                  </h3>
                  <p className="text-[10px] text-purple-200 font-medium mt-0.5">
                    الوظيفة المتقدم لها: {previewFileModal.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewFileModal.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الملف</span>
                </a>

                <button
                  onClick={() => setPreviewFileModal(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer Content Body */}
            <div className="p-6 flex-1 bg-slate-950/5 overflow-auto flex items-center justify-center min-h-[400px]">
              {previewFileModal.url.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                <img
                  src={previewFileModal.url}
                  alt={`CV ${previewFileModal.candidateName}`}
                  className="max-h-[65vh] w-auto max-w-full rounded-2xl shadow-lg border border-slate-200 object-contain"
                />
              ) : previewFileModal.url.startsWith("data:") || previewFileModal.url.match(/\.(pdf)$/i) || previewFileModal.url.includes("/uploads/") ? (
                <iframe
                  src={previewFileModal.url}
                  title={`CV Preview ${previewFileModal.candidateName}`}
                  className="w-full h-[65vh] rounded-2xl border border-slate-200 shadow-inner bg-white"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-3xl border border-slate-200 max-w-md shadow-sm space-y-4">
                  <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto font-black text-xl">
                    📁
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">الملف جاهز للعرض والتحميل</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      يمكنك فتح الملف مباشرة في نافذة جديدة أو تنزيله على جهازك لمراجعته.
                    </p>
                  </div>
                  <a
                    href={previewFileModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md"
                  >
                    <span>فتح المستند في نافذة مستقلة 🔗</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewFileModal(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-2xl text-xs transition-all"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
