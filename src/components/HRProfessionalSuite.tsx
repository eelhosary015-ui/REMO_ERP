import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  Trash2,
  Eye,
  UploadCloud,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Printer,
  X,
  Maximize2,
} from "lucide-react";
import { api } from "../utils/api";
import { Employee, Branch, HRDepartment, HRShift } from "../types";
import { EmployeeSearchSelect } from "./EmployeeSearchSelect";
import { HRDetailedEmployeeReport } from "./HRDetailedEmployeeReport";

type HRProfessionalSuiteProps = {
  employees: Employee[];
  departments: HRDepartment[];
  branches: Branch[];
  shifts?: HRShift[];
  onRefresh?: () => void;
  onEditEmployee?: (emp: any, step?: number) => void;
};

type DashboardData = {
  stats?: {
    total_employees: number;
    active_employees: number;
    on_leave_employees: number;
    suspended_employees: number;
    terminated_employees: number;
    monthly_payroll_cost: number;
    attendance_present_today: number;
    attendance_late_today: number;
    open_leave_requests: number;
    expiring_contracts_30_days: number;
    open_custody_items: number;
  };
  workforce_by_branch?: Array<{ branch_name: string; total: number }>;
  workforce_by_department?: Array<{ department_name: string; total: number }>;
  attendance_exceptions?: Array<any>;
  contracts_expiring?: Array<any>;
  pending_leaves?: Array<any>;
  payroll_trend?: Array<any>;
};

type HRSettings = {
  annual_leave_days: number;
  sick_leave_days: number;
  casual_leave_days: number;
  probation_days: number;
  contract_expiry_alert_days: number;
  retirement_age: number;
  default_work_days: number;
  default_daily_hours: number;
  overtime_multiplier: number;
  late_grace_minutes: number;
  require_manager_approval_for_leave: boolean;
  auto_create_salary_deductions: boolean;
  allow_negative_leave_balance: boolean;
  default_currency: string;
  hr_manager_name: string;
};

type LeaveRequest = {
  id?: number;
  employee_id: number | string;
  employee_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number | string;
  status?: string;
  reason?: string;
  approved_by?: string;
  notes?: string;
};

type Evaluation = {
  id?: number;
  employee_id: number | string;
  employee_name?: string;
  evaluation_period: string;
  evaluator_name: string;
  score: number | string;
  grade: string;
  strengths?: string;
  improvement_points?: string;
  action_plan?: string;
  status?: string;
};

type TrainingCourse = {
  id?: number;
  name: string;
  provider?: string;
  start_date?: string;
  end_date?: string;
  cost?: number | string;
  status?: string;
  notes?: string;
};

type EmployeeDocument = {
  id?: number;
  employee_id: number | string;
  employee_name?: string;
  employee_code?: string;
  department_id?: number | string;
  branch_id?: number | string;
  document_type: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  file_url?: string;
  status?: string;
  notes?: string;
};

const defaultSettings: HRSettings = {
  annual_leave_days: 21,
  sick_leave_days: 14,
  casual_leave_days: 6,
  probation_days: 90,
  contract_expiry_alert_days: 30,
  retirement_age: 60,
  default_work_days: 30,
  default_daily_hours: 8,
  overtime_multiplier: 1.5,
  late_grace_minutes: 10,
  require_manager_approval_for_leave: true,
  auto_create_salary_deductions: true,
  allow_negative_leave_balance: false,
  default_currency: "EGP",
  hr_manager_name: "",
};

