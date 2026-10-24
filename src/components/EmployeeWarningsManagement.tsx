import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Printer,
  Search,
  Download,
  Plus,
  X,
  User,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  Edit3,
  Share2,
  ShieldAlert,
  UserCheck,
  Eye,
  Send,
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react";
import { api } from "../utils/api";
import { EmployeeSearchSelect } from "./EmployeeSearchSelect";

export interface EmployeeWarningRecord {
  id?: number;
  warning_number: string;
  employee_id: number;
  company_name?: string;
  issue_date: string;
  issue_place?: string;
  day_name?: string;
  warning_subject?: string;
  violation_types: string[];
  violation_other_text?: string;
  warning_level: string; // 'لفت نظر' | 'إنذار أول' | 'إنذار ثانٍ' | 'إنذار نهائي' | 'إنذار بالفصل'
  incident_date?: string;
  incident_time?: string;
  incident_details?: string;
  warning_text?: string;
  employee_response?: string;
  receipt_status: "pending" | "acknowledged" | "refused";
  notes?: string;
  employee_signature_name?: string;
  employee_signature_date?: string;
  direct_manager_name?: string;
  direct_manager_signature_date?: string;
  hr_manager_name?: string;
  hr_signature_date?: string;
  dept_manager_name?: string;
  dept_manager_signature_date?: string;
  admin_notes?: string;
  created_at?: string;
  // Joined fields
  employee_name?: string;
  employee_code?: string;
  job_title?: string;
  hire_date?: string;
  employee_phone?: string;
  department_name?: string;
  branch_name?: string;
}

interface EmployeeWarningsManagementProps {
  employees: any[];
  departments: any[];
  branches: any[];
  initialEmployeeId?: number | null;
  onClose?: () => void;
}

const VIOLATION_OPTIONS = [
  "التأخير عن مواعيد العمل",
  "الغياب دون إذن",
  "ترك مقر العمل دون تصريح",
  "عدم الالتزام بتعليمات العمل",
  "التقصير في أداء المهام",
  "مخالفة اللوائح والنظم الداخلية",
  "سوء التعامل أو السلوك الوظيفي",
  "أخرى"
];

const WARNING_LEVELS = [
  "لفت نظر",
  "إنذار أول",
  "إنذار ثانٍ",
  "إنذار نهائي",
  "إنذار بالفصل"
];