const numberValue = (value: any) => Number(value || 0 || 0).toLocaleString("ar-EG");

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const exportRowsAsCsv = (rows: any[], filename: string) => {
  if (!rows.length) return alert("لا توجد بيانات للتصدير");
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const value = status || "pending";
  const className =
    value === "approved" || value === "completed" || value === "valid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : value === "rejected" || value === "expired"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : value === "in_progress"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-amber-50 text-amber-700 border-amber-200";
  const label: Record<string, string> = {
    pending: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    completed: "مكتمل",
    in_progress: "قيد التنفيذ",
    valid: "ساري",
    expired: "منتهي",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${className}`}>
      {label[value] || value}
    </span>
  );
};

export const HRProfessionalSuite: React.FC<HRProfessionalSuiteProps> = ({
  employees,
  departments,
  branches,
  shifts = [],
  onRefresh,
  onEditEmployee,
}) => {
  const [activeView, setActiveView] = useState<
    "dashboard" | "reports" | "settings" | "leaves" | "evaluations" | "documents" | "training"
  >("dashboard");
  const [reportSubView, setReportSubView] = useState<"detailed_employees" | "quick_reports">("detailed_employees");
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [settings, setSettings] = useState<HRSettings>(defaultSettings);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [reportFrom, setReportFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(todayIso());

  const [leaveForm, setLeaveForm] = useState<LeaveRequest>({
    employee_id: "",
    leave_type: "annual",
    start_date: todayIso(),
    end_date: todayIso(),
    days_count: 1,
    reason: "",
  });

  const [evaluationForm, setEvaluationForm] = useState<Evaluation>({
    employee_id: "",
    evaluation_period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    evaluator_name: "",
    score: 85,
    grade: "جيد جداً",
    strengths: "",
    improvement_points: "",
    action_plan: "",
    status: "approved",
  });

  const [documentForm, setDocumentForm] = useState<EmployeeDocument>({
    employee_id: "",
    document_type: "بطاقة شخصية",
    document_number: "",
    issue_date: todayIso(),
    expiry_date: addDaysIso(365),
    file_url: "",
    status: "valid",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docBranchFilter, setDocBranchFilter] = useState("");
  const [docDepartmentFilter, setDocDepartmentFilter] = useState("");
  
  // Document Preview Modal State
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    fileType: string;
  }>({
    isOpen: false,
    fileUrl: "",
    fileName: "",
    fileType: "",
  });

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // 1. Search by name or code
      const q = docSearchQuery.trim().toLowerCase();
      if (q) {
        const nameMatch = doc.employee_name ? String(doc.employee_name).toLowerCase().includes(q) : false;
        const codeMatch = doc.employee_code ? String(doc.employee_code).toLowerCase().includes(q) : false;
        if (!nameMatch && !codeMatch) return false;
      }
      // 2. Filter by branch
      if (docBranchFilter && String(doc.branch_id) !== String(docBranchFilter)) {
        return false;
      }
      // 3. Filter by department
      if (docDepartmentFilter && String(doc.department_id) !== String(docDepartmentFilter)) {
        return false;
      }
      return true;
    });
  }, [documents, docSearchQuery, docBranchFilter, docDepartmentFilter]);

  const [courseForm, setCourseForm] = useState<TrainingCourse>({
    name: "",
    provider: "",
    start_date: todayIso(),
    end_date: addDaysIso(7),
    cost: 0,
    status: "planned",
    notes: "",
  });

  const loadSuiteData = async () => {
    setLoading(true);
    try {
      const [dashRes, settingsRes, leavesRes, evalsRes, docsRes, coursesRes] = await Promise.all([
        api.get(`/api/hr/dashboard?from=${reportFrom}&to=${reportTo}`),
        api.get("/api/hr/settings"),
        api.get("/api/hr/leave-requests"),
        api.get("/api/hr/evaluations"),
        api.get("/api/hr/documents"),
        api.get("/api/hr/training-courses"),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (settingsRes.ok) setSettings({ ...defaultSettings, ...(await settingsRes.json()) });
      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (evalsRes.ok) setEvaluations(await evalsRes.json());
      if (docsRes.ok) setDocuments(await docsRes.json());
      if (coursesRes.ok) setCourses(await coursesRes.json());
    } catch (error) {
      console.error("Failed to load HR professional suite", error);
      alert("تعذر تحميل بيانات الموارد البشرية الاحترافية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuiteData();
  }, [reportFrom, reportTo]);

  const employeeOptions = useMemo(
    () => employees.filter((emp) => (emp.status || "active") !== "terminated"),
    [employees],
  );

  const saveSettings = async () => {
    const res = await api.post("/api/hr/settings", settings);
    if (res.ok) {
      alert("تم حفظ إعدادات الموارد البشرية بنجاح");
      loadSuiteData();
    } else {
      alert("فشل حفظ إعدادات الموارد البشرية");
    }
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.post("/api/hr/leave-requests", {
      ...leaveForm,
      employee_id: Number(leaveForm.employee_id),
      days_count: Number(leaveForm.days_count),
    });
    if (res.ok) {
      setLeaveForm({ employee_id: "", leave_type: "annual", start_date: todayIso(), end_date: todayIso(), days_count: 1, reason: "" });
      loadSuiteData();
      onRefresh?.();
      alert("تم تسجيل طلب الإجازة");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "فشل تسجيل طلب الإجازة");
    }
  };

  const updateLeaveStatus = async (id: number | undefined, status: string) => {
    if (!id) return;
    const res = await api.put(`/api/hr/leave-requests/${id}`, { status });
    if (res.ok) {
      loadSuiteData();
      onRefresh?.();
    }
  };

  const submitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.post("/api/hr/evaluations", {
      ...evaluationForm,
      employee_id: Number(evaluationForm.employee_id),
      score: Number(evaluationForm.score),
    });
    if (res.ok) {
      setEvaluationForm({
        employee_id: "",
        evaluation_period: evaluationForm.evaluation_period,
        evaluator_name: evaluationForm.evaluator_name,
        score: 85,
        grade: "جيد جداً",
        strengths: "",
        improvement_points: "",
        action_plan: "",
        status: "approved",
      });
      loadSuiteData();
      alert("تم حفظ تقييم الموظف");
    } else {
      alert("فشل حفظ التقييم");
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to download file");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || url.split("/").pop() || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      // Fallback
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.download = filename || "document";
      link.click();
    }
  };

  const deleteDocument = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستند؟")) return;
    try {
      const res = await api.delete(`/api/hr/documents/${id}`);
      if (res.ok) {
        alert("تم حذف المستند بنجاح");
        loadSuiteData();
      } else {
        alert("فشل حذف المستند");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حذف المستند");
    }
  };

  const submitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentForm.employee_id) {
      alert("الرجاء اختيار الموظف");
      return;
    }

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("employee_id", String(documentForm.employee_id));
        formData.append("document_type", documentForm.document_type);
        if (documentForm.document_number) formData.append("document_number", documentForm.document_number);
        if (documentForm.issue_date) formData.append("issue_date", documentForm.issue_date);
        if (documentForm.expiry_date) formData.append("expiry_date", documentForm.expiry_date);
        if (documentForm.notes) formData.append("notes", documentForm.notes);

        const token = localStorage.getItem('token');
        const uploadRes = await fetch("/api/hr/documents/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData
        });

        if (uploadRes.ok) {
          setDocumentForm({
            employee_id: "",
            document_type: "بطاقة شخصية",
            document_number: "",
            issue_date: todayIso(),
            expiry_date: addDaysIso(365),
            file_url: "",
            status: "valid",
            notes: "",
          });
          setSelectedFile(null);
          loadSuiteData();
          alert("تم حفظ ورفع مستند الموظف بنجاح");
        } else {
          const errData = await uploadRes.json().catch(() => ({}));
          alert(errData.error || "فشل رفع وحفظ المستند");
        }
      } else {
        const res = await api.post("/api/hr/documents", {
          ...documentForm,
          employee_id: Number(documentForm.employee_id),
        });
        if (res.ok) {
          setDocumentForm({
            employee_id: "",
            document_type: "بطاقة شخصية",
            document_number: "",
            issue_date: todayIso(),
            expiry_date: addDaysIso(365),
            file_url: "",
            status: "valid",
            notes: "",
          });
          loadSuiteData();
          alert("تم حفظ مستند الموظف بنجاح");
        } else {
          alert("فشل حفظ المستند");
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ غير متوقع: " + (err.message || ""));
    }
  };

  const submitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.post("/api/hr/training-courses", {
      ...courseForm,
      cost: Number(courseForm.cost || 0),
    });
    if (res.ok) {
      setCourseForm({ name: "", provider: "", start_date: todayIso(), end_date: addDaysIso(7), cost: 0, status: "planned", notes: "" });
      loadSuiteData();
      alert("تم حفظ الدورة التدريبية");
    } else {
      alert("فشل حفظ الدورة التدريبية");
    }
  };

  const cards = [
    { label: "إجمالي الموظفين", value: dashboard.stats?.total_employees || employees.length, icon: Users, tone: "bg-purple-50 text-purple-700" },
    { label: "نشطين", value: dashboard.stats?.active_employees || 0, icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "تكلفة رواتب الشهر", value: `${numberValue(dashboard.stats?.monthly_payroll_cost)} ج.م`, icon: BriefcaseBusiness, tone: "bg-blue-50 text-blue-700" },
    { label: "طلبات إجازة مفتوحة", value: dashboard.stats?.open_leave_requests || 0, icon: CalendarCheck, tone: "bg-amber-50 text-amber-700" },
    { label: "عقود قرب الانتهاء", value: dashboard.stats?.expiring_contracts_30_days || 0, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
    { label: "عهد مفتوحة", value: dashboard.stats?.open_custody_items || 0, icon: ClipboardCheck, tone: "bg-indigo-50 text-indigo-700" },
  ];

  const nav = [
    { id: "dashboard", label: "لوحة HR", icon: BarChart3 },
    { id: "reports", label: "تقارير", icon: FileText },
    { id: "leaves", label: "الإجازات", icon: CalendarCheck },
    { id: "evaluations", label: "التقييمات", icon: Award },
    { id: "documents", label: "ملفات الموظفين", icon: ShieldCheck },
    { id: "training", label: "التدريب", icon: GraduationCap },
    { id: "settings", label: "الإعدادات", icon: Settings },
  ] as const;

  const renderEmployeeSelect = (
    value: string | number,
    onChange: (value: string) => void,
    required = true,
  ) => (
    <EmployeeSearchSelect
      employees={employeeOptions as any}
      value={value}
      onChange={onChange}
      required={required}
      placeholder="ابحث باسم الموظف أو الكود..."
    />
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-3xl p-5 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-l from-purple-600/30 to-blue-600/20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-6 h-6 text-purple-200" />
              <h2 className="text-2xl font-black">مركز الموارد البشرية الاحترافي</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-3xl">
              إدارة متقدمة للموظفين، الإجازات، التقييمات، المستندات، التدريب، عقود العمل، ومؤشرات الحضور والرواتب.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={reportFrom ?? ""} onChange={(e) => setReportFrom(e.target.value)} className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm" />
            <input type="date" value={reportTo ?? ""} onChange={(e) => setReportTo(e.target.value)} className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm" />
            <button onClick={loadSuiteData} className="px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-bold flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex gap-2 overflow-x-auto">
        {nav.map((item) => {
          const Icon = item.icon;
          const selected = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-black whitespace-nowrap flex items-center gap-2 transition-colors ${
                selected ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {activeView === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className={`w-11 h-11 rounded-2xl ${card.tone} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs text-slate-500 font-bold">{card.label}</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{card.value}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="font-black text-slate-900 mb-4">توزيع الموظفين حسب الفرع</h3>
              <div className="space-y-3">
                {(dashboard.workforce_by_branch || []).map((row, idx) => (
                  <div key={`branch-${row.branch_name || idx}-${idx}`} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">{row.branch_name || "غير محدد"}</span>
                    <span className="px-3 py-1 rounded-full bg-slate-100 font-black">{row.total}</span>
                  </div>
                ))}
                {(dashboard.workforce_by_branch || []).length === 0 && <div className="text-sm text-slate-400">لا توجد بيانات</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="font-black text-slate-900 mb-4">توزيع الموظفين حسب القسم</h3>
              <div className="space-y-3">
                {(dashboard.workforce_by_department || []).map((row, idx) => (
                  <div key={`dept-${row.department_name || idx}-${idx}`} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">{row.department_name || "غير محدد"}</span>
                    <span className="px-3 py-1 rounded-full bg-slate-100 font-black">{row.total}</span>
                  </div>
                ))}
                {(dashboard.workforce_by_department || []).length === 0 && <div className="text-sm text-slate-400">لا توجد بيانات</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="font-black text-slate-900 mb-4">تنبيهات العقود خلال 30 يوم</h3>
              <div className="space-y-3">
                {(dashboard.contracts_expiring || []).slice(0, 5).map((row) => (
                  <div key={row.id} className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                    <div className="font-black text-rose-800">{row.name}</div>
                    <div className="text-xs text-rose-600">ينتهي في {row.contract_end_date}</div>
                  </div>
                ))}
                {(dashboard.contracts_expiring || []).length === 0 && <div className="text-sm text-slate-400">لا توجد عقود قريبة الانتهاء</div>}
              </div>
            </div>
          </div>

          {/* Quick Access to Detailed Report */}
          <div className="bg-gradient-to-l from-indigo-900 via-purple-900 to-slate-900 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-purple-500/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-purple-300 border border-white/20 shrink-0">
                <FileSpreadsheet className="w-8 h-8 text-purple-200" />
              </div>
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  تقرير الموظفين المفصل الشامل 📊
                </h3>
                <p className="text-sm text-slate-300 mt-1 max-w-xl">
                  عرض وتصدير كافة بيانات الموظفين مع فلاتر طرق صرف الراتب (كاش، بنك، صراف)، الورديات ومواعيد العمل، الرواتب، والأقسام.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveView("reports");
                setReportSubView("detailed_employees");
              }}
              className="px-6 py-3 bg-white hover:bg-purple-50 text-purple-900 rounded-xl font-black text-sm transition-all shadow-lg flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>فتح التقرير المفصل</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {activeView === "reports" && (
        <div className="space-y-5">
          {/* Sub-nav inside Reports */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-2 shadow-sm gap-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setReportSubView("detailed_employees")}
                className={`px-4 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                  reportSubView === "detailed_employees"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تقرير الموظفين المفصل الشامل (الرواتب، الورديات، الفلاتر) 📊</span>
              </button>

              <button
                onClick={() => setReportSubView("quick_reports")}
                className={`px-4 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                  reportSubView === "quick_reports"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Download className="w-4 h-4" />
                <span>تقارير التصدير السريعة واستثناءات الحضور 📑</span>
              </button>
            </div>
          </div>

          {reportSubView === "detailed_employees" ? (
            <HRDetailedEmployeeReport
              employees={employees}
              departments={departments}
              branches={branches}
              shifts={shifts}
              onEditEmployee={onEditEmployee}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {[
                  { label: "تقرير قوة العمل", rows: dashboard.workforce_by_branch || [], filename: "hr_workforce_by_branch" },
                  { label: "تقرير الأقسام", rows: dashboard.workforce_by_department || [], filename: "hr_workforce_by_department" },
                  { label: "عقود قرب الانتهاء", rows: dashboard.contracts_expiring || [], filename: "hr_expiring_contracts" },
                  { label: "استثناءات الحضور", rows: dashboard.attendance_exceptions || [], filename: "hr_attendance_exceptions" },
                ].map((report) => (
                  <button
                    key={report.filename}
                    onClick={() => exportRowsAsCsv(report.rows, report.filename)}
                    className="bg-white border border-slate-200 rounded-2xl p-5 text-right hover:border-purple-300 hover:shadow-lg transition-all"
                  >
                    <Download className="w-6 h-6 text-purple-600 mb-3" />
                    <div className="font-black text-slate-900">{report.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{report.rows.length} سجل قابل للتصدير</div>
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-black">استثناءات الحضور والتأخير</div>
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">تأخير</th>
                      <th className="p-3">جزاء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.attendance_exceptions || []).slice(0, 20).map((row) => (
                      <tr key={`${row.employee_id}-${row.date}`} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{row.employee_name}</td>
                        <td className="p-3">{row.date}</td>
                        <td className="p-3">{row.status}</td>
                        <td className="p-3">{row.delay_minutes || 0} دقيقة</td>
                        <td className="p-3">{row.penalty || 0} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === "settings" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-black text-xl text-slate-900">إعدادات الموارد البشرية</h3>
              <p className="text-sm text-slate-500">تحكم في سياسات الإجازات، العقود، الحضور، والرواتب.</p>
            </div>
            <button onClick={saveSettings} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black flex items-center gap-2">
              <Save className="w-4 h-4" />
              حفظ الإعدادات
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              ["annual_leave_days", "رصيد الإجازة السنوية"],
              ["sick_leave_days", "رصيد الإجازة المرضية"],
              ["casual_leave_days", "رصيد الإجازة العارضة"],
              ["probation_days", "مدة الاختبار بالأيام"],
              ["contract_expiry_alert_days", "تنبيه انتهاء العقد قبل"],
              ["retirement_age", "سن التقاعد"],
              ["default_work_days", "أيام العمل الافتراضية"],
              ["default_daily_hours", "ساعات العمل اليومية"],
              ["overtime_multiplier", "معامل الإضافي"],
              ["late_grace_minutes", "سماحية التأخير بالدقائق"],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-black text-slate-500">{label}</span>
                <input
                  type="number"
                  value={(settings as any)[key] ?? ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-black text-slate-500">العملة الافتراضية</span>
              <input value={settings.default_currency ?? ""} onChange={(e) => setSettings((prev) => ({ ...prev, default_currency: e.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">مسؤول HR</span>
              <input value={settings.hr_manager_name ?? ""} onChange={(e) => setSettings((prev) => ({ ...prev, hr_manager_name: e.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            {[
              ["require_manager_approval_for_leave", "إجبار موافقة مدير على الإجازات"],
              ["auto_create_salary_deductions", "إنشاء خصومات الرواتب تلقائياً"],
              ["allow_negative_leave_balance", "السماح برصيد إجازات سالب"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  checked={Boolean((settings as any)[key])}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                <span className="text-sm font-black text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {activeView === "leaves" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <form onSubmit={submitLeave} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-lg">طلب إجازة جديد</h3>
            {renderEmployeeSelect(leaveForm.employee_id, (value) => setLeaveForm((prev) => ({ ...prev, employee_id: value })))}
            <select value={leaveForm.leave_type ?? ""} onChange={(e) => setLeaveForm((prev) => ({ ...prev, leave_type: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
              <option value="annual">سنوية</option>
              <option value="sick">مرضية</option>
              <option value="casual">عارضة</option>
              <option value="unpaid">بدون مرتب</option>
              <option value="other">أخرى</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={leaveForm.start_date ?? ""} onChange={(e) => setLeaveForm((prev) => ({ ...prev, start_date: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <input type="date" value={leaveForm.end_date ?? ""} onChange={(e) => setLeaveForm((prev) => ({ ...prev, end_date: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <input type="number" min={0.5} step={0.5} value={leaveForm.days_count ?? ""} onChange={(e) => setLeaveForm((prev) => ({ ...prev, days_count: e.target.value }))} placeholder="عدد الأيام" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <textarea value={leaveForm.reason || ""} onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="سبب الإجازة" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <button className="w-full bg-purple-600 text-white rounded-xl py-2 font-black">حفظ الطلب</button>
          </form>

          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-black">طلبات الإجازات</div>
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="p-3">الموظف</th><th className="p-3">النوع</th><th className="p-3">الفترة</th><th className="p-3">الحالة</th><th className="p-3">إجراء</th></tr>
              </thead>
              <tbody>
                {leaves.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="p-3 font-bold">{row.employee_name}</td>
                    <td className="p-3">{row.leave_type}</td>
                    <td className="p-3">{row.start_date} ← {row.end_date}</td>
                    <td className="p-3"><StatusBadge status={row.status} /></td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => updateLeaveStatus(row.id, "approved")} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold">اعتماد</button>
                      <button onClick={() => updateLeaveStatus(row.id, "rejected")} className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold">رفض</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === "evaluations" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <form onSubmit={submitEvaluation} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-lg">تقييم موظف</h3>
            {renderEmployeeSelect(evaluationForm.employee_id, (value) => setEvaluationForm((prev) => ({ ...prev, employee_id: value })))}
            <input value={evaluationForm.evaluation_period ?? ""} onChange={(e) => setEvaluationForm((prev) => ({ ...prev, evaluation_period: e.target.value }))} placeholder="الفترة: 2026-07" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <input value={evaluationForm.evaluator_name ?? ""} onChange={(e) => setEvaluationForm((prev) => ({ ...prev, evaluator_name: e.target.value }))} placeholder="اسم المقيم" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} max={100} value={evaluationForm.score ?? ""} onChange={(e) => setEvaluationForm((prev) => ({ ...prev, score: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <input value={evaluationForm.grade ?? ""} onChange={(e) => setEvaluationForm((prev) => ({ ...prev, grade: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <textarea value={evaluationForm.strengths || ""} onChange={(e) => setEvaluationForm((prev) => ({ ...prev, strengths: e.target.value }))} placeholder="نقاط القوة" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <textarea value={evaluationForm.improvement_points || ""} onChange={(e) => setEvaluationForm((prev) => ({ ...prev, improvement_points: e.target.value }))} placeholder="نقاط التحسين" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <button className="w-full bg-purple-600 text-white rounded-xl py-2 font-black">حفظ التقييم</button>
          </form>
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluations.map((row) => (
              <div key={row.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">{row.employee_name}</div>
                    <div className="text-xs text-slate-500">{row.evaluation_period}</div>
                  </div>
                  <div className="text-2xl font-black text-purple-700">{row.score}</div>
                </div>
                <div className="mt-3 text-sm font-bold">{row.grade}</div>
                <div className="mt-2 text-xs text-slate-500 line-clamp-3">{row.action_plan || row.improvement_points || row.strengths}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === "documents" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <form onSubmit={submitDocument} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-black text-lg">إضافة مستند موظف</h3>
            {renderEmployeeSelect(documentForm.employee_id, (value) => setDocumentForm((prev) => ({ ...prev, employee_id: value })))}
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">نوع المستند</label>
              <input value={documentForm.document_type ?? ""} onChange={(e) => setDocumentForm((prev) => ({ ...prev, document_type: e.target.value }))} placeholder="مثال: بطاقة شخصية، عقد عمل، شهادة صحية" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">رقم المستند (اختياري)</label>
              <input value={documentForm.document_number || ""} onChange={(e) => setDocumentForm((prev) => ({ ...prev, document_number: e.target.value }))} placeholder="رقم البطاقة أو المستند" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">تاريخ الإصدار</label>
                <input type="date" value={documentForm.issue_date || ""} onChange={(e) => setDocumentForm((prev) => ({ ...prev, issue_date: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">تاريخ الانتهاء</label>
                <input type="date" value={documentForm.expiry_date || ""} onChange={(e) => setDocumentForm((prev) => ({ ...prev, expiry_date: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">رفع ملف المستند</label>
              <div className="border-2 border-dashed border-slate-200 hover:border-purple-500 rounded-xl p-4 text-center cursor-pointer relative bg-slate-50 hover:bg-purple-50/20 transition-all">
                <input
                  type="file"
                  id="doc_file_input"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                />
                <div className="flex flex-col items-center justify-center space-y-1">
                  <UploadCloud className="w-8 h-8 text-slate-400" />
                  <p className="text-xs font-bold text-slate-600">
                    {selectedFile ? `تم تحديد: ${selectedFile.name}` : "اضغط أو اسحب لرفع مستند مرفق"}
                  </p>
                  <p className="text-[10px] text-slate-400">PDF, PNG, JPG (الحد الأقصى 5MB)</p>
                </div>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-100 text-purple-700 px-3 py-2 rounded-xl text-xs font-bold">
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold"
                >
                  إلغاء الملف
                </button>
              </div>
            )}

            <div className="relative text-center my-2">
              <span className="bg-white px-2 text-[10px] text-slate-400 relative z-10 font-bold">أو أدخل رابطاً يدوياً للمستند</span>
              <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-100 z-0"></div>
            </div>

            <input value={documentForm.file_url || ""} onChange={(e) => setDocumentForm((prev) => ({ ...prev, file_url: e.target.value }))} placeholder="رابط المستند يدوياً (مثال: https://...)" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 font-black transition-colors shadow-sm">حفظ المستند</button>
          </form>

          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
              <div className="font-black text-slate-800 text-base">ملفات ومستندات الموظفين المرفوعة</div>
              
              {/* Dynamic Search & Filtering Panel */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={docSearchQuery ?? ""}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  placeholder="البحث باسم الموظف أو الكود..."
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-44 bg-slate-50 font-medium"
                />

                <select
                  value={docBranchFilter ?? ""}
                  onChange={(e) => setDocBranchFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 font-bold text-slate-700 cursor-pointer"
                >
                  <option value="">كل الفروع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  value={docDepartmentFilter ?? ""}
                  onChange={(e) => setDocDepartmentFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 font-bold text-slate-700 cursor-pointer"
                >
                  <option value="">كل الأقسام</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">المستند</th>
                    <th className="p-3">ينتهي في</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">المرفق</th>
                    <th className="p-3 w-16 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد مستندات تطابق الفلاتر أو البحث حالياً.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-bold text-slate-800">{row.employee_name}</td>
                        <td className="p-3">
                          <div>
                            <span className="font-bold text-slate-700">{row.document_type}</span>
                            {row.document_number && (
                              <span className="block text-[10px] text-slate-400 font-bold">رقم: {row.document_number}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{row.expiry_date || "-"}</td>
                        <td className="p-3"><StatusBadge status={row.status} /></td>
                        <td className="p-3">
                          {row.file_url ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => downloadFile(row.file_url!, `${row.employee_name}_${row.document_type}`)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all"
                                title="تحميل الملف إلى جهازك"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل للكمبيوتر</span>
                              </button>
                              <button
                                onClick={() => setPreviewModal({
                                  isOpen: true,
                                  fileUrl: row.file_url || "",
                                  fileName: `${row.employee_name}_${row.document_type}`,
                                  fileType: (row as any).file_type || "",
                                })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-all"
                                title="فتح الملف لمعاينته وطباعته"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>معاينة</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-bold">لا يوجد ملف</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => deleteDocument(row.id!)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="حذف المستند"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === "training" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <form onSubmit={submitCourse} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-lg">برنامج تدريبي</h3>
            <input required value={courseForm.name ?? ""} onChange={(e) => setCourseForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="اسم الدورة" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <input value={courseForm.provider || ""} onChange={(e) => setCourseForm((prev) => ({ ...prev, provider: e.target.value }))} placeholder="الجهة المقدمة" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={courseForm.start_date || ""} onChange={(e) => setCourseForm((prev) => ({ ...prev, start_date: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              <input type="date" value={courseForm.end_date || ""} onChange={(e) => setCourseForm((prev) => ({ ...prev, end_date: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <input type="number" value={courseForm.cost || 0} onChange={(e) => setCourseForm((prev) => ({ ...prev, cost: e.target.value }))} placeholder="التكلفة" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <button className="w-full bg-purple-600 text-white rounded-xl py-2 font-black">حفظ البرنامج</button>
          </form>
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => (
              <div key={course.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-black text-slate-900">{course.name}</div>
                    <div className="text-xs text-slate-500">{course.provider || "داخلي"}</div>
                  </div>
                  <StatusBadge status={course.status === "planned" ? "pending" : course.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="p-2 bg-slate-50 rounded-xl"><div className="text-[10px] text-slate-500">من</div><div className="text-xs font-black">{course.start_date || "-"}</div></div>
                  <div className="p-2 bg-slate-50 rounded-xl"><div className="text-[10px] text-slate-500">إلى</div><div className="text-xs font-black">{course.end_date || "-"}</div></div>
                  <div className="p-2 bg-slate-50 rounded-xl"><div className="text-[10px] text-slate-500">التكلفة</div><div className="text-xs font-black">{numberValue(course.cost)} ج.م</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm text-purple-900">
        <b>تم تطوير HR ليشمل:</b> إعدادات سياسات، لوحة مؤشرات، تقارير قابلة للتصدير، طلبات إجازة مع اعتماد، تقييمات أداء، مستندات بعقود وتنبيهات انتهاء، وبرامج تدريب.
      </div>

      {/* Document Preview & Print Modal */}
      {previewModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-l from-sky-600 to-purple-600 text-white">
              <div className="flex items-center gap-3">
                <Maximize2 className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-lg">معاينة وطباعة المستند</h3>
                  <p className="text-xs text-sky-100 font-medium">{previewModal.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open(previewModal.fileUrl, '_blank');
                    if (printWindow) {
                      printWindow.onload = () => {
                        printWindow.print();
                      };
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-bold text-sm transition-all border border-white/30"
                  title="طباعة المستند"
                >
                  <Printer className="w-4 h-4" />
                  طباعة
                </button>
                <button
                  onClick={() => setPreviewModal({ isOpen: false, fileUrl: "", fileName: "", fileType: "" })}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content - Document Preview */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden min-h-full">
                {previewModal.fileType?.startsWith('image/') || 
                 previewModal.fileUrl?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ? (
                  // Image Preview
                  <div className="flex items-center justify-center p-8">
                    <img
                      src={previewModal.fileUrl}
                      alt={previewModal.fileName}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
                      }}
                    />
                  </div>
                ) : previewModal.fileType === 'application/pdf' || 
                         previewModal.fileUrl?.endsWith('.pdf') ? (
                  // PDF Preview using iframe
                  <iframe
                    src={previewModal.fileUrl}
                    title={previewModal.fileName}
                    className="w-full min-h-[60vh] border-0"
                    style={{ minHeight: '60vh' }}
                  />
                ) : (
                  // Other files - Show download prompt with preview option
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <FileText className="w-20 h-20 text-slate-300 mb-4" />
                    <h4 className="text-lg font-bold text-slate-700 mb-2">معاينة غير متاحة</h4>
                    <p className="text-slate-500 mb-6 max-w-md">
                      نوع الملف هذا لا يدعم المعاينة المباشرة. يمكنك تحميل الملف أو فتحه في نافذة جديدة.
                    </p>
                    <div className="flex gap-3">
                      <a
                        href={previewModal.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm transition-all"
                      >
                        <Eye className="w-4 h-4" />
                        فتح في نافذة جديدة
                      </a>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = previewModal.fileUrl;
                          link.download = previewModal.fileName;
                          link.click();
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all"
                      >
                        <Download className="w-4 h-4" />
                        تحميل الملف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                <span className="font-medium">نوع الملف:</span> {previewModal.fileType || 'غير محدد'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(previewModal.fileUrl, '_blank')}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-all"
                >
                  فتح في تبويب جديد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