const ARABIC_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const EmployeeWarningsManagement: React.FC<EmployeeWarningsManagementProps> = ({
  employees = [],
  departments = [],
  branches = [],
  initialEmployeeId,
  onClose
}) => {
  const [warnings, setWarnings] = useState<EmployeeWarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [receiptFilter, setReceiptFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingWarningId, setEditingWarningId] = useState<number | null>(null);

  // Print Preview Modal
  const [previewWarning, setPreviewWarning] = useState<EmployeeWarningRecord | null>(null);
  const [isPrintBlank, setIsPrintBlank] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Form State
  const defaultCompanyName = localStorage.getItem("company_name") || "الشركة الحديثة للأنظمة المتكاملة";
  const [formData, setFormData] = useState<Partial<EmployeeWarningRecord>>({
    warning_number: "",
    employee_id: initialEmployeeId || (employees[0]?.id ? Number(employees[0].id) : 0),
    company_name: defaultCompanyName,
    issue_date: new Date().toISOString().split("T")[0],
    issue_place: "الإدارة العامة / مقر الشركة",
    day_name: ARABIC_DAYS[new Date().getDay()],
    warning_subject: "مخالفة لوائح وتعليمات العمل المعمول بها في المنشأة",
    violation_types: [],
    violation_other_text: "",
    warning_level: "إنذار أول",
    incident_date: new Date().toISOString().split("T")[0],
    incident_time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    incident_details: "",
    warning_text: "بناءً على ما سبق، يتم إنذار الموظف إنذارًا رسميًا، والتنبيه عليه بضرورة الالتزام بمواعيد العمل والتعليمات واللوائح الداخلية للشركة، وعدم تكرار المخالفة مستقبلاً. وفي حالة تكرار المخالفة، يتم اتخاذ الإجراءات الإدارية المناسبة وفقاً للوائح ونظم العمل المعمول بها في الشركة.",
    employee_response: "",
    receipt_status: "pending",
    notes: "",
    direct_manager_name: "",
    hr_manager_name: "مسؤول الموارد البشرية",
    dept_manager_name: "المدير العام",
    admin_notes: ""
  });

  // Fetch warnings from API
  const fetchWarnings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/hr/employee-warnings");
      const data = await res.json();
      setWarnings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching employee warnings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarnings();
  }, []);

  // Open create modal pre-filled with initial employee if supplied
  useEffect(() => {
    if (initialEmployeeId) {
      handleOpenCreateModal(initialEmployeeId);
    }
  }, [initialEmployeeId]);

  // Update day name when issue date changes
  const handleDateChange = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = ARABIC_DAYS[d.getDay()];
        setFormData((prev) => ({ ...prev, issue_date: dateStr, day_name: day }));
        return;
      }
    } catch (_) {}
    setFormData((prev) => ({ ...prev, issue_date: dateStr }));
  };

  const handleOpenCreateModal = (empId?: number) => {
    const selectedId = empId || (employees[0]?.id ? Number(employees[0].id) : 0);
    const emp = employees.find((e) => Number(e.id) === Number(selectedId));
    const now = new Date();
    const count = warnings.length + 1;
    const autoNum = `WRN-${now.getFullYear()}-${String(count).padStart(4, "0")}`;

    setFormData({
      warning_number: autoNum,
      employee_id: selectedId,
      company_name: defaultCompanyName,
      issue_date: now.toISOString().split("T")[0],
      issue_place: "الإدارة العامة / مقر الشركة",
      day_name: ARABIC_DAYS[now.getDay()],
      warning_subject: "مخالفة لوائح وتعليمات العمل المعمول بها في المنشأة",
      violation_types: ["التأخير عن مواعيد العمل"],
      violation_other_text: "",
      warning_level: "إنذار أول",
      incident_date: now.toISOString().split("T")[0],
      incident_time: now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      incident_details: "",
      warning_text: "بناءً على ما سبق، يتم إنذار الموظف إنذارًا رسميًا، والتنبيه عليه بضرورة الالتزام بمواعيد العمل والتعليمات واللوائح الداخلية للشركة، وعدم تكرار المخالفة مستقبلاً. وفي حالة تكرار المخالفة، يتم اتخاذ الإجراءات الإدارية المناسبة وفقاً للوائح ونظم العمل المعمول بها في الشركة.",
      employee_response: "",
      receipt_status: "pending",
      notes: "",
      direct_manager_name: "",
      hr_manager_name: "مسؤول الموارد البشرية",
      dept_manager_name: "المدير العام",
      admin_notes: ""
    });

    setModalMode("create");
    setEditingWarningId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (warning: EmployeeWarningRecord) => {
    setFormData({
      ...warning,
      violation_types: Array.isArray(warning.violation_types) ? warning.violation_types : []
    });
    setEditingWarningId(warning.id || null);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleToggleViolation = (violation: string) => {
    const current = formData.violation_types || [];
    if (current.includes(violation)) {
      setFormData({
        ...formData,
        violation_types: current.filter((v) => v !== violation)
      });
    } else {
      setFormData({
        ...formData,
        violation_types: [...current, violation]
      });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      alert("يرجى اختيار الموظف");
      return;
    }

    try {
      if (modalMode === "create") {
        await api.post("/api/hr/employee-warnings", formData);
      } else if (modalMode === "edit" && editingWarningId) {
        await api.put(`/api/hr/employee-warnings/${editingWarningId}`, formData);
      }
      setIsModalOpen(false);
      fetchWarnings();
    } catch (error: any) {
      console.error("Failed to save employee warning:", error);
      alert(error.message || "حدث خطأ أثناء حفظ محضر الإنذار");
    }
  };

  const handleDeleteWarning = async (id?: number) => {
    if (!id) return;
    if (!confirm("هل أنت متأكد من رغبتك في حذف محضر الإنذار هذا نهائياً؟")) return;
    try {
      await api.delete(`/api/hr/employee-warnings/${id}`);
      fetchWarnings();
    } catch (error) {
      alert("فشل حذف محضر الإنذار");
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const exportData = filteredWarnings.map((w, idx) => ({
      "م": idx + 1,
      "رقم المحضر": w.warning_number,
      "اسم الموظف": w.employee_name || "-",
      "الرقم الوظيفي": w.employee_code || "-",
      "الوظيفة": w.job_title || "-",
      "القسم": w.department_name || "-",
      "تاريخ التحرير": w.issue_date,
      "درجة الإنذار": w.warning_level,
      "المخالفات": Array.isArray(w.violation_types) ? w.violation_types.join("، ") : "",
      "حالة الاستلام":
        w.receipt_status === "acknowledged"
          ? "أقر بالاستلام"
          : w.receipt_status === "refused"
          ? "رفض التوقيع"
          : "قيد الإجراء",
      "تفاصيل الواقعة": w.incident_details || "-",
      "رد الموظف": w.employee_response || "-"
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "محاضر الإنذارات");
    XLSX.writeFile(wb, `محاضر_إنذارات_الموظفين_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleSendWhatsApp = (warning: EmployeeWarningRecord) => {
    const empPhone = warning.employee_phone;
    const msg = `السلام عليكم ورحمة الله وبركاته، الأخ/الأخت ${warning.employee_name} المحترم،\nنحيطكم علماً بأنه قد تم تحرير محضر إنذار رسمي رقم (${warning.warning_number}) بتاريخ ${warning.issue_date}.\nالدرجة: ${warning.warning_level}\nالموضوع: ${warning.warning_subject || "مخالفة تعليمات العمل"}\nيرجى مراجعة إدارة الموارد البشرية للاطلاع والرد والتوقيع.`;
    const encoded = encodeURIComponent(msg);
    if (empPhone) {
      window.open(`https://wa.me/${empPhone.replace(/[^0-9]/g, "")}?text=${encoded}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  // Filtered Warnings
  const filteredWarnings = useMemo(() => {
    return warnings.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        w.warning_number?.toLowerCase().includes(q) ||
        w.employee_name?.toLowerCase().includes(q) ||
        w.employee_code?.toLowerCase().includes(q) ||
        w.warning_subject?.toLowerCase().includes(q) ||
        w.department_name?.toLowerCase().includes(q);

      const matchesLevel = levelFilter === "all" || w.warning_level === levelFilter;
      const matchesReceipt = receiptFilter === "all" || w.receipt_status === receiptFilter;
      const matchesDept =
        deptFilter === "all" || String(w.department_name).toLowerCase() === deptFilter.toLowerCase();

      return matchesSearch && matchesLevel && matchesReceipt && matchesDept;
    });
  }, [warnings, searchQuery, levelFilter, receiptFilter, deptFilter]);

  // Key KPI stats
  const stats = useMemo(() => {
    const total = warnings.length;
    const firstLevel = warnings.filter((w) => w.warning_level === "إنذار أول").length;
    const finalLevel = warnings.filter((w) => w.warning_level === "إنذار نهائي" || w.warning_level === "إنذار بالفصل").length;
    const acknowledged = warnings.filter((w) => w.receipt_status === "acknowledged").length;
    const refused = warnings.filter((w) => w.receipt_status === "refused").length;
    return { total, firstLevel, finalLevel, acknowledged, refused };
  }, [warnings]);

  // Selected Employee Info for Form
  const currentSelectedEmployee = useMemo(() => {
    return employees.find((e) => Number(e.id) === Number(formData.employee_id));
  }, [employees, formData.employee_id]);

  return (
    <div className="space-y-6 select-none font-cairo" dir="rtl">
      {/* 1. Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800">محاضر إنذارات الموظفين</h2>
              <span className="text-xs font-black bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                النموذج الإداري المعتمد
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              إدارة وتحرير محاضر الإنذارات القانونية والرسمية للموظفين، وتوثيق المخالفات والتوقيعات والطباعة المعتمدة A4
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setIsPrintBlank(true);
              setPreviewWarning(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all shadow-xs hover:shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>طباعة نموذج فارغ A4</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-2xl font-bold text-sm transition-all shadow-xs hover:shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md hover:shadow-lg shadow-amber-600/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>تحرير محضر إنذار جديد</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي المحاضر</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-600 block mb-1">إنذار أول</span>
            <span className="text-2xl font-black text-blue-700 font-mono">{stats.firstLevel}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-rose-100 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-600 block mb-1">إنذار نهائي / فصل</span>
            <span className="text-2xl font-black text-rose-700 font-mono">{stats.finalLevel}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 block mb-1">أقر باستلام صورة</span>
            <span className="text-2xl font-black text-emerald-700 font-mono">{stats.acknowledged}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-amber-100 rounded-2xl p-4.5 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-xs font-bold text-amber-700 block mb-1">رفض التوقيع</span>
            <span className="text-2xl font-black text-amber-800 font-mono">{stats.refused}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filters Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <input
            type="text"
            placeholder="بحث برقم المحضر، اسم الموظف، الكود أو موضوع الإنذار..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
        </div>

        <div className="w-40">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
          >
            <option value="all">كل درجات الإنذار</option>
            {WARNING_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <select
            value={receiptFilter}
            onChange={(e) => setReceiptFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
          >
            <option value="all">حالة التوقيع والاستلام</option>
            <option value="acknowledged">أقر باستلام صورة</option>
            <option value="refused">رفض التوقيع</option>
            <option value="pending">قيد الإجراء</option>
          </select>
        </div>

        <div className="w-40">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
          >
            <option value="all">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {(searchQuery || levelFilter !== "all" || receiptFilter !== "all" || deptFilter !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setLevelFilter("all");
              setReceiptFilter("all");
              setDeptFilter("all");
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            إعادة الضبط
          </button>
        )}
      </div>

      {/* 4. Table / List of Warnings */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            <span className="text-sm font-bold">جاري تحميل سجلات محاضر الإنذار...</span>
          </div>
        ) : filteredWarnings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <p className="text-base font-extrabold text-slate-600">لا توجد محاضر إنذار مسجلة حالياً</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              يمكنك تحرير أول محضر إنذار رسمي لموظف بموجب اللائحة الداخلية ونموذج محضر الإنذار المعتمد.
            </p>
            <button
              onClick={() => handleOpenCreateModal()}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تحرير محضر إنذار الآن</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-extrabold">
                  <th className="p-4 w-12 text-center">م</th>
                  <th className="p-4">رقم المحضر</th>
                  <th className="p-4">الموظف</th>
                  <th className="p-4">القسم والوظيفة</th>
                  <th className="p-4">تاريخ التحرير</th>
                  <th className="p-4">درجة الإنذار</th>
                  <th className="p-4">نوع المخالفة</th>
                  <th className="p-4">حالة الاستلام</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredWarnings.map((w, idx) => {
                  const isFinal = w.warning_level === "إنذار نهائي" || w.warning_level === "إنذار بالفصل";
                  const isFirst = w.warning_level === "إنذار أول";
                  return (
                    <tr key={w.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 text-center font-mono text-xs text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-xs border border-slate-200">
                          {w.warning_number}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                            {w.employee_name ? w.employee_name.charAt(0) : "م"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{w.employee_name || "موظف"}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              كود: {w.employee_code || `#${w.employee_id}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-bold text-slate-700">{w.job_title || "-"}</div>
                        <div className="text-[11px] text-slate-400">{w.department_name || "-"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-mono font-bold text-slate-700">{w.issue_date}</div>
                        <div className="text-[11px] text-slate-400">{w.day_name || ""}</div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full border ${
                            isFinal
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : isFirst
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isFinal && <ShieldAlert className="w-3 h-3" />}
                          {w.warning_level}
                        </span>
                      </td>
                      <td className="p-4 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(w.violation_types) && w.violation_types.slice(0, 2).map((v, vIdx) => (
                            <span
                              key={vIdx}
                              className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[140px]"
                              title={v}
                            >
                              {v}
                            </span>
                          ))}
                          {Array.isArray(w.violation_types) && w.violation_types.length > 2 && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1 py-0.5 rounded">
                              +{w.violation_types.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {w.receipt_status === "acknowledged" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            أقر بالاستلام
                          </span>
                        ) : w.receipt_status === "refused" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" />
                            رفض التوقيع
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            قيد المتابعة
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setPreviewWarning(w);
                              setIsPrintBlank(false);
                            }}
                            title="معاينة وطباعة النموذج الرسمي A4"
                            className="p-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleSendWhatsApp(w)}
                            title="إرسال إشعار WhatsApp للموظف"
                            className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(w)}
                            title="تعديل المحضر"
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteWarning(w.id)}
                            title="حذف المحضر"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black leading-tight">
                    {modalMode === "create" ? "تحرير محضر إنذار موظف رسمي" : "تعديل محضر إنذار موظف"}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    النموذج الرسمي الشامل المعتمد للمخالفات والجزاءات الإدارية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Top Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم الشركة / المنشأة</label>
                  <input
                    type="text"
                    value={formData.company_name || ""}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">رقم المحضر</label>
                  <input
                    type="text"
                    value={formData.warning_number || ""}
                    onChange={(e) => setFormData({ ...formData, warning_number: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-amber-500"
                    placeholder="WRN-2026-0001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ تحرير المحضر</label>
                  <input
                    type="date"
                    value={formData.issue_date || ""}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">مكان تحرير المحضر</label>
                  <input
                    type="text"
                    value={formData.issue_place || ""}
                    onChange={(e) => setFormData({ ...formData, issue_place: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                    placeholder="المقر الرئيسي / الفرع"
                  />
                </div>
              </div>

              {/* Section 1: Employee Details */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">أولاً: بيانات الموظف</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">اختر الموظف *</label>
                    <EmployeeSearchSelect
                      required
                      employees={employees}
                      value={formData.employee_id}
                      onChange={(value) => setFormData({ ...formData, employee_id: Number(value) || 0 })}
                      placeholder="ابحث باسم الموظف أو الكود..."
                      inputClassName="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">الرقم الوظيفي</label>
                    <input
                      type="text"
                      readOnly
                      value={currentSelectedEmployee?.employee_code || `#${formData.employee_id || ""}`}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">الوظيفة / المسمى الوظيفي</label>
                    <input
                      type="text"
                      readOnly
                      value={currentSelectedEmployee?.job_title || "-"}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">الإدارة / القسم</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        departments.find((d) => d.id === currentSelectedEmployee?.department_id)?.name ||
                        currentSelectedEmployee?.department_name ||
                        "-"
                      }
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">الفرع</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        branches.find((b) => b.id === currentSelectedEmployee?.branch_id)?.name ||
                        currentSelectedEmployee?.branch_name ||
                        "-"
                      }
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ الالتحاق بالعمل</label>
                    <input
                      type="text"
                      readOnly
                      value={currentSelectedEmployee?.hire_date || "-"}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Warning Subject & Violation Types */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                      2
                    </span>
                    <h4 className="font-black text-slate-800 text-sm">ثانياً: موضوع الإنذار ونوع المخالفة</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">درجة الإنذار:</span>
                    <select
                      value={formData.warning_level}
                      onChange={(e) => setFormData({ ...formData, warning_level: e.target.value })}
                      className="bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-xs rounded-lg px-2.5 py-1 focus:outline-none"
                    >
                      {WARNING_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">اليوم والتاريخ في الديباجة:</label>
                    <p className="text-slate-500 font-medium">
                      إنه في يوم <span className="font-bold text-slate-800">{formData.day_name || "..."}</span> الموافق{" "}
                      <span className="font-bold font-mono text-slate-800">{formData.issue_date || "..."}</span> تم تحرير
                      هذا المحضر بشأن الموظف المذكور أعلاه.
                    </p>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">موضوع الإنذار العام:</label>
                    <input
                      type="text"
                      value={formData.warning_subject || ""}
                      onChange={(e) => setFormData({ ...formData, warning_subject: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">
                    نوع المخالفة / سبب الإنذار (حدد كل ما ينطبق كما في الاستمارة الرسمية):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {VIOLATION_OPTIONS.map((item) => {
                      const isChecked = formData.violation_types?.includes(item);
                      return (
                        <label
                          key={item}
                          onClick={() => handleToggleViolation(item)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isChecked
                              ? "bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
                          />
                          <span>{item}</span>
                        </label>
                      );
                    })}
                  </div>

                  {formData.violation_types?.includes("أخرى") && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        placeholder="يرجى كتابة وتفصيل المخالفة الأخرى هنا..."
                        value={formData.violation_other_text || ""}
                        onChange={(e) => setFormData({ ...formData, violation_other_text: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Incident Details */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">ثالثاً: تفاصيل الواقعة</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ حدوث الواقعة</label>
                    <input
                      type="date"
                      value={formData.incident_date || ""}
                      onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">في تمام الساعة</label>
                    <input
                      type="text"
                      placeholder="مثال: 09:30 صباحاً"
                      value={formData.incident_time || ""}
                      onChange={(e) => setFormData({ ...formData, incident_time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    تم إثبات قيام الموظف بـ (تفاصيل الواقعة والشرح التوضيحي):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="اكتب هنا تفاصيل الواقعة بدقة وما تم رصده أو ثبوته على الموظف..."
                    value={formData.incident_details || ""}
                    onChange={(e) => setFormData({ ...formData, incident_details: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                  <div className="mt-1 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                    ملاحظة قانونية ثابتة في النموذج: "وقد تم تنبيه الموظف إلى ضرورة الالتزام بالتعليمات واللوائح المنظمة للعمل وعدم تكرار هذه المخالفة."
                  </div>
                </div>
              </div>

              {/* Section 4: Warning Legal Text */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                    4
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">رابعاً: صيغة الإنذار الرسمي</h4>
                </div>
                <textarea
                  rows={2}
                  value={formData.warning_text || ""}
                  onChange={(e) => setFormData({ ...formData, warning_text: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-950 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Section 5: Employee Response & Receipt Status */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                    5
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">خامساً: رد الموظف وإقرار الاستلام</h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    أفيد أنا الموظف المذكور أعلاه بأنني (أقوال الموظف إن وجدت):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="يمكن كتابة أقوال الموظف أو تركه فارغاً ليقوم الموظف بكتابته بخط يده..."
                    value={formData.employee_response || ""}
                    onChange={(e) => setFormData({ ...formData, employee_response: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <span className="text-xs font-bold text-slate-700">موقف الموظف من الاستلام:</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="radio"
                      name="receipt_status"
                      checked={formData.receipt_status === "acknowledged"}
                      onChange={() => setFormData({ ...formData, receipt_status: "acknowledged" })}
                      className="accent-emerald-600"
                    />
                    <span>أقر باستلام صورة من هذا الإنذار</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="radio"
                      name="receipt_status"
                      checked={formData.receipt_status === "refused"}
                      onChange={() => setFormData({ ...formData, receipt_status: "refused" })}
                      className="accent-rose-600"
                    />
                    <span>أرفض التوقيع على استلام الإنذار</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="radio"
                      name="receipt_status"
                      checked={formData.receipt_status === "pending"}
                      onChange={() => setFormData({ ...formData, receipt_status: "pending" })}
                      className="accent-slate-500"
                    />
                    <span>قيد الإجراء والتسليم</span>
                  </label>
                </div>
              </div>

              {/* Section 6: Signatures & Administration */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                    6
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">سادساً: التوقيعات والاعتمادات الإدارية</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">اسم المسؤول المباشر</label>
                    <input
                      type="text"
                      placeholder="اسم المدير المباشر"
                      value={formData.direct_manager_name || ""}
                      onChange={(e) => setFormData({ ...formData, direct_manager_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">مسؤول الموارد البشرية</label>
                    <input
                      type="text"
                      value={formData.hr_manager_name || ""}
                      onChange={(e) => setFormData({ ...formData, hr_manager_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">اعتماد مدير الإدارة / المسؤول</label>
                    <input
                      type="text"
                      value={formData.dept_manager_name || ""}
                      onChange={(e) => setFormData({ ...formData, dept_manager_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات إدارية إضافية</label>
                  <input
                    type="text"
                    placeholder="أي توجيهات أو إجراءات ملحقة..."
                    value={formData.admin_notes || ""}
                    onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  {modalMode === "create" ? "حفظ وإصدار محضر الإنذار" : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. OFFICIAL A4 PRINT PREVIEW MODAL (Identical reproduction of uploaded image) */}
      {(previewWarning || isPrintBlank) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:overflow-visible">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col print:shadow-none print:border-none print:max-w-none print:rounded-none">
            {/* Top Toolbar - Hidden during print */}
            <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm">
                  {isPrintBlank ? "معاينة النموذج الفارغ للطباعة (A4)" : `معاينة محضر الإنذار: ${previewWarning?.warning_number}`}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleTriggerPrint}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة فورية (Print)</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewWarning(null);
                    setIsPrintBlank(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Content Frame */}
            <div className="p-4 sm:p-10 overflow-y-auto print:overflow-visible print:p-0 bg-white" dir="rtl">
              <div
                ref={printRef}
                className="w-full max-w-[800px] mx-auto bg-white border-2 border-black p-6 sm:p-8 space-y-4 text-black text-xs sm:text-sm font-cairo leading-normal print:border-2 print:border-black print:p-6 print:max-w-none"
                style={{ fontFamily: "'Cairo', 'Amiri', 'Times New Roman', serif" }}
              >
                {/* 1. Header */}
                <div className="text-center relative pb-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-black tracking-wide border-b-2 border-black pb-1 inline-block">
                    محضر إنذار موظف
                  </h1>
                </div>

                {/* Company & Warning Metas */}
                <div className="flex justify-between items-start pt-1 text-xs sm:text-sm font-semibold">
                  <div className="space-y-1 text-right">
                    <div>
                      <span className="font-bold">مكان تحرير المحضر: </span>
                      <span className="border-b border-dotted border-black pb-0.5 px-3 min-w-[150px] inline-block">
                        {previewWarning?.issue_place || (isPrintBlank ? "" : "مقر العمل الرئيسي")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-right min-w-[240px]">
                    <div className="flex justify-between">
                      <span className="font-bold">اسم الشركة:</span>
                      <span className="border-b border-dotted border-black pb-0.5 px-2 font-bold">
                        {previewWarning?.company_name || defaultCompanyName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">رقم المحضر:</span>
                      <span className="border-b border-dotted border-black pb-0.5 px-2 font-mono font-bold">
                        {previewWarning?.warning_number || (isPrintBlank ? "......../........" : "WRN-2026-0001")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">التاريخ:</span>
                      <span className="border-b border-dotted border-black pb-0.5 px-2 font-mono font-bold">
                        {previewWarning?.issue_date || (isPrintBlank ? "..... / ..... / 202..." : "")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* أولاً: بيانات الموظف */}
                <div className="pt-2">
                  <div className="inline-block bg-slate-200 border border-black px-4 py-0.5 font-bold text-xs sm:text-sm rounded-xs mb-1.5">
                    أولاً: بيانات الموظف
                  </div>
                  <div className="space-y-2 border border-black p-3 rounded-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-bold">اسم الموظف: </span>
                        <span className="border-b border-dotted border-black pb-0.5 font-bold px-2 inline-block min-w-[160px]">
                          {previewWarning?.employee_name || (isPrintBlank ? "" : ".....................................")}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold">الرقم الوظيفي: </span>
                        <span className="border-b border-dotted border-black pb-0.5 font-mono font-bold px-2 inline-block min-w-[120px]">
                          {previewWarning?.employee_code ||
                            (isPrintBlank ? "" : `#${previewWarning?.employee_id || ""}`)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-bold">الوظيفة: </span>
                        <span className="border-b border-dotted border-black pb-0.5 px-2 inline-block min-w-[160px]">
                          {previewWarning?.job_title || (isPrintBlank ? "" : ".....................................")}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold">الإدارة / القسم: </span>
                        <span className="border-b border-dotted border-black pb-0.5 px-2 inline-block min-w-[120px]">
                          {previewWarning?.department_name ||
                            (isPrintBlank ? "" : ".....................................")}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="font-bold">تاريخ الالتحاق بالعمل: </span>
                      <span className="border-b border-dotted border-black pb-0.5 font-mono px-2 inline-block min-w-[160px]">
                        {previewWarning?.hire_date || (isPrintBlank ? "..... / ..... / 202..." : "")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ثانياً: موضوع الإنذار */}
                <div>
                  <div className="inline-block bg-slate-200 border border-black px-4 py-0.5 font-bold text-xs sm:text-sm rounded-xs mb-1.5">
                    ثانياً: موضوع الإنذار
                  </div>
                  <div className="border border-black p-3 rounded-xs space-y-2">
                    <p className="leading-relaxed">
                      إنه في يوم{" "}
                      <span className="font-bold border-b border-dotted border-black px-2">
                        {previewWarning?.day_name || (isPrintBlank ? "................" : "................")}
                      </span>{" "}
                      الموافق{" "}
                      <span className="font-bold font-mono border-b border-dotted border-black px-2">
                        {previewWarning?.issue_date || (isPrintBlank ? "..... / ..... / 202..." : "")}
                      </span>
                      ، تم تحرير هذا المحضر بشأن الموظف المذكور أعلاه، وذلك بسبب:
                    </p>

                    <div className="border-b border-dotted border-black pb-1 font-semibold text-slate-800 min-h-[22px]">
                      {previewWarning?.warning_subject || ""}
                    </div>

                    <div className="pt-1">
                      <div className="font-bold mb-1.5">نوع المخالفة / سبب الإنذار:</div>
                      <div className="grid grid-cols-3 gap-y-2 gap-x-2 text-xs">
                        {VIOLATION_OPTIONS.slice(0, 7).map((opt) => {
                          const checked = !isPrintBlank && previewWarning?.violation_types?.includes(opt);
                          return (
                            <div key={opt} className="flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-black text-[10px] font-black">
                                {checked ? "✓" : ""}
                              </span>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-1.5 col-span-2">
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-black text-[10px] font-black">
                            {!isPrintBlank && previewWarning?.violation_types?.includes("أخرى") ? "✓" : ""}
                          </span>
                          <span>أخرى: </span>
                          <span className="border-b border-dotted border-black flex-1 min-h-[16px]">
                            {!isPrintBlank ? previewWarning?.violation_other_text || "" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ثالثاً: تفاصيل الواقعة */}
                <div>
                  <div className="inline-block bg-slate-200 border border-black px-4 py-0.5 font-bold text-xs sm:text-sm rounded-xs mb-1.5">
                    ثالثاً: تفاصيل الواقعة
                  </div>
                  <div className="border border-black p-3 rounded-xs space-y-2">
                    <p className="leading-relaxed">
                      بتاريخ:{" "}
                      <span className="font-bold font-mono border-b border-dotted border-black px-2">
                        {previewWarning?.incident_date || (isPrintBlank ? "..... / ..... / 202..." : "")}
                      </span>{" "}
                      وفي تمام الساعة{" "}
                      <span className="font-bold border-b border-dotted border-black px-2">
                        {previewWarning?.incident_time || (isPrintBlank ? "..............." : "")}
                      </span>{" "}
                      تم إثبات قيام الموظف بـ:
                    </p>

                    <div className="border-b border-dotted border-black pb-1 min-h-[44px] leading-relaxed font-semibold">
                      {previewWarning?.incident_details || ""}
                    </div>

                    <p className="font-bold text-xs pt-1 border-t border-slate-300">
                      وقد تم تنبيه الموظف إلى ضرورة الالتزام بالتعليمات واللوائح المنظمة للعمل وعدم تكرار هذه المخالفة.
                    </p>
                  </div>
                </div>

                {/* رابعاً: الإنذار */}
                <div>
                  <div className="inline-block bg-slate-200 border border-black px-4 py-0.5 font-bold text-xs sm:text-sm rounded-xs mb-1.5">
                    رابعاً: الإنذار
                  </div>
                  <div className="border border-black p-3 rounded-xs space-y-1.5">
                    <p className="leading-relaxed text-xs sm:text-sm">
                      بناءً على ما سبق، يتم إنذار الموظف إنذارًا رسميًا{" "}
                      <span className="font-black underline px-1">
                        ({previewWarning?.warning_level || "إنذار أول"})
                      </span>
                      ، والتنبيه عليه بضرورة الالتزام بمواعيد العمل والتعليمات واللوائح الداخلية للشركة، وعدم تكرار المخالفة مستقبلاً.
                    </p>
                    <p className="leading-relaxed text-xs sm:text-sm font-semibold">
                      وفي حالة تكرار المخالفة، يتم اتخاذ الإجراءات الإدارية المناسبة وفقاً للوائح ونظم العمل المعمول بها في الشركة.
                    </p>
                  </div>
                </div>

                {/* خامساً: رد الموظف */}
                <div>
                  <div className="inline-block bg-slate-200 border border-black px-4 py-0.5 font-bold text-xs sm:text-sm rounded-xs mb-1.5">
                    خامساً: رد الموظف
                  </div>
                  <div className="border border-black p-3 rounded-xs space-y-2">
                    <p className="font-bold">أفيد أنا الموظف المذكور أعلاه بأنني:</p>
                    <div className="border-b border-dotted border-black min-h-[36px] text-xs font-semibold">
                      {previewWarning?.employee_response || ""}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-black text-[10px] font-black">
                          {!isPrintBlank && previewWarning?.receipt_status === "acknowledged" ? "✓" : ""}
                        </span>
                        <span className="font-bold">أقر باستلام صورة من هذا الإنذار.</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-black text-[10px] font-black">
                          {!isPrintBlank && previewWarning?.receipt_status === "refused" ? "✓" : ""}
                        </span>
                        <span className="font-bold">أرفض التوقيع على استلام الإنذار.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* سادساً: الملاحظات */}
                <div>
                  <div className="inline-block bg-slate-200 border border-black px-4 py-0.5 font-bold text-xs sm:text-sm rounded-xs mb-1.5">
                    سادساً: الملاحظات
                  </div>
                  <div className="border border-black p-2 rounded-xs min-h-[26px] text-xs">
                    {previewWarning?.notes || ""}
                  </div>
                </div>

                {/* جدول التوقيعات */}
                <div>
                  <div className="text-center font-black border-t-2 border-black pt-1 mb-2">
                    التوقيعات
                  </div>

                  <div className="border-2 border-black">
                    <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black border-b border-black py-1 px-2 text-xs font-bold items-center">
                      <div className="col-span-5">
                        <span>اسم الموظف: </span>
                        <span className="font-normal">{previewWarning?.employee_name || "............................"}</span>
                      </div>
                      <div className="col-span-4 px-2">
                        <span>التوقيع: </span>
                        <span className="font-normal">............................</span>
                      </div>
                      <div className="col-span-3 px-2">
                        <span>التاريخ: </span>
                        <span className="font-normal font-mono">... / ... / 202...</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black border-b border-black py-1 px-2 text-xs font-bold items-center">
                      <div className="col-span-5">
                        <span>المسؤول المباشر: </span>
                        <span className="font-normal">
                          {previewWarning?.direct_manager_name || "............................"}
                        </span>
                      </div>
                      <div className="col-span-4 px-2">
                        <span>التوقيع: </span>
                        <span className="font-normal">............................</span>
                      </div>
                      <div className="col-span-3 px-2">
                        <span>التاريخ: </span>
                        <span className="font-normal font-mono">... / ... / 202...</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black border-b border-black py-1 px-2 text-xs font-bold items-center">
                      <div className="col-span-5">
                        <span>مسؤول الموارد البشرية: </span>
                        <span className="font-normal">
                          {previewWarning?.hr_manager_name || "............................"}
                        </span>
                      </div>
                      <div className="col-span-4 px-2">
                        <span>التوقيع: </span>
                        <span className="font-normal">............................</span>
                      </div>
                      <div className="col-span-3 px-2">
                        <span>التاريخ: </span>
                        <span className="font-normal font-mono">... / ... / 202...</span>
                      </div>
                    </div>

                    <div className="p-2 text-xs border-b border-black space-y-1">
                      <div className="font-bold">اعتماد مدير الإدارة / المدير المسؤول:</div>
                      <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black text-xs font-bold pt-1">
                        <div className="col-span-5">
                          <span>الاسم: </span>
                          <span className="font-normal">
                            {previewWarning?.dept_manager_name || "............................"}
                          </span>
                        </div>
                        <div className="col-span-4 px-2">
                          <span>التوقيع: </span>
                          <span className="font-normal">............................</span>
                        </div>
                        <div className="col-span-3 px-2">
                          <span>التاريخ: </span>
                          <span className="font-normal font-mono">... / ... / 202...</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 text-xs">
                      <span className="font-bold">ملاحظات إدارية: </span>
                      <span className="font-normal">{previewWarning?.admin_notes || ""}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default EmployeeWarningsManagement;
