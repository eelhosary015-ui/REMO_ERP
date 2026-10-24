import { DocumentPreviewModal } from "./DocumentPreviewModal";
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { databaseStorage } from "../utils/databaseStorage";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  UserPlus,
  Crown,
  Star,
  Search,
  Filter,
  Edit2,
  Trash2,
  MapPin,
  Building2,
  Clock,
  ShieldAlert,
  Save,
  X,
  Plus,
  Phone,
  CreditCard,
  Briefcase,
  GraduationCap,
  Home,
  CheckCircle2,
  UtensilsCrossed,
  LayoutDashboard,
  Lock,
  Package,
  MessageSquare,
  MessageSquareWarning,
  Download,
  Eye,
  Printer,
  StarHalf,
  CalendarDays,
  FileCog,
  UserCheck,
  Gavel,
  AlertTriangle,
  Zap,
  Target,
  Calculator,
  Key,
  Fingerprint,
  ShieldCheck,
  User,
  Paperclip,
  Upload,
  FileText,
  Power,
  PowerOff,
  History,
  XCircle,
  ChevronDown,
  RefreshCw, Calendar,
  Bell, Gift, Sparkles, Layers,
  List,
  FileCheck,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import { Employee, HRDepartment, HRShift, Branch, HRPenalty } from "../types";
import { api } from "../utils/api";
import { HRProfessionalSuite } from "./HRProfessionalSuite";
import { SetEmployeePasswordModal } from "./SetEmployeePasswordModal";
import { PortalRequestsManagement } from "./PortalRequestsManagement";
import { RecruitmentSuite } from "./RecruitmentSuite";
import { HRComprehensiveReport } from "./HRComprehensiveReport";
import { SendEmployeeMessageModal } from "./SendEmployeeMessageModal";
import { LeaveApprovalsWorkflow } from "./LeaveApprovalsWorkflow";
import { BulkActionsPage } from "./BulkActionsPage";
import { ClearanceManagement } from "./ClearanceManagement";
import { HRDetailedEmployeeReport } from "./HRDetailedEmployeeReport";
import { AnnualIncreasesManagement } from "./AnnualIncreasesManagement";
import { EmployeeBasicInfo } from "./EmployeeBasicInfo";
import { OrganizationsManagement } from "./OrganizationsManagement";

const getTypeLabel = (type: string) => {
  const translations: Record<string, string> = {
    direct: "سلفة مباشرة",
    installment: "سلفة قسط",
    housing: "بدل سكن",
    bonus: "مكافأة",
    delivery: "دليفري",
    vacation: "بدل إجازة",
    meal: "بدل وجبة",
    transport: "بدل انتقال وركوب",
    absence: "خصم غياب (إضافي)",
    cl: "CL",
    shortage: "عجز",
    fellowship: "صندوق زمالة",
    hr: "خصم HR",
    penalty: "جزاء إداري",
    insurance: "خصم تأمينات اجتماعية",
  };
  return translations[type] || type;
};

interface HRProps {
  onBack: () => void;
  initialTab?:
    | "employees"
    | "employee_basic_info"
    | "branches"
    | "departments"
    | "shifts"
    | "penalties"
    | "attendance"
    | "payroll"
    | "requests"
    | "settings"
    | "professional"
    | "award_penalties"
    | "clearance"
    | "clearance_records"
    | "custody"
    | "production_bonuses"
    | "payroll_elements"
    | "evaluations"
    | "leaves"
    | "portal_requests"
    | "leave_settings"
    | "documents"
    | "hr_settings"
    | "comprehensive_report"
    | "recruitment"
    | "bulk_actions"
    | "detailed_report"
    | "hr_detailed_report";
}

const DEFAULT_ABSENCES = [
  {
    id: 1,
    employee_id: 1,
    employee_name: "أحمد محمود علي",
    date: "2026-06-05",
    type: "غياب بدون إذن",
    status: "خصم يومين",
    amount: 150,
    notes: "لم يبلغ الفرع مسبقاً",
  },
  {
    id: 2,
    employee_id: 2,
    employee_name: "محمد عبد الله",
    date: "2026-06-10",
    type: "غياب مسبب",
    status: "مقبول عذر طبي",
    amount: 0,
    notes: "وعكة صحية",
  },
];

const DEFAULT_OVERTIME = [
  {
    id: 1,
    employee_id: 1,
    employee_name: "أحمد محمود علي",
    date: "2026-06-02",
    scheduled_hours: "8 ساعات",
    actual_hours: "11 ساعة",
    overtime_hours: "3 ساعات",
    hourly_rate: "25 ج.م",
    total_bonus: "75 ج.م",
    approved: true,
  },
  {
    id: 2,
    employee_id: 2,
    employee_name: "محمد عبد الله",
    date: "2026-06-12",
    scheduled_hours: "8 ساعات",
    actual_hours: "10 ساعات",
    overtime_hours: "ساعتين",
    hourly_rate: "20 ج.م",
    total_bonus: "40 ج.م",
    approved: false,
  },
];

const DEFAULT_LEAVE_POLICIES = [
  {
    id: 1,
    name: "إجازة اعتيادية (سنوية)",
    allowed_days: 21,
    impact: "paid",
    deduct_from_balance: true,
  },
  {
    id: 2,
    name: "إجازة مرضية",
    allowed_days: 14,
    impact: "paid",
    deduct_from_balance: true,
  },
  {
    id: 3,
    name: "إجازة عارضة",
    allowed_days: 6,
    impact: "paid",
    deduct_from_balance: true,
  },
  {
    id: 4,
    name: "إجازة بدون مرتب",
    allowed_days: 0,
    impact: "unpaid",
    deduct_from_balance: false,
  },
];

export const HR: React.FC<HRProps> = ({ onBack, initialTab }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | "employees"
    | "branches"
    | "departments"
    | "shifts"
    | "penalties"
    | "attendance"
    | "payroll"
    | "requests"
    | "settings"
    | "professional"
    | "award_penalties"
    | "clearance"
    | "custody"
    | "production_bonuses"
    | "payroll_elements"
    | "evaluations"
    | "leaves"
    | "leave_settings"
    | "documents"
    | "hr_settings"
    | "comprehensive_report"
    | "recruitment"
    | "portal_requests"
    | "bulk_actions"
    | "detailed_report"
    | "annual_increases"
    | "organizations"
  >(() => {
    if (initialTab) {
      if (initialTab === "clearance_records") return "clearance";
      if (initialTab === "hr_detailed_report" || initialTab === "detailed_report") return "detailed_report";
      return initialTab as any;
    }
    const saved = localStorage.getItem("last_hr_tab");
    return (saved as any) || "professional";
  });

  useEffect(() => {
    if (activeTab) {
      try {
        localStorage.setItem("last_hr_tab", activeTab);
      } catch (_) {}
    }
  }, [activeTab]);

  const tabNames: Record<string, string> = {
    professional: "مركز الموارد البشرية الاحترافي",
    recruitment: "منظومة التوظيف و فرز السير الذاتية بالذكاء الاصطناعي (ATS)",
    annual_increases: "منظومة وموافقات الزيادة السنوية للموظفين",
    portal_requests: "موافقات التطبيب والمذكرات",
    employees: "قائمة الموظفين",
    organizations: "إدارة المؤسسات والشركات",
    detailed_report: "تقرير الموظفين المفصل الشامل",
    hr_detailed_report: "تقرير الموظفين المفصل الشامل",
    bulk_actions: "لوحة الإجراءات الجماعية الذكية",
    documents: "ملفات ومستندات الموظفين",
    payroll_elements: "عناصر الراتب",
    custody: "عهد الموظفين",
    production_bonuses: "حوافز الإنتاج",
    award_penalties: "إدارة الجزاءات",
    clearance: "إخلاء الطرف والتقارير",
    evaluations: "تقييم الموظفين",
    leaves: "إدارة الإجازات",
    leave_settings: "لائحة الإجازات",
    hr_settings: "إعدادات الموارد البشرية",
    comprehensive_report: "التقرير الشامل",
    branches: "إدارة الفروع",
    departments: "إدارة الأقسام",
    shifts: "إدارة الورديات",
    penalties: "لائحة الجزاءات",
  };

  useEffect(() => {
    if (initialTab) {
      if (initialTab === "clearance_records") {
        setActiveTab("clearance");
      } else if (initialTab === "hr_detailed_report" || initialTab === "detailed_report") {
        setActiveTab("detailed_report");
      } else if (initialTab === "employee_basic_info") {
        setActiveTab("employees");
        setEmployeeActiveStep(2);
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<HRDepartment[]>([]);
  const [shifts, setShifts] = useState<HRShift[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [penalties, setPenalties] = useState<HRPenalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMultiSearchModal, setShowMultiSearchModal] = useState(false);
  const [multiSearchInput, setMultiSearchInput] = useState("");

  const getSearchTerms = (query: string, type: string) => {
    if (!query) return [];
    // Split by commas, semicolons, newlines, pluses
    let terms = query.split(/[,;\n+]+/).map((t) => t.trim()).filter(Boolean);
    
    // For codes or all-comprehensive search, we can also split single terms by spaces if they look like multiple separate numbers/codes
    if (type === "code" || type === "all") {
      const finalTerms: string[] = [];
      terms.forEach((term) => {
        if (term.includes(" ")) {
          const spaceParts = term.split(/\s+/).map((p) => p.trim()).filter(Boolean);
          // If every part consists entirely of digits or short alphanumeric tokens (less than 6 chars), let's treat them as individual codes
          const isMostlyCodes = spaceParts.every((p) => /^\d+$/.test(p) || p.length <= 6);
          if (isMostlyCodes || type === "code") {
            finalTerms.push(...spaceParts);
          } else {
            finalTerms.push(term);
          }
        } else {
          finalTerms.push(term);
        }
      });
      return finalTerms;
    }
    return terms;
  };

  // Send Message Modal State
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  const [preselectedMsgEmpId, setPreselectedMsgEmpId] = useState<number | null>(null);

  useEffect(() => {
    const handleVoiceSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSearchQuery(customEvent.detail);
      }
    };
    window.addEventListener("voice_search", handleVoiceSearch);
    const handleAiAction = (e: Event) => {
      const ce = e as CustomEvent;
      const { actionType, payload } = ce.detail;
      
      if (actionType === "ADD_EMPLOYEE") {
        setEditingEmployee({
          id: 0,
          name: payload.name || "",
          job_title: payload.job_title || "",
          basic_salary: payload.basic_salary ? Number(payload.basic_salary) : 0,
          phone: payload.phone || "",
          department_id: departments[0]?.id || 1,
          branch_id: branches[0]?.id || 1,
          salary_type: "monthly",
          work_days: 30,
          has_insurance: false,
          has_meal_allowance: false,
          fingerprint_code: "",
          national_id: "",
          address: "",
          qualification: ""
        });
      }
    };
    window.addEventListener("ai_action", handleAiAction);

    
    return () => {
      window.removeEventListener("voice_search", handleVoiceSearch);
      window.removeEventListener("ai_action", handleAiAction);
    };

  }, []);

  const [searchType, setSearchType] = useState<"all" | "name" | "code" | "department">("all");
  const [filterDepartmentId, setFilterDepartmentId] = useState<number | "">("");
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterRoleLevel, setFilterRoleLevel] = useState<"" | "head" | "supervisor" | "regular">("");

  // Steps & Navigation for Employee Section
  const [employeeActiveStep, setEmployeeActiveStep] = useState<number>(1);

  // Pagination for the employees list - 50 per page by default, adjustable
  const EMPLOYEE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
  const [employeePageSize, setEmployeePageSize] = useState(50);
  const [employeeCurrentPage, setEmployeeCurrentPage] = useState(1);

  // Modals
  const [passwordModalEmp, setPasswordModalEmp] = useState<Employee | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [validationModal, setValidationModal] = useState<{ title: string; messages: string[] } | null>(null);

  // Biometric Access Control States
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [biometricTargetEmp, setBiometricTargetEmp] = useState<Employee | null>(null);
  const [biometricAction, setBiometricAction] = useState<"disable" | "enable">("disable");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricResult, setBiometricResult] = useState<{
    success: boolean;
    message: string;
    deviceResults?: any[];
  } | null>(null);

  const [biometricAuditModalOpen, setBiometricAuditModalOpen] = useState(false);
  const [biometricAuditLogs, setBiometricAuditLogs] = useState<any[]>([]);
  const [biometricAuditLoading, setBiometricAuditLoading] = useState(false);

  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(null);

  const handleOpenBiometricModal = (emp: Employee, action: "disable" | "enable") => {
    setBiometricTargetEmp(emp);
    setBiometricAction(action);
    setBiometricResult(null);
    setBiometricModalOpen(true);
  };

  const handleExecuteBiometricAction = async () => {
    if (!biometricTargetEmp) return;
    setBiometricLoading(true);
    setBiometricResult(null);
    try {
      const res = await api.post(`/api/hr/employees/${biometricTargetEmp.id}/fingerprint-access`, {
        action: biometricAction
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBiometricResult({
          success: true,
          message: data.message || `تم ${biometricAction === 'disable' ? 'تعطيل' : 'تفعيل'} البصمة بنجاح على أجهزة البصمة.`,
          deviceResults: data.deviceResults || []
        });
        fetchData();
      } else {
        setBiometricResult({
          success: false,
          message: data.error || "فشلت عملية البصمة على أجهزة البصمة.",
          deviceResults: data.deviceResults || []
        });
      }
    } catch (err: any) {
      setBiometricResult({
        success: false,
        message: "حدث خطأ أثناء الاتصال بالسيرفر أو أجهزة البصمة: " + (err?.message || String(err))
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleApplyBulkActions = async () => {
    if (selectedEmployeeIds.length === 0) {
      alert("الرجاء اختيار موظف واحد على الأقل من القائمة لتطبيق الإجراءات");
      return;
    }

    const hasAnyAction = 
      bulkActionConfig.fingerprint !== "no_change" ||
      (Number(bulkActionConfig.penalty.amount) > 0 && bulkActionConfig.penalty.reason.trim() !== "") ||
      (Number(bulkActionConfig.bonus.amount) > 0 && bulkActionConfig.bonus.title.trim() !== "") ||
      bulkActionConfig.hr_summons.active;

    if (!hasAnyAction) {
      alert("يرجى تفعيل أو تحديد إجراء جماعي واحد على الأقل وتعبئة بياناته (مثل كتابة سبب الخصم أو عنوان المكافأة) لتطبيقه");
      return;
    }

    setBulkActionLoading(true);
    try {
      const actionsObj: any = {};
      if (bulkActionConfig.fingerprint === "active") {
        actionsObj.enable_fingerprint = true;
      } else if (bulkActionConfig.fingerprint === "suspended") {
        actionsObj.disable_fingerprint = true;
      }

      if (Number(bulkActionConfig.penalty.amount) > 0) {
        actionsObj.penalty = {
          amount: Number(bulkActionConfig.penalty.amount),
          reason: bulkActionConfig.penalty.reason || "جزاء مالي إداري جماعي",
          type: "penalty"
        };
      }

      if (Number(bulkActionConfig.bonus.amount) > 0) {
        actionsObj.bonus = {
          amount: Number(bulkActionConfig.bonus.amount),
          title: bulkActionConfig.bonus.title || "مكافأة جماعية إدارية"
        };
      }

      if (bulkActionConfig.hr_summons.active) {
        actionsObj.hr_summons = {
          title: bulkActionConfig.hr_summons.title || "🚨 إخطار استدعاء عاجل من الموارد البشرية (HR)",
          message: bulkActionConfig.hr_summons.message || "يرجى الحضور فوراً إلى مكتب إدارة الموارد البشرية لمراجعة الإدارة."
        };
      }

      const res = await api.post("/api/hr/employees/bulk-actions", {
        employee_ids: selectedEmployeeIds,
        actions: actionsObj
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "تم تطبيق جميع الإجراءات الجماعية وتسميعها بنجاح على الموظفين المحددين!");
        setSelectedEmployeeIds([]);
        setBulkActionConfig({
          fingerprint: "no_change",
          penalty: { amount: "", reason: "" },
          bonus: { amount: "", title: "" },
          hr_summons: { active: false, title: "🚨 إخطار استدعاء عاجل من الموارد البشرية (HR)", message: "يرجى الحضور فوراً إلى مكتب إدارة الموارد البشرية لمراجعة الإدارة." }
        });
        fetchData();
      } else {
        alert("فشل تنفيذ الإجراءات الجماعية: " + (data.error || "خطأ غير معروف"));
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء تنفيذ الإجراءات الجماعية: " + (err.message || String(err)));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleOpenBiometricAuditLogs = async (employeeId?: number) => {
    setBiometricAuditModalOpen(true);
    setBiometricAuditLoading(true);
    try {
      const url = employeeId 
        ? `/api/fingerprint/audit-logs?employee_id=${employeeId}` 
        : `/api/fingerprint/audit-logs`;
      const res = await api.get(url);
      const data = await res.json();
      setBiometricAuditLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch biometric audit logs", err);
    } finally {
      setBiometricAuditLoading(false);
    }
  };

  // Form States
  const [docPreviewModalOpen, setDocPreviewModalOpen] = useState(false);
  const [previewDocData, setPreviewDocData] = useState<any>(null);

  const handleOpenDocPreview = (doc: any, fallbackTitle?: string, fallbackCat?: string) => {
    const empName = editingEmployee?.name || (documentsEmployee as any)?.name || 'الموظف المعتمد';
    const empCode = editingEmployee?.employee_code || editingEmployee?.code || (documentsEmployee as any)?.employee_code || 'EMP-101';
    const natId = editingEmployee?.national_id || (documentsEmployee as any)?.national_id || '-';
    const dep = (editingEmployee as any)?.department || (documentsEmployee as any)?.department || 'إدارة الموارد البشرية';
    const job = editingEmployee?.job_title || (documentsEmployee as any)?.job_title || 'موظف';
    
    setPreviewDocData({
      id: doc?.id || Date.now(),
      name: doc?.name || doc?.title || fallbackTitle || 'مستند رسمي',
      title: doc?.title || doc?.name || fallbackTitle || 'مستند رسمي',
      category: doc?.category || fallbackCat || 'مستند عام',
      fileName: doc?.fileName || doc?.document_type || `${fallbackTitle || 'document'}.pdf`,
      fileUrl: doc?.fileUrl || doc?.file_url || '',
      uploadDate: doc?.uploadDate || doc?.upload_date || new Date().toISOString().split('T')[0],
      expiryDate: doc?.expiryDate || doc?.expiry_date || 'غير محدد',
      size: doc?.size || '1.5 MB',
      status: doc?.status || (doc?.fileUrl || doc?.file_url ? 'مرفوع' : 'غير مرفوع'),
      employeeName: empName,
      employeeCode: empCode,
      nationalId: natId,
      department: dep,
      jobTitle: job,
      notes: doc?.notes || 'مستند رسمي معتمد وموثق في ملف الموظف'
    });
    setDocPreviewModalOpen(true);
  };
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({
    salary_type: "monthly",
    work_days: 30,
    has_insurance: false,
    has_meal_allowance: false,
    exempt_from_penalties: false,
    contract_type: "full_time",
    hire_date: new Date().toISOString().split("T")[0],
    annual_leave_balance: 21,
    sick_leave_balance: 14,
    casual_leave_balance: 6,
    shifts: [],
  });

  const [editingDept, setEditingDept] = useState<Partial<HRDepartment>>({});
  const [editingShift, setEditingShift] = useState<Partial<HRShift>>({});
  const [editingBranch, setEditingBranch] = useState<Partial<Branch>>({});
  const [editingPenalty, setEditingPenalty] = useState<Partial<HRPenalty>>({
    type: "amount",
    category: "manual",
    threshold_minutes: 0,
  });

  // New States for Penalties, Absence, Overtime, and On Call
  const [penaltiesFilterEmployee, setPenaltiesFilterEmployee] = useState<
    number | "all"
  >("all");
  const [penaltiesFilterFromDate, setPenaltiesFilterFromDate] =
    useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [penaltiesFilterToDate, setPenaltiesFilterToDate] =
    useState<string>(new Date().toISOString().split("T")[0]);
  const [penaltiesActiveTab, setPenaltiesActiveTab] = useState<
    "penalties" | "absence" | "overtime_detail" | "overtime_review" | "on_call"
  >("penalties");
  const [penaltiesSubTab, setPenaltiesSubTab] = useState<
    "applied" | "requests"
  >("applied");
  const [downloadedDeductions, setDownloadedDeductions] = useState<any[]>([]);
  const [penaltyTotals, setPenaltyTotals] = useState<any[]>([]);
  const [penaltyCalcExplanation, setPenaltyCalcExplanation] = useState("");
  const [showAwardPenaltyModal, setShowAwardPenaltyModal] =
    useState<boolean>(false);
  const [awardPenaltyData, setAwardPenaltyData] = useState<any>({
    employee_id: "",
    amount: "",
    type: "manual",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    penalty_rule_id: null,
  });
  // ─── "Calculate by hour" mode for the Award Penalty modal ───
  // When enabled, the amount input is interpreted as NUMBER OF HOURS to deduct
  // (not EGP). The actual EGP amount is computed from the employee's hourly rate:
  //   amount_egp = hours × (basic_salary / 26 / employee_shift_hours)
  // The system reads the employee's actual assigned shift hours (8 / 10 / 12 etc.)
  // so the deduction is prorated correctly per their shift.
  const [calcByHour, setCalcByHour] = useState<boolean>(false);
  // Cached hourly-rate info for the selected employee (so we can show the
  // explanation live without re-fetching on every keystroke).
  const [hourlyRateInfo, setHourlyRateInfo] = useState<any>(null);
  // Employee penalty history panel
  const [showPenaltyHistoryPanel, setShowPenaltyHistoryPanel] = useState(false);
  const [penaltyHistoryEmployee, setPenaltyHistoryEmployee] = useState<any>(null);
  const [employeePenaltyHistory, setEmployeePenaltyHistory] = useState<any[]>([]);
  const [employeePenaltySummary, setEmployeePenaltySummary] = useState<any>(null);
  const [penaltyHistoryLoading, setPenaltyHistoryLoading] = useState(false);
  // Employee penalty badges cache
  const [employeePenaltyBadges, setEmployeePenaltyBadges] = useState<Record<number, { count: number; amount: number }>>({});

  // Bulk Actions states
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false);
  const [bulkActionConfig, setBulkActionConfig] = useState({
    fingerprint: "no_change", // "no_change" | "active" | "suspended"
    penalty: { amount: "", reason: "" },
    bonus: { amount: "", title: "" },
    hr_summons: { active: false, title: "🚨 إخطار استدعاء عاجل من الموارد البشرية (HR)", message: "يرجى الحضور فوراً إلى مكتب إدارة الموارد البشرية لمراجعة الإدارة." }
  });

  // Persistent collections showing on other tabs
  const [absences, setAbsences] = useState<any[]>([]);
  const [overtimeDetails, setOvertimeDetails] = useState<any[]>([]);
  const [evaluationsList, setEvaluationsList] = useState<any[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [clearanceRecords, setClearanceRecords] = useState<any[]>([]);
  const [isHrDataLoading, setIsHrDataLoading] = useState(true);

  

  // Auto-calculate hour rate for hourly workers
  useEffect(() => {
    if (editingEmployee && (editingEmployee as any).works_hourly === "نعم") {
      const emp = editingEmployee as any;
      const basic = Number(emp.basic_salary || emp.salary || 0);
      const days = Number(emp.work_days_count || 26);
      if (basic > 0 && days > 0) {
        const rate = (basic / (days * 8)).toFixed(2);
        if (emp.new_hour_rate !== rate) {
          setEditingEmployee((prev: any) => ({ ...prev, new_hour_rate: rate }));
        }
      }
    }
  }, [(editingEmployee as any)?.works_hourly, (editingEmployee as any)?.basic_salary, (editingEmployee as any)?.salary, (editingEmployee as any)?.work_days_count]);

  // Load everything on mount
  useEffect(() => {
    const loadAll = async () => {
      const savedAbsences = await databaseStorage.getItem<any[]>("restomaster_absences", DEFAULT_ABSENCES);
      const savedOvertime = await databaseStorage.getItem<any[]>("restomaster_overtime", DEFAULT_OVERTIME);
      const savedEvaluations = await databaseStorage.getItem<any[]>("restomaster_employee_evaluations", []);
      const savedPolicies = await databaseStorage.getItem<any[]>("restomaster_leave_policies", DEFAULT_LEAVE_POLICIES);
      const savedLeaveReqs = await databaseStorage.getItem<any[]>("restomaster_leave_requests", []);
      const savedClearance = await databaseStorage.getItem<any[]>("restomaster_clearance_records", []);
      
      setAbsences(savedAbsences);
      setOvertimeDetails(savedOvertime);
      setEvaluationsList(savedEvaluations);
      setLeavePolicies(savedPolicies);
      setLeaveRequests(savedLeaveReqs);
      setClearanceRecords(savedClearance);
      setIsHrDataLoading(false);
    };
    loadAll();
  }, []);

  const [onCallList, setOnCallList] = useState<any[]>([
    {
      id: 1,
      employee_id: 2,
      employee_name: "محمد عبد الله",
      date: "2026-06-15",
      status: "مستعد للاستدعاء",
      location: "فرع السويس",
      duration: "24 ساعة",
    },
  ]);

  // Modals for absence & detailed overtime
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceData, setAbsenceData] = useState({
    employee_id: "",
    date: new Date().toISOString().split("T")[0],
    type: "غياب بدون إذن",
    status: "خصم يومين",
    amount: "150",
    notes: "",
  });

  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeData, setOvertimeData] = useState({
    employee_id: "",
    date: new Date().toISOString().split("T")[0],
    scheduled_hours: "8",
    actual_hours: "12",
    hourly_rate: "30",
    notes: "",
  });

  // Automatically save to database
  useEffect(() => {
    if (!isHrDataLoading) {
      databaseStorage.setItem("restomaster_absences", absences);
    }
  }, [absences, isHrDataLoading]);

  useEffect(() => {
    if (!isHrDataLoading) {
      databaseStorage.setItem("restomaster_overtime", overtimeDetails);
    }
  }, [overtimeDetails, isHrDataLoading]);

  useEffect(() => {
    if (!isHrDataLoading) {
      databaseStorage.setItem("restomaster_employee_evaluations", evaluationsList);
    }
  }, [evaluationsList, isHrDataLoading]);

  useEffect(() => {
    if (!isHrDataLoading) {
      databaseStorage.setItem("restomaster_leave_policies", leavePolicies);
    }
  }, [leavePolicies, isHrDataLoading]);

  useEffect(() => {
    if (!isHrDataLoading) {
      databaseStorage.setItem("restomaster_leave_requests", leaveRequests);
    }
  }, [leaveRequests, isHrDataLoading]);

  useEffect(() => {
    if (!isHrDataLoading) {
      databaseStorage.setItem("restomaster_clearance_records", clearanceRecords);
    }
  }, [clearanceRecords, isHrDataLoading]);

  // States for searchable employee autocompletes
  const [filterEmpSearch, setFilterEmpSearch] = useState("");
  const [filterEmpDropdownOpen, setFilterEmpDropdownOpen] = useState(false);

  // --- ERP New States ---
  // A. Employee Status Machine & Audit Trail
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusEmployee, setStatusEmployee] = useState<Employee | null>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("active");
  const [statusReason, setStatusReason] = useState<string>("");

  // B. Customizable Payroll Elements & Custom Item Types from Settings
  const [payrollElements, setPayrollElements] = useState<any[]>([]);
  const [customBonusesTypes, setCustomBonusesTypes] = useState<string[]>([]);
  const [customAdvancesTypes, setCustomAdvancesTypes] = useState<string[]>([]);
  const [customDeductionsTypes, setCustomDeductionsTypes] = useState<string[]>([]);
  const [showElementModal, setShowElementModal] = useState(false);
  const [editingElement, setEditingElement] = useState<any>({
    name: "",
    type: "addition",
    rule_type: "fixed",
    value: 0,
  });
  const [showEmployeeElementModal, setShowEmployeeElementModal] =
    useState(false);
  const [elementEmployee, setElementEmployee] = useState<Employee | null>(null);
  const [employeeElementStates, setEmployeeElementStates] = useState<any[]>([]);

  // C. Custody & Asset Management
  const [custodyList, setCustodyList] = useState<any[]>([]);
  const [custodySubTab, setCustodySubTab] = useState<"employees" | "store">(
    "employees",
  );
  const [custodyStoreList, setCustodyStoreList] = useState<any[]>([]);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeForm, setStoreForm] = useState<any>({
    id: null,
    asset_name: "",
    serial_number: "",
    quantity: 1,
    replacement_cost: 0,
    notes: "",
  });
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [custodyForm, setCustodyForm] = useState<any>({
    employee_id: "",
    custody_store_item_id: "",
    asset_name: "",
    serial_number: "",
    received_date: new Date().toISOString().split("T")[0],
    notes: "",
    replacement_cost: 0,
  });
  const [custodyEmpSearch, setCustodyEmpSearch] = useState<string>("");
  const [showCustodyEmpDropdown, setShowCustodyEmpDropdown] =
    useState<boolean>(false);

  // D. Production Bonuses (Factory KPI Output)
  const [productionBonuses, setProductionBonuses] = useState<any[]>([]);
  const [showProdBonusModal, setShowProdBonusModal] = useState(false);
  const [prodBonusForm, setProdBonusForm] = useState<any>({
    employee_id: "",
    product_name: "",
    units_produced: "",
    rate_per_unit: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [prodBonusEmpSearch, setProdBonusEmpSearch] = useState<string>("");
  const [showProdBonusEmpDropdown, setShowProdBonusEmpDropdown] =
    useState<boolean>(false);
  // --- End ERP New States ---

  const [awardEmpSearch, setAwardEmpSearch] = useState("");
  const [showAwardEmpDropdown, setShowAwardEmpDropdown] = useState(false);

  const [absenceEmpSearch, setAbsenceEmpSearch] = useState("");
  const [showAbsenceEmpDropdown, setShowAbsenceEmpDropdown] = useState(false);

  // Employee Import from Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  // Employee Documents & Files
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [documentsEmployee, setDocumentsEmployee] = useState<Employee | null>(null);
  const [employeeDocuments, setEmployeeDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [docForm, setDocForm] = useState<any>({
    document_type: "بطاقة شخصية",
    document_number: "",
    issue_date: "",
    expiry_date: "",
    notes: "",
  });

  // HR Settings (loaded from server, affects all module behavior)
  const [hrSettings, setHrSettings] = useState<any>({
    annual_leave_days: 21,
    sick_leave_days: 14,
    casual_leave_days: 6,
    probation_days: 90,
    contract_expiry_alert_days: 30,
    retirement_age: 60,
    default_work_days: 30,
    default_daily_hours: 8,
    overtime_multiplier: 1.5,
    late_grace_minutes: 15,
    allow_half_day_leave: true,
  });
  const [hrSettingsLoading, setHrSettingsLoading] = useState(false);
  const [hrSettingsSaving, setHrSettingsSaving] = useState(false);

  const fetchHRSettings = async () => {
    setHrSettingsLoading(true);
    try {
      const res = await api.get("/api/hr/settings");
      if (res.ok) {
        const data = await res.json();
        // BUGFIX 2026-08-25 — The backend GET /api/hr/settings returns a FLAT
        // object { key: value, ... } merged with defaults. The old code only
        // handled an array-of-rows shape, so the response was silently ignored
        // and the form always showed the hardcoded defaults — making the user
        // think their saved settings "disappeared". Handle BOTH shapes now.
        const map: any = {};
        if (Array.isArray(data)) {
          data.forEach((s: any) => {
            if (!s?.key) return;
            let v: any = s.value;
            if (v === "true") v = true;
            else if (v === "false") v = false;
            else if (typeof v === "string" && v !== "" && !isNaN(Number(v))) v = Number(v);
            map[s.key] = v;
          });
        } else if (data && typeof data === "object") {
          Object.entries(data).forEach(([k, v]) => {
            let val: any = v;
            if (val === "true") val = true;
            else if (val === "false") val = false;
            else if (typeof val === "string" && val !== "" && !isNaN(Number(val))) val = Number(val);
            map[k] = val;
          });
        }
        if (Object.keys(map).length > 0) {
          setHrSettings((prev: any) => ({ ...prev, ...map }));
        }
      }
    } catch { /* use defaults */ }
    setHrSettingsLoading(false);
  };

  const handleSaveHRSettings = async () => {
    setHrSettingsSaving(true);
    try {
      // BUGFIX 2026-08-25 — The backend POST /api/hr/settings expects the
      // WHOLE settings object at once: { key1: v1, key2: v2, ... } and
      // upserts each entry via Object.entries(req.body). The old code sent
      // one { key, value } pair per request, which the backend misread as
      // two literal rows named "key" and "value" — nothing was ever saved.
      // Send the full object in a single request now.
      const res = await api.post("/api/hr/settings", hrSettings);
      if (!res.ok) throw new Error("save failed");
      // Re-fetch immediately so the UI reflects exactly what the server stored.
      await fetchHRSettings();
      alert("تم حفظ إعدادات الموارد البشرية بنجاح");
    } catch {
      alert("فشل في حفظ الإعدادات");
    }
    setHrSettingsSaving(false);
  };

  const [overtimeEmpSearch, setOvertimeEmpSearch] = useState("");
  const [showOvertimeEmpDropdown, setShowOvertimeEmpDropdown] = useState(false);

  // Clearance states
  const [clearanceTab, setClearanceTab] = useState<"new" | "records">("new");
  const [clearanceEmployeeId, setClearanceEmployeeId] = useState<string>("");
  const [clearanceEmpSearch, setClearanceEmpSearch] = useState<string>("");
  const [showClearanceEmpDropdown, setShowClearanceEmpDropdown] =
    useState<boolean>(false);
  const [clearanceDate, setClearanceDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [clearanceReason, setClearanceReason] = useState<string>("استقالة");
  const [clearanceFinancialStatus, setClearanceFinancialStatus] =
    useState<string>("تم تسوية المستحقات بالكامل");
  const [clearanceHandoverStatus, setClearanceHandoverStatus] =
    useState<string>("تم تسليم العهدة بالكامل");
  const [clearanceNotes, setClearanceNotes] = useState<string>("");

  // Clearance Report Filter States
  const [reportSearchText, setReportSearchText] = useState<string>("");
  const [reportFromDate, setReportFromDate] = useState<string>("2026-06-01");
  const [reportToDate, setReportToDate] = useState<string>("2026-06-18");
  const [reportDeptId, setReportDeptId] = useState<string>("all");
  const [reportBranchId, setReportBranchId] = useState<string>("all");

  // Evaluations States
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluationForm, setEvaluationForm] = useState<any>({
    employee_id: "",
    rating: 5,
    metrics: { efficiency: 5, behavior: 5, attendance: 5, quality: 5 },
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [evaluationEmpSearch, setEvaluationEmpSearch] = useState("");
  const [showEvaluationEmpDropdown, setShowEvaluationEmpDropdown] =
    useState(false);

  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState<any>({
    employee_id: "",
    policy_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [leaveEmpSearch, setLeaveEmpSearch] = useState("");
  const [showLeaveEmpDropdown, setShowLeaveEmpDropdown] = useState(false);

  const [showLeavePolicyModal, setShowLeavePolicyModal] = useState(false);
  const [leavePolicyForm, setLeavePolicyForm] = useState<any>({
    id: 0,
    name: "",
    allowed_days: 0,
    impact: "paid", // paid, unpaid, partial
    partial_percentage: 0,
    deduct_from_balance: true,
  });

  // Synchronize clearance_records to show records list sub-tab
  useEffect(() => {
    if (initialTab === "clearance_records") {
      setClearanceTab("records");
    }
  }, [initialTab]);

  // Synchronize clearance employee search input
  useEffect(() => {
    const emp = employees.find((e) => e.id === Number(clearanceEmployeeId));
    if (emp) {
      setClearanceEmpSearch(
        `${emp.name} (كود: ${emp.fingerprint_code || emp.id})`,
      );
    } else if (!clearanceEmployeeId) {
      setClearanceEmpSearch("");
    }
  }, [clearanceEmployeeId, employees]);

  // Synchronize top filter search text
  useEffect(() => {
    if (penaltiesFilterEmployee === "all") {
      setFilterEmpSearch("كل الموظفين");
    } else {
      const emp = employees.find(
        (e) => e.id === Number(penaltiesFilterEmployee),
      );
      if (emp) {
        setFilterEmpSearch(
          `${emp.name} (كود: ${emp.fingerprint_code || emp.id})`,
        );
      }
    }
  }, [penaltiesFilterEmployee, employees]);

  // Synchronize award penalty modal employee search input
  useEffect(() => {
    if (showAwardPenaltyModal) {
      const emp = employees.find(
        (e) => e.id === Number(awardPenaltyData.employee_id),
      );
      if (emp) {
        setAwardEmpSearch(
          `${emp.name} (كود: ${emp.fingerprint_code || emp.id})`,
        );
      } else {
        setAwardEmpSearch("");
      }
    } else {
      setAwardEmpSearch("");
      setShowAwardEmpDropdown(false);
    }
  }, [showAwardPenaltyModal, awardPenaltyData.employee_id, employees]);

  // ─── Fetch the selected employee's hourly rate info whenever calcByHour is ON
  // and an employee is selected. The result is cached in hourlyRateInfo so the
  // modal can display a live explanation as the admin types the number of hours
  // without re-calling the API on every keystroke.
  useEffect(() => {
    if (!showAwardPenaltyModal || !calcByHour || !awardPenaltyData.employee_id) {
      setHourlyRateInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // We send hours=0 just to bootstrap — the API still returns the
        // employee's hourly_rate, shift_hours, day_rate, basic_salary so we
        // can compute live in the modal.
        const res = await api.post("/api/hr/penalties/calculate", {
          employee_id: Number(awardPenaltyData.employee_id),
          hours: 0,
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setHourlyRateInfo(data);
        }
      } catch (_e) {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAwardPenaltyModal, calcByHour, awardPenaltyData.employee_id]);

  // Synchronize absence modal employee search input
  useEffect(() => {
    if (showAbsenceModal) {
      const emp = employees.find(
        (e) => e.id === Number(absenceData.employee_id),
      );
      if (emp) {
        setAbsenceEmpSearch(
          `${emp.name} (كود: ${emp.fingerprint_code || emp.id})`,
        );
      } else {
        setAbsenceEmpSearch("");
      }
    } else {
      setAbsenceEmpSearch("");
      setShowAbsenceEmpDropdown(false);
    }
  }, [showAbsenceModal, absenceData.employee_id, employees]);

  // Synchronize overtime modal employee search input
  useEffect(() => {
    if (showOvertimeModal) {
      const emp = employees.find(
        (e) => e.id === Number(overtimeData.employee_id),
      );
      if (emp) {
        setOvertimeEmpSearch(
          `${emp.name} (كود: ${emp.fingerprint_code || emp.id})`,
        );
      } else {
        setOvertimeEmpSearch("");
      }
    } else {
      setOvertimeEmpSearch("");
      setShowOvertimeEmpDropdown(false);
    }
  }, [showOvertimeModal, overtimeData.employee_id, employees]);

  // Reactivate a terminated employee - restores status to 'active' and records the reactivation
  const handleReactivateEmployee = async (emp: Employee) => {
    if (!confirm(`هل أنت متأكد من إعادة تفعيل الموظف ${emp.name}؟ سيتم تغيير حالة الموظف إلى "نشط" وتسجيل عملية إعادة التفعيل.`)) {
      return;
    }
    try {
      const res = await api.post(`/api/hr/employees/${emp.id}/reactivate`, {
        date: new Date().toISOString().split("T")[0],
        reason: "إعادة تفعيل الموظف",
        notes: "تمت إعادة تفعيل الموظف للعمل",
      });
      if (res.ok) {
        await fetchData();
        alert("تمت إعادة تفعيل الموظف بنجاح. الموظف الآن نشط ويمكنه العمل.");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || data.detail || "فشل إعادة تفعيل الموظف");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إعادة تفعيل الموظف");
    }
  };

  // Handlers for creating clearance, absence & overtime
  const handleCreateClearance = async (e: React.FormEvent, settleCustody = false) => {
    e.preventDefault();
    if (!clearanceEmployeeId) {
      alert("يرجى اختيار الموظف أولاً");
      return;
    }
    const emp = employees.find((ent) => ent.id === Number(clearanceEmployeeId));
    if (!emp) {
      alert("الموظف غير موجود");
      return;
    }

    if (
      !confirm(
        `هل أنت متأكد من إخلاء طرف الموظف ${emp.name}؟ سيتم تغيير حالة الموظف إلى "منتهي الخدمة" وتسجيل العملية. يمكنك إعادة تفعيل الموظف لاحقاً من شاشة الموظفين.`,
      )
    ) {
      return;
    }

    try {
      // Use the soft-delete clearance endpoint - sets status='terminated' and records in DB
      // Employee data is PRESERVED for reactivation
      // settle_custody: if true, auto-settle all active custody items
      const res = await api.post(`/api/hr/employees/${emp.id}/clearance`, {
        date: clearanceDate,
        reason: clearanceReason,
        financial_status: clearanceFinancialStatus,
        handover_status: clearanceHandoverStatus,
        notes: clearanceNotes || "عملية إخلاء طرف لموظف",
        settle_custody: settleCustody,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // Reset form state
        setClearanceEmployeeId("");
        setClearanceEmpSearch("");
        setClearanceNotes("");
        setClearanceReason("استقالة");
        setClearanceFinancialStatus("تم تسوية المستحقات بالكامل");
        setClearanceHandoverStatus("تم تسليم العهدة بالكامل");

        // Refresh employee list
        await fetchData();

        alert(data.message || "تم إخلاء طرف الموظف بنجاح. يمكنك إعادة تفعيل الموظف لاحقاً من شاشة الموظفين.");
      } else {
        const data = await res.json().catch(() => ({}));
        // Check if the error is about active custody items
        if (data.has_active_custody && data.custody_items) {
          const custodyList = data.custody_items as any[];
          let custodyDetails = custodyList.map((c: any, i: number) =>
            `${i + 1}. ${c.asset_name} (S/N: ${c.serial_number || "—"}) - قيمة التعويض: ${c.replacement_cost || 0} ج.م`
          ).join("\n");

          const shouldSettle = confirm(
            `⚠️ الموظف ${emp.name} لديه ${custodyList.length} عهدة نشطة:\n\n${custodyDetails}\n\n` +
            `يجب تصفية العهدة قبل إخلاء الطرف.\n\n` +
            `هل تريد تصفية جميع العهدة تلقائياً (تسجيلها كـ "مُستردة")؟\n` +
            `• اضغط "موافق" للتصفية التلقائية ثم إخلاء الطرف\n` +
            `• اضغط "إلغاء" للرجوع وتصفية العهدة يدوياً من شاشة العهد`
          );

          if (shouldSettle) {
            // Retry with settle_custody=true
            return handleCreateClearance(e, true);
          }
          return;
        }
        alert(data.error || data.detail || data.message || "فشل إخلاء طرف الموظف، يرجى المحاولة لاحقاً.");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إجراء إخلاء الطرف");
    }
  };

  const handleSaveEvaluationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluationForm.employee_id) {
      alert("الرجاء اختيار الموظف");
      return;
    }
    const emp = employees.find(
      (e) => e.id === Number(evaluationForm.employee_id),
    );
    if (!emp) return;

    // Calculate average rating
    const metrics = evaluationForm.metrics;
    const avg =
      (metrics.efficiency +
        metrics.behavior +
        metrics.attendance +
        metrics.quality) /
      4;

    const newEval = {
      id: Date.now(),
      employee_id: emp.id,
      employee_name: emp.name,
      employee_code: emp.fingerprint_code,
      department_name: emp.department_name,
      metrics: { ...metrics },
      rating: avg,
      notes: evaluationForm.notes,
      date: evaluationForm.date,
    };

    setEvaluationsList((prev) => [newEval, ...prev]);

    // Reset
    setEvaluationForm({
      employee_id: "",
      rating: 5,
      metrics: { efficiency: 5, behavior: 5, attendance: 5, quality: 5 },
      notes: "",
      date: new Date().toISOString().split("T")[0],
    });
    setEvaluationEmpSearch("");
    setShowEvaluationModal(false);
  };

  const handleLeavePolicySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (leavePolicyForm.id) {
      setLeavePolicies((prev) =>
        prev.map((p) =>
          p.id === leavePolicyForm.id ? { ...leavePolicyForm } : p,
        ),
      );
    } else {
      setLeavePolicies((prev) => [
        ...prev,
        { ...leavePolicyForm, id: Date.now() },
      ]);
    }
    setShowLeavePolicyModal(false);
  };

  const handleLeaveRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.employee_id || !leaveForm.policy_id) return;

    const emp = employees.find((e) => e.id === Number(leaveForm.employee_id));
    const policy = leavePolicies.find(
      (p) => p.id === Number(leaveForm.policy_id),
    );

    if (!emp || !policy) return;

    const start = new Date(leaveForm.start_date);
    const end = new Date(leaveForm.end_date);
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Optional: check balance if it's deducted
    if (policy.deduct_from_balance) {
      // In a real system, you would calculate total consumed days over the year.
      // Here, just a basic warning:
      let usedDays = 0;
      leaveRequests.forEach((req) => {
        if (
          req.employee_id === emp.id &&
          req.policy_id === policy.id &&
          req.status === "approved"
        ) {
          usedDays += req.days;
        }
      });
      if (usedDays + days > policy.allowed_days) {
        if (
          !window.confirm(
            `تحذير: لقد تجاوز الموظف رصيد الإجازات المسموح (${policy.allowed_days} يوم). المتبقي: ${Math.max(0, policy.allowed_days - usedDays)} يوم. هل تريد المتابعة على أية حال؟`,
          )
        ) {
          return;
        }
      }
    }

    setLeaveRequests((prev) => [
      {
        id: Date.now(),
        employee_id: emp.id,
        employee_name: emp.name,
        employee_code: emp.fingerprint_code,
        department_name: emp.department_name,
        policy_id: policy.id,
        policy_name: policy.name,
        impact: policy.impact,
        partial_percentage: policy.partial_percentage,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days,
        notes: leaveForm.notes,
        request_date: new Date().toISOString().split("T")[0],
        status: "pending",
      },
      ...prev,
    ]);

    setShowLeaveRequestModal(false);
    setLeaveForm({
      employee_id: "",
      policy_id: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setLeaveEmpSearch("");
  };

  const handleUpdateLeaveStatus = (
    requestId: number,
    newStatus: "approved" | "rejected",
  ) => {
    setLeaveRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, status: newStatus } : req,
      ),
    );
  };

  const handleDeleteLeaveRequest = (requestId: number) => {
    if (window.confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
      setLeaveRequests((prev) => prev.filter((req) => req.id !== requestId));
    }
  };

  const handleCreateAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceData.employee_id) {
      alert("الرجاء اختيار الموظف");
      return;
    }
    const emp = employees.find(
      (empItem) => empItem.id === Number(absenceData.employee_id),
    );
    if (!emp) return;

    try {
      const statusText = absenceData.status || "";
      const isLeaveDeduction = statusText.includes("رصيد") || statusText.includes("سنوية") || statusText.includes("عارضة") || statusText.includes("مرضية");

      if (isLeaveDeduction) {
        let leave_type = "annual";
        if (statusText.includes("مرضية")) leave_type = "sick";
        if (statusText.includes("عارضة")) leave_type = "casual";

        const deductRes = await api.post(`/api/hr/employees/${absenceData.employee_id}/deduct-leave`, {
          leave_type,
          days: 1,
          reason: `خصم غياب (${absenceData.type})`,
          notes: absenceData.notes || `خصم غياب مباشر من ${statusText}`
        });

        if (!deductRes.ok) {
          const errData = await deductRes.json();
          throw new Error(errData.error || "فشل خصم اليوم من رصيد الإجازات");
        }
      } else {
        const amt = Number(absenceData.amount);
        if (amt > 0) {
          const dRes = await api.post("/api/payroll/deductions", {
            employee_id: Number(absenceData.employee_id),
            amount: amt,
            type: "absence",
            date: absenceData.date,
            notes:
              `${absenceData.type} (${absenceData.status}) - ${absenceData.notes || "غياب موظف"}`.trim(),
            userId: user?.id,
          });
          if (!dRes.ok) {
            const detail = await dRes.json();
            throw new Error(
              detail.error || "فشل تسجيل الخصم المالي في قاعدة البيانات",
            );
          }
        }
      }

      const newAbs = {
        id: Date.now(),
        employee_id: emp.id,
        employee_name: emp.name,
        date: absenceData.date,
        type: absenceData.type,
        status: absenceData.status,
        amount: isLeaveDeduction ? 0 : Number(absenceData.amount),
        notes: absenceData.notes || "غياب موظف",
      };

      setAbsences((prev) => [...prev, newAbs]);
      alert(
        isLeaveDeduction
          ? "تم خصم يوم الغياب بنجاح من رصيد إجازات الموظف وتحديث التقرير وتنبيه الموظف على التطبيق!"
          : "تم تسجيل غياب الموظف بنجاح وتسميع خصم الغياب في الجزاءات/المرتبات!"
      );
      setShowAbsenceModal(false);
      setAbsenceData({
        employee_id: "",
        date: new Date().toISOString().split("T")[0],
        type: "غياب بدون إذن",
        status: "خصم يومين",
        amount: "150",
        notes: "",
      });
      if (isLeaveDeduction) {
        setEmployees((prev) =>
          prev.map((eItem) => {
            if (eItem.id === emp.id) {
              if (statusText.includes("مرضية")) {
                const cur = Number(eItem.sick_leave_balance ?? 14);
                return { ...eItem, sick_leave_balance: Math.max(0, cur - 1) };
              } else if (statusText.includes("عارضة")) {
                const cur = Number(eItem.casual_leave_balance ?? 6);
                return { ...eItem, casual_leave_balance: Math.max(0, cur - 1) };
              } else {
                const cur = Number(eItem.annual_leave_balance ?? 21);
                return { ...eItem, annual_leave_balance: Math.max(0, cur - 1) };
              }
            }
            return eItem;
          })
        );
      }
      fetchDeductions();
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ الغياب: " + err.message);
    }
  };

  const handleCreateOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeData.employee_id) {
      alert("الرجاء اختيار الموظف");
      return;
    }
    const emp = employees.find(
      (empItem) => empItem.id === Number(overtimeData.employee_id),
    );
    if (!emp) return;

    const sched = parseFloat(overtimeData.scheduled_hours) || 0;
    const act = parseFloat(overtimeData.actual_hours) || 0;
    const rate = parseFloat(overtimeData.hourly_rate) || 0;
    const otHours = Math.max(act - sched, 0);
    const bonusAmt = Math.round(otHours * rate);

    try {
      if (bonusAmt > 0) {
        const bRes = await api.post("/api/payroll/bonuses", {
          employee_id: Number(overtimeData.employee_id),
          amount: bonusAmt,
          type: "overtime",
          date: overtimeData.date,
          notes:
            `إضافي تفصيلي: ${otHours} ساعة (سعر الساعة: ${rate} ج.م) - ${overtimeData.notes || "ساعات عمل إضافية"}`.trim(),
          userId: user?.id,
        });
        if (!bRes.ok) {
          const detail = await bRes.json();
          throw new Error(
            detail.error || "فشل تسجيل المكافأة المالية في قاعدة البيانات",
          );
        }
      }

      const newOT = {
        id: Date.now(),
        employee_id: emp.id,
        employee_name: emp.name,
        date: overtimeData.date,
        scheduled_hours: `${sched} ساعات`,
        actual_hours: `${act} ساعات`,
        overtime_hours: `${otHours} ساعات`,
        hourly_rate: `${rate} ج.م`,
        total_bonus: `${bonusAmt} ج.م`,
        approved: true,
        notes: overtimeData.notes,
      };

      setOvertimeDetails((prev) => [...prev, newOT]);
      alert(
        "تم تسجيل الساعات الإضافية للموظف واعتمادها وتسميع المكافأة التفصيلية في قسم المرتبات بنجاح!",
      );
      setShowOvertimeModal(false);
      setOvertimeData({
        employee_id: "",
        date: new Date().toISOString().split("T")[0],
        scheduled_hours: "8",
        actual_hours: "12",
        hourly_rate: "30",
        notes: "",
      });
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ الإضافي: " + err.message);
    }
  };

  const fetchDeductions = async () => {
    try {
      // BUGFIX 2026-08-24 — previously this only fetched one month worth of
      // penalties (the month of penaltiesFilterFromDate). When the admin
      // searched an employee with a date range crossing two months (e.g.
      // 2026-07-15 → 2026-08-24), only July's penalties appeared in the
      // sheet. Now we send from_date / to_date so the backend returns the
      // full date range, and an employee's complete penalty history in the
      // selected range shows up in the sheet below.
      let url = `/api/payroll/deductions?`;
      const qp: string[] = [];
      // Always send the full date range — backend falls back to year+month
      // only when neither from_date nor to_date is present.
      if (penaltiesFilterFromDate) qp.push(`from_date=${encodeURIComponent(penaltiesFilterFromDate)}`);
      if (penaltiesFilterToDate) qp.push(`to_date=${encodeURIComponent(penaltiesFilterToDate)}`);
      if (penaltiesFilterEmployee && penaltiesFilterEmployee !== "all") {
        qp.push(`employee_id=${penaltiesFilterEmployee}`);
      }
      // Free-text employee search: when the user types a name instead of
      // picking from the dropdown, send it so the backend can match by
      // name OR fingerprint code.
      const freeText = (filterEmpSearch || "").trim();
      if (
        freeText &&
        freeText !== "كل الموظفين" &&
        !freeText.startsWith("كل الموظفين") &&
        // Don't send the "(كود: 123)" hint the dropdown sets — extract name only
        !penaltiesFilterEmployee
      ) {
        // Strip any "(كود: …)" suffix the dropdown injects so the backend
        // gets a clean name fragment to ILIKE on.
        const cleanName = freeText.replace(/\s*\(كود:.*\)\s*$/i, "").trim();
        if (cleanName) qp.push(`employee_name=${encodeURIComponent(cleanName)}`);
      }
      url += qp.join("&");

      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        // Support both old format (array) and new format ({deductions, totals})
        if (Array.isArray(data)) {
          setDownloadedDeductions(data);
          setPenaltyTotals([]);
        } else {
          setDownloadedDeductions(data.deductions || []);
          setPenaltyTotals(data.totals || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch deductions", err);
    }
  };

  // Fetch penalty history for a specific employee
  const fetchEmployeePenaltyHistory = async (empId: number, empData: any) => {
    setPenaltyHistoryEmployee(empData);
    setShowPenaltyHistoryPanel(true);
    setPenaltyHistoryLoading(true);
    try {
      const res = await api.get(`/api/employees/${empId}/penalties?status=all&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setEmployeePenaltyHistory(data.penalties || []);
        setEmployeePenaltySummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch employee penalty history", err);
    } finally {
      setPenaltyHistoryLoading(false);
    }
  };

  // Cancel a specific employee penalty
  const handleCancelEmployeePenalty = async (penaltyId: number) => {
    const reason = window.prompt("سبب إلغاء الجزاء (اختياري):");
    if (reason === null) return; // user cancelled the prompt
    try {
      const res = await api.put(`/api/employee-penalties/${penaltyId}/cancel`, {
        userId: user?.id,
        reason: reason || "تم الإلغاء",
      });
      if (res.ok) {
        if (penaltyHistoryEmployee) {
          fetchEmployeePenaltyHistory(penaltyHistoryEmployee.id, penaltyHistoryEmployee);
        }
        await fetchDeductions();
        await loadEmployeePenaltyBadges();
      }
    } catch (err) {
      console.error("Failed to cancel penalty", err);
    }
  };

  // Load penalty summary badges for all employees
  const loadEmployeePenaltyBadges = async () => {
    try {
      const res = await api.get("/api/employee-penalties?status=active&per_page=1000");
      if (res.ok) {
        const data = await res.json();
        const badges: Record<number, { count: number; amount: number }> = {};
        (data.penalties || []).forEach((p: any) => {
          if (p.status === 'active') {
            if (!badges[p.employee_id]) badges[p.employee_id] = { count: 0, amount: 0 };
            badges[p.employee_id].count++;
            badges[p.employee_id].amount += Number(p.amount);
          }
        });
        setEmployeePenaltyBadges(badges);
      }
    } catch (err) {
      console.error("Failed to load employee penalty badges", err);
    }
  };

  const getFilteredDeductions = () => {
    if (!Array.isArray(downloadedDeductions)) return [];
    // Backend already applies employee_id, from_date, to_date and
    // employee_name filters when fetchDeductions() is called. The
    // client-side filter below only enforces the date + employee match
    // as a safety net (e.g. when the user changes dates without
    // re-clicking "بحث").
    return downloadedDeductions.filter((item) => {
      const matchEmp =
        penaltiesFilterEmployee === "all" ||
        !penaltiesFilterEmployee ||
        Number(item.employee_id) === Number(penaltiesFilterEmployee);
      const rowDate = item.date;
      const matchFrom =
        !penaltiesFilterFromDate || rowDate >= penaltiesFilterFromDate;
      const matchTo =
        !penaltiesFilterToDate || rowDate <= penaltiesFilterToDate;
      return matchEmp && matchFrom && matchTo;
    });
  };

  const getFilteredAbsences = () => {
    if (!Array.isArray(absences)) return [];
    return absences.filter((item) => {
      const matchEmp =
        penaltiesFilterEmployee === "all" ||
        Number(item.employee_id) === Number(penaltiesFilterEmployee);
      const rowDate = item.date;
      const matchFrom =
        !penaltiesFilterFromDate || rowDate >= penaltiesFilterFromDate;
      const matchTo =
        !penaltiesFilterToDate || rowDate <= penaltiesFilterToDate;
      return matchEmp && matchFrom && matchTo;
    });
  };

  const getFilteredOvertime = () => {
    if (!Array.isArray(overtimeDetails)) return [];
    return overtimeDetails.filter((item) => {
      const matchEmp =
        penaltiesFilterEmployee === "all" ||
        Number(item.employee_id) === Number(penaltiesFilterEmployee);
      const rowDate = item.date;
      const matchFrom =
        !penaltiesFilterFromDate || rowDate >= penaltiesFilterFromDate;
      const matchTo =
        !penaltiesFilterToDate || rowDate <= penaltiesFilterToDate;
      return matchEmp && matchFrom && matchTo;
    });
  };

  const getFilteredOnCall = () => {
    return onCallList.filter((item) => {
      const matchEmp =
        penaltiesFilterEmployee === "all" ||
        Number(item.employee_id) === Number(penaltiesFilterEmployee);
      const rowDate = item.date;
      const matchFrom =
        !penaltiesFilterFromDate || rowDate >= penaltiesFilterFromDate;
      const matchTo =
        !penaltiesFilterToDate || rowDate <= penaltiesFilterToDate;
      return matchEmp && matchFrom && matchTo;
    });
  };

  const loadCustomItemSettings = async () => {
    try {
      const [resB, resA, resD] = await Promise.all([
        api.get("/api/system/settings/payroll_bonuses_types").catch(() => null),
        api.get("/api/system/settings/payroll_advances_types").catch(() => null),
        api.get("/api/system/settings/payroll_deductions_types").catch(() => null),
      ]);
      if (resB && resB.ok) {
        const val = await resB.json().catch(() => null);
        if (Array.isArray(val) && val.length > 0) setCustomBonusesTypes(val);
      }
      if (resA && resA.ok) {
        const val = await resA.json().catch(() => null);
        if (Array.isArray(val) && val.length > 0) setCustomAdvancesTypes(val);
      }
      if (resD && resD.ok) {
        const val = await resD.json().catch(() => null);
        if (Array.isArray(val) && val.length > 0) setCustomDeductionsTypes(val);
      }
    } catch (err) {
      console.warn("Could not load custom payroll item settings in HR (using defaults):", (err as any)?.message || err);
    }
  };

  useEffect(() => {
    fetchData();
    const handleSettingsUpdate = () => {
      loadCustomItemSettings();
    };
    window.addEventListener("payroll_settings_updated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("payroll_settings_updated", handleSettingsUpdate);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoints = [
        { url: "/api/hr/employees", setter: setEmployees },
        { url: "/api/hr/departments", setter: setDepartments },
        { url: "/api/hr/shifts", setter: setShifts },
        { url: "/api/hr/branches-status", setter: setBranches },
        { url: "/api/hr/penalties", setter: setPenalties },
        { url: "/api/payroll/elements", setter: setPayrollElements },
        { url: "/api/hr/custody", setter: setCustodyList },
        { url: "/api/hr/custody/store", setter: setCustodyStoreList },
        { url: "/api/hr/production-bonuses", setter: setProductionBonuses },
      ];

      await Promise.all(
        endpoints.map(async ({ url, setter }) => {
          try {
            console.log(`Fetching ${url}...`);
            const res = await api.get(url);
            console.log(`Response from ${url}:`, res.status);
            if (res.ok) {
              let data = await res.json();
              if (Array.isArray(data)) {
                if (url === "/api/hr/departments" || url === "/api/hr/branches-status") {
                  const seen = new Set();
                  data = data.filter((item: any) => {
                    const k = item?.id !== undefined && item?.id !== null ? item.id : item?.name;
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                  });
                }
                setter(data);
              } else {
                setter([]);
              }
            } else {
              console.error(
                `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
              );
            }
          } catch (err) {
            console.error(`Failed to fetch ${url}`, err);
          }
        }),
      );
      await fetchDeductions();
      await loadCustomItemSettings();
      loadEmployeePenaltyBadges(); // non-blocking
      fetchHRSettings(); // load HR settings that affect all sub-modules
    } catch (error) {
      console.error("Failed to fetch HR data", error);
    } finally {
      setLoading(false);
    }
  };

  // --- ERP API Event Handlers ---

  // A. Employee Status Transitions & Historics
  const fetchStatusHistory = async (employeeId: number) => {
    setStatusHistoryLoading(true);
    try {
      const res = await api.get(
        `/api/hr/employees/${employeeId}/status-history`,
      );
      if (res.ok) {
        setStatusHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStatusHistoryLoading(false);
    }
  };

  const handleOpenStatusModal = (emp: Employee) => {
    setStatusEmployee(emp);
    setTargetStatus(emp.status || "active");
    setStatusReason("");
    fetchStatusHistory(emp.id);
    setShowStatusModal(true);
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEmployee) return;
    try {
      const res = await api.post(
        `/api/hr/employees/${statusEmployee.id}/status`,
        {
          old_status: statusEmployee.status || "active",
          new_status: targetStatus,
          notes: statusReason,
        },
      );
      if (res.ok) {
        setShowStatusModal(false);
        fetchData();
        alert(
          "تم تحديث حالة الموظف بنجاح وتوثيق مسار التدقيق المالي والإداري!",
        );
      } else {
        const err = await res.json();
        alert(err.error || "حدث خطأ أثناء محاولة تحديث حالة الموظف");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // B. Customizable Payroll Elements
  const handleSaveElementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingElement.id ? "PUT" : "POST";
      const url = editingElement.id
        ? `/api/payroll/elements/${editingElement.id}`
        : "/api/payroll/elements";
      const res =
        method === "PUT"
          ? await api.put(url, editingElement)
          : await api.post(url, editingElement);
      if (res.ok) {
        setShowElementModal(false);
        fetchData();
        alert("تم حفظ عنصر السلم المالي للرواتب بنجاح");
      } else {
        const err = await res.json();
        alert(err.error || "فشل حفظ عنصر الراتب");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenEmployeeElementModal = async (emp: Employee) => {
    setElementEmployee(emp);
    try {
      const res = await api.get(`/api/hr/employees/${emp.id}/elements`);
      if (res.ok) {
        setEmployeeElementStates(await res.json());
        setShowEmployeeElementModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEmployeeElements = async () => {
    if (!elementEmployee) return;
    try {
      const res = await api.post(
        `/api/hr/employees/${elementEmployee.id}/elements`,
        {
          elements: employeeElementStates.map((el) => ({
            element_id: el.id,
            assigned: el.assigned,
            value_override: parseFloat(el.value_override) || 0,
          })),
        },
      );
      if (res.ok) {
        setShowEmployeeElementModal(false);
        fetchData();
        alert("تم حفظ عناصر وبدلات الراتب والتخويل المالي للموظف بنجاح");
      } else {
        alert("حدث خطأ أثناء حفظ عناصر راتب الموظف");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePayrollElement = async (id: number) => {
    if (
      !window.confirm(
        "هل أنت متأكد من حذف عنصر الراتب هذا؟ سيتم إزالته من بدلات جميع الموظفين المرتبطين به.",
      )
    )
      return;
    try {
      const res = await api.delete(`/api/payroll/elements/${id}`);
      if (res.ok) {
        fetchData();
        alert("تم حذف عنصر الراتب بنجاح");
      } else {
        const err = await res.json();
        alert(err.error || "فشل حذف عنصر الراتب");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // C. Custody & Asset Management
  const handleSaveStoreItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/hr/custody/store", storeForm);
      if (res.ok) {
        setShowStoreModal(false);
        setStoreForm({
          id: null,
          asset_name: "",
          serial_number: "",
          quantity: 1,
          replacement_cost: 0,
          notes: "",
        });
        fetchData();
        alert("تم حفظ صنف العهدة بنجاح وتحديث كمية مخزن العهد!");
      } else {
        const err = await res.json();
        alert(err.error || "فشل حفظ الصنف في مخزن العهد");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الاتصال بالخادم لحفظ صنف العهدة");
    }
  };

  const handleDeleteStoreItem = async (id: number) => {
    if (!window.confirm("هل متأكد من حذف هذا الصنف من مخزن العهد نهائياً؟"))
      return;
    try {
      const res = await api.delete(`/api/hr/custody/store/${id}`);
      if (res.ok) {
        fetchData();
        alert("تم حذف صنف العهدة بنجاح!");
      } else {
        alert("فشل في حذف صنف العهدة");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/hr/custody", custodyForm);
      if (res.ok) {
        setShowCustodyModal(false);
        setCustodyForm({
          employee_id: "",
          custody_store_item_id: "",
          asset_name: "",
          serial_number: "",
          received_date: new Date().toISOString().split("T")[0],
          notes: "",
          replacement_cost: 0,
        });
        setCustodyEmpSearch("");
        fetchData();
        alert(
          "تم تسجيل وتسليم العهدة للموظف بنجاح والخصم من مخزن العهد وتوثيق المسؤولية المالية!",
        );
      } else {
        const err = await res.json();
        alert(err.error || "فشل تسجيل العهدة");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReturnCustodySubmit = async (
    id: number,
    status: string,
    customNotes?: string,
  ) => {
    const reason = window.prompt(
      "أدخل أي ملاحظات بخصوص استلام وإخلاء طرف العهدة (اختياري):",
      customNotes || "",
    );
    if (reason === null) return; // User cancelled
    try {
      const res = await api.post(`/api/hr/custody/${id}/return`, {
        status, // 'returned', 'damaged', 'lost'
        returned_date: new Date().toISOString().split("T")[0],
        notes: reason,
      });
      if (res.ok) {
        fetchData();
        if (status === "damaged" || status === "lost") {
          alert(
            "تم بنجاح إثبات فقدان/تلف العهدة تلقائياً وتسجيل جزاء مالي بقيمة التكلفة لخصمه من راتب الموظف بموديول الرواتب!",
          );
        } else {
          alert(
            "تم استرداد وإخلاء العهدة بنجاح وإرجاعها للمستودع وتبرئة ذمة الموظف!",
          );
        }
      } else {
        const err = await res.json();
        alert(err.error || "فشل إرجاع العهدة");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCustody = async (id: number) => {
    if (!window.confirm("هل متأكد من مسح قيد العهدة هذا نهائياً من السجلات؟"))
      return;
    try {
      const res = await api.delete(`/api/hr/custody/${id}`);
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // D. Production Factory KPI Bonuses
  const handleSaveProdBonusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/hr/production-bonuses", {
        employee_id: prodBonusForm.employee_id,
        product_name: prodBonusForm.product_name,
        units_produced: parseInt(prodBonusForm.units_produced) || 0,
        rate_per_unit: parseFloat(prodBonusForm.rate_per_unit) || 0,
        date: prodBonusForm.date,
      });
      if (res.ok) {
        setShowProdBonusModal(false);
        setProdBonusForm({
          employee_id: "",
          product_name: "",
          units_produced: "",
          rate_per_unit: "",
          date: new Date().toISOString().split("T")[0],
        });
        setProdBonusEmpSearch("");
        fetchData();
        alert("تم حفظ مؤشر أداء الإنتاج وحساب مبلغ الحافز التجريبي بنجاح!");
      } else {
        const err = await res.json();
        alert(err.error || "فشل حفظ حافز الإنتاج");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveProdBonusSubmit = async (id: number) => {
    if (
      !window.confirm(
        "هل أنت متأكد من اعتماد حافز الإنتاج هذا وترحيله مباشرة للرواتب الجارية؟",
      )
    )
      return;
    try {
      const res = await api.post(
        `/api/hr/production-bonuses/${id}/approve`,
        {},
      );
      if (res.ok) {
        fetchData();
        alert(
          "تم اعتماد حافز الإنتاج بنجاح وترحيله آلياً لخانة المكافآت بكشف الرواتب!",
        );
      } else {
        const err = await res.json();
        alert(err.error || "فشل اعتماد الحافز");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- End ERP Event Handlers ---

  const handleAddNewEmployeeClick = () => {
    setEditingEmployee({
      id: 0,
      name: "",
      first_name: "",
      second_name: "",
      third_name: "",
      fourth_name: "",
      title_prefix: "--",
      english_title: "",
      english_first_name: "",
      english_second_name: "",
      english_third_name: "",
      english_fourth_name: "",
      gender: "ذكر",
      religion: "مسلم",
      marital_status: "أعزب",
      id_type: "بطاقة رقم قومي",
      national_id: "",
      birth_date: "",
      blood_type: "--",
      passport_number: "",
      nationality: "مصر",
      passport_expiry: "",
      phone: "",
      mobile: "",
      home_phone: "",
      email: "",
      governorate: "",
      city: "",
      address: "",
      hospital_code: "ORG-TG",
      hospital_name: "مؤسسة ترانس جلف",
      employee_code: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      contract_type: "full_time",
      hire_date: new Date().toISOString().split("T")[0],
      contract_start_date: new Date().toISOString().split("T")[0],
      contract_end_date: "",
      documents: [],
      salary_type: "monthly",
      work_days: 30,
      has_insurance: false,
      has_meal_allowance: false,
      exempt_from_penalties: false,
      shifts: [],
      annual_leave_balance: 21,
      sick_leave_balance: 14,
      casual_leave_balance: 6,
    } as any);
    setEmployeeActiveStep(2);
  };

  const handleEditEmployeeAction = (emp: any) => {
    // Fill in first_name, second_name, third_name, fourth_name if missing but name is present
    let updatedEmp = { ...emp };
    if (updatedEmp.name && !updatedEmp.first_name) {
      const parts = updatedEmp.name.split(" ").filter(Boolean);
      updatedEmp.first_name = parts[0] || "";
      updatedEmp.second_name = parts[1] || "";
      updatedEmp.third_name = parts[2] || "";
      updatedEmp.fourth_name = parts.slice(3).join(" ") || "";
    }

    // Map old data to new Step 5 fields
    if (!updatedEmp.attendance_code) {
      updatedEmp.attendance_code = updatedEmp.fingerprint_code || updatedEmp.code || "";
    }
    if (!updatedEmp.work_days_count) {
      updatedEmp.work_days_count = "26";
    }
    if (updatedEmp.works_hourly === "نعم") {
      const basic = Number(updatedEmp.basic_salary || updatedEmp.salary || 0);
      const days = Number(updatedEmp.work_days_count || 26);
      if (basic > 0 && days > 0) {
        updatedEmp.new_hour_rate = (basic / (days * 8)).toFixed(2);
      }
    }
    
    setEditingEmployee(updatedEmp);
    setActiveActionMenuId(null);
    setEmployeeActiveStep(2);
  };

  const handleSaveEmployee = async (e?: React.FormEvent, targetStep?: number) => {
    if (e) e.preventDefault();
    try {
      const fullComputedName = editingEmployee.name || [editingEmployee.first_name, editingEmployee.second_name, editingEmployee.third_name, editingEmployee.fourth_name].filter(Boolean).join(" ") || "موظف جديد";
      
      let finalSalaryComponents = (editingEmployee as any).salary_components;
      if (!finalSalaryComponents || finalSalaryComponents.length === 0) {
        finalSalaryComponents = [
          { id: 1, is_basic: true, is_active: true, code: "101", name: "مرتب أساسي", amount: Number((editingEmployee as any).basic_salary || 5000), type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
          { id: 2, is_basic: false, is_active: true, code: "102", name: "بدل انتقال وركوب", amount: 500, type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
          { id: 3, is_basic: false, is_active: true, code: "201", name: "خصم تأمينات اجتماعية", amount: 550, type: "استقطاع", value_type: "نسبة من الأساسي", discount_pct: 11, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" }
        ];
      }

      // BUGFIX 2026-08-24 — Enforce is_basic=false for non-basic components
      // before save. Even though the form's checkbox is now disabled for
      // non-أساسي items, users may have older data where is_basic=true was
      // ticked by mistake on بدلات. This guarantees the saved payload is
      // clean: only the base-salary row retains is_basic=true.
      if (Array.isArray(finalSalaryComponents)) {
        finalSalaryComponents = finalSalaryComponents.map((comp: any) => {
          if (!comp || !comp.name) return comp;
          const n = String(comp.name).toLowerCase();
          const looksLikeBasicSalary =
            n.includes("أساسي") || n === "basic" || n.includes("مرتب أساسي");
          // For non-basic rows, force is_basic=false. For basic rows, leave
          // it as the user's intent (default true).
          if (!looksLikeBasicSalary && comp.is_basic === true) {
            return { ...comp, is_basic: false };
          }
          return comp;
        });
      }

      let insuranceCompAmount = 0;
      let hasInsComp = false;
      if (Array.isArray(finalSalaryComponents)) {
        finalSalaryComponents.forEach((comp: any) => {
          if ((comp.type === "استقطاع" || !comp.type) && (comp.name?.includes("تأمين") || comp.name?.toLowerCase().includes("insurance"))) {
            hasInsComp = true;
            let amt = parseFloat(comp.amount) || 0;
            if (comp.value_type === "نسبة من الأساسي") {
              const basic = Number(editingEmployee.basic_salary || (editingEmployee as any).salary || 0);
              const pct = parseFloat(comp.discount_pct) || 0;
              amt = (basic * pct) / 100;
            }
            insuranceCompAmount += amt;
          }
        });
      }

      const payload = {
        ...editingEmployee,
        name: fullComputedName,
        phone: editingEmployee.phone || (editingEmployee as any).mobile || "",
        salary_components: finalSalaryComponents,
        has_insurance: hasInsComp ? true : (editingEmployee.has_insurance ?? false),
        insurance_amount: hasInsComp ? Math.round(insuranceCompAmount) : (editingEmployee.insurance_amount || 0),
      };

      const method = editingEmployee.id ? "PUT" : "POST";
      const url = editingEmployee.id
        ? `/api/hr/employees/${editingEmployee.id}`
        : "/api/hr/employees";
      const res =
        method === "PUT"
          ? await api.put(url, payload)
          : await api.post(url, payload);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "حدث خطأ أثناء حفظ بيانات الموظف في قاعدة البيانات");
        return;
      }

      const savedData = await res.json().catch(() => ({}));

      const newId = editingEmployee.id || savedData.id;
      if (newId) {
        setEditingEmployee((prev: any) => ({ ...prev, ...payload, id: newId }));
      }

      if (!targetStep || targetStep === 1) {
        alert("تم حفظ بيانات الموظف بنجاح في قاعدة البيانات ✨");
        setEmployeeActiveStep(1);
      } else {
        setEmployeeActiveStep(targetStep);
      }
      fetchData();
    } catch (error) {
      console.error("Failed to save employee to DB", error);
      alert("حدث خطأ في الاتصال بالخادم أثناء حفظ البيانات");
    }
  };

  const handleDelete = async (type: string, id: number) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      const res = await api.delete(`/api/hr/${type}/${id}`);
      if (res.ok) fetchData();
    } catch (error) {
      console.error(`Failed to delete ${type}`);
    }
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingDept.id ? "PUT" : "POST";
      const url = editingDept.id
        ? `/api/hr/departments/${editingDept.id}`
        : "/api/hr/departments";
      const res =
        method === "PUT"
          ? await api.put(url, editingDept)
          : await api.post(url, editingDept);
      if (res.ok) {
        setShowDeptModal(false);
        setEditingDept({});
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save department");
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingBranch.id ? "PUT" : "POST";
      const url = editingBranch.id
        ? `/api/hr/branches/${editingBranch.id}`
        : "/api/hr/branches";
      const res =
        method === "PUT"
          ? await api.put(url, editingBranch)
          : await api.post(url, editingBranch);
      if (res.ok) {
        setShowBranchModal(false);
        setEditingBranch({});
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save branch");
    }
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingShift.id ? "PUT" : "POST";
      const url = editingShift.id
        ? `/api/hr/shifts/${editingShift.id}`
        : "/api/hr/shifts";
      const res =
        method === "PUT"
          ? await api.put(url, { ...editingShift, total_hours: 10 })
          : await api.post(url, { ...editingShift, total_hours: 10 });
      if (res.ok) {
        setShowShiftModal(false);
        setEditingShift({});
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save shift");
    }
  };

  const handleSavePenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingPenalty.id ? "PUT" : "POST";
      const url = editingPenalty.id
        ? `/api/hr/penalties/${editingPenalty.id}`
        : "/api/hr/penalties";
      const res =
        method === "PUT"
          ? await api.put(url, editingPenalty)
          : await api.post(url, editingPenalty);
      if (res.ok) {
        setShowPenaltyModal(false);
        setEditingPenalty({
          type: "amount",
          category: "manual",
          threshold_minutes: 0,
        });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save penalty");
    }
  };

  const handleDeleteDeduction = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الجزاء؟")) return;
    try {
      const res = await api.delete(
        `/api/payroll/deductions/${id}?userId=${user?.id}`,
      );
      if (res.ok) {
        await fetchDeductions();
      } else {
        const data = await res.json();
        alert(data.error || "فشل الحذف");
      }
    } catch (err) {
      console.error("Failed to delete deduction", err);
    }
  };

  const handleAwardPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardPenaltyData.employee_id || !awardPenaltyData.amount) {
      alert("الرجاء اختيار الموظف وإدخال قيمة الخصم / الجزاء");
      return;
    }
    try {
      // If penalty rule is days/hours type and no amount calculated yet, calculate first
      let finalAmount = Number(awardPenaltyData.amount);

      // ─── "Calculate by hour" mode ───
      // When the admin toggles this on, the "amount" input contains NUMBER OF HOURS,
      // not EGP. We need to convert hours → EGP using the employee's hourly rate.
      //   amount_egp = hours × (basic_salary / 26 / employee_shift_hours)
      // The hourly rate respects the employee's actual assigned shift (8 / 10 / 12 etc.).
      let hourlyExplanation = "";
      if (calcByHour) {
        try {
          const calcRes = await api.post("/api/hr/penalties/calculate", {
            employee_id: Number(awardPenaltyData.employee_id),
            hours: Number(awardPenaltyData.amount),
          });
          if (calcRes.ok) {
            const calcData = await calcRes.json();
            finalAmount = calcData.amount;
            hourlyExplanation = calcData.explanation || "";
          } else {
            alert("تعذر حساب قيمة الخصم بالساعة. تأكد من أن الموظف له ورديه مسجله وراتب أساسي.");
            return;
          }
        } catch (err) {
          console.error("Failed to calc by hour:", err);
          alert("خطأ أثناء حساب قيمة الخصم بالساعة");
          return;
        }
      } else if (awardPenaltyData.penalty_rule_id && !finalAmount) {
        try {
          const calcRes = await api.post("/api/hr/penalties/calculate", {
            employee_id: Number(awardPenaltyData.employee_id),
            penalty_id: awardPenaltyData.penalty_rule_id,
          });
          if (calcRes.ok) {
            const calcData = await calcRes.json();
            finalAmount = calcData.amount;
          }
        } catch (_e) { /* fallback to 0 */ }
      }

      // Append the hourly-rate explanation to the deduction notes so the
      // payroll sheet shows how the amount was derived (audit trail).
      let finalNotes = awardPenaltyData.notes || "";
      if (calcByHour && hourlyExplanation) {
        finalNotes = finalNotes
          ? `${finalNotes} | ${hourlyExplanation}`
          : hourlyExplanation;
      }

      const res = await api.post("/api/payroll/deductions", {
        employee_id: Number(awardPenaltyData.employee_id),
        amount: finalAmount,
        type: awardPenaltyData.type,
        date: awardPenaltyData.date,
        notes: finalNotes,
        userId: user?.id,
        penalty_rule_id: awardPenaltyData.penalty_rule_id,
      });
      if (res.ok) {
        setShowAwardPenaltyModal(false);
        setAwardPenaltyData({
          employee_id: "",
          amount: "",
          type: "manual",
          date: new Date().toISOString().split("T")[0],
          notes: "",
          penalty_rule_id: null,
        });
        setCalcByHour(false);
        setHourlyRateInfo(null);
        setPenaltyCalcExplanation("");
        setAwardEmpSearch("");
        await fetchDeductions();
        loadEmployeePenaltyBadges(); // refresh badges
        alert(
          calcByHour
            ? `تم تنزيل جزاء بقيمة ${finalAmount.toFixed(2)} ج.م (= ${awardPenaltyData.amount} ساعة × ${hourlyRateInfo?.hourly_rate || 0} ج.م/ساعة) في مسودة راتب الموظف بنجاح!`
            : "تم تنزيل الجزاء / الاستقطاع في مسودة راتب الموظف بنجاح!"
        );
      } else {
        const errData = await res.json();
        alert(errData.error || "فشل تسجيل الجزاء / الاستقطاع");
      }
    } catch (err) {
      console.error("Failed to save penalty deduction", err);
    }
  };

  // --- Employee Import from Excel ---
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setImportPreview(data.slice(0, 10));
      } catch {
        alert("فشل في قراءة الملف. تأكد من أنه ملف Excel صحيح.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportEmployees = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const token = localStorage.getItem('token');
      const res = await fetch("/api/hr/employees/import", {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ success: data.imported || 0, failed: data.failed || 0, errors: data.errors || [] });
        if (data.imported > 0) fetchData();
      } else {
        alert(data.error || "فشل في استيراد البيانات");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setImporting(false);
    }
  };

  // --- Employee Documents ---
  const handleOpenDocuments = async (emp: Employee) => {
    setDocumentsEmployee(emp);
    setShowDocumentsModal(true);
    setDocumentsLoading(true);
    try {
      const res = await api.get(`/api/hr/documents?employee_id=${emp.id}`);
      if (res.ok) {
        const data = await res.json();
        setEmployeeDocuments(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setDocumentsLoading(false);
  };

  const handleUploadDocument = async () => {
    if (!documentsEmployee || !docUploadFile) return;
    try {
      const formData = new FormData();
      formData.append("file", docUploadFile);
      formData.append("employee_id", documentsEmployee.id.toString());
      formData.append("document_type", docForm.document_type);
      formData.append("document_number", docForm.document_number);
      formData.append("issue_date", docForm.issue_date);
      formData.append("expiry_date", docForm.expiry_date);
      formData.append("notes", docForm.notes);
      const token = localStorage.getItem('token');
      const res = await fetch("/api/hr/documents/upload", {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        setShowDocUploadModal(false);
        setDocUploadFile(null);
        setDocForm({ document_type: "بطاقة شخصية", document_number: "", issue_date: "", expiry_date: "", notes: "" });
        handleOpenDocuments(documentsEmployee);
      } else {
        const data = await res.json();
        alert(data.error || "فشل رفع المستند");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستند؟")) return;
    try {
      const res = await api.delete(`/api/hr/documents/${docId}`);
      if (res.ok && documentsEmployee) handleOpenDocuments(documentsEmployee);
    } catch { /* ignore */ }
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

  const filteredEmployees = employees.filter((emp) => {
    const rawQuery = (searchQuery || "").trim();
    let matchesSearch = true;
    if (rawQuery) {
      const searchTerms = getSearchTerms(rawQuery, searchType);

      if (searchTerms.length > 0) {
        matchesSearch = searchTerms.some((term) => {
          const q = term.toLowerCase();
          switch (searchType) {
            case "name":
              return (
                String(emp.name || "").toLowerCase().includes(q) ||
                String(emp.job_title || "").toLowerCase().includes(q)
              );
            case "code":
              return (
                String((emp as any).employee_code || "").toLowerCase().includes(q) ||
                String(emp.fingerprint_code || "").toLowerCase().includes(q) ||
                (emp.id && emp.id.toString().includes(q))
              );
            case "department":
              return (
                String(emp.department_name || "").toLowerCase().includes(q) ||
                String(emp.branch_name || "").toLowerCase().includes(q)
              );
            default:
              return (
                String(emp.name || "").toLowerCase().includes(q) ||
                String(emp.job_title || "").toLowerCase().includes(q) ||
                String((emp as any).employee_code || "").toLowerCase().includes(q) ||
                String(emp.fingerprint_code || "").toLowerCase().includes(q) ||
                (emp.id && emp.id.toString().includes(q)) ||
                String(emp.department_name || "").toLowerCase().includes(q) ||
                String(emp.branch_name || "").toLowerCase().includes(q) ||
                String(emp.phone || "").toLowerCase().includes(q)
              );
          }
        });
      }
    }

    const matchesDepartment =
      filterDepartmentId === "" || emp.department_id === filterDepartmentId;
    const matchesBranch =
      filterBranchId === "" || emp.branch_id === filterBranchId;
    const matchesStatus =
      filterStatus === "" || (emp.status || "active") === filterStatus;
    const matchesRoleLevel =
      filterRoleLevel === "" ||
      (filterRoleLevel === "head"
        ? (emp.role_level === "head" || emp.is_department_head)
        : filterRoleLevel === "supervisor"
        ? (emp.role_level === "supervisor" || emp.is_supervisor)
        : (!emp.is_department_head && !emp.is_supervisor && emp.role_level !== "head" && emp.role_level !== "supervisor"));

    return matchesSearch && matchesDepartment && matchesBranch && matchesStatus && matchesRoleLevel;
  });

  // Pagination calculations for the employees list
  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployees.length / employeePageSize));
  const paginatedEmployees = filteredEmployees.slice(
    (employeeCurrentPage - 1) * employeePageSize,
    employeeCurrentPage * employeePageSize,
  );

  // Reset to page 1 when filters/search/page-size change
  useEffect(() => {
    setEmployeeCurrentPage(1);
  }, [searchQuery, searchType, filterDepartmentId, filterBranchId, filterStatus, filterRoleLevel, employeePageSize]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header - Sticky Wrapper */}
      <div className="sticky top-0 z-50 flex flex-col shadow-md">
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white relative z-20">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shadow-sm"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2.5 text-slate-900">
              <Users className="w-7 h-7 text-purple-600 drop-shadow-sm" />
              {initialTab ? (
                <div className="flex items-center gap-2">
                  <Lock className="w-6 h-6 text-purple-600" />
                  {tabNames[activeTab] || "الموارد البشرية"}
                </div>
              ) : (
                "الموارد البشرية"
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">
              {initialTab
                ? `القسم الفرعي: ${tabNames[activeTab] || ""}`
                : "إدارة الموظفين، الفروع، الأقسام والعمليات الجماعية"}
            </p>
          </div>
        </div>

        {/* Action Buttons for Employees - Clean and Compact inside sticky header */}
        {activeTab === "employees" && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setPreselectedMsgEmpId(null);
                setShowSendMessageModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-bold text-sm shadow-sm hover:shadow-md cursor-pointer"
            >
              <MessageSquare className="w-5 h-5" />
              <span>رسائل WhatsApp وتنبيهات 💬</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all font-bold text-sm shadow-sm hover:shadow-md cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>استيراد Excel</span>
            </button>
          </div>
        )}
      </div>
      {/* Steps Navigation Bar (Moved to sticky header) */}
      {activeTab === "employees" && (
          <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 overflow-hidden relative z-10 shadow-sm">
            <div className="flex flex-row-reverse items-center justify-center gap-4 sm:gap-8 md:gap-16 py-3 px-2 overflow-x-auto custom-scrollbar">
              {[
                { num: 1, label: "بحث عن الموظفين" },
                { num: 2, label: "البيانات الأساسية" },
                { num: 3, label: "البيانات الوظيفية" },
                { num: 4, label: "مكونات الراتب" },
                { num: 5, label: "ورديات الموظف" },
                { num: 6, label: "مرفقات الموظف" }
              ].map((step, idx) => {
                const isAccessible = step.num === 1 || employeeActiveStep > 1;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isAccessible) {
                        setEmployeeActiveStep(step.num);
                      } else {
                        alert("يرجى الضغط على 'إضافة موظف' أو اختيار 'تعديل بيانات الموظف' من قائمة الحركات أولاً للدخول على هذه المرحلة.");
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 min-w-max transition-all duration-300 ${
                      isAccessible 
                        ? "cursor-pointer hover:scale-105" 
                        : "cursor-not-allowed opacity-40 hover:opacity-50"
                    }`}
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-lg font-bold border-2 transition-colors
                      ${employeeActiveStep === step.num ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/40 scale-110" : "bg-white border-slate-300 text-slate-500"}`}>
                      {step.num}
                    </div>
                    <span className={`text-[10px] md:text-xs font-bold transition-colors ${
                      employeeActiveStep === step.num ? "text-orange-600" : "text-slate-600"
                    }`}>{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Filter & Action Bar - Sticky inside header when Step 1 is active */}
            {employeeActiveStep === 1 && (
              <div className="bg-slate-50/95 border-t border-slate-200 px-5 py-3 flex flex-col xl:flex-row items-center justify-between gap-4">
                {/* Action Buttons */}
                <div className="flex flex-row-reverse items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
                  <button
                    onClick={handleAddNewEmployeeClick}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة موظف</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSearchQuery("")}
                      className="px-5 py-2 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                    >
                      مسح
                    </button>
                    <button
                      onClick={fetchData}
                      className="px-5 py-2 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                    >
                      بحث
                    </button>
                  </div>
                </div>

                {/* Search Inputs & Filters */}
                <div className="flex-1 flex flex-col lg:flex-row-reverse items-center justify-start gap-3 w-full xl:w-auto">
                  {/* Main Search Input */}
                  <div className="flex w-full lg:w-[360px] bg-white border border-slate-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors shadow-sm">
                    <input
                      type="text"
                      value={searchQuery ?? ""}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بيانات شخصية - رقم قومي - تليفون - اسم"
                      className="flex-1 px-4 py-2 outline-none text-xs bg-white text-right font-medium placeholder:text-slate-400"
                      dir="rtl"
                    />
                    <button onClick={fetchData} className="bg-blue-500 px-3 flex items-center justify-center text-white hover:bg-blue-600 transition-colors shrink-0 cursor-pointer">
                      <Search className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Department Filter Dropdown */}
                  <div className="flex w-full lg:w-48 bg-white border border-slate-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors shadow-sm">
                    <select
                      value={filterDepartmentId ?? ""}
                      onChange={(e) => setFilterDepartmentId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 outline-none text-xs bg-white text-right font-bold text-slate-700 cursor-pointer"
                      dir="rtl"
                      title="فلترة حسب القسم"
                    >
                      <option value="">كل الأقسام</option>
                      {departments.map((dept, idx) => (
                        <option key={`dept-bar-${dept.id ?? dept.name}-${idx}`} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    <div className="bg-blue-500 px-2.5 flex items-center justify-center text-white shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Branch Filter Dropdown */}
                  <div className="flex w-full lg:w-48 bg-white border border-slate-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors shadow-sm">
                    <select
                      value={filterBranchId ?? ""}
                      onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 outline-none text-xs bg-white text-right font-bold text-slate-700 cursor-pointer"
                      dir="rtl"
                      title="فلترة حسب الفرع"
                    >
                      <option value="">كل الفروع</option>
                      {branches.map((branch, idx) => (
                        <option key={`branch-bar-${branch.id ?? branch.name}-${idx}`} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <div className="bg-blue-500 px-2.5 flex items-center justify-center text-white shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      )}
      </div>
      {/* Content - seamless sticky table view */}
      <div className="flex-1 px-4 md:px-6 pt-3 pb-6 flex flex-col min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {activeTab === "professional" && (
              <HRProfessionalSuite
                employees={employees}
                departments={departments}
                branches={branches}
                shifts={shifts}
                onRefresh={fetchData}
                onEditEmployee={(emp, step) => {
                  setEditingEmployee(emp);
                  setEmployeeActiveStep(step || 2);
                  setActiveTab("employees");
                }}
              />
            )}

            {activeTab === "recruitment" && (
              <RecruitmentSuite
                departments={departments}
                branches={branches}
                onRefreshEmployees={fetchData}
              />
            )}

            {activeTab === "bulk_actions" && (
              <BulkActionsPage
                employees={employees}
                departments={departments}
                branches={branches}
                selectedEmployeeIds={selectedEmployeeIds}
                setSelectedEmployeeIds={setSelectedEmployeeIds}
                bulkActionConfig={bulkActionConfig}
                setBulkActionConfig={setBulkActionConfig}
                handleApplyBulkActions={handleApplyBulkActions}
                bulkActionLoading={bulkActionLoading}
              />
            )}

            {activeTab === "detailed_report" && (
              <HRDetailedEmployeeReport
                employees={employees}
                departments={departments}
                branches={branches}
                shifts={shifts}
                onBack={() => setActiveTab("employees")}
                onEditEmployee={(emp, step) => {
                  setEditingEmployee(emp);
                  setEmployeeActiveStep(step || 2);
                  setActiveTab("employees");
                }}
              />
            )}

            {activeTab === "employees" && (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                {/* STEP 1: Search & Employees List */}
                {employeeActiveStep === 1 && (
                  <>
                    {filteredEmployees.length === 0 ? (
                      <div className="bg-[#f9fafb] border border-slate-200 rounded-xl shadow-xs flex flex-col items-center justify-center min-h-[400px] w-full py-16">
                        <Search className="w-20 h-20 text-slate-300 mb-6 opacity-60" strokeWidth={1} />
                        <p className="text-slate-400 font-bold mb-4 text-[15px]">لا توجد نتائج مطابقة للبحث</p>
                        <button
                          onClick={handleAddNewEmployeeClick}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>إضافة موظف جديد</span>
                        </button>
                      </div>
                    ) : (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-auto flex-1 max-h-[calc(100vh-270px)] min-h-[450px] custom-scrollbar relative">
                    <table className="w-full text-right min-w-[900px] border-collapse relative">
                      <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-30 shadow-sm">
                        <tr className="text-slate-800 font-bold">
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black w-12 text-center z-30 border-b-2 border-slate-200 shadow-xs">
                            <input
                              type="checkbox"
                              checked={paginatedEmployees.length > 0 && paginatedEmployees.every(emp => selectedEmployeeIds.includes(emp.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const newIds = [...selectedEmployeeIds];
                                  paginatedEmployees.forEach(emp => {
                                    if (!newIds.includes(emp.id)) newIds.push(emp.id);
                                  });
                                  setSelectedEmployeeIds(newIds);
                                } else {
                                  setSelectedEmployeeIds(selectedEmployeeIds.filter(id => !paginatedEmployees.some(emp => emp.id === id)));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                            />
                          </th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">الكود</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">الموظف</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">القسم / الفرع</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">الهاتف</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">الراتب الأساسي</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">الجزاءات</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">الحالة</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800">البصمة</th>
                          <th className="sticky top-0 bg-slate-100 p-4 text-xs font-black z-30 border-b-2 border-slate-200 shadow-xs text-slate-800 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedEmployees.map((emp) => (
                      <tr
                        key={emp.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedEmployeeIds.includes(emp.id) ? 'bg-purple-50/40 hover:bg-purple-50/60' : ''}`}
                      >
                        <td className="p-4 text-center w-12">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmployeeIds(prev => [...prev, emp.id]);
                              } else {
                                setSelectedEmployeeIds(prev => prev.filter(id => id !== emp.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 text-sm font-mono text-purple-600 font-bold">
                          {(emp as any).employee_code || emp.fingerprint_code || `#${emp.id}`}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                              {(emp.name || "م").charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">
                                  {emp.name || "موظف بدون اسم"}
                                </p>
                                {(emp.role_level === 'head' || emp.is_department_head) ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                    <Crown className="w-3 h-3 text-amber-600" /> رئيس قسم 👑
                                  </span>
                                ) : (emp.role_level === 'supervisor' || emp.is_supervisor) ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> مشرف قسم ⭐
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
                                    موظف عادي
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {emp.job_title}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          <div>{emp.department_name || "غير محدد"}</div>
                          <div className="text-xs text-slate-400">
                            {emp.branch_name || "غير محدد"}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span>{emp.phone || "-"}</span>
                            {emp.phone && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreselectedMsgEmpId(emp.id);
                                  setShowSendMessageModal(true);
                                }}
                                className="w-6 h-6 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center transition-all cursor-pointer"
                                title="إرسال رسالة WhatsApp للموظف"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-bold text-emerald-600">
                          {emp.basic_salary} ج.م
                        </td>
                        <td className="p-4">
                          {employeePenaltyBadges[emp.id] && employeePenaltyBadges[emp.id].count > 0 ? (
                            <button
                              onClick={() => fetchEmployeePenaltyHistory(emp.id, emp)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-700 transition-colors cursor-pointer"
                              title={`${employeePenaltyBadges[emp.id].count} جزاء - إجمالي ${employeePenaltyBadges[emp.id].amount.toFixed(2)} ج.م`}
                            >
                              <Gavel className="w-3.5 h-3.5" />
                              {employeePenaltyBadges[emp.id].count} جزاء
                              <span className="text-red-500 mr-1">({employeePenaltyBadges[emp.id].amount.toFixed(0)} ج.م)</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-lg">لا توجد جزاءات</span>
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          {(() => {
                            const st = emp.status || "active";
                            if (st === "active")
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  نشط
                                </span>
                              );
                            if (st === "on_leave")
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                  في إجازة
                                </span>
                              );
                            if (st === "suspended")
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  موقوف مؤقتاً
                                </span>
                              );
                            if (st === "terminated")
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                  منتهي الخدمة
                                </span>
                              );
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                مؤرشف
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-sm">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 font-bold">
                              <Fingerprint className="w-3.5 h-3.5 text-teal-600" />
                              <span>{emp.fingerprint_code || (emp as any).employee_code || `#${emp.id}`}</span>
                            </div>
                            
                            <div>
                              {emp.fingerprint_status === "disabled" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                                  <ShieldAlert className="w-3 h-3 text-red-600" />
                                  معطلة
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  مفعلة
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 relative">
                          <div className="relative inline-block text-right">
                            <button
                              onClick={() => setActiveActionMenuId(activeActionMenuId === emp.id ? null : emp.id)}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <span>الحركات</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeActionMenuId === emp.id ? 'rotate-180' : ''}`} />
                            </button>

                            {activeActionMenuId === emp.id && (
                              <>
                                {/* Invisible Backdrop to close menu */}
                                <div 
                                  className="fixed inset-0 z-20" 
                                  onClick={() => setActiveActionMenuId(null)} 
                                />

                                <div className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 z-30 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                                  {/* Edit basic info */}
                                  <button
                                    onClick={() => {
                                      handleEditEmployeeAction(emp);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span>تعديل بيانات الموظف</span>
                                  </button>

                                  {/* WhatsApp Direct Message */}
                                  <button
                                    onClick={() => {
                                      setPreselectedMsgEmpId(emp.id);
                                      setShowSendMessageModal(true);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>إرسال رسالة WhatsApp 💬</span>
                                  </button>

                                  {/* Biometric Toggle */}
                                  {emp.fingerprint_status === "disabled" ? (
                                    <button
                                      onClick={() => {
                                        handleOpenBiometricModal(emp, "enable");
                                        setActiveActionMenuId(null);
                                      }}
                                      className="w-full text-right px-3 py-2 hover:bg-emerald-50 text-emerald-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>تفعيل وإعادة ربط البصمة</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        handleOpenBiometricModal(emp, "disable");
                                        setActiveActionMenuId(null);
                                      }}
                                      className="w-full text-right px-3 py-2 hover:bg-red-50 text-red-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                      <span>تعطيل وحظر البصمة</span>
                                    </button>
                                  )}

                                  {/* Biometric Audit log */}
                                  <button
                                    onClick={() => {
                                      handleOpenBiometricAuditLogs(emp.id);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-teal-50 text-teal-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    <span>سجل حركات البصمة</span>
                                  </button>

                                  {/* Edit status */}
                                  <button
                                    onClick={() => {
                                      handleOpenStatusModal(emp);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>تعديل الحالة الوظيفية</span>
                                  </button>

                                  {/* Allowances & Payroll elements */}
                                  <button
                                    onClick={() => {
                                      handleOpenEmployeeElementModal(emp);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-purple-50 text-purple-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <Calculator className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span>البدلات والاستقطاعات</span>
                                  </button>

                                  {/* Mobile Password */}
                                  <button
                                    onClick={() => {
                                      setPasswordModalEmp(emp);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-emerald-50 text-emerald-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <Key className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>كلمة مرور الموبايل</span>
                                  </button>

                                  {/* Penalty History */}
                                  <button
                                    onClick={() => {
                                      fetchEmployeePenaltyHistory(emp.id, emp);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-red-50 text-red-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <Gavel className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    <span>سجل الجزاءات</span>
                                  </button>

                                  {/* Documents */}
                                  <button
                                    onClick={() => {
                                      handleOpenDocuments(emp);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-sky-50 text-sky-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <FileCog className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    <span>مستندات الموظف</span>
                                  </button>

                                  {/* Reactivate if terminated */}
                                  {(emp.status || "active") === "terminated" && (
                                    <button
                                      onClick={() => {
                                        handleReactivateEmployee(emp);
                                        setActiveActionMenuId(null);
                                      }}
                                      className="w-full text-right px-3 py-2 hover:bg-emerald-50 text-emerald-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>إعادة تفعيل الموظف</span>
                                    </button>
                                  )}

                                  <div className="my-1 border-t border-slate-100" />

                                  {/* Delete Employee */}
                                  <button
                                    onClick={() => {
                                      handleDelete("employees", emp.id);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-red-50 text-red-600 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    <span>حذف الموظف</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls for the employees list */}
                {filteredEmployees.length > 0 && (
                  <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-bold">عرض</span>
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg font-bold text-xs">
                        {(employeeCurrentPage - 1) * employeePageSize + 1}
                      </span>
                      <span>إلى</span>
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg font-bold text-xs">
                        {Math.min(employeeCurrentPage * employeePageSize, filteredEmployees.length)}
                      </span>
                      <span>من</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                        {filteredEmployees.length}
                      </span>
                      <span>موظف</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEmployeeCurrentPage(1)}
                        disabled={employeeCurrentPage === 1}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="الصفحة الأولى"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEmployeeCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={employeeCurrentPage === 1}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="الصفحة السابقة"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {(() => {
                        const pages: number[] = [];
                        let startP = Math.max(1, employeeCurrentPage - 2);
                        let endP = Math.min(employeeTotalPages, employeeCurrentPage + 2);
                        if (employeeCurrentPage <= 3) endP = Math.min(employeeTotalPages, 5);
                        if (employeeCurrentPage >= employeeTotalPages - 2) startP = Math.max(1, employeeTotalPages - 4);
                        for (let i = startP; i <= endP; i++) pages.push(i);
                        return pages.map((page) => (
                          <button
                            key={page}
                            onClick={() => setEmployeeCurrentPage(page)}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                              page === employeeCurrentPage
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                                : "border border-slate-200 hover:bg-slate-100 text-slate-600"
                            }`}
                          >
                            {page}
                          </button>
                        ));
                      })()}

                      <button
                        onClick={() => setEmployeeCurrentPage((p) => Math.min(employeeTotalPages, p + 1))}
                        disabled={employeeCurrentPage === employeeTotalPages}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="الصفحة التالية"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEmployeeCurrentPage(employeeTotalPages)}
                        disabled={employeeCurrentPage === employeeTotalPages}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="الصفحة الأخيرة"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-sm text-slate-500 font-bold">
                        صفحة {employeeCurrentPage} من {employeeTotalPages}
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <span className="text-xs text-slate-500 font-bold">موظف لكل صفحة</span>
                        <select
                          value={employeePageSize ?? ""}
                          onChange={(e) => setEmployeePageSize(parseInt(e.target.value))}
                          className="bg-transparent focus:outline-none text-sm font-bold text-slate-700 cursor-pointer"
                          title="عدد الموظفين المعروضين في كل صفحة"
                        >
                          {EMPLOYEE_PAGE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Bottom Bar for Selected Employees */}
                {selectedEmployeeIds.length > 0 && (
                  <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-white/95 backdrop-blur-xs border border-purple-200 rounded-xl p-2 shadow-lg shadow-purple-950/5 flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                      <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center text-purple-700 font-black text-[11px]">
                        {selectedEmployeeIds.length}
                      </div>
                      <span className="text-slate-600 text-xs">تم اختيار {selectedEmployeeIds.length} موظف</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveTab("bulk_actions")}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        الإجراءات الجماعية ⚡
                      </button>
                      <button
                        onClick={() => setSelectedEmployeeIds([])}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                        title="إلغاء التحديد"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}

              {/* STEP 2: Basic Employee Data Form */}
              {employeeActiveStep === 2 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-0">
                  <EmployeeBasicInfo
                    initialData={editingEmployee}
                    onDataChange={(data: any) => {
                      // Keep parent state in sync with every field the user edits,
                      // so nothing is lost when navigating between wizard steps.
                      setEditingEmployee((prev: any) => ({ ...prev, ...data }));
                    }}
                    onNext={() => setEmployeeActiveStep(3)}
                    onSave={(saved) => {
                      setEditingEmployee((prev: any) => ({ ...prev, ...saved }));
                      fetchData();
                      setEmployeeActiveStep(1);
                    }}
                    onBack={() => setEmployeeActiveStep(1)}
                  />
                </div>
              )}

              {/* STEP 3: Job & Qualification Data Form */}
              {employeeActiveStep === 3 && (
                <form onSubmit={handleSaveEmployee} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-0">
                  {/* Dark Blue Header Banner */}
                  <div className="bg-[#1e3a8a] text-white p-3.5 px-6 flex flex-row-reverse items-center justify-between shadow-md mb-4">
                    <h2 className="text-sm md:text-base font-bold flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                      البيانات الوظيفية والمؤهل العلمي
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleSaveEmployee()}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ البيانات الوظيفية</span>
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Educational Qualification Section */}
                    <div className="border border-slate-300 rounded-lg p-5 relative bg-white" dir="rtl">
                      <span className="absolute -top-3 right-4 bg-white px-2 text-xs font-bold text-blue-600 border border-blue-200 rounded flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        المؤهل الدراسي والتخصص الأكاديمي
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-right">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">المؤهل العلمي / الدرجة *</label>
                          <select
                            value={(editingEmployee as any).qualification_level || "بكالوريوس"}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, qualification_level: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          >
                            <option value="دكتوراه">دكتوراه / درجة الدكتوراه</option>
                            <option value="ماجستير">ماجستير / دبلوم دراسات عليا</option>
                            <option value="بكالوريوس">بكالوريوس / ليسانس</option>
                            <option value="دبلوم فوق متوسط">دبلوم فوق متوسط / معهد</option>
                            <option value="دبلوم متوسط">دبلوم فني / متوسط (تجاري / صناعي / زراعي)</option>
                            <option value="مؤهل متوسط">ثانوية عامة / أزهرية / مؤهل متوسط</option>
                            <option value="مؤهل أقل من متوسط">مؤهل أقل من متوسط / إعدادية</option>
                            <option value="شهادات حرفية ومهنية">شهادة حرفية / دورات تدريبية مهنية</option>
                            <option value="بدون مؤهل">بدون مؤهل / محو أمية / يقرأ ويكتب</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">التخصص / الكلية</label>
                          <input
                            type="text"
                            placeholder="مثال: محاسبة / هندسة / إدارة / تمريض / حاسبات / حقوق..."
                            value={(editingEmployee as any).qualification_field || (editingEmployee as any).education || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, qualification_field: e.target.value, education: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الجامعة / المعهد / الجهة التعليمية</label>
                          <input
                            type="text"
                            placeholder="مثال: جامعة القاهرة / معهد فني / أكاديمية العلوم..."
                            value={(editingEmployee as any).university || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, university: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">سنة التخرج</label>
                          <input
                            type="text"
                            placeholder="2020"
                            value={(editingEmployee as any).graduation_year || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, graduation_year: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-center"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">تقدير التخرج / التقييم</label>
                          <select
                            value={(editingEmployee as any).graduation_grade || "جيد جداً"}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, graduation_grade: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          >
                            <option value="ممتاز مع مرتبة الشرف">ممتاز مع مرتبة الشرف</option>
                            <option value="ممتاز">ممتاز</option>
                            <option value="جيد جداً">جيد جداً</option>
                            <option value="جيد">جيد</option>
                            <option value="مقبول">مقبول</option>
                            <option value="ناجح">ناجح / باجيد</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">رقم القيد النقابي / الترخيص المهني (إن وجد)</label>
                          <input
                            type="text"
                            placeholder="رقم القيد أو الترخيص لكافة التخصصات"
                            value={(editingEmployee as any).license_number || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, license_number: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-center"
                          />
                        </div>
                      </div>

                      {/* University Degree File Upload */}
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-700 block mb-2">رفع مستند الشهادة / مؤهل التخرج / الدورات</label>
                        <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-5 text-center bg-slate-50/50 transition-colors cursor-pointer relative group">
                          <Upload className="w-7 h-7 text-blue-600 mx-auto mb-2 opacity-80 group-hover:scale-110 transition-transform" />
                          <p className="text-xs font-bold text-slate-700">اضغط لرفع شهادة المؤهل الدراسي (الشهادة الجامعية / الدبلوم / بيان الدرجات / الدورات)</p>
                          <p className="text-[10px] text-slate-400 mt-1">يدعم الصور والملفات بصيغ PDF, PNG, JPG (حجم أقصى 10 ميجابايت)</p>
                          <input
                            type="file"
                            multiple
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files) {
                                const newDegrees = [...((editingEmployee as any).degree_certificates || [])];
                                Array.from(files).forEach((file) => {
                                  newDegrees.push({
                                    name: file.name,
                                    size: (file.size / 1024 / 1024).toFixed(2) + " MB",
                                    date: new Date().toISOString().split("T")[0]
                                  });
                                });
                                setEditingEmployee({ ...editingEmployee, degree_certificates: newDegrees } as any);
                              }
                            }}
                          />
                        </div>

                        {((editingEmployee as any).degree_certificates && (editingEmployee as any).degree_certificates.length > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                            {(editingEmployee as any).degree_certificates.map((doc: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                                  <div className="truncate">
                                    <p className="font-bold text-slate-800 truncate">{doc.name}</p>
                                    <p className="text-[10px] text-slate-400">{doc.size} • {doc.date}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const docs = [...(editingEmployee as any).degree_certificates];
                                    docs.splice(idx, 1);
                                    setEditingEmployee({ ...editingEmployee, degree_certificates: docs } as any);
                                  }}
                                  className="p-1 hover:bg-red-100 text-red-500 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 2 Navigation Bar */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 mt-4">
                      <button
                        type="button"
                        onClick={() => setEmployeeActiveStep(1)}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        إلغاء والعودة للبحث (خطوة 1)
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => handleSaveEmployee(e, 2)}
                          className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>حفظ البيانات الأساسية</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleSaveEmployee(e, 3)}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          التالي: البيانات الوظيفية (خطوة 3)
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* STEP 3: Job Data & Department Placement Form */}
              {employeeActiveStep === 3 && (
                <form onSubmit={(e) => handleSaveEmployee(e, 4)} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-0">
                  {/* Dark Blue Header Banner */}
                  <div className="bg-[#1e3a8a] text-white p-3.5 px-6 flex flex-row-reverse items-center justify-between shadow-md mb-4">
                    <h2 className="text-sm md:text-base font-bold flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-amber-400" />
                      البيانات الوظيفية والتسكين الإداري (خطوة 3)
                    </h2>
                    <button
                      type="button"
                      onClick={(e) => handleSaveEmployee(e, 3)}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ</span>
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Department, Division & Role Placement Section */}
                    <div className="border border-slate-300 rounded-lg p-5 relative bg-white" dir="rtl">
                      <span className="absolute -top-3 right-4 bg-white px-2 text-xs font-bold text-purple-600 border border-purple-200 rounded flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        التسكين الإداري والقسم الوظيفي (بيقدم في قسم إيه)
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-right">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">القسم / الإدارة التابع لها *</label>
                          <select
                            value={editingEmployee.department_id || (editingEmployee as any).department_name || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const selectedDept = departments.find(d => String(d.id) === val || d.name === val);
                              if (selectedDept) {
                                setEditingEmployee({ 
                                  ...editingEmployee, 
                                  department_id: selectedDept.id, 
                                  department_name: selectedDept.name 
                                });
                              } else {
                                setEditingEmployee({ 
                                  ...editingEmployee, 
                                  department_id: isNaN(Number(val)) ? editingEmployee.department_id : Number(val), 
                                  department_name: val 
                                });
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right font-bold text-purple-900"
                          >
                            <option value="">-- اختر القسم المكرّيت في الإعدادات --</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                            {departments.length === 0 && (
                              <>
                                <option value="قسم الحسابات والمالية">قسم الحسابات والمالية</option>
                                <option value="قسم الموارد البشرية (HR)">قسم الموارد البشرية (HR)</option>
                                <option value="قسم نظم المعلومات والشبكات (IT)">قسم نظم المعلومات والشبكات (IT)</option>
                                <option value="قسم الصيانة والخدمات الفنية">قسم الصيانة والخدمات الفنية</option>
                                <option value="قسم المبيعات والتسويق">قسم المبيعات والتسويق</option>
                                <option value="قسم الاستقبال والطوارئ">قسم الاستقبال والطوارئ</option>
                                <option value="قسم الخدمات المعاونة والتشغيل">قسم الخدمات المعاونة والتشغيل</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">المسمى الوظيفي *</label>
                          <input
                            type="text"
                            placeholder="مثال: محاسب / مهندس / موظف استقبال / طبيب / فني صيانة / مدخل بيانات"
                            value={editingEmployee.position || (editingEmployee as any).job_title || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value, job_title: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">المستوى الوظيفي</label>
                          <select
                            value={(editingEmployee as any).job_level || "تنفيذي"}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, job_level: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          >
                            <option value="تنفيذي">تنفيذي / أخصائي</option>
                            <option value="إشرافي">إشرافي / مشرف وردية</option>
                            <option value="رئيس قسم">رئيس قسم / مدير مباشر</option>
                            <option value="إدارة عليا">إدارة عليا / مدير عام</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">المدير / المسؤول المباشر</label>
                          <input
                            type="text"
                            placeholder="اسم المسؤول المباشر"
                            value={(editingEmployee as any).direct_manager || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, direct_manager: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">مكان / مقر العمل</label>
                          <select
                            value={editingEmployee.branch_id || (editingEmployee as any).branch_name || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const selectedBranch = branches.find(b => String(b.id) === val || b.name === val);
                              if (selectedBranch) {
                                setEditingEmployee({ 
                                  ...editingEmployee, 
                                  branch_id: selectedBranch.id, 
                                  branch_name: selectedBranch.name 
                                });
                              } else {
                                setEditingEmployee({ 
                                  ...editingEmployee, 
                                  branch_id: isNaN(Number(val)) ? editingEmployee.branch_id : Number(val), 
                                  branch_name: val 
                                });
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          >
                            <option value="">-- اختر الفرع / مقر العمل --</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                            {branches.length === 0 && (
                              <>
                                <option value="المبنى الرئيسي">المبنى الرئيسي</option>
                                <option value="فرع السويس">فرع السويس</option>
                                <option value="المجمع الطبي الملحق">المجمع الطبي الملحق</option>
                                <option value="الفرع الإداري">الفرع الإداري</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">حالة العمل الحالية</label>
                          <select
                            value={editingEmployee.status || "على رأس العمل"}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right font-bold text-emerald-700"
                          >
                            <option value="على رأس العمل">على رأس العمل (نشط)</option>
                            <option value="إجازة بدون مرتب">في إجازة بدون مرتب</option>
                            <option value="إجازة مرضية">في إجازة مرضية</option>
                            <option value="موقوف مؤقتاً">موقوف مؤقتاً</option>
                            <option value="منتهي الخدمة">منتهي الخدمة / مستقيل</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Additional Commencement & HR Details Section */}
                    <div className="border border-slate-300 rounded-lg p-5 relative bg-white" dir="rtl">
                      <span className="absolute -top-3 right-4 bg-white px-2 text-xs font-bold text-emerald-600 border border-emerald-200 rounded flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        تفاصيل المباشرة والدرجة الوظيفية
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-right">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">تاريخ استلام العمل الفعلي</label>
                          <input
                            type="date"
                            value={(editingEmployee as any).actual_start_date || editingEmployee.hire_date || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, actual_start_date: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-center"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الكادر / الدرجة الوظيفية</label>
                          <select
                            value={(editingEmployee as any).job_grade || "الكادر الإداري"}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, job_grade: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          >
                            <option value="الكادر الإداري">الكادر الإداري والمالي</option>
                            <option value="الكادر الهندسي والفني">الكادر الهندسي والفني</option>
                            <option value="كادر نظم المعلومات والتكنولوجيا">كادر نظم المعلومات والتكنولوجيا (IT)</option>
                            <option value="كادر المبيعات والتسويق">كادر المبيعات والتسويق</option>
                            <option value="الكادر الطبي والصحي">الكادر الطبي والرعاية الصحية</option>
                            <option value="كادر الخدمات العامة والحراسة">كادر الخدمات العامة والحراسة واللوجستيات</option>
                            <option value="كادر عام">كادر عام / مهن أخرى</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الوردية التلقائية</label>
                          <select
                            value={editingEmployee.shift_id || (editingEmployee as any).shift_name || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const selectedShift = shifts.find(s => String(s.id) === val || s.name === val);
                              if (selectedShift) {
                                setEditingEmployee({ 
                                  ...editingEmployee, 
                                  shift_id: selectedShift.id, 
                                  shift_name: selectedShift.name 
                                });
                              } else {
                                setEditingEmployee({ 
                                  ...editingEmployee, 
                                  shift_id: isNaN(Number(val)) ? editingEmployee.shift_id : Number(val), 
                                  shift_name: val 
                                });
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-right"
                          >
                            <option value="">-- اختر الوردية المقررة --</option>
                            {shifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.start_time} - {s.end_time})
                              </option>
                            ))}
                            {shifts.length === 0 && (
                              <>
                                <option value="الوردية الصباحية (8 ص - 4 م)">الوردية الصباحية (8 ص - 4 م)</option>
                                <option value="الوردية المسائية (4 م - 12 ص)">الوردية المسائية (4 م - 12 ص)</option>
                                <option value="الوردية الليلية (12 ص - 8 ص)">الوردية الليلية (12 ص - 8 ص)</option>
                                <option value="نظام النبطشية 24 ساعة">نظام النبطشية 24 ساعة</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div className="md:col-span-3">
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الوصف الوظيفي والمهام المطلوبة</label>
                          <textarea
                            rows={2}
                            placeholder="اكتب نبذة مختصرة عن مهام ومسؤوليات الوظيفة..."
                            value={(editingEmployee as any).job_description || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, job_description: e.target.value } as any)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs text-right"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer Navigation & Actions */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg text-right" dir="rtl">
                      <button
                        type="button"
                        onClick={() => setEmployeeActiveStep(2)}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded transition-colors cursor-pointer"
                      >
                        السابق: البيانات الأساسية (خطوة 2)
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>حفظ البيانات الوظيفية</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleSaveEmployee(e, 4)}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          التالي: مكونات الراتب (خطوة 4)
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* STEP 4: Salary Components & Financial Data (مكونات الراتب والبيانات المالية) */}
              {employeeActiveStep === 4 && (
                <div className="bg-slate-100 rounded-lg border border-slate-300 shadow-sm overflow-hidden p-0 text-right text-xs" dir="rtl">
                  {/* Top Action Header */}
                  <div className="bg-[#1e3a8a] text-white p-2.5 px-4 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>مكونات الراتب</span>
                        <span className="text-slate-300 text-xs font-normal">/ تدرج الراتب</span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleSaveEmployee();
                          alert("تم حفظ البيانات المالية ومكونات الراتب بنجاح");
                        }}
                        className="flex items-center gap-1.5 px-4 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>حفظ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alert("جارٍ استدعاء تدرج الراتب والمسح الضوئي...")}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                      >
                        مسح ضوئي / تدرج الراتب
                      </button>
                    </div>
                  </div>

                  <div className="p-2 space-y-3">
                    {/* SECTION 1: بيانات مالية */}
                    <div className="border border-slate-300 bg-white rounded overflow-hidden shadow-sm">
                      <div className="bg-[#2b4c7e] text-white px-3 py-1 font-bold text-xs flex items-center justify-between">
                        <span>بيانات مالية</span>
                      </div>
                      
                      <div className="p-2.5 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px] bg-slate-50/50">
                        {/* COLUMN 1 (Right) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">حالة المرتب</label>
                            <select
                              value={(editingEmployee as any).salary_status || "له راتب"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, salary_status: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="له راتب">له راتب</option>
                              <option value="ليس له راتب">ليس له راتب</option>
                              <option value="موقوف مؤقتاً">موقوف مؤقتاً</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">كود البنك</label>
                            <select
                              value={(editingEmployee as any).bank_code || "البنك الأهلي الكويتي - مصر"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_code: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="البنك الأهلي الكويتي - مصر">البنك الأهلي الكويتي - مصر</option>
                              <option value="البنك الأهلي المصري">البنك الأهلي المصري</option>
                              <option value="بنك مصر">بنك مصر</option>
                              <option value="بنك CIB">بنك CIB التجاري الدولي</option>
                              <option value="بنك القاهرة">بنك القاهرة</option>
                              <option value="بنك الإسكندرية">بنك الإسكندرية</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">له تأمينات</label>
                            <select
                              value={(editingEmployee as any).has_insurance || "نعم"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, has_insurance: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="نعم">نعم</option>
                              <option value="لا">لا</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">المكان القائم بالتأمين</label>
                            <input
                              type="text"
                              value={(editingEmployee as any).insurance_location || "المكتب الرئيسي"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, insurance_location: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">Insurance Reason</label>
                            <input
                              type="text"
                              placeholder="سبب التأمين"
                              value={(editingEmployee as any).insurance_reason || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, insurance_reason: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">تاريخ استمارة 6</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).form6_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, form6_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">له ضرائب</label>
                            <select
                              value={(editingEmployee as any).has_tax || "نعم"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, has_tax: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="نعم">نعم</option>
                              <option value="لا">لا</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">تاريخ أول سلفة</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).first_loan_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, first_loan_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">نسبة الزيادة السنوية</label>
                            <input
                              type="number"
                              placeholder="%"
                              value={(editingEmployee as any).annual_increase_pct || 10}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, annual_increase_pct: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">تأمين الرعاية الصحية</label>
                            <select
                              value={(editingEmployee as any).health_insurance || "نعم"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, health_insurance: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="نعم">نعم</option>
                              <option value="لا">لا</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">المستويات المالية</label>
                            <select
                              value={(editingEmployee as any).financial_level || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, financial_level: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="المستوى الأول">المستوى الأول</option>
                              <option value="المستوى الثاني">المستوى الثاني</option>
                              <option value="المستوى الثالث">المستوى الثالث</option>
                            </select>
                          </div>
                        </div>

                        {/* COLUMN 2 (Middle) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">طريقة الصرف</label>
                            <select
                              value={(editingEmployee as any).payment_method || "ATM"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, payment_method: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="ATM">ATM</option>
                              <option value="نقداً">نقداً</option>
                              <option value="تحويل بنكي">تحويل بنكي</option>
                              <option value="شيك">شيك</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">كود البنك الفرعي</label>
                            <select
                              value={(editingEmployee as any).bank_sub_code || "البنك الأهلي الكويتي - مصر"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_sub_code: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="البنك الأهلي الكويتي - مصر">البنك الأهلي الكويتي - مصر</option>
                              <option value="الفرع الرئيسي">الفرع الرئيسي</option>
                              <option value="فرع السويس">فرع السويس</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">أتعاب أطباء IBAN</label>
                            <input
                              type="text"
                              placeholder="EG..."
                              value={(editingEmployee as any).doctor_iban || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, doctor_iban: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">أول راتب</label>
                            <select
                              value={(editingEmployee as any).first_salary || "لا"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, first_salary: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="لا">لا</option>
                              <option value="نعم">نعم</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">الرقم التأميني</label>
                            <input
                              type="text"
                              placeholder="الرقم التأميني"
                              value={(editingEmployee as any).insurance_number || (editingEmployee as any).national_id || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, insurance_number: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">Vac Start Date</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).vac_start_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, vac_start_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">إيقاف الراتب</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).stop_salary_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, stop_salary_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">تاريخ بداية الراتب</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).start_salary_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, start_salary_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">تاريخ القيد</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).entry_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, entry_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">صرفية أساسية</label>
                            <select
                              value={(editingEmployee as any).basic_payout || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, basic_payout: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="صرفية شهري روتيني">صرفية شهري روتيني</option>
                              <option value="صرفية أسبوعية">صرفية أسبوعية</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">كشف الصرف</label>
                            <select
                              value={(editingEmployee as any).payroll_statement || "نعم"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, payroll_statement: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="نعم">نعم</option>
                              <option value="لا">لا</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">صافي المرتب</label>
                            <select
                              value={(editingEmployee as any).net_salary_option || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, net_salary_option: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="صافي كامل">صافي كامل</option>
                              <option value="صافي بعد الخصم">صافي بعد الخصم</option>
                            </select>
                          </div>
                        </div>

                        {/* COLUMN 3 (Left) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">اسم الحساب</label>
                            <div className="flex items-center gap-1 w-full">
                              <select className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] w-16">
                                <option>ATM</option>
                                <option>Cash</option>
                              </select>
                              <input
                                type="text"
                                placeholder=""
                                value={(editingEmployee as any).account_name || ""}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, account_name: e.target.value } as any)}
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">كود الموظف بالبنك</label>
                            <input
                              type="text"
                              value={(editingEmployee as any).bank_emp_code || (editingEmployee as any).code || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_emp_code: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">المرتب الحالي</label>
                            <input
                              type="number"
                              placeholder="ج.م"
                              value={(editingEmployee as any).basic_salary || (editingEmployee as any).salary || 5000}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, basic_salary: Number(e.target.value), salary: Number(e.target.value) } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-bold text-blue-900"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">تاريخ التأمين</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).insurance_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, insurance_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">Vac End Date</label>
                            <input
                              type="date"
                              value={(editingEmployee as any).vac_end_date || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, vac_end_date: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">نسبة المرتب</label>
                            <div className="flex items-center gap-1 w-full">
                              <span className="text-[10px] text-slate-500">%</span>
                              <input
                                type="number"
                                value={(editingEmployee as any).salary_pct || 100}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, salary_pct: e.target.value } as any)}
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                              />
                              <select className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] w-20">
                                <option>- اختر -</option>
                                <option>شامل</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">ثابت 30/6</label>
                            <select
                              value={(editingEmployee as any).fixed_30_6 || "لا"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, fixed_30_6: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="لا">لا</option>
                              <option value="نعم">نعم</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">صرفية التجاريين غير مؤمن</label>
                            <select
                              value={(editingEmployee as any).uninsured_commercial || "صرفية التجاريين غير مؤمن"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, uninsured_commercial: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                            >
                              <option value="صرفية التجاريين غير مؤمن">صرفية التجاريين غير مؤمن</option>
                              <option value="لا">لا</option>
                              <option value="نعم">نعم</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-28 shrink-0">فيزا أو بدون فيزا</label>
                            <div className="flex items-center gap-1 w-full">
                              <select
                                value={(editingEmployee as any).visa_status || "بدون فيزا"}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, visa_status: e.target.value } as any)}
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px]"
                              >
                                <option value="بدون فيزا">بدون فيزا</option>
                                <option value="فيزا">فيزا</option>
                              </select>
                              <select className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] w-20">
                                <option>- اختر -</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: تغير الصرفية */}
                    <div className="border border-slate-300 bg-white rounded overflow-hidden shadow-sm">
                      <div className="bg-[#2b4c7e] text-white px-3 py-1 font-bold text-xs flex items-center justify-between">
                        <span>تغير الصرفية</span>
                      </div>
                      
                      <div className="p-2.5 flex items-center justify-between gap-4 bg-slate-50/50 text-[11px]">
                        <div className="flex items-center gap-4 w-full">
                          <div className="flex items-center gap-2 w-1/2">
                            <label className="text-slate-700 font-bold shrink-0">من صرفية</label>
                            <select
                              value={(editingEmployee as any).from_payroll || "الصرفية الأساسية"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, from_payroll: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="الصرفية الأساسية">الصرفية الأساسية</option>
                              <option value="صرفية الإضافي">صرفية الإضافي</option>
                              <option value="صرفية الأرباح والمكافآت">صرفية الأرباح والمكافآت</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2 w-1/2">
                            <label className="text-slate-700 font-bold shrink-0">الى صرفية</label>
                            <select
                              value={(editingEmployee as any).to_payroll || "صرفية شهر سبتمبر 2026"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, to_payroll: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="صرفية شهر سبتمبر 2026">صرفية شهر سبتمبر 2026</option>
                              <option value="صرفية شهر أكتوبر 2026">صرفية شهر أكتوبر 2026</option>
                              <option value="صرفية أسبوعية 1">صرفية أسبوعية 1</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => alert(`تم تنفيذ تحويل الصرفية بنجاح إلى ${(editingEmployee as any).to_payroll || "الصرفية المختارة"}`)}
                          className="px-6 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs border border-slate-300 rounded transition-colors cursor-pointer shrink-0"
                        >
                          تنفيذ
                        </button>
                      </div>
                    </div>

                    {/* SECTION 3: مكونات الراتب */}
                    <div className="border border-slate-300 bg-white rounded overflow-hidden shadow-sm">
                      <div className="bg-[#2b4c7e] text-white px-3 py-1 font-bold text-xs flex items-center justify-between">
                        <span>مكونات الراتب</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => alert("قواعد Tax Item مفعّلة")}
                            className="px-2 py-0.5 bg-slate-200 text-slate-800 hover:bg-white text-[10px] font-bold rounded border border-slate-400 cursor-pointer"
                          >
                            Tax Item
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const hasInsurance = (editingEmployee as any).has_insurance;
                              if (hasInsurance === "لا" || hasInsurance === false) {
                                alert("لا يمكن تفعيل التأمينات. الموظف غير مسجل بالتأمينات.");
                              } else {
                                alert("قواعد بنود التأمينات مفعّلة");
                              }
                            }}
                            className="px-2 py-0.5 bg-slate-200 text-slate-800 hover:bg-white text-[10px] font-bold rounded border border-slate-400 cursor-pointer"
                          >
                            بنود التأمينات
                          </button>
                          
                          <div className="flex items-center gap-1 mr-2">
                            <button
                              type="button"
                              onClick={() => {
                                const selItem = (editingEmployee as any).selected_item_to_add;
                                if (!selItem || selItem === "اخبار بند" || selItem === "اختيار بند") {
                                  alert("برجاء اختيار بند من القائمة أولاً");
                                  return;
                                }
                                const currentItems = (editingEmployee as any).salary_components || [
                                  { id: 1, is_basic: true, is_active: true, code: "101", name: "مرتب أساسي", amount: Number((editingEmployee as any).basic_salary || 5000), type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
                                  { id: 2, is_basic: false, is_active: true, code: "102", name: "بدل انتقال وركوب", amount: 500, type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
                                  { id: 3, is_basic: false, is_active: true, code: "201", name: "خصم تأمينات اجتماعية", amount: 550, type: "استقطاع", value_type: "نسبة من الأساسي", discount_pct: 11, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" }
                                ];
                                
                                if (selItem.includes("تأمين")) {
                                  const hasInsurance = (editingEmployee as any).has_insurance;
                                  if (hasInsurance === "لا" || hasInsurance === false) {
                                    alert("لا يمكن إضافة بند التأمينات لأن الموظف غير مسجل بالتأمينات في البيانات الأساسية.");
                                    return;
                                  }
                                }
                                
                                const matchedElement = payrollElements.find(el => el.name === selItem);
                                const isDeduction =
                                  (matchedElement && matchedElement.type === "deduction") ||
                                  customDeductionsTypes.some(d => getTypeLabel(d) === selItem) ||
                                  customAdvancesTypes.some(a => getTypeLabel(a) === selItem) ||
                                  selItem.includes("خصم") ||
                                  selItem.includes("جزاء") ||
                                  selItem.includes("استقطاع") ||
                                  selItem.includes("سلفة") ||
                                  selItem.includes("عجز") ||
                                  selItem.includes("غياب");

                                let calculatedAmount = 0;
                                let isPercent = false;
                                let pctValue = 0;
                                
                                if (matchedElement) {
                                  if (matchedElement.rule_type === "percent") {
                                    isPercent = true;
                                    pctValue = Number(matchedElement.value) || 0;
                                    const basic = Number((editingEmployee as any).basic_salary || 0);
                                    calculatedAmount = (basic * pctValue) / 100;
                                  } else {
                                    calculatedAmount = Number(matchedElement.value) || 0;
                                  }
                                } else {
                                  if (selItem.includes("سكن")) calculatedAmount = 500;
                                  else if (selItem.includes("انتقال") || selItem.includes("مواصلات")) calculatedAmount = 300;
                                  else if (selItem.includes("وجبة") || selItem.includes("طعام")) calculatedAmount = 250;
                                  else if (selItem.includes("تأمين")) {
                                    const basic = Number((editingEmployee as any).basic_salary || 0);
                                    calculatedAmount = Math.round(basic * 0.11);
                                    isPercent = true;
                                    pctValue = 11;
                                  } else {
                                    calculatedAmount = isDeduction ? 200 : 400;
                                  }
                                }

                                const newItem = {
                                  id: Date.now(),
                                  is_basic: false,
                                  is_active: true,
                                  code: `ITEM-${Math.floor(100 + Math.random() * 900)}`,
                                  name: selItem,
                                  amount: calculatedAmount,
                                  type: isDeduction ? "استقطاع" : "استحقاق",
                                  value_type: isPercent ? "نسبة من الأساسي" : "مبلغ ثابت",
                                  discount_pct: pctValue,
                                  payroll_run: "الصرفية الأساسية",
                                  position: editingEmployee.position || "كل الوظائف",
                                  last_modified: new Date().toISOString().split("T")[0],
                                  user_name: "ADMIN",
                                  is_closed: false,
                                  available_from: "2026-01-01",
                                  available_to: "2030-12-31"
                                };
                                setEditingEmployee({
                                  ...editingEmployee,
                                  salary_components: [...currentItems, newItem]
                                } as any);
                              }}
                              className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded cursor-pointer flex items-center justify-center"
                              title="إضافة بند"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <select
                              value={(editingEmployee as any).selected_item_to_add || "اختيار بند"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, selected_item_to_add: e.target.value } as any)}
                              className="bg-white text-slate-800 border border-slate-300 rounded px-2 py-0.5 text-[11px] font-bold max-w-[220px]"
                            >
                              <option value="اختيار بند">اختيار بند...</option>
                              
                              {/* Payroll Elements from HR */}
                              {payrollElements.length > 0 && (
                                <optgroup label="عناصر الراتب والسلم المالي">
                                  {payrollElements.map(el => (
                                    <option key={`el-${el.id}`} value={el.name}>
                                      {el.name} ({el.type === "addition" ? "إضافة" : "خصم"})
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {/* Custom Bonuses from Settings */}
                              <optgroup label="البدلات والمكافآت (إعدادات البنود)">
                                {Array.from(new Set(["housing", "bonus", "delivery", "vacation", "meal", "transport", ...customBonusesTypes])).map((item, idx) => {
                                  const label = getTypeLabel(item);
                                  return <option key={`b-${idx}`} value={label}>{label}</option>;
                                })}
                              </optgroup>

                              {/* Custom Deductions from Settings */}
                              <optgroup label="الخصومات والجزاءات (إعدادات البنود)">
                                {Array.from(new Set(["absence", "cl", "shortage", "fellowship", "hr", "penalty", "insurance", ...customDeductionsTypes])).map((item, idx) => {
                                  const label = getTypeLabel(item);
                                  return <option key={`d-${idx}`} value={label}>{label}</option>;
                                })}
                              </optgroup>

                              {/* Custom Advances from Settings */}
                              <optgroup label="السلفيات والاستقطاعات (إعدادات البنود)">
                                {Array.from(new Set(["direct", "installment", ...customAdvancesTypes])).map((item, idx) => {
                                  const label = getTypeLabel(item);
                                  return <option key={`a-${idx}`} value={label}>{label}</option>;
                                })}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Salary Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] text-center border-collapse">
                          <thead>
                            <tr className="bg-[#2b4c7e] text-white border-b border-blue-900 font-bold">
                              <th className="p-1.5 border-r border-blue-900 w-16 text-emerald-200">مفعّل<br/><span className="text-[9px] font-normal text-emerald-100/70">(للحساب)</span></th>
                              <th className="p-1.5 border-r border-blue-900 w-16">بند أساسي</th>
                              <th className="p-1.5 border-r border-blue-900 w-16">الكود</th>
                              <th className="p-1.5 border-r border-blue-900 min-w-[120px]">الاسم</th>
                              <th className="p-1.5 border-r border-blue-900 w-20">القيمة</th>
                              <th className="p-1.5 border-r border-blue-900 w-24">استحقاق / استقطاع</th>
                              <th className="p-1.5 border-r border-blue-900 w-24">نوع القيمة</th>
                              <th className="p-1.5 border-r border-blue-900 w-16">نسبة الخصم</th>
                              <th className="p-1.5 border-r border-blue-900 w-24">الصرفية</th>
                              <th className="p-1.5 border-r border-blue-900 min-w-[140px] text-amber-300">الوظيفة (تخصيص وظيفي)</th>
                              <th className="p-1.5 border-r border-blue-900 w-20">تاريخ آخر تعديل</th>
                              <th className="p-1.5 border-r border-blue-900 w-20">المستخدم</th>
                              <th className="p-1.5 border-r border-blue-900 w-12">مغلق</th>
                              <th className="p-1.5 border-r border-blue-900 w-20">متاحة من</th>
                              <th className="p-1.5 border-r border-blue-900 w-20">متاحة الى</th>
                              <th className="p-1.5 w-12">حذف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {((editingEmployee as any).salary_components || [
                              { id: 1, is_basic: true, is_active: true, code: "101", name: "مرتب أساسي", amount: Number((editingEmployee as any).basic_salary || 5000), type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
                              { id: 2, is_basic: false, is_active: true, code: "102", name: "بدل انتقال وركوب", amount: 500, type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
                              { id: 3, is_basic: false, is_active: true, code: "201", name: "خصم تأمينات اجتماعية", amount: 550, type: "استقطاع", value_type: "نسبة من الأساسي", discount_pct: 11, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" }
                            ]).map((item: any, idx: number) => {
                              const itemsList = [...((editingEmployee as any).salary_components || [
                                { id: 1, is_basic: true, is_active: true, code: "101", name: "مرتب أساسي", amount: Number((editingEmployee as any).basic_salary || 5000), type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
                                { id: 2, is_basic: false, is_active: true, code: "102", name: "بدل انتقال وركوب", amount: 500, type: "استحقاق", value_type: "مبلغ ثابت", discount_pct: 0, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" },
                                { id: 3, is_basic: false, is_active: true, code: "201", name: "خصم تأمينات اجتماعية", amount: 550, type: "استقطاع", value_type: "نسبة من الأساسي", discount_pct: 11, payroll_run: "الصرفية الأساسية", position: editingEmployee.position || "كل الوظائف", last_modified: "2026-08-12", user_name: "ADMIN", is_closed: false, available_from: "2026-01-01", available_to: "2030-12-31" }
                              ])];

                              const updateItem = (field: string, val: any) => {
                                itemsList[idx] = { ...itemsList[idx], [field]: val };
                                setEditingEmployee({ ...editingEmployee, salary_components: itemsList } as any);
                              };

                              return (
                                <tr key={item.id || idx} className={`hover:bg-slate-50 transition-colors ${item.is_active === false ? "opacity-50 bg-slate-100" : ""}`}>
                                  <td className="p-1 border-r border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={item.is_active !== false}
                                      title={item.is_active === false ? "هذا البند معطّل — لن يدخل في حساب المرتب" : "هذا البند مُفعّل وسيُحسب في المرتب"}
                                      onChange={(e) => updateItem("is_active", e.target.checked)}
                                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    {(() => {
                                      // BUGFIX 2026-08-24 — Prevent users from
                                      // accidentally marking non-basic بدلات as
                                      // "بند أساسي" (which would make the backend
                                      // skip them in payroll calculation). Only
                                      // allow toggling the flag for rows whose
                                      // name actually represents the base salary.
                                      const itemName = String(item.name || "").toLowerCase();
                                      const looksLikeBasicSalary =
                                        itemName.includes("أساسي") ||
                                        itemName.includes("basic") ||
                                        itemName.includes("مرتب أساسي");
                                      return (
                                        <input
                                          type="checkbox"
                                          checked={item.is_basic}
                                          disabled={!looksLikeBasicSalary}
                                          title={
                                            looksLikeBasicSalary
                                              ? "هذا البند هو المرتب الأساسي"
                                              : "لا يمكن تفعيل 'بند أساسي' إلا للمرتب الأساسي — البدلات والإضافات تُحسب تلقائياً"
                                          }
                                          onChange={(e) => updateItem("is_basic", e.target.checked)}
                                          className="rounded disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                      );
                                    })()}
                                  </td>
                                  <td className="p-1 border-r border-slate-200 font-mono text-[10px]">
                                    <input
                                      type="text"
                                      value={item.code ?? ""}
                                      onChange={(e) => updateItem("code", e.target.value)}
                                      className="w-full text-center bg-transparent border-b border-transparent focus:border-blue-400"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200 font-bold text-slate-800">
                                    <div className="w-full text-right px-1 py-0.5 font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded">
                                      {item.name}
                                    </div>
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <input
                                      type="number"
                                      value={item.amount ?? ""}
                                      onChange={(e) => updateItem("amount", Number(e.target.value))}
                                      className="w-full text-center bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-blue-900"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <div
                                      className={`w-full text-center font-bold rounded px-1 py-1 border ${
                                        item.type === "استحقاق" ? "text-emerald-700 bg-emerald-50 border-emerald-300" : "text-rose-700 bg-rose-50 border-rose-300"
                                      }`}
                                    >
                                      {item.type}
                                    </div>
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <div className="w-full text-center bg-slate-50 border border-slate-200 rounded px-1 py-1 text-slate-600 font-semibold">
                                      {item.value_type}
                                    </div>
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <input
                                      type="number"
                                      value={item.discount_pct || 0}
                                      onChange={(e) => updateItem("discount_pct", Number(e.target.value))}
                                      className="w-12 text-center bg-white border border-slate-200 rounded px-1 py-0.5"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <select
                                      value={item.payroll_run || "الصرفية الأساسية"}
                                      onChange={(e) => updateItem("payroll_run", e.target.value)}
                                      className="w-full text-center bg-white border border-slate-200 rounded px-1 py-0.5"
                                    >
                                      <option value="الصرفية الأساسية">الصرفية الأساسية</option>
                                      <option value="صرفية الإضافي">صرفية الإضافي</option>
                                      <option value="صرفية الأرباح">صرفية الأرباح</option>
                                    </select>
                                  </td>
                                  {/* EACH ITEM ASSIGNED TO A JOB POSITION */}
                                  <td className="p-1 border-r border-slate-200 bg-amber-50/40">
                                    <select
                                      value={item.position || editingEmployee.position || "كل الوظائف"}
                                      onChange={(e) => updateItem("position", e.target.value)}
                                      className="w-full text-right bg-white border border-amber-300 rounded px-1 py-0.5 text-slate-800 font-bold"
                                    >
                                      <option value="كل الوظائف">كل الوظائف (عام)</option>
                                      {editingEmployee.position && (
                                        <option value={editingEmployee.position}>{editingEmployee.position} (وظيفة الموظف)</option>
                                      )}
                                      <option value="محاسب">محاسب / كادر مالي</option>
                                      <option value="مهندس">مهندس / كادر فني</option>
                                      <option value="طبيب مقيم">طبيب مقيم / كادر طبي</option>
                                      <option value="ممرض أول">ممرض أول / كادر تمريض</option>
                                      <option value="موظف استقبال">موظف استقبال / خدمات</option>
                                      <option value="فني صيانة">فني صيانة</option>
                                      <option value="مسؤول موارد بشرية">مسؤول موارد بشرية (HR)</option>
                                    </select>
                                  </td>
                                  <td className="p-1 border-r border-slate-200 text-slate-500">{item.last_modified}</td>
                                  <td className="p-1 border-r border-slate-200 text-slate-600">{item.user_name}</td>
                                  <td className="p-1 border-r border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={item.is_closed}
                                      onChange={(e) => updateItem("is_closed", e.target.checked)}
                                      className="rounded"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <input
                                      type="date"
                                      value={item.available_from || "2026-01-01"}
                                      onChange={(e) => updateItem("available_from", e.target.value)}
                                      className="w-full text-[9px] bg-white border border-slate-200 rounded px-0.5 py-0.5"
                                    />
                                  </td>
                                  <td className="p-1 border-r border-slate-200">
                                    <input
                                      type="date"
                                      value={item.available_to || "2030-12-31"}
                                      onChange={(e) => updateItem("available_to", e.target.value)}
                                      className="w-full text-[9px] bg-white border border-slate-200 rounded px-0.5 py-0.5"
                                    />
                                  </td>
                                  <td className="p-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newArr = itemsList.filter((_, i) => i !== idx);
                                        setEditingEmployee({ ...editingEmployee, salary_components: newArr } as any);
                                      }}
                                      className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors cursor-pointer"
                                      title="حذف البند"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Totals Row matching Screenshot */}
                      {(() => {
                        const items = ((editingEmployee as any).salary_components || [
                          { id: 1, is_basic: true, is_active: true, code: "101", name: "مرتب أساسي", amount: Number((editingEmployee as any).basic_salary || 5000), type: "استحقاق" },
                          { id: 2, is_basic: false, is_active: true, code: "102", name: "بدل انتقال وركوب", amount: 500, type: "استحقاق" },
                          { id: 3, is_basic: false, is_active: true, code: "201", name: "خصم تأمينات اجتماعية", amount: 550, type: "استقطاع" }
                        ]);

                        // فلترة البنود غير المُفعّلة (علامة الصح غير مُعلّمة) — لا تدخل في الإجمالي
                        const activeItems = items.filter((i: any) => i.is_active !== false);

                        const totalEarnings = activeItems
                          .filter((i: any) => i.type === "استحقاق")
                          .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

                        const totalDeductions = activeItems
                          .filter((i: any) => i.type === "استقطاع")
                          .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

                        const net = totalEarnings - totalDeductions;

                        return (
                          <div className="bg-[#2b4c7e] text-white p-2 font-bold text-xs flex items-center justify-between border-t border-blue-900">
                            <div>إجمالي الاستحقاقات: <span className="text-emerald-300 font-mono text-sm mr-1">{Number(totalEarnings || 0).toLocaleString()} ج.م</span></div>
                            <div>الصافي: <span className="text-amber-300 font-mono text-base mr-1">{Number(net || 0).toLocaleString()} ج.م</span></div>
                            <div>إجمالي الاستقطاعات: <span className="text-rose-300 font-mono text-sm mr-1">{Number(totalDeductions || 0).toLocaleString()} ج.م</span></div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Step Navigation Bar */}
                    <div className="flex items-center justify-between p-3 bg-white border border-slate-300 rounded text-right">
                      <button
                        type="button"
                        onClick={() => setEmployeeActiveStep(3)}
                        className="px-5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded transition-colors cursor-pointer"
                      >
                        السابق: البيانات الوظيفية (خطوة 3)
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleSaveEmployee(e, 4)}
                          className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>حفظ مكونات الراتب</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleSaveEmployee(e, 5)}
                          className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                        >
                          التالي: ورديات الموظف (خطوة 5)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Employee Shifts & Attendance Rules (ورديات الموظف ورصيد البصمة) */}
              {employeeActiveStep === 5 && (
                <div className="bg-slate-100 rounded-lg border border-slate-300 shadow-sm overflow-hidden p-0 text-right text-xs" dir="rtl">
                  {/* Top Action Header */}
                  <div className="bg-white border-b border-slate-300 p-2.5 px-4 flex items-center justify-between shadow-sm">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span>ورديات الموظف وقواعد الحضور والانصراف</span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleSaveEmployee();
                          alert("تم حفظ ورديات الموظف وقواعد الحضور والانصراف بنجاح");
                        }}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>حفظ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alert("جارٍ فتح نظام المسح الضوئي لبصمة الموظف...")}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded border border-slate-300 transition-colors cursor-pointer"
                      >
                        المسح الضوئي
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4 bg-slate-50/50">
                    {/* Upper Form Section with Clock Face */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      {/* Left: Clock Face Graphic */}
                      <div className="lg:col-span-2 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-300 bg-white shadow-inner flex flex-col items-center justify-center relative mb-2">
                          <span className="text-[10px] font-bold text-slate-600 absolute top-1">XII</span>
                          <span className="text-[10px] font-bold text-slate-600 absolute bottom-1">VI</span>
                          <span className="text-[10px] font-bold text-slate-600 absolute right-2">III</span>
                          <span className="text-[10px] font-bold text-slate-600 absolute left-2">IX</span>
                          {/* Clock Hands */}
                          <div className="w-1 h-7 bg-red-600 rounded-full origin-bottom transform rotate-45 mb-1"></div>
                          <div className="w-1.5 h-5 bg-slate-800 rounded-full origin-bottom transform -rotate-45"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 absolute"></div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">توقيت الورديات</span>
                        <span className="text-[10px] text-slate-400">نظام الحساب الآلي</span>
                      </div>

                      {/* Middle & Right: Multi-column Attendance Fields */}
                      <div className="lg:col-span-10 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-[11px]">
                        {/* Column 1 (Right) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">كود الحضور</label>
                            <div className="flex items-center gap-1 w-full">
                              <input
                                type="text"
                                value={(editingEmployee as any).attendance_code || editingEmployee.code || ""}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, attendance_code: e.target.value } as any)}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-mono text-center"
                              />
                              <select className="bg-white border border-slate-300 rounded px-1 py-1 text-[11px] w-12">
                                <option>▼</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">مجموعة الحضور</label>
                            <input
                              type="text"
                              placeholder="مجموعة أ"
                              value={(editingEmployee as any).attendance_group || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, attendance_group: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">يتبع طريقة حضور وانصراف</label>
                            <select
                              value={(editingEmployee as any).attendance_method || "يتبع طريقة حضور وانصراف"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, attendance_method: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="يتبع طريقة حضور وانصراف">يتبع طريقة حضور وانصراف</option>
                              <option value="عدم اتباع حضور وانصراف">عدم اتباع حضور وانصراف</option>
                              <option value="بصمة إلكترونية">بصمة إلكترونية</option>
                              <option value="كارت مغناطيسي">كارت مغناطيسي</option>
                              <option value="توقيع يدوي">توقيع يدوي</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">نوع وردية الحضور للموظف</label>
                            <select
                              value={(editingEmployee as any).shift_type_option || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, shift_type_option: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="ثابتة">وردية ثابتة</option>
                              <option value="متغيرة / دوارة">وردية متغيرة / دوارة</option>
                              <option value="مرنة">ساعات مرنة</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">مكافئ الأجازة</label>
                            <select
                              value={(editingEmployee as any).vacation_equivalent || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, vacation_equivalent: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="يوم كامل">يوم كامل</option>
                              <option value="نصف يوم">نصف يوم</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">الحد الأقصى للإضافي</label>
                            <input
                              type="text"
                              placeholder="ساعات"
                              value={(editingEmployee as any).max_overtime_hours || "4"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, max_overtime_hours: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">عدد ايام العمل</label>
                            <input
                              type="text"
                              placeholder="مثال: 26"
                              value={(editingEmployee as any).work_days_count || "26"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, work_days_count: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">مكافئ الساعة المسائية</label>
                            <select
                              value={(editingEmployee as any).evening_hour_equiv || "1.25"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, evening_hour_equiv: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="1.0">1.0 (عادي)</option>
                              <option value="1.25">1.25 (ساعة وربع)</option>
                              <option value="1.5">1.5 (ساعة ونصف)</option>
                            </select>
                          </div>
                        </div>

                        {/* Column 2 (Middle) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">يعمل بالساعة</label>
                            <select
                              value={(editingEmployee as any).works_hourly || "لا"}
                              onChange={(e) => {
                                const val = e.target.value;
                                const basic = parseFloat((editingEmployee as any).basic_salary) || 0;
                                const days = parseInt((editingEmployee as any).work_days_count || (editingEmployee as any).work_days) || 30;
                                const shiftHours = 8;
                                const autoRate = (days > 0 && shiftHours > 0) ? ((basic / days) / shiftHours).toFixed(2) : "0.00";
                                const currentRate = (editingEmployee as any).new_hour_rate;
                                setEditingEmployee({
                                  ...editingEmployee,
                                  works_hourly: val,
                                  new_hour_rate: (val === "نعم" && (!currentRate || currentRate === "0.00" || currentRate === "0")) ? autoRate : currentRate
                                } as any);
                              }}
                              className={`w-full border rounded px-2 py-1 text-[11px] font-bold ${
                                (editingEmployee as any).works_hourly === "نعم"
                                  ? "bg-purple-50 border-purple-400 text-purple-800"
                                  : "bg-white border-slate-300 text-slate-800"
                              }`}
                            >
                              <option value="لا">لا</option>
                              <option value="نعم">نعم (حساب بالساعة والدقيقة)</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">عدد أذون التأخير</label>
                            <input
                              type="number"
                              value={(editingEmployee as any).delay_permissions || "2"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, delay_permissions: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">حالة الساعة</label>
                            <select
                              value={(editingEmployee as any).hour_status || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, hour_status: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="ساعة قياسية">ساعة قياسية</option>
                              <option value="ساعة مضاعفة">ساعة مضاعفة</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">نسبة الأجازة من بدل حضور</label>
                            <select
                              value={(editingEmployee as any).vac_attendance_allowance || "no"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, vac_attendance_allowance: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="no">no</option>
                              <option value="yes">yes</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">سعر ساعة الاضافي</label>
                            <select
                              value={(editingEmployee as any).overtime_rate || "- اختر -"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, overtime_rate: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="- اختر -">- اختر -</option>
                              <option value="1.35">1.35%</option>
                              <option value="1.50">1.50%</option>
                              <option value="2.00">2.00%</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">عدد أذون الخروج</label>
                            <select
                              value={(editingEmployee as any).exit_permissions || "2"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, exit_permissions: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">حساب حد أقصى للإضافي</label>
                            <select
                              value={(editingEmployee as any).calc_max_overtime || "لا"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, calc_max_overtime: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="لا">لا</option>
                              <option value="نعم">نعم</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">مقابل حضور</label>
                            <select
                              value={(editingEmployee as any).attendance_allowance || "لا"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, attendance_allowance: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="لا">لا</option>
                              <option value="نعم">نعم</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <label className="text-slate-700 font-bold w-32 shrink-0">سعر الساعه للموظف</label>
                              <input
                                type="text"
                                value={(editingEmployee as any).new_hour_rate !== undefined ? (editingEmployee as any).new_hour_rate : "0.00"}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, new_hour_rate: e.target.value } as any)}
                                placeholder="0.00"
                                className={`w-full border rounded px-2 py-1 text-[11px] font-bold ${
                                  (editingEmployee as any).works_hourly === "نعم"
                                    ? "bg-purple-50 border-purple-300 text-purple-900"
                                    : "bg-white border-slate-300 text-slate-900"
                                }`}
                              />
                            </div>
                            {(editingEmployee as any).works_hourly === "نعم" && (
                              <p className="text-[10px] text-purple-700 font-medium bg-purple-50 p-1 rounded border border-purple-200">
                                ⏱️ يحسب الراتب بالساعة والدقيقة من إجمالي ساعات الحضور الشهرية
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Column 3 (Left) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">دمج عدد الأذون</label>
                            <select
                              value={(editingEmployee as any).merge_permissions || "لا"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, merge_permissions: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            >
                              <option value="لا">لا</option>
                              <option value="نعم">نعم</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">رصيد بصمة الحضور</label>
                            <div className="flex items-center gap-1 w-full">
                              <span className="text-[10px] text-slate-500 shrink-0">دقيقة</span>
                              <input
                                type="number"
                                placeholder="دقيقة"
                                value={(editingEmployee as any).attendance_fingerprint_balance || "120"}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, attendance_fingerprint_balance: e.target.value } as any)}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <label className="text-slate-700 font-bold w-32 shrink-0">عدد المناوبات لتغير سعر الساعة</label>
                            <input
                              type="number"
                              value={(editingEmployee as any).shifts_count_rate_change || "0"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, shifts_count_rate_change: e.target.value } as any)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                            />
                          </div>

                          <div className="pt-2 space-y-1">
                            <select className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]">
                              <option>- اختر -</option>
                              <option>نسبة افتراضية</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">%</span>
                              <input type="text" className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">%</span>
                              <input type="text" className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Blue Divider Line */}
                    <div className="h-1 bg-blue-500 rounded-full w-full"></div>

                    {/* Shifts Selection & Table Section */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        {/* Search by Shift Number or Shift Name */}
                        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                          <div className="relative w-full">
                            <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="ابحث برقم الوردية أو اسمها (مثال: 101 أو صباحية)..."
                              value={(editingEmployee as any).shift_search_query || ""}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, shift_search_query: e.target.value } as any)}
                              className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold focus:ring-2 focus:ring-blue-500 text-slate-800"
                            />
                            {((editingEmployee as any).shift_search_query) && (
                              <button
                                type="button"
                                onClick={() => setEditingEmployee({ ...editingEmployee, shift_search_query: "" } as any)}
                                className="absolute left-2 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Filtered Dropdown & Add Button */}
                        <div className="flex items-center gap-2">
                          <select
                            value={(editingEmployee as any).selected_shift_to_add || ""}
                            onChange={(e) => setEditingEmployee({ ...editingEmployee, selected_shift_to_add: e.target.value } as any)}
                            className="bg-white text-slate-800 border border-slate-300 rounded px-3 py-1.5 text-xs font-bold min-w-[260px] focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- اختر وردية من القائمة --</option>
                            {(() => {
                              const searchQ = ((editingEmployee as any).shift_search_query || "").trim().toLowerCase();
                              const availableList = shifts.length > 0 ? shifts.map((s, idx) => ({
                                id: s.id || (101 + idx),
                                code: (s as any).code || `10${idx + 1}`,
                                name: s.name,
                                start_time: s.start_time,
                                end_time: s.end_time,
                                total_hours: s.total_hours || 8
                              })) : [
                                { id: 101, code: "101", name: "الوردية الصباحية العامة", start_time: "08:00 ص", end_time: "04:00 م", total_hours: 8 },
                                { id: 102, code: "102", name: "الوردية المسائية", start_time: "04:00 م", end_time: "12:00 م", total_hours: 8 },
                                { id: 103, code: "103", name: "الوردية الليلية", start_time: "12:00 م", end_time: "08:00 ص", total_hours: 8 },
                                { id: 104, code: "104", name: "نبطشية 24 ساعة", start_time: "08:00 ص", end_time: "08:00 ص", total_hours: 24 }
                              ];

                              const filtered = availableList.filter((s) => {
                                if (!searchQ) return true;
                                const idStr = String(s.id).toLowerCase();
                                const codeStr = String(s.code).toLowerCase();
                                const nameStr = (s.name || "").toLowerCase();
                                return idStr.includes(searchQ) || codeStr.includes(searchQ) || nameStr.includes(searchQ);
                              });

                              if (filtered.length === 0) {
                                return <option value="" disabled>لا توجد ورديات تطابق البحث "{searchQ}"</option>;
                              }

                              return filtered.map((s) => (
                                <option key={s.id} value={s.code}>
                                  [رقم الوردية: {s.code}] - {s.name} ({s.start_time} - {s.end_time})
                                </option>
                              ));
                            })()}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              const searchQ = ((editingEmployee as any).shift_search_query || "").trim().toLowerCase();
                              let selCode = (editingEmployee as any).selected_shift_to_add;

                              const availableList = shifts.length > 0 ? shifts.map((s, idx) => ({
                                id: s.id || (101 + idx),
                                code: (s as any).code || `10${idx + 1}`,
                                name: s.name,
                                start_time: s.start_time,
                                end_time: s.end_time,
                                total_hours: s.total_hours || 8
                              })) : [
                                { id: 101, code: "101", name: "الوردية الصباحية العامة", start_time: "08:00 ص", end_time: "04:00 م", total_hours: 8 },
                                { id: 102, code: "102", name: "الوردية المسائية", start_time: "04:00 م", end_time: "12:00 م", total_hours: 8 },
                                { id: 103, code: "103", name: "الوردية الليلية", start_time: "12:00 م", end_time: "08:00 ص", total_hours: 8 },
                                { id: 104, code: "104", name: "نبطشية 24 ساعة", start_time: "08:00 ص", end_time: "08:00 ص", total_hours: 24 }
                              ];

                              // If no dropdown value selected but user typed a search query matching a shift code/number or name
                              let matchedShift = availableList.find(s => s.code === selCode);
                              if (!matchedShift && searchQ) {
                                matchedShift = availableList.find(s =>
                                  String(s.code).toLowerCase() === searchQ ||
                                  String(s.id).toLowerCase() === searchQ ||
                                  s.name.toLowerCase().includes(searchQ)
                                );
                              }
                              if (!matchedShift) {
                                matchedShift = availableList[0];
                              }

                              const currentShifts = (editingEmployee as any).assigned_shifts || [
                                { id: 1, code: "101", name: "الوردية الصباحية العامة", start_time: "08:00 ص", end_time: "04:00 م", thursday: "عمل", friday: "راحة", hour_rate: "50 ج.م", total_hours: "8 ساعات", is_primary: true, position: editingEmployee.position || "كل الوظائف" },
                                { id: 2, code: "102", name: "الوردية المسائية", start_time: "04:00 م", end_time: "12:00 م", thursday: "عمل", friday: "راحة", hour_rate: "60 ج.م", total_hours: "8 ساعات", is_primary: false, position: editingEmployee.position || "كل الوظائف" }
                              ];

                              const newShiftItem = {
                                id: Date.now(),
                                code: matchedShift.code,
                                shift_number: matchedShift.code,
                                name: matchedShift.name,
                                start_time: matchedShift.start_time,
                                end_time: matchedShift.end_time,
                                thursday: "عمل",
                                friday: "راحة",
                                hour_rate: "50 ج.م",
                                total_hours: `${matchedShift.total_hours} ساعات`,
                                is_primary: currentShifts.length === 0,
                                position: editingEmployee.position || editingEmployee.job_title || "كل الوظائف"
                              };

                              setEditingEmployee({
                                ...editingEmployee,
                                assigned_shifts: [...currentShifts, newShiftItem],
                                selected_shift_to_add: "",
                                shift_search_query: ""
                              } as any);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm shrink-0"
                            title="إضافة وردية"
                          >
                            <Plus className="w-4 h-4" />
                            <span>إضافة الوردية</span>
                          </button>
                        </div>
                      </div>

                      {/* Shifts Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-center border-collapse">
                          <thead>
                            <tr className="bg-[#1e3a8a] text-white font-bold">
                              <th className="p-2 border-r border-blue-900 w-28">وردية أساسية<br/><span className="text-[10px] font-normal text-amber-200">(يمكن اختيار أكثر من وردية)</span></th>
                              <th className="p-2 border-r border-blue-900 w-28">اجمالي الوردي</th>
                              <th className="p-2 border-r border-blue-900 w-24">سعر الساعة</th>
                              <th className="p-2 border-r border-blue-900 w-20">الجمعة</th>
                              <th className="p-2 border-r border-blue-900 w-20">الخميس</th>
                              <th className="p-2 border-r border-blue-900 min-w-[140px] text-amber-300">الوظيفة (تخصيص وظيفي)</th>
                              <th className="p-2 border-r border-blue-900 w-24">وقت النهاية</th>
                              <th className="p-2 border-r border-blue-900 w-24">وقت البداية</th>
                              <th className="p-2 border-r border-blue-900 min-w-[150px]">الاسم</th>
                              <th className="p-2 border-r border-blue-900 w-20">الكود</th>
                              <th className="p-2 w-12">حذف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {((editingEmployee as any).assigned_shifts || [
                              { id: 1, code: "SH-01", name: "الوردية الصباحية العامة", start_time: "08:00 ص", end_time: "04:00 م", thursday: "عمل", friday: "راحة", hour_rate: "50 ج.م", total_hours: "8 ساعات", is_primary: true, position: editingEmployee.position || "كل الوظائف" },
                              { id: 2, code: "SH-02", name: "الوردية المسائية", start_time: "04:00 م", end_time: "12:00 م", thursday: "عمل", friday: "راحة", hour_rate: "60 ج.م", total_hours: "8 ساعات", is_primary: false, position: editingEmployee.position || "كل الوظائف" }
                            ]).map((sItem: any, sIdx: number) => {
                              const shiftsList = [...((editingEmployee as any).assigned_shifts || [
                                { id: 1, code: "SH-01", name: "الوردية الصباحية العامة", start_time: "08:00 ص", end_time: "04:00 م", thursday: "عمل", friday: "راحة", hour_rate: "50 ج.م", total_hours: "8 ساعات", is_primary: true, position: editingEmployee.position || "كل الوظائف" },
                                { id: 2, code: "SH-02", name: "الوردية المسائية", start_time: "04:00 م", end_time: "12:00 م", thursday: "عمل", friday: "راحة", hour_rate: "60 ج.م", total_hours: "8 ساعات", is_primary: false, position: editingEmployee.position || "كل الوظائف" }
                              ])];

                              const updateShift = (field: string, val: any) => {
                                if (field === "is_primary") {
                                  // السماح بتحديد أكثر من وردية أساسية: نبدّل حالة الصف الحالي فقط دون لمس بقية الصفوف
                                  shiftsList[sIdx] = { ...shiftsList[sIdx], is_primary: val };
                                } else {
                                  shiftsList[sIdx] = { ...shiftsList[sIdx], [field]: val };
                                }
                                setEditingEmployee({ ...editingEmployee, assigned_shifts: shiftsList } as any);
                              };

                              return (
                                <tr key={sItem.id || sIdx} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-1.5 border-r border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={sItem.is_primary}
                                      onChange={(e) => updateShift("is_primary", e.target.checked)}
                                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                                    />
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200 font-bold text-slate-700">
                                    {sItem.total_hours}
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200">
                                    <div className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-center text-xs font-semibold text-slate-600">
                                      {sItem.hour_rate}
                                    </div>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200">
                                    <select
                                      value={sItem.friday ?? ""}
                                      onChange={(e) => updateShift("friday", e.target.value)}
                                      className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-xs text-center font-bold text-slate-700"
                                    >
                                      <option value="راحة">راحة</option>
                                      <option value="عمل">عمل</option>
                                      <option value="إضافي">إضافي</option>
                                    </select>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200">
                                    <select
                                      value={sItem.thursday ?? ""}
                                      onChange={(e) => updateShift("thursday", e.target.value)}
                                      className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-xs text-center font-bold text-slate-700"
                                    >
                                      <option value="عمل">عمل</option>
                                      <option value="راحة">راحة</option>
                                      <option value="إضافي">إضافي</option>
                                    </select>
                                  </td>
                                  {/* JOB TITLE / POSITION ALLOCATION COLUMN */}
                                  <td className="p-1.5 border-r border-slate-200 bg-amber-50/50">
                                    <div className="w-full bg-amber-50 border border-amber-200 rounded px-1.5 py-1 text-xs font-bold text-amber-800 text-center">
                                      {sItem.position || editingEmployee.position || "كل الوظائف"}
                                    </div>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200">
                                    <div className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs font-semibold text-slate-700 text-center">
                                      {sItem.end_time}
                                    </div>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200">
                                    <div className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs font-semibold text-slate-700 text-center">
                                      {sItem.start_time}
                                    </div>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200 font-bold text-slate-800 text-right">
                                    <div className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-800 text-right">
                                      {sItem.name}
                                    </div>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200 font-mono text-center font-bold text-slate-600">
                                    {sItem.code}
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = shiftsList.filter((_, i) => i !== sIdx);
                                        setEditingEmployee({ ...editingEmployee, assigned_shifts: updated } as any);
                                      }}
                                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4 mx-auto" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer Controls */}
                  <div className="bg-slate-200 border-t border-slate-300 p-3 px-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEmployeeActiveStep(4)}
                      className="px-5 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold text-xs rounded transition-colors cursor-pointer"
                    >
                      السابق: مكونات الراتب (خطوة 4)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleSaveEmployee(e, 5)}
                        className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>حفظ ورديات الموظف</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleSaveEmployee(e, 6)}
                        className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                      >
                        التالي: مرفقات الموظف (خطوة 6)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Employee Attachments & Document Management (مرفقات الموظف) */}
              {employeeActiveStep === 6 && (
                <div className="bg-slate-100 rounded-2xl border border-slate-300 shadow-sm overflow-hidden p-0 text-right text-xs" dir="rtl">
                  {/* Header Actions */}
                  <div className="bg-white border-b border-slate-300 p-4 px-6 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-inner">
                        <Paperclip className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-800">مرفقات ومستندات الموظف الرسمية</h2>
                        <p className="text-xs text-slate-500 font-medium">إدارة المستندات والعقود، بطاقة الهوية، والشهادات الرسمية للموظف مع المعاينة والطباعة الفورية</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleSaveEmployee();
                          alert("تم حفظ ملف ومرفقات الموظف بنجاح");
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        <span>حفظ المرفقات</span>
                      </button>

                      <label className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm active:scale-95">
                        <Upload className="w-4 h-4" />
                        <span>رفع مستند جديد</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx"
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            const existingDocs = Array.isArray((editingEmployee as any).documents) ? (editingEmployee as any).documents : [];
                            const newUploaded = await Promise.all(files.map(f => new Promise<any>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                resolve({
                                  id: Date.now() + Math.random(),
                                  name: f.name.split('.')[0] || 'مستند مرفق',
                                  category: 'مستند عام',
                                  fileName: f.name,
                                  uploadDate: new Date().toISOString().split('T')[0],
                                  expiryDate: 'غير محدد',
                                  size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                                  status: 'مرفوع',
                                  fileUrl: (event.target?.result as string) || ''
                                });
                              };
                              reader.onerror = () => {
                                resolve({
                                  id: Date.now() + Math.random(),
                                  name: f.name.split('.')[0] || 'مستند مرفق',
                                  category: 'مستند عام',
                                  fileName: f.name,
                                  uploadDate: new Date().toISOString().split('T')[0],
                                  expiryDate: 'غير محدد',
                                  size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                                  status: 'مرفوع',
                                  fileUrl: ''
                                });
                              };
                              reader.readAsDataURL(f);
                            })));
                            const updatedDocuments = [...existingDocs, ...newUploaded];
                            setEditingEmployee({
                              ...editingEmployee,
                              documents: updatedDocuments
                            } as any);
                            alert(`تم رفع ${files.length} مستند بنجاح! يمكنك الآن معاينتها وطباعتها.`);
                            if (newUploaded[0]) {
                              handleOpenDocPreview(newUploaded[0]);
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer active:scale-95"
                        title="طباعة تقرير المرفقات"
                      >
                        <Printer className="w-4 h-4" />
                        <span>طباعة</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-5 bg-slate-50/70">
                    {/* Completion Progress Banner */}
                    {(() => {
                      const docs = Array.isArray((editingEmployee as any).documents) ? (editingEmployee as any).documents : [];
                      const requiredTypes = [
                        "بطاقة الرقم القومي",
                        "عقد العمل",
                        "فيش وتشبيه",
                        "المؤهل الدراسي",
                        "شهادة الميلاد",
                        "الموقف من التجنيد",
                        "صورة شخصية"
                      ];
                      const uploadedCount = docs.length;
                      const progressPct = Math.min(100, Math.round((uploadedCount / requiredTypes.length) * 100));
                      return (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 w-full sm:w-auto">
                            <div className="w-13 h-13 rounded-2xl border-4 border-blue-600 bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm shrink-0 shadow-inner">
                              {progressPct}%
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 text-sm">نسبة استكمال أوراق ومستندات الموظف</span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {uploadedCount} من {requiredTypes.length} مكتملة
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 font-medium">اضغط على أي مستند لمعاينته بالحجم الكامل أو طباعته فوراً، أو استخدم زر رفع المستند</p>
                            </div>
                          </div>
                          <div className="w-full sm:w-72 bg-slate-200 rounded-full h-3 overflow-hidden p-0.5 border border-slate-300/60">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500 shadow-sm" style={{ width: `${progressPct}%` }}></div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Standard Checklist Grid */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <FileCheck className="w-5 h-5 text-blue-600" />
                          <span>قائمة المستندات والأوراق الرسمية الأساسية (انقر للمعاينة والطباعة)</span>
                        </h3>
                        <span className="text-xs text-slate-500 font-semibold">
                          انقر على أي بطاقة لعرض صورة المستند وإمكانية طباعته
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                        {[
                          { title: "صورة بطاقة الرقم القومي", desc: "وجهان متقابلان ساريان", cat: "بطاقة هويّة", req: true, icon: CreditCard },
                          { title: "عقد العمل المبرم", desc: "العقد الاصلي المكتوب والموقع", cat: "عقود", req: true, icon: FileText },
                          { title: "فيش وتشبيه (صحيفة جنائية)", desc: "حديث وموجه للشركة", cat: "مستندات رسمية", req: true, icon: ShieldCheck },
                          { title: "شهادة المؤهل الدراسي", desc: "البكالوريوس / الليسانس / الدبلوم", cat: "شهادات", req: true, icon: GraduationCap },
                          { title: "شهادة الميلاد المميكنة", desc: "أصل الشهادة الكمبيوتر الحديثة", cat: "شهادات", req: true, icon: CalendarDays },
                          { title: "الموقف من التجنيد", desc: "أداء الخدمة العسكرية أو الإعفاء", cat: "مستندات رسمية", req: true, icon: UserCheck },
                          { title: "الصورة الشخصية", desc: "صورة خلفية بيضاء حديثة", cat: "صور", req: true, icon: User },
                          { title: "إقرار الاستلام والسياسات", desc: "موقع ومعتمد من الموظف", cat: "إقرارات", req: false, icon: FileCheck }
                        ].map((item, idx) => {
                          const currentDocs = Array.isArray((editingEmployee as any).documents) ? (editingEmployee as any).documents : [];
                          const foundDoc = currentDocs.find((d: any) =>
                            d.name?.toLowerCase().includes(item.title.toLowerCase()) ||
                            item.title.toLowerCase().includes(d.name?.toLowerCase() || '') ||
                            (d.category && d.category.toLowerCase().includes(item.cat.toLowerCase()))
                          );
                          const ItemIcon = item.icon;
                          const hasFileUrl = Boolean(foundDoc?.fileUrl || foundDoc?.file_url);
                          const isImgUrl = hasFileUrl && (
                            (foundDoc.fileUrl || foundDoc.file_url).startsWith('data:image/') ||
                            (foundDoc.fileUrl || foundDoc.file_url).startsWith('blob:') ||
                            Boolean((foundDoc.fileUrl || foundDoc.file_url).match(/\.(jpg|jpeg|png|webp|gif)/i))
                          );

                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                handleOpenDocPreview(foundDoc || {
                                  id: Date.now() + idx,
                                  name: item.title,
                                  title: item.title,
                                  category: item.cat,
                                  status: 'غير مرفوع'
                                }, item.title, item.cat);
                              }}
                              className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer group shadow-sm hover:shadow-md ${
                                foundDoc
                                  ? "bg-emerald-50/70 border-emerald-300 hover:border-emerald-500"
                                  : "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/20"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                      foundDoc ? "bg-emerald-200/80 text-emerald-800" : "bg-blue-100 text-blue-700"
                                    }`}>
                                      <ItemIcon className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-slate-800 text-xs leading-tight line-clamp-2">
                                      {item.title}
                                    </span>
                                  </div>

                                  {foundDoc ? (
                                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg flex items-center gap-1 shrink-0 shadow-sm">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>مرفوع</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg shrink-0">
                                      غير مرفوع
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-slate-500 font-medium mb-3 leading-relaxed">
                                  {item.desc}
                                </p>

                                {/* If Image Uploaded, show nice mini thumbnail */}
                                {isImgUrl && (
                                  <div className="mb-3 rounded-xl overflow-hidden border border-emerald-300 bg-white h-24 flex items-center justify-center relative group/img shadow-inner">
                                    <img
                                      src={foundDoc.fileUrl || foundDoc.file_url}
                                      alt={item.title}
                                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-[11px]">
                                      <Eye className="w-4 h-4" />
                                      <span>معاينة وطباعة</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div
                                className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 mt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {foundDoc ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDocPreview(foundDoc, item.title, item.cat)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                                      title="معاينة المستند والطباعة"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>معاينة وطباعة</span>
                                    </button>

                                    <div className="flex items-center gap-1">
                                      <label className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors" title="تعديل واستبدال الملف">
                                        <Upload className="w-3.5 h-3.5" />
                                        <input
                                          type="file"
                                          accept="image/*,.pdf,.doc,.docx"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                              const updatedList = currentDocs.filter((d: any) => d.id !== foundDoc?.id);
                                              const newDocItem = {
                                                id: Date.now(),
                                                name: item.title,
                                                category: item.cat,
                                                fileName: file.name,
                                                uploadDate: new Date().toISOString().split('T')[0],
                                                expiryDate: 'غير محدد',
                                                size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                                                status: 'مرفوع',
                                                fileUrl: (event.target?.result as string) || ''
                                              };
                                              setEditingEmployee({
                                                ...editingEmployee,
                                                documents: [...updatedList, newDocItem]
                                              } as any);
                                              alert(`تم استبدال مستند "${item.title}" بنجاح!`);
                                              handleOpenDocPreview(newDocItem, item.title, item.cat);
                                            };
                                            reader.readAsDataURL(file);
                                          }}
                                        />
                                      </label>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`هل تريد حذف مستند "${item.title}"؟`)) {
                                            const updatedList = currentDocs.filter((d: any) => d.id !== foundDoc?.id);
                                            setEditingEmployee({
                                              ...editingEmployee,
                                              documents: updatedList
                                            } as any);
                                          }
                                        }}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                                        title="حذف المستند"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all shadow-sm active:scale-95">
                                      <Upload className="w-3.5 h-3.5" />
                                      <span>رفع المستند</span>
                                      <input
                                        type="file"
                                        accept="image/*,.pdf,.doc,.docx"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            const updatedList = currentDocs.filter((d: any) => d.id !== foundDoc?.id);
                                            const newDocItem = {
                                              id: Date.now(),
                                              name: item.title,
                                              category: item.cat,
                                              fileName: file.name,
                                              uploadDate: new Date().toISOString().split('T')[0],
                                              expiryDate: 'غير محدد',
                                              size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                                              status: 'مرفوع',
                                              fileUrl: (event.target?.result as string) || ''
                                            };
                                            setEditingEmployee({
                                              ...editingEmployee,
                                              documents: [...updatedList, newDocItem]
                                            } as any);
                                            alert(`تم رفع مستند "${item.title}" بنجاح! يمكنك الآن معاينته وطباعته.`);
                                            handleOpenDocPreview(newDocItem, item.title, item.cat);
                                          };
                                          reader.readAsDataURL(file);
                                        }}
                                      />
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleOpenDocPreview({
                                          id: Date.now() + idx,
                                          name: item.title,
                                          title: item.title,
                                          category: item.cat,
                                          status: 'نموذج رسمي'
                                        }, item.title, item.cat);
                                      }}
                                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 p-1 hover:bg-slate-200/60 rounded-lg transition-colors"
                                      title="معاينة وطباعة النموذج"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                                      <span>معاينة النموذج</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Drag and Drop Upload Dropzone */}
                    <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/20 text-center relative hover:bg-blue-50/40 transition-colors shadow-sm">
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          const existingDocs = Array.isArray((editingEmployee as any).documents) ? (editingEmployee as any).documents : [];
                          const newUploaded = await Promise.all(files.map(f => new Promise<any>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              resolve({
                                id: Date.now() + Math.random(),
                                name: f.name.split('.')[0] || 'مستند مرفق',
                                category: 'مستند عام',
                                fileName: f.name,
                                uploadDate: new Date().toISOString().split('T')[0],
                                expiryDate: 'غير محدد',
                                size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                                status: 'مرفوع',
                                fileUrl: (event.target?.result as string) || ''
                              });
                            };
                            reader.onerror = () => {
                              resolve({
                                id: Date.now() + Math.random(),
                                name: f.name.split('.')[0] || 'مستند مرفق',
                                category: 'مستند عام',
                                fileName: f.name,
                                uploadDate: new Date().toISOString().split('T')[0],
                                expiryDate: 'غير محدد',
                                size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                                status: 'مرفوع',
                                fileUrl: ''
                              });
                            };
                            reader.readAsDataURL(f);
                          })));
                          setEditingEmployee({
                            ...editingEmployee,
                            documents: [...existingDocs, ...newUploaded]
                          } as any);
                          alert(`تم رفع ${files.length} ملف بنجاح عبر السحب والإفلات!`);
                          if (newUploaded[0]) {
                            handleOpenDocPreview(newUploaded[0]);
                          }
                        }}
                      />
                      <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                          <UploadCloud className="w-7 h-7" />
                        </div>
                        <span className="font-black text-slate-800 text-sm">اسحب وأفلت المستندات أو الصور هنا لرفعها مباشرة</span>
                        <span className="text-xs text-slate-500 font-medium">يدعم صور الهوية والعقود بصيغ PDF, PNG, JPG, DOCX بحجم أقصى 25 ميجابايت للملف</span>
                      </div>
                    </div>

                    {/* All Uploaded Documents Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-800">
                              سجل المستندات والمرفقات المرفوعة للموظف ({((editingEmployee as any).documents || []).length})
                            </h3>
                            <p className="text-xs text-slate-500">انقر على أيقونة المعاينة أو الطباعة لاستعراض المستند وطباعته بجودة عالية</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const name = prompt('أدخل اسم المستند الجديد:');
                            if (!name) return;
                            const cat = prompt('نوع المستند (بطاقة هويّة / عقود / شهادات / مستند عام):', 'مستند عام') || 'مستند عام';
                            const existingDocs = Array.isArray((editingEmployee as any).documents) ? (editingEmployee as any).documents : [];
                            const newDoc = {
                              id: Date.now(),
                              name,
                              category: cat,
                              fileName: `${name.replace(/\s+/g, '_')}.pdf`,
                              uploadDate: new Date().toISOString().split('T')[0],
                              expiryDate: '2028-12-31',
                              size: '1.5 MB',
                              status: 'مرفوع',
                              fileUrl: ''
                            };
                            setEditingEmployee({
                              ...editingEmployee,
                              documents: [...existingDocs, newDoc]
                            } as any);
                            handleOpenDocPreview(newDoc);
                          }}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة مستند يدوياً</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs text-center border-collapse">
                          <thead>
                            <tr className="bg-[#1e3a8a] text-white font-bold">
                              <th className="p-2.5 border-r border-blue-900 w-12">#</th>
                              <th className="p-2.5 border-r border-blue-900 min-w-[160px] text-right">عنوان المستند</th>
                              <th className="p-2.5 border-r border-blue-900 w-28">التصنيف</th>
                              <th className="p-2.5 border-r border-blue-900 min-w-[140px]">اسم الملف</th>
                              <th className="p-2.5 border-r border-blue-900 w-28">تاريخ الرفع</th>
                              <th className="p-2.5 border-r border-blue-900 w-28">تاريخ الانتهاء</th>
                              <th className="p-2.5 border-r border-blue-900 w-20">الحجم</th>
                              <th className="p-2.5 border-r border-blue-900 w-24">الحالة</th>
                              <th className="p-2.5 w-32">الإجراءات والمعاينة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white font-medium">
                            {(Array.isArray((editingEmployee as any).documents) ? (editingEmployee as any).documents : []).map((docItem: any, docIdx: number) => {
                              const docList = [...((editingEmployee as any).documents || [])];
                              const isImg = docItem.fileUrl && (
                                docItem.fileUrl.startsWith('data:image/') ||
                                docItem.fileUrl.startsWith('blob:') ||
                                Boolean(docItem.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)/i))
                              );
                              return (
                                <tr key={docItem.id || docIdx} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 font-bold text-slate-500">
                                    {docIdx + 1}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 font-bold text-slate-800 text-right">
                                    <div className="flex items-center gap-2">
                                      {isImg ? (
                                        <img
                                          src={docItem.fileUrl}
                                          alt={docItem.name}
                                          className="w-7 h-7 rounded object-cover border border-slate-300 shrink-0 cursor-pointer"
                                          onClick={() => handleOpenDocPreview(docItem)}
                                        />
                                      ) : (
                                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                      )}
                                      <input
                                        type="text"
                                        value={docItem.name ?? ''}
                                        onChange={(e) => {
                                          docList[docIdx].name = e.target.value;
                                          setEditingEmployee({ ...editingEmployee, documents: docList } as any);
                                        }}
                                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-right font-bold focus:border-blue-500 focus:outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                                      {docItem.category || 'عام'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 text-slate-600 font-mono text-[11px] dir-ltr text-center">
                                    {docItem.fileName}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 text-slate-600">
                                    {docItem.uploadDate}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 text-slate-600">
                                    <input
                                      type="date"
                                      value={docItem.expiryDate !== 'غير محدد' ? docItem.expiryDate : ''}
                                      onChange={(e) => {
                                        docList[docIdx].expiryDate = e.target.value || 'غير محدد';
                                        setEditingEmployee({ ...editingEmployee, documents: docList } as any);
                                      }}
                                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] text-center focus:border-blue-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200 text-slate-500 text-[11px]">
                                    {docItem.size}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200">
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-200 flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>{docItem.status || 'مرفوع'}</span>
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDocPreview(docItem)}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="معاينة المستند بالحجم الكامل والطباعة"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDocPreview(docItem)}
                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="طباعة المستند"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                      {docItem.fileUrl && (
                                        <a
                                          href={docItem.fileUrl}
                                          download={docItem.fileName}
                                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                                          title="تحميل الملف"
                                        >
                                          <Download className="w-4 h-4" />
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`هل أنت متأكد من حذف ${docItem.name}؟`)) {
                                            const updated = docList.filter((_, i) => i !== docIdx);
                                            setEditingEmployee({ ...editingEmployee, documents: updated } as any);
                                          }
                                        }}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                        title="حذف المستند"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {(!((editingEmployee as any).documents) || (editingEmployee as any).documents.length === 0) && (
                              <tr>
                                <td colSpan={9} className="p-6 text-center text-slate-400 font-medium italic">
                                  لا توجد مستندات مرفوعة لهذا الموظف بعد. استخدم قائمة المستندات أعلاه أو زر الرفع.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer Controls */}
                  <div className="bg-slate-200 border-t border-slate-300 p-4 px-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEmployeeActiveStep(5)}
                      className="px-5 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      السابق: ورديات الموظف (خطوة 5)
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleSaveEmployee(e, 1)}
                        className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        <span>حفظ وإتمام ملف الموظف</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeeActiveStep(1)}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        العودة لقائمة الموظفين (خطوة 1)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "documents" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                        <FileCog className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">ملفات ومستندات جميع الموظفين</h2>
                        <p className="text-xs text-slate-500">اختر موظف لعرض ملفاته أو رفع مستندات جديدة</p>
                      </div>
                    </div>

                    {/* Search & Filter Controls directly inside the tab as requested */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-150 p-2.5 rounded-2xl w-full lg:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder={
                            searchType === "name" ? "ابحث بالاسم (تفصل بينها فاصلة ,)..."
                            : searchType === "code" ? "أدخل كود (تفصل بينها فاصلة ,)..."
                            : "بحث متعدد: أسماء أو أكواد (تفصل بينها فاصلة ,)..."
                          }
                          value={searchQuery ?? ""}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pr-8 pl-3 text-xs focus:outline-none focus:border-purple-500 transition-colors text-slate-900 font-medium"
                        />
                      </div>

                      <select
                        value={searchType ?? ""}
                        onChange={(e) => setSearchType(e.target.value as any)}
                        className="bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 focus:outline-none focus:border-purple-500 transition-colors text-slate-700 text-xs font-bold cursor-pointer"
                        title="طريقة البحث"
                      >
                        <option value="all">بحث شامل</option>
                        <option value="name">بالاسم</option>
                        <option value="code">بالكود</option>
                      </select>

                      <select
                        value={filterDepartmentId ?? ""}
                        onChange={(e) => setFilterDepartmentId(e.target.value ? Number(e.target.value) : "")}
                        className="bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 focus:outline-none focus:border-purple-500 transition-colors text-slate-700 text-xs font-bold cursor-pointer"
                        title="تصفية بالقسم"
                      >
                        <option value="">كل الأقسام</option>
                        {departments.map((dept, idx) => (
                          <option key={`dept-f-${dept.id ?? dept.name}-${idx}`} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterBranchId ?? ""}
                        onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
                        className="bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 focus:outline-none focus:border-purple-500 transition-colors text-slate-700 text-xs font-bold cursor-pointer"
                        title="تصفية بالفرع"
                      >
                        <option value="">كل الفروع</option>
                        {branches.map((branch, idx) => (
                          <option key={`branch-f-${branch.id ?? branch.name}-${idx}`} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterRoleLevel ?? ""}
                        onChange={(e) => setFilterRoleLevel(e.target.value as any)}
                        className="bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 focus:outline-none focus:border-purple-500 transition-colors text-slate-700 text-xs font-bold cursor-pointer"
                        title="تصفية بالمستوى الهيكلي (رؤساء أقسام / مشرفون / موظفون)"
                      >
                        <option value="">كل المستويات</option>
                        <option value="head">👑 رؤساء الأقسام</option>
                        <option value="supervisor">⭐ المشرفون</option>
                        <option value="regular">👤 موظفين عاديين</option>
                      </select>

                      {(searchQuery || filterDepartmentId !== "" || filterBranchId !== "" || filterRoleLevel !== "") && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setSearchType("all");
                            setFilterDepartmentId("");
                            setFilterBranchId("");
                            setFilterRoleLevel("");
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all border border-rose-150"
                        >
                          إعادة تعيين
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div className="text-center p-12 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-slate-500 font-bold text-sm">لا يوجد موظفين يطابقون خيارات البحث أو التصفية الحالية.</p>
                      <p className="text-slate-400 text-xs mt-1">يرجى تغيير الكلمات الدليلة للبحث أو اختيار أقسام/فروع أخرى.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredEmployees.slice(0, 50).map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => handleOpenDocuments(emp)}
                          className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-all"
                        >
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                            {(emp.name || "م").charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate">{emp.name}</p>
                            <p className="text-xs text-slate-500">{(emp as any).employee_code || emp.fingerprint_code || `#${emp.id}`}</p>
                          </div>
                          <FileCog className="w-4 h-4 text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "hr_settings" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                        <FileCog className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">إعدادات الموارد البشرية العامة</h2>
                        <p className="text-xs text-slate-500">هذه الإعدادات تؤثر على كل مكونات المديول (الإجازات، الرواتب، الجزاءات، العقود)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("organizations")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>إدارة المؤسسات والشركات</span>
                    </button>
                  </div>
                  {hrSettingsLoading ? (
                    <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">أيام الإجازة السنوية الافتراضية</label>
                        <input type="number" value={hrSettings.annual_leave_days ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, annual_leave_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                        <p className="text-xs text-slate-400">يُطبق عند إنشاء موظف جديد</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">أيام الإجازة المرضية الافتراضية</label>
                        <input type="number" value={hrSettings.sick_leave_days ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, sick_leave_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">أيام الإجازة العارضة الافتراضية</label>
                        <input type="number" value={hrSettings.casual_leave_days ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, casual_leave_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">فترة التجربة (أيام)</label>
                        <input type="number" value={hrSettings.probation_days ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, probation_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                        <p className="text-xs text-slate-400">تُستخدم لحساب تاريخ نهاية التجربة تلقائياً</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">تنبيه انتهاء العقد قبل (أيام)</label>
                        <input type="number" value={hrSettings.contract_expiry_alert_days ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, contract_expiry_alert_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                        <p className="text-xs text-slate-400">يظهر تنبيه في اللوحة الاحترافية</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">سن التقاعد</label>
                        <input type="number" value={hrSettings.retirement_age ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, retirement_age: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">أيام العمل الشهرية الافتراضية</label>
                        <input type="number" value={hrSettings.default_work_days ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, default_work_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                        <p className="text-xs text-slate-400">يُستخدم في حساب الراتب اليومي</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">ساعات العمل اليومية الافتراضية</label>
                        <input type="number" value={hrSettings.default_daily_hours ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, default_daily_hours: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">معامل حساب overtime</label>
                        <input type="number" step="0.1" value={hrSettings.overtime_multiplier ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, overtime_multiplier: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                        <p className="text-xs text-slate-400">مثال: 1.5 يعني ساعة إضافية = 1.5 × السعر الأصلي</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600">مهلة التأخير بالدقائق</label>
                        <input type="number" value={hrSettings.late_grace_minutes ?? ""} onChange={(e) => setHrSettings({ ...hrSettings, late_grace_minutes: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-purple-500" />
                        <p className="text-xs text-slate-400">التأخير أقل من هذا الرقم لا يُحسب كجزاء</p>
                      </div>
                      <div className="space-y-2 flex items-center gap-3 pt-6">
                        <input type="checkbox" id="halfDayLeave" checked={hrSettings.allow_half_day_leave} onChange={(e) => setHrSettings({ ...hrSettings, allow_half_day_leave: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                        <label htmlFor="halfDayLeave" className="text-sm font-bold text-slate-600">السماح بالإجازة نصف يوم</label>
                      </div>
                    </div>
                  )}
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleSaveHRSettings}
                      disabled={hrSettingsSaving}
                      className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-lg shadow-purple-600/20"
                    >
                      {hrSettingsSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "organizations" && (
              <OrganizationsManagement />
            )}

            {activeTab === "branches" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branches.map((branch, idx) => (
                  <div
                    key={`branch-card-${branch.id ?? branch.name}-${idx}`}
                    className="bg-white border border-slate-200 p-6 rounded-3xl relative overflow-hidden group shadow-sm"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-emerald-50 flex items-center justify-center text-emerald-600 rounded-2xl">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full">
                          {(branch as any).employee_count || 0} موظف
                        </span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-1 text-slate-900">
                      {branch.name}
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">
                      الموقع غير محدد
                    </p>
                    <div className="flex gap-2 pt-6 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setEditingBranch(branch);
                          setShowBranchModal(true);
                        }}
                        className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-bold text-slate-700 transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete("branches", branch.id)}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setEditingBranch({});
                    setShowBranchModal(true);
                  }}
                  className="bg-white border border-dashed border-slate-300 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-slate-400" />
                  </div>
                  <span className="font-bold text-slate-500">
                    إضافة فرع جديد
                  </span>
                </button>
              </div>
            )}

            {activeTab === "departments" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {departments.map((dept, idx) => (
                  <div
                    key={`dept-card-${dept.id ?? dept.name}-${idx}`}
                    className="bg-white border border-slate-200 p-6 rounded-3xl text-center group shadow-sm"
                  >
                    <div className="w-16 h-16 bg-purple-50 flex items-center justify-center text-purple-600 rounded-2xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Building2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-900">
                      {dept.name}
                    </h3>
                    <span className="text-sm font-bold bg-purple-100 text-purple-600 px-4 py-1 rounded-full">
                      {dept.employee_count || 0} موظف نشط
                    </span>
                    <div className="flex gap-2 mt-6 pt-6 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setEditingDept(dept);
                          setShowDeptModal(true);
                        }}
                        className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-bold text-slate-700 transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete("departments", dept.id)}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setEditingDept({});
                    setShowDeptModal(true);
                  }}
                  className="bg-white border border-dashed border-slate-300 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-slate-400" />
                  </div>
                  <span className="font-bold text-slate-500">
                    إضافة قسم جديد
                  </span>
                </button>
              </div>
            )}

            {activeTab === "shifts" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-blue-50 flex items-center justify-center text-blue-600 rounded-2xl">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-lg text-slate-900">
                          {shift.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          إجمالي الساعات: {shift.total_hours} س
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-xs text-emerald-600 font-bold">
                          الحضور المجدول
                        </span>
                        <span className="font-bold font-mono text-emerald-700">
                          {shift.start_time}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                        <span className="text-xs text-red-600 font-bold">
                          الانصراف المجدول
                        </span>
                        <span className="font-bold font-mono text-red-700">
                          {shift.end_time}
                        </span>
                      </div>
                      {shift.grace_period > 0 && (
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                          <span className="text-xs text-purple-600 font-bold">
                            فترة السماح
                          </span>
                          <span className="font-bold font-mono text-purple-700">
                            {shift.grace_period} دقيقة
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingShift(shift);
                          setShowShiftModal(true);
                        }}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-600/20"
                      >
                        تعديل الوردية
                      </button>
                      <button
                        onClick={() => handleDelete("shifts", shift.id)}
                        className="p-3 bg-red-50 hover:bg-red-100 rounded-xl text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setEditingShift({});
                    setShowShiftModal(true);
                  }}
                  className="bg-white border border-dashed border-slate-300 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-slate-400" />
                  </div>
                  <span className="font-bold text-slate-500">
                    إضافة وردية جديدة
                  </span>
                </button>
              </div>
            )}

            {activeTab === "attendance" && (
              <div className="p-6 text-center text-gray-400">
                <p className="text-lg mb-2">إدارة الحضور والانصراف</p>
                <p className="text-sm">يرجى الانتقال لشاشة الحضور من القائمة الرئيسية</p>
              </div>
            )}

            {activeTab === "penalties" && (
              <div className="space-y-6" dir="rtl">
                {/* Header with Title, Stats and Add Button */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Gavel className="w-6 h-6 text-purple-600" />
                        لائحة ومنظومة قوانين الجزاءات
                      </h3>
                      <p className="text-slate-500 text-sm mt-1">
                        تحديد بنود الخصومات والجزاءات التلقائية واليدوية المعتمدة
                        بالجدول
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingPenalty({
                          type: "amount",
                          category: "manual",
                          threshold_minutes: 0,
                        });
                        setShowPenaltyModal(true);
                      }}
                      className="px-5 py-3 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm text-sm"
                    >
                      <Plus className="w-4.5 h-4.5" />
                      إضافة بند لائحة جديد
                    </button>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-red-600">{penalties.filter(p => p.category === 'delay').length}</p>
                      <p className="text-[11px] text-red-400 font-bold">جزاءات تأخير</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-amber-600">{penalties.filter(p => p.category === 'absence').length}</p>
                      <p className="text-[11px] text-amber-400 font-bold">جزاءات غياب</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-orange-600">{penalties.filter(p => p.category === 'early_leave').length}</p>
                      <p className="text-[11px] text-orange-400 font-bold">جزاءات انصراف مبكر</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-slate-600">{penalties.filter(p => p.category === 'manual').length}</p>
                      <p className="text-[11px] text-slate-400 font-bold">جزاءات يدوية / عامة</p>
                    </div>
                  </div>
                </div>

                {/* Penalty Rules Grid */}
                {penalties.length === 0 ? (
                  <div className="bg-white border border-slate-200 p-16 rounded-3xl shadow-sm text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
                      <ShieldAlert className="w-10 h-10 text-red-300" />
                    </div>
                    <p className="text-slate-500 font-bold text-lg mb-2">لا توجد بنود في لائحة الجزاءات</p>
                    <p className="text-slate-400 text-sm mb-6">أضف أول بند جزاء لبدء تنظيم الجزاءات التلقائية واليدوية</p>
                    <button
                      onClick={() => {
                        setEditingPenalty({ type: "amount", category: "manual", threshold_minutes: 0 });
                        setShowPenaltyModal(true);
                      }}
                      className="px-6 py-3 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold inline-flex items-center gap-2 transition-all text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة بند جزاء
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {penalties.map((penalty, idx) => {
                      const categoryConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: any; bar: string }> = {
                        delay: { label: "تأخير", color: "text-red-600", bg: "bg-red-50", border: "border-red-100", icon: Clock, bar: "from-red-500/80 to-red-500/20" },
                        absence: { label: "غياب", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", icon: AlertTriangle, bar: "from-amber-500/80 to-amber-500/20" },
                        early_leave: { label: "انصراف مبكر", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", icon: Zap, bar: "from-orange-500/80 to-orange-500/20" },
                        missing_punch: { label: "نسيان بصمة", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", icon: Target, bar: "from-blue-500/80 to-blue-500/20" },
                        manual: { label: "يدوي / عام", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: FileCog, bar: "from-slate-500/80 to-slate-500/20" },
                      };
                      const cat = categoryConfig[penalty.category || "manual"] || categoryConfig.manual;
                      const CatIcon = cat.icon;

                      return (
                        <div
                          key={penalty.id}
                          className={`bg-white border ${cat.border} p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden`}
                        >
                          {/* Colored top bar */}
                          <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-l ${cat.bar}`} />

                          <div className="flex justify-between items-start mb-4 pt-1">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 ${cat.bg} ${cat.color} flex items-center justify-center rounded-2xl`}>
                                <CatIcon className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-base text-slate-900 leading-tight">
                                  {penalty.name}
                                </h3>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${cat.color} mt-0.5`}>
                                  <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
                                  {cat.label}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">
                              #{penalty.id}
                            </span>
                          </div>

                          <div className={`p-4 ${cat.bg}/50 rounded-2xl mb-4 space-y-2.5`}>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">قيمة الجزاء</span>
                              <span className={`text-xl font-black ${cat.color}`}>
                                {penalty.type === "shift_ratio" ? (
                                  <span className="text-sm">تلقائي ⚡</span>
                                ) : (
                                  <>
                                    {penalty.amount}{" "}
                                    {penalty.type === "amount"
                                      ? "ج.م"
                                      : penalty.type === "days"
                                        ? "يوم"
                                        : penalty.type === "hours"
                                          ? "ساعة"
                                          : penalty.type === "per_minute"
                                            ? "ج.م/دقيقة"
                                            : "ج.م/وحدة"}
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">نوع الخصم</span>
                              <span className="text-sm font-bold text-slate-700">
                                {penalty.type === "amount"
                                  ? "مبلغ مالي ثابت"
                                  : penalty.type === "days"
                                    ? "خصم أيام عمل"
                                    : penalty.type === "hours"
                                      ? "خصم ساعات عمل"
                                      : penalty.type === "per_minute"
                                        ? "خصم بالدقيقة"
                                        : penalty.type === "per_minute_ratio"
                                          ? "خصم دقيقة لكل N دقائق"
                                          : "تلقائي حسب الوردية ⚡"}
                              </span>
                            </div>
                            {(penalty.category === "delay" ||
                              penalty.category === "early_leave") &&
                              (penalty.threshold_minutes || 0) > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-500">
                                    {penalty.type === "per_minute_ratio"
                                      ? "كل N دقيقة"
                                      : "حد التشغيل"}
                                  </span>
                                  <span className="text-sm font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg">
                                    {penalty.type === "per_minute_ratio"
                                      ? `كل ${penalty.threshold_minutes} دقيقة`
                                      : `≥ ${penalty.threshold_minutes} دقيقة`}
                                  </span>
                                </div>
                              )}
                          </div>

                          {penalty.notes && (
                            <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                              {penalty.notes}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                // Open the award modal directly with this penalty pre-filled
                                setAwardPenaltyData({
                                  employee_id: "",
                                  amount: penalty.type === "amount" ? String(penalty.amount) : "",
                                  type: penalty.category || "manual",
                                  date: new Date().toISOString().split("T")[0],
                                  notes: `تنزيل جزاء من اللائحة: ${penalty.name}`,
                                  penalty_rule_id: penalty.id,
                                });
                                setPenaltyCalcExplanation("");
                                setAwardEmpSearch("");
                                setCalcByHour(false);
                                setHourlyRateInfo(null);
                                setShowAwardPenaltyModal(true);
                              }}
                              className="flex-1 py-2.5 bg-[#0a5c5a]/10 hover:bg-[#0a5c5a] text-[#0a5c5a] rounded-xl font-bold transition-colors text-xs flex items-center justify-center gap-1.5"
                              title="تطبيق هذا الجزاء على موظف"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              تطبيق على موظف
                            </button>
                            <button
                              onClick={() => {
                                setEditingPenalty(penalty);
                                setShowPenaltyModal(true);
                              }}
                              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                              title="تعديل البند"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete("penalties", penalty.id)}
                              className="p-2.5 bg-red-50 hover:bg-red-100 rounded-xl text-red-500 transition-colors"
                              title="حذف البند"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add New Card */}
                    <button
                      onClick={() => {
                        setEditingPenalty({
                          type: "amount",
                          category: "manual",
                          threshold_minutes: 0,
                        });
                        setShowPenaltyModal(true);
                      }}
                      className="bg-white border border-dashed border-slate-300 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-all group min-h-[280px]"
                    >
                      <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:scale-110 group-hover:border-[#0a5c5a] transition-all">
                        <Plus className="w-6 h-6 text-slate-400 group-hover:text-[#0a5c5a]" />
                      </div>
                      <span className="font-bold text-slate-500 group-hover:text-[#0a5c5a] transition-colors">
                        إضافة بند لائحة جديد
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "award_penalties" && (
              <div className="space-y-6" dir="rtl">
                {/* 1. Filters container */}
                <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[220px] relative">
                    <label className="block text-slate-600 text-xs font-extrabold mb-2 tracking-wide flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                      اختر موظف للبحث (بالاسم أو الكود)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث باسم الموظف أو الكود ثم اضغط بحث أو Enter..."
                        value={filterEmpSearch ?? ""}
                        onChange={(e) => {
                          setFilterEmpSearch(e.target.value);
                          setFilterEmpDropdownOpen(true);
                          // If the user edits the search text after picking an
                          // employee from the dropdown, the previously-set
                          // employee_id is stale — clear it so the backend
                          // falls back to free-text name search instead of
                          // combining both filters.
                          if (e.target.value === "") {
                            setPenaltiesFilterEmployee("all");
                          }
                        }}
                        onKeyDown={(e) => {
                          // Allow Enter to trigger the search immediately,
                          // matching the user's flow: type a name → press Enter →
                          // sheet below refreshes with that employee's penalties.
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setFilterEmpDropdownOpen(false);
                            fetchDeductions();
                          }
                        }}
                        onFocus={() => setFilterEmpDropdownOpen(true)}
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 pr-10 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:bg-white transition-all text-sm shadow-xs"
                      />
                      <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>

                    {filterEmpDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setFilterEmpDropdownOpen(false)}
                        />
                        <div
                          className="absolute z-50 right-0 left-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl divide-y divide-slate-100"
                          style={{ minWidth: "220px" }}
                        >
                          <div
                            onClick={() => {
                              setPenaltiesFilterEmployee("all");
                              setFilterEmpSearch("كل الموظفين");
                              setFilterEmpDropdownOpen(false);
                            }}
                            className="p-3.5 hover:bg-teal-50/80 cursor-pointer text-sm font-bold text-teal-700 transition-colors flex items-center justify-between"
                          >
                            <span>كل الموظفين</span>
                            <span className="text-xs bg-teal-100/80 text-teal-800 px-2 py-0.5 rounded-full font-bold">الكل</span>
                          </div>
                          {employees
                            .filter((emp) => {
                              const query = filterEmpSearch.toLowerCase();
                              if (query === "كل الموظفين" || !query)
                                return true;
                              return (
                                String(emp.name || "").toLowerCase().includes(query) ||
                                String(emp.fingerprint_code || "").toLowerCase().includes(query) ||
                                String((emp as any).employee_code || "").toLowerCase().includes(query)
                              );
                            })
                            .map((emp) => (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  setPenaltiesFilterEmployee(emp.id);
                                  setFilterEmpSearch(
                                    `${emp.name} (كود: ${emp.fingerprint_code || emp.id})`,
                                  );
                                  setFilterEmpDropdownOpen(false);
                                }}
                                className="p-3.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-sm font-medium transition-colors"
                              >
                                <span className="text-slate-900 font-bold">
                                  {emp.name}
                                </span>
                                <span className="text-[#0a5c5a] text-xs bg-[#0a5c5a]/10 px-2.5 py-1 rounded-lg font-mono font-bold">
                                  كود: {emp.fingerprint_code || emp.id}
                                </span>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-slate-600 text-xs font-extrabold mb-2 tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      من تاريخ
                    </label>
                    <input
                      type="date"
                      value={penaltiesFilterFromDate ?? ""}
                      onChange={(e) =>
                        setPenaltiesFilterFromDate(e.target.value)
                      }
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl p-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:bg-white transition-all text-sm shadow-xs"
                    />
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-slate-600 text-xs font-extrabold mb-2 tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      الى تاريخ
                    </label>
                    <input
                      type="date"
                      value={penaltiesFilterToDate ?? ""}
                      onChange={(e) => setPenaltiesFilterToDate(e.target.value)}
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl p-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 focus:bg-white transition-all text-sm shadow-xs"
                    />
                  </div>

                  <div className="flex gap-2 min-w-[200px]">
                    <button
                      onClick={fetchDeductions}
                      className="flex-1 py-3.5 bg-gradient-to-r from-[#0a5c5a] to-[#0e7471] hover:from-[#084947] hover:to-[#0a5c5a] text-white rounded-2xl font-bold transition-all shadow-md shadow-teal-900/15 hover:shadow-lg text-sm cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Filter className="w-4 h-4" />
                      <span>بحث</span>
                    </button>
                    <button
                      onClick={() => {
                        setPenaltiesFilterEmployee("all");
                        setPenaltiesFilterFromDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
                        setPenaltiesFilterToDate(new Date().toISOString().split("T")[0]);
                      }}
                      className="flex-1 py-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-200/60 rounded-2xl font-bold transition-all text-sm cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>مسح</span>
                    </button>
                  </div>
                </div>

                {/* 2. Top tab row */}
                <div className="flex flex-wrap border border-slate-200/70 mb-6 gap-1.5 bg-slate-100/70 p-1.5 rounded-2xl backdrop-blur-xs">
                  {[
                    { id: "penalties", label: "جزاءات واستقطاعات الموظف" },
                    { id: "absence", label: "غياب موظف" },
                    { id: "overtime_detail", label: "اضافي تفصيلي" },
                    { id: "overtime_review", label: "مراجعة كل الاضافي" },
                    { id: "on_call", label: "On Call" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setPenaltiesActiveTab(tab.id as any)}
                      className={`px-5 py-2.5 font-extrabold text-sm rounded-xl transition-all cursor-pointer ${
                        penaltiesActiveTab === tab.id
                          ? "bg-[#0a5c5a] text-white shadow-md shadow-teal-900/15 scale-[1.02]"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content 1. Applied Penalties Tab */}
                {penaltiesActiveTab === "penalties" && (
                  <div className="space-y-6">
                    {/* Penalty Totals Summary Cards */}
                    {penaltyTotals.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {penaltyTotals.map((t: any) => (
                          <div key={t.employee_id} className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{t.employee_name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{t.penalty_count} جزاء</p>
                              </div>
                              <div className="text-left">
                                <p className="text-lg font-black text-red-600">{Number(t.total_amount || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-red-400 font-bold">ج.م إجمالي الخصم</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800">
                        جزاءات واستقطاعات الموظف المطبقة
                      </h3>
                      <button
                        onClick={() => {
                          setAwardPenaltyData({
                            employee_id: employees[0]?.id || "",
                            amount: "",
                            type: "manual",
                            date: new Date().toISOString().split("T")[0],
                            notes: "",
                            penalty_rule_id: null,
                          });
                          setCalcByHour(false);
                          setHourlyRateInfo(null);
                          setPenaltyCalcExplanation("");
                          setShowAwardPenaltyModal(true);
                        }}
                        className="px-5 py-3 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm text-sm"
                      >
                        <Plus className="w-4.5 h-4.5" />
                        تنزيل جزاء / استقطاع على موظف
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 text-sm border-b border-slate-200">
                              <th className="p-4 font-bold">#</th>
                              <th className="p-4 font-bold">الموظف</th>
                              <th className="p-4 font-bold">التاريخ</th>
                              <th className="p-4 font-bold">تصنيف الجزاء</th>
                              <th className="p-4 font-bold">المصدر</th>
                              <th className="p-4 font-bold">قيمة الخصم</th>
                              <th className="p-4 font-bold">ملاحظات وقرارات</th>
                              <th className="p-4 font-bold">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {getFilteredDeductions().length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="p-12 text-center text-slate-400 font-medium"
                                >
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                      <ShieldAlert className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="text-base">لا يوجد جزاءات أو استقطاعات منزلة على الموظفين في هذه الفترة المحددة</p>
                                    <p className="text-xs text-slate-300">قم بتغيير الفترة أو أضف جزاء / استقطاع جديد باستخدام الزر أعلاه</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              getFilteredDeductions().map((row: any, idx: number) => {
                                const categoryConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
                                  delay: { label: "تأخير", color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
                                  absence: { label: "غياب", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
                                  early_leave: { label: "انصراف مبكر", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
                                  missing_punch: { label: "نسيان بصمة", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
                                  manual: { label: "يدوي / عام", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
                                  penalty: { label: "جزاء إداري", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
                                  deduction: { label: "استقطاع عام", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-100" },
                                  discount: { label: "خصم خاص", color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-100" },
                                  advance: { label: "سلفة / تقسيط", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
                                  insurance: { label: "تأمينات اجتماعية", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-100" },
                                  vacation_deduction: { label: "خصم إجازات", color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-100" },
                                  uniform: { label: "خصم زي / عهدة", color: "text-lime-700", bg: "bg-lime-50", border: "border-lime-100" },
                                  hr: { label: "خصم HR إداري", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
                                };
                                const cat = categoryConfig[row.type] || categoryConfig.manual;
                                const empObj = employees.find((e) => e.id === Number(row.employee_id));
                                return (
                                  <tr
                                    key={row.id}
                                    className="hover:bg-slate-50/50 transition-colors"
                                  >
                                    <td className="p-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                                    <td className="p-4">
                                      <button
                                        onClick={() => empObj && fetchEmployeePenaltyHistory(Number(row.employee_id), empObj)}
                                        className="font-bold text-slate-800 hover:text-[#0a5c5a] transition-colors text-sm cursor-pointer hover:underline"
                                        title="عرض سجل جزاءات الموظف"
                                      >
                                        {row.employee_name || "موظف مجهول"}
                                        {row.fingerprint_code && (
                                          <span className="text-[10px] text-slate-400 font-mono mr-1.5">({row.fingerprint_code})</span>
                                        )}
                                      </button>
                                    </td>
                                    <td className="p-4 font-mono text-slate-600 text-sm">
                                      {row.date}
                                    </td>
                                    <td className="p-4">
                                      <span className={`px-3 py-1 ${cat.bg} ${cat.color} rounded-full text-xs font-bold border ${cat.border}`}>
                                        {cat.label}
                                      </span>
                                    </td>
                                    <td className="p-4">
                                      {row.notes?.includes("خصم تلقائي") ? (
                                        <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-lg text-[11px] font-bold border border-violet-100">تلقائي</span>
                                      ) : row.notes?.includes("جزاء من لائحة الجزاءات") ? (
                                        <span className="px-2.5 py-1 bg-teal-50 text-teal-600 rounded-lg text-[11px] font-bold border border-teal-100">لائحة الجزاءات</span>
                                      ) : (
                                        <span className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[11px] font-bold border border-slate-200">يدوي</span>
                                      )}
                                    </td>
                                    <td className="p-4 font-bold text-red-600">
                                      {Number(row.amount || 0).toLocaleString()} ج.م
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs max-w-[200px] truncate" title={row.notes || ""}>
                                      {row.notes || "-"}
                                    </td>
                                    <td className="p-4">
                                      <div className="flex gap-1.5">
                                        {empObj && (
                                          <button
                                            onClick={() => fetchEmployeePenaltyHistory(Number(row.employee_id), empObj)}
                                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#0a5c5a] transition-colors"
                                            title="سجل جزاءات الموظف"
                                          >
                                            <UserCheck className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() =>
                                            handleDeleteDeduction(row.id)
                                          }
                                          className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors cursor-pointer"
                                          title="حذف الجزاء"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab content 2. Absence Tab */}
                {penaltiesActiveTab === "absence" && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800">
                        سجل غيابات الموظفين
                      </h3>
                      <button
                        onClick={() => {
                          setAbsenceData({
                            employee_id: employees[0]?.id?.toString() || "",
                            date: new Date().toISOString().split("T")[0],
                            type: "غياب بدون إذن",
                            status: "خصم يومين",
                            amount: "150",
                            notes: "",
                          });
                          setShowAbsenceModal(true);
                        }}
                        className="px-5 py-3 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm text-sm"
                      >
                        <Plus className="w-4.5 h-4.5" />
                        سحب غياب جديد
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 text-sm border-b border-slate-200">
                              <th className="p-4 font-bold">الموظف</th>
                              <th className="p-4 font-bold">التاريخ</th>
                              <th className="p-4 font-bold">نوع الغياب</th>
                              <th className="p-4 font-bold">الجزاء / الحالة</th>
                              <th className="p-4 font-bold">ملاحظات</th>
                              <th className="p-4 font-bold">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {getFilteredAbsences().length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="p-12 text-center text-slate-400"
                                >
                                  لا يوجد غيابات مسجلة لهذه الفرز
                                </td>
                              </tr>
                            ) : (
                              getFilteredAbsences().map((row: any) => (
                                <tr
                                  key={row.id}
                                  className="hover:bg-slate-50/50"
                                >
                                  <td className="p-4 font-bold text-slate-800">
                                    {row.employee_name}
                                  </td>
                                  <td className="p-4 font-mono">{row.date}</td>
                                  <td className="p-4 text-amber-600 font-bold">
                                    {row.type}
                                  </td>
                                  <td className="p-4 text-red-500 font-bold">
                                    {row.status}
                                  </td>
                                  <td className="p-4 text-slate-500 text-sm">
                                    {row.notes}
                                  </td>
                                  <td className="p-4">
                                    <button
                                      onClick={() => {
                                        const updated = absences.filter(
                                          (item) => item.id !== row.id,
                                        );
                                        setAbsences(updated);
                                        localStorage.setItem(
                                          "restomaster_absences",
                                          JSON.stringify(updated),
                                        );
                                        alert(
                                          "تم إزالة الغياب من السجل بنجاح!",
                                        );
                                      }}
                                      className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-5 h-5" />
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

                {/* Tab content 3. Detailed Overtime Tab */}
                {penaltiesActiveTab === "overtime_detail" && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-[#0a5c5a]">
                        تفاصيل ومراجعة ساعات العمل الإضافية
                      </h3>
                      <button
                        onClick={() => {
                          setOvertimeData({
                            employee_id: employees[0]?.id?.toString() || "",
                            date: new Date().toISOString().split("T")[0],
                            scheduled_hours: "8",
                            actual_hours: "12",
                            hourly_rate: "30",
                            notes: "",
                          });
                          setShowOvertimeModal(true);
                        }}
                        className="px-5 py-3 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm text-sm"
                      >
                        <Plus className="w-4.5 h-4.5" />
                        إضافة ساعات إضافية
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 text-sm border-b border-slate-200">
                              <th className="p-4 font-bold">الموظف</th>
                              <th className="p-4 font-bold">التاريخ</th>
                              <th className="p-4 font-bold">
                                الوردية المجدولة
                              </th>
                              <th className="p-4 font-bold">
                                ساعات العمل الفعلية
                              </th>
                              <th className="p-4 font-bold">
                                الساعات الإضافية
                              </th>
                              <th className="p-4 font-bold">سعر الساعة</th>
                              <th className="p-4 font-bold">إجمالي المكافأة</th>
                              <th className="p-4 font-bold">حالة الاعتماد</th>
                              <th className="p-4 font-bold">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {getFilteredOvertime().length === 0 ? (
                              <tr>
                                <td
                                  colSpan={9}
                                  className="p-12 text-center text-slate-400"
                                >
                                  لا يوجد ساعات عمل إضافية مسجلة لهذه الفرز
                                </td>
                              </tr>
                            ) : (
                              getFilteredOvertime().map((row: any) => (
                                <tr
                                  key={row.id}
                                  className="hover:bg-slate-50/50"
                                >
                                  <td className="p-4 font-bold text-slate-800">
                                    {row.employee_name}
                                  </td>
                                  <td className="p-4 font-mono">{row.date}</td>
                                  <td className="p-4 text-slate-600">
                                    {row.scheduled_hours}
                                  </td>
                                  <td className="p-4 font-bold text-slate-700">
                                    {row.actual_hours}
                                  </td>
                                  <td className="p-4 text-emerald-600 font-bold">
                                    +{row.overtime_hours}
                                  </td>
                                  <td className="p-4 text-slate-600">
                                    {row.hourly_rate}
                                  </td>
                                  <td className="p-4 text-emerald-600 font-bold">
                                    {row.total_bonus}
                                  </td>
                                  <td className="p-4">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        row.approved
                                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                          : "bg-amber-50 text-amber-600 border border-amber-100"
                                      }`}
                                    >
                                      {row.approved ? "معتمد" : "معلق للاعتماد"}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex gap-2">
                                      {!row.approved && (
                                        <button
                                          onClick={() => {
                                            const updated = overtimeDetails.map(
                                              (ot) =>
                                                ot.id === row.id
                                                  ? { ...ot, approved: true }
                                                  : ot,
                                            );
                                            setOvertimeDetails(updated);
                                            localStorage.setItem(
                                              "restomaster_overtime",
                                              JSON.stringify(updated),
                                            );
                                            alert(
                                              "تم اعتماد الساعات الإضافية وإضافتها للراتب بنجاح!",
                                            );
                                          }}
                                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold cursor-pointer"
                                        >
                                          اعتماد
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          const updated =
                                            overtimeDetails.filter(
                                              (ot) => ot.id !== row.id,
                                            );
                                          setOvertimeDetails(updated);
                                          localStorage.setItem(
                                            "restomaster_overtime",
                                            JSON.stringify(updated),
                                          );
                                          alert(
                                            "تم إزالة ساعات الإضافي من السجل بنجاح!",
                                          );
                                        }}
                                        className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-5 h-5" />
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
                  </div>
                )}

                {/* Tab content 4. Review All Overtime Tab */}
                {penaltiesActiveTab === "overtime_review" && (
                  <div className="space-y-6">
                    <div className="p-6 bg-emerald-50/35 border border-emerald-100 rounded-3xl flex justify-between items-center flex-wrap gap-4">
                      <div>
                        <h4 className="font-bold text-[#0a5c5a] text-lg">
                          مراجعة واعتماد نشاطات العمل الإضافية
                        </h4>
                        <p className="text-slate-500 text-sm mt-1">
                          يوجد حالياً{" "}
                          {(Array.isArray(overtimeDetails) ? overtimeDetails : []).filter((ot) => !ot.approved).length}{" "}
                          ساعات معلقة بحاجة للمراجعة بالتصفية الحالية.
                        </p>
                      </div>
                      {(Array.isArray(overtimeDetails) ? overtimeDetails : []).some((ot) => !ot.approved) && (
                        <button
                          onClick={() => {
                            setOvertimeDetails(
                              (Array.isArray(overtimeDetails) ? overtimeDetails : []).map((ot) => ({
                                ...ot,
                                approved: true,
                              })),
                            );
                            alert(
                              "تم اعتماد جميع الساعات الإضافية دفعة واحدة وإضافتها لمسودة الرواتب!",
                            );
                          }}
                          className="px-6 py-3.5 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold transition-all shadow-md text-sm cursor-pointer"
                        >
                          اعتماد كافة الساعات المعلقة
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(Array.isArray(overtimeDetails) ? overtimeDetails : []).map((row) => (
                        <div
                          key={row.id}
                          className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow flex justify-between items-center gap-4"
                        >
                          <div>
                            <h4 className="font-bold text-slate-900">
                              {row.employee_name}
                            </h4>
                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                              <span>التاريخ: {row.date}</span>
                              <span>
                                الإضافي:{" "}
                                <strong className="text-emerald-600">
                                  {row.overtime_hours}
                                </strong>
                              </span>
                              <span>
                                المبلغ كلياً:{" "}
                                <strong className="text-emerald-600">
                                  {row.total_bonus}
                                </strong>
                              </span>
                            </div>
                          </div>
                          <div>
                            {row.approved ? (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                معتمد
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setOvertimeDetails(
                                    overtimeDetails.map((ot) =>
                                      ot.id === row.id
                                        ? { ...ot, approved: true }
                                        : ot,
                                    ),
                                  );
                                  alert(
                                    `تم اعتماد ساعات ${row.employee_name} بنجاح!`,
                                  );
                                }}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                اعتماد ساعات الموظف
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab content 5. On Call Tab */}
                {penaltiesActiveTab === "on_call" && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800">
                        إدارة نوبات التواجد والاتصال (On Call)
                      </h3>
                      <button
                        onClick={() => {
                          const newOnCall = {
                            id: onCallList.length + 1,
                            employee_id: employees[0]?.id || 1,
                            employee_name:
                              employees[0]?.name || "الموظف الحالي",
                            date: new Date().toISOString().split("T")[0],
                            status: "مستعد للاستدعاء",
                            location: "فرع السويس الرئيسي",
                            duration: "24 ساعة",
                          };
                          setOnCallList([...onCallList, newOnCall]);
                          alert("تم تسجيل نوبة On Call بنجاح للموظف!");
                        }}
                        className="px-5 py-3 bg-[#0a5c5a] hover:bg-[#074341] text-white rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm text-sm"
                      >
                        <Plus className="w-4.5 h-4.5" />
                        تسجيل نوبة On Call
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 text-sm border-b border-slate-200">
                              <th className="p-4 font-bold">الموظف</th>
                              <th className="p-4 font-bold">التاريخ</th>
                              <th className="p-4 font-bold">
                                مكان التغطية والفرع
                              </th>
                              <th className="p-4 font-bold">
                                مدة المناوبة الحرة
                              </th>
                              <th className="p-4 font-bold">الحالة</th>
                              <th className="p-4 font-bold">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {getFilteredOnCall().length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="p-12 text-center text-slate-400"
                                >
                                  لا يوجد بيانات مناوبات مسجلة لهذه الفرز
                                </td>
                              </tr>
                            ) : (
                              getFilteredOnCall().map((row: any) => (
                                <tr
                                  key={row.id}
                                  className="hover:bg-slate-50/50"
                                >
                                  <td className="p-4 font-bold text-slate-800">
                                    {row.employee_name}
                                  </td>
                                  <td className="p-4 font-mono">{row.date}</td>
                                  <td className="p-4 text-slate-600">
                                    {row.location}
                                  </td>
                                  <td className="p-4 text-slate-600 font-bold">
                                    {row.duration}
                                  </td>
                                  <td className="p-4">
                                    <span className="px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-xs font-bold border border-teal-100">
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <button
                                      onClick={() =>
                                        setOnCallList(
                                          onCallList.filter(
                                            (item) => item.id !== row.id,
                                          ),
                                        )
                                      }
                                      className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-5 h-5" />
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
              </div>
            )}

            {activeTab === "leaves" && (
              <div
                className="space-y-6 font-sans text-right animate-fadeIn"
                dir="rtl"
              >
                {/* Structure Approval Workflow Section */}
                <LeaveApprovalsWorkflow departments={departments} branches={branches} onRefresh={fetchData} />

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        كروت وشبكة طلبات الإجازة السريعة
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        إدارة ومتابعة طلبات الإجازات المباشرة.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setLeaveForm({
                          employee_id: "",
                          policy_id: "",
                          start_date: new Date().toISOString().split("T")[0],
                          end_date: new Date().toISOString().split("T")[0],
                          notes: "",
                        });
                        setLeaveEmpSearch("");
                        setShowLeaveRequestModal(true);
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      تقديم طلب إجازة جديد
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leaveRequests.length === 0 ? (
                      <div className="col-span-full p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                        لا توجد طلبات إجازة مسجلة حالياً
                      </div>
                    ) : (
                      leaveRequests.map((req, idx) => (
                        <div
                          key={req.id || idx}
                          className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow relative group"
                        >
                          {/* Top Status Bar */}
                          <div
                            className={`h-1.5 w-full ${req.status === "approved" ? "bg-emerald-500" : req.status === "rejected" ? "bg-red-500" : "bg-amber-400"}`}
                          ></div>

                          <div className="p-5 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-bold text-slate-900">
                                  {req.employee_name}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  #{req.employee_code || req.employee_id}
                                </p>
                              </div>
                              <div
                                className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                                  req.status === "approved"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : req.status === "rejected"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {req.status === "approved"
                                  ? "موافق عليه"
                                  : req.status === "rejected"
                                    ? "مرفوض"
                                    : "قيد الانتظار"}
                              </div>
                            </div>

                            <div className="mb-4">
                              <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md border border-blue-100 font-medium">
                                {req.policy_name}
                              </span>
                              {req.impact === "unpaid" && (
                                <span className="mr-1 inline-block bg-red-50 text-red-700 text-[10px] px-1.5 py-1 rounded border border-red-100">
                                  بدون أجر
                                </span>
                              )}
                              {req.impact === "partial" && (
                                <span className="mr-1 inline-block bg-purple-50 text-purple-700 text-[10px] px-1.5 py-1 rounded border border-purple-100">
                                  خصم {req.partial_percentage}%
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4 text-xs mt-auto bg-white p-3 rounded-xl border border-slate-100">
                              <div>
                                <p className="text-slate-400 text-[10px] mb-1">
                                  من تاريخ
                                </p>
                                <p className="font-bold text-slate-700">
                                  {req.start_date}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px] mb-1">
                                  إلى تاريخ
                                </p>
                                <p className="font-bold text-slate-700">
                                  {req.end_date}
                                </p>
                              </div>
                              <div className="col-span-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                <span className="text-slate-500">
                                  المدة الإجمالية:
                                </span>
                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  {req.days} أيام
                                </span>
                              </div>
                            </div>

                            {req.notes && (
                              <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mb-4 line-clamp-2">
                                {req.notes}
                              </p>
                            )}

                            {/* Manager Actions */}
                            {req.status === "pending" && (
                              <div className="flex gap-2 mt-auto pt-2">
                                <button
                                  onClick={() =>
                                    handleUpdateLeaveStatus(req.id, "approved")
                                  }
                                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold py-2 rounded-lg transition-colors flex justify-center items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> قبول
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateLeaveStatus(req.id, "rejected")
                                  }
                                  className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-bold py-2 rounded-lg transition-colors flex justify-center items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> رفض
                                </button>
                              </div>
                            )}

                            <button
                              onClick={() => handleDeleteLeaveRequest(req.id)}
                              className="absolute top-3 left-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "leave_settings" && (
              <div
                className="space-y-6 font-sans text-right animate-fadeIn"
                dir="rtl"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        لائحة الإجازات وسياسات الخصم
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        تعريف أنواع الإجازات وتأثيرها على المرتب ورصيد الإجازات
                        السنوي.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setLeavePolicyForm({
                          id: 0,
                          name: "",
                          allowed_days: 21,
                          impact: "paid",
                          partial_percentage: 0,
                          deduct_from_balance: true,
                        });
                        setShowLeavePolicyModal(true);
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة نوع إجازة
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leavePolicies.map((policy) => (
                      <div
                        key={policy.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-colors flex flex-col relative group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-900">
                            {policy.name}
                          </h4>
                          <div className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                            {policy.allowed_days} يوم / سنة
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">
                              التأثير المالي:
                            </span>
                            {policy.impact === "paid" && (
                              <span className="font-bold text-emerald-600">
                                مدفوعة الأجر (على حساب الشركة)
                              </span>
                            )}
                            {policy.impact === "unpaid" && (
                              <span className="font-bold text-red-600">
                                بدون أجر (يخصم من المرتب)
                              </span>
                            )}
                            {policy.impact === "partial" && (
                              <span className="font-bold text-purple-600">
                                خصم جزئي ({policy.partial_percentage}%)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">
                              يخصم من الرصيد:
                            </span>
                            <span
                              className={`font-bold ${policy.deduct_from_balance ? "text-amber-600" : "text-slate-600"}`}
                            >
                              {policy.deduct_from_balance ? "نعم" : "لا"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                          <button
                            onClick={() => {
                              setLeavePolicyForm({ ...policy });
                              setShowLeavePolicyModal(true);
                            }}
                            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-lg transition-colors border border-slate-200"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "حذف هذا النوع سيؤثر على القواعد، هل أنت متأكد؟",
                                )
                              ) {
                                setLeavePolicies((prev) =>
                                  prev.filter((p) => p.id !== policy.id),
                                );
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "portal_requests" && (
              <PortalRequestsManagement />
            )}

            {activeTab === "evaluations" && (
              <div
                className="space-y-6 font-sans text-right animate-fadeIn"
                dir="rtl"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        تقييم الموظفين والأداء
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        تسجيل تقييمات الموظفين وعرض العُهد النشطة المسجلة عليهم.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEvaluationForm({
                          employee_id: "",
                          rating: 5,
                          metrics: {
                            efficiency: 5,
                            behavior: 5,
                            attendance: 5,
                            quality: 5,
                          },
                          notes: "",
                          date: new Date().toISOString().split("T")[0],
                        });
                        setEvaluationEmpSearch("");
                        setShowEvaluationModal(true);
                      }}
                      className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-yellow-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة تقييم جديد
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {evaluationsList.length === 0 ? (
                      <div className="col-span-full p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                        لا توجد تقييمات مسجلة حالياً
                      </div>
                    ) : (
                      evaluationsList.map((evalRecord, idx) => {
                        // Find if this employee has any active custody
                        const employeeCustodies = custodyList.filter(
                          (c) =>
                            c.employee_id === evalRecord.employee_id &&
                            (c.status === "handed_over" ||
                              c.status === "issued"),
                        );

                        return (
                          <div
                            key={evalRecord.id || idx}
                            className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group"
                          >
                            {/* Decorative accent */}
                            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 opacity-70"></div>

                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-bold text-slate-900">
                                  {evalRecord.employee_name}
                                </h4>
                                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {evalRecord.employee_code || "#"}
                                  </span>
                                  <span>{evalRecord.department_name}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-center bg-yellow-100 text-yellow-700 font-bold px-2.5 py-1 rounded-xl text-lg min-w-[50px]">
                                {evalRecord.rating.toFixed(1)}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4 text-xs mt-auto">
                              <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <p className="text-slate-400 mb-1">الكفاءة</p>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />{" "}
                                  <span className="font-bold text-slate-700">
                                    {evalRecord.metrics.efficiency}/5
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <p className="text-slate-400 mb-1">السلوك</p>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />{" "}
                                  <span className="font-bold text-slate-700">
                                    {evalRecord.metrics.behavior}/5
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <p className="text-slate-400 mb-1">
                                  الالتزام بالدوام
                                </p>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />{" "}
                                  <span className="font-bold text-slate-700">
                                    {evalRecord.metrics.attendance}/5
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <p className="text-slate-400 mb-1">
                                  جودة العمل
                                </p>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />{" "}
                                  <span className="font-bold text-slate-700">
                                    {evalRecord.metrics.quality}/5
                                  </span>
                                </div>
                              </div>
                            </div>

                            {employeeCustodies.length > 0 && (
                              <div className="mt-2 pt-3 border-t border-slate-200">
                                <p className="text-[10px] font-bold text-indigo-600 mb-2 flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  عُهد نشطة في ذمته ({employeeCustodies.length}
                                  ):
                                </p>
                                <div className="flex flex-col gap-1.5">
                                  {employeeCustodies.slice(0, 2).map((c, i) => (
                                    <div
                                      key={i}
                                      className="text-[10px] flex justify-between bg-indigo-50/50 p-1.5 rounded text-indigo-900 border border-indigo-100/50"
                                    >
                                      <span className="font-medium truncate pl-1">
                                        {c.asset_name}
                                      </span>
                                      <span className="font-mono text-slate-500 flex-shrink-0">
                                        {c.serial_number || "-"}
                                      </span>
                                    </div>
                                  ))}
                                  {employeeCustodies.length > 2 && (
                                    <div className="text-[10px] text-slate-500 text-center mt-1">
                                      +{employeeCustodies.length - 2} عهد إضافية
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-slate-200">
                              <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {evalRecord.date}
                              </p>
                              {evalRecord.notes && (
                                <p className="text-xs text-slate-600 bg-white p-2 text-right rounded-lg border border-slate-100 line-clamp-2 mt-2">
                                  {evalRecord.notes}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                setEvaluationsList((prev) =>
                                  prev.filter((e) => e.id !== evalRecord.id),
                                )
                              }
                              className="absolute top-3 left-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "comprehensive_report" && (
              <HRComprehensiveReport 
                employees={employees}
                departments={departments}
                branches={branches}
                shifts={shifts}
                evaluations={evaluationsList}
              />
            )}

            {activeTab === "clearance" && (
              <ClearanceManagement
                employees={employees}
                departments={departments}
                branches={branches}
                onRefresh={fetchData}
              />
            )}

            {activeTab === "annual_increases" && (
              <AnnualIncreasesManagement />
            )}

            {activeTab === "payroll_elements" && (
              <div
                className="space-y-6 font-sans text-right animate-fadeIn"
                dir="rtl"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        هيكلية وأوعية عناصر الرواتب المرنة
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        تتيح لك هذه المنصة إنشاء بدلات مخصصة واستقطاعات تلقائية
                        لسلم الرواتب وربطه مع الموثق المالي للمطعم والورشة.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingElement({
                          name: "",
                          type: "addition",
                          rule_type: "fixed",
                          value: 0,
                        });
                        setShowElementModal(true);
                      }}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md shadow-purple-600/10"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة عنصر مالي جديد
                    </button>
                  </div>

                  <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-right divide-y divide-slate-100 min-w-[700px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            اسم العنصر
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            طبيعة المعاملة
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            القاعدة المحاسبية
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            القيمة الافتراضية
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            الإجراءات
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {payrollElements.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-8 text-center text-slate-400 text-sm"
                            >
                              لم يتم تعريف أي عناصر مخصصة بعد. عناصر السلم
                              والبدلات التي يتم تحديدها هنا ستظهر آلياً كبدلات
                              قابلة للتعديل والضرب لكل موظف على حدة.
                            </td>
                          </tr>
                        ) : (
                          payrollElements.map((el) => (
                            <tr
                              key={el.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="p-4 font-bold text-slate-900">
                                {el.name}
                              </td>
                              <td className="p-4">
                                {el.type === "addition" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                    بَدَل وإضافة (+)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                                    استقطاع وخصم (-)
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-sm text-slate-600">
                                {el.rule_type === "fixed"
                                  ? "مبلغ مقطوع ثابت"
                                  : "نسبة مئوية من الراتب الأساسي"}
                              </td>
                              <td className="p-4 font-bold text-slate-700">
                                {el.value}{" "}
                                {el.rule_type === "fixed" ? "ج.م" : "%"}
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingElement(el);
                                      setShowElementModal(true);
                                    }}
                                    className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-purple-600 rounded-lg transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeletePayrollElement(el.id)
                                    }
                                    className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
              </div>
            )}

            {activeTab === "custody" && (
              <div
                className="space-y-6 font-sans text-right animate-fadeIn"
                dir="rtl"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  {/* Tab Header with Switchers */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        إدارة الأصول العينية والعُهد اللوجستية
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        تتبع الأصول العينية والأجهزة اللوجستية كجهاز البصمة،
                        الدراجة، والـ POS، مع الضوابط المالية التلقائية
                        والمخازن.
                      </p>
                    </div>
                    <div className="flex gap-2 text-right justify-start md:justify-end w-full md:w-auto">
                      {custodySubTab === "employees" ? (
                        <button
                          onClick={() => {
                            setCustodyForm({
                              employee_id: "",
                              custody_store_item_id: "",
                              asset_name: "",
                              serial_number: "",
                              received_date: new Date()
                                .toISOString()
                                .split("T")[0],
                              notes: "",
                              replacement_cost: 0,
                            });
                            setCustodyEmpSearch("");
                            setShowCustodyModal(true);
                          }}
                          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-600/10"
                        >
                          <Plus className="w-4 h-4" />
                          صرف وتسليم عهدة لموظف
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setStoreForm({
                              id: null,
                              asset_name: "",
                              serial_number: "",
                              quantity: 1,
                              replacement_cost: 0,
                              notes: "",
                            });
                            setShowStoreModal(true);
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/10"
                        >
                          <Plus className="w-4 h-4" />
                          إضافة أصل جديد للمستودع
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-Tabs Selector */}
                  <div className="flex border-b border-slate-200 mb-6 gap-4">
                    <button
                      onClick={() => setCustodySubTab("employees")}
                      className={`pb-3 text-sm font-bold transition-colors relative ${custodySubTab === "employees" ? "text-purple-600 border-b-2 border-purple-600" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      عُهد الموظفين النشطة
                    </button>
                    <button
                      onClick={() => setCustodySubTab("store")}
                      className={`pb-3 text-sm font-bold transition-colors relative ${custodySubTab === "store" ? "text-purple-600 border-b-2 border-purple-600" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      مخزن العُهد والمستودع العام للشركة
                    </button>
                  </div>

                  {custodySubTab === "employees" ? (
                    <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-right divide-y divide-slate-100 min-w-[700px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              الموظف المسؤول
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              اسم العهدة والأصل
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              الرقم التسلسلي S/N
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              تاريخ التسليم
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              الحالة والمحاسبة المالية
                            </th>
                            <th className="p-4 text-xs font-bold text-red-600">
                              قيمة التعويض البديل (replacement_cost)
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              تاريخ الاسترجاع
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              ملاحظات
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              الإجراءات والعمليات
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {custodyList.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="p-8 text-center text-slate-400 text-sm"
                              >
                                لا توجد عهد عينية أو لوجستية مسجلة حالياً لعمال
                                التوصيل أو الموظفين.
                              </td>
                            </tr>
                          ) : (
                            custodyList.map((cust) => (
                              <tr
                                key={cust.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="p-4">
                                  <span className="font-bold text-slate-900">
                                    {cust.employee_name}
                                  </span>
                                </td>
                                <td className="p-4 font-medium text-slate-800">
                                  {cust.asset_name}
                                </td>
                                <td className="p-4 font-mono text-slate-600 text-sm">
                                  {cust.serial_number || "بدون"}
                                </td>
                                <td className="p-4 text-slate-500 text-sm">
                                  {cust.received_date
                                    ? cust.received_date.split("T")[0]
                                    : "غير مدخل"}
                                </td>
                                <td className="p-4">
                                  {cust.status === "handed_over" ||
                                  cust.status === "issued" ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      في عهدة الموظف
                                    </span>
                                  ) : cust.status === "returned" ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      مستردّة بالكامل ومغلقة
                                    </span>
                                  ) : cust.status === "lost" ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      مفقودة (سُجل خصم مالي)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                      تالفة (سُجل خصم مالي)
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 font-bold text-red-600 font-mono text-sm">
                                  {cust.replacement_cost
                                    ? `${cust.replacement_cost} ج.م`
                                    : "0 ج.م"}
                                </td>
                                <td className="p-4 text-slate-500 text-sm">
                                  {cust.returned_date
                                    ? cust.returned_date.split("T")[0]
                                    : "-"}
                                </td>
                                <td className="p-4 text-slate-600 text-xs w-48">
                                  {cust.notes || "-"}
                                </td>
                                <td className="p-4">
                                  <div className="flex gap-1.5 flex-wrap">
                                    {(cust.status === "handed_over" ||
                                      cust.status === "issued") && (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleReturnCustodySubmit(
                                              cust.id,
                                              "returned",
                                              cust.notes,
                                            )
                                          }
                                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 transition-colors"
                                        >
                                          إرجاع سليم
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleReturnCustodySubmit(
                                              cust.id,
                                              "damaged",
                                              cust.notes,
                                            )
                                          }
                                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 transition-colors"
                                        >
                                          إثبات تالفة
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleReturnCustodySubmit(
                                              cust.id,
                                              "lost",
                                              cust.notes,
                                            )
                                          }
                                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-700 transition-colors"
                                        >
                                          إثبات مفقودة
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() =>
                                        handleDeleteCustody(cust.id)
                                      }
                                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded mr-auto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* General Custody Warehouse Section */
                    <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-right divide-y divide-slate-100 min-w-[700px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              اسم صنف العهدة
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              الرقم التسلسلي لقاعدة الصنف
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              الكمية المتاحة حالياً بالمخزن
                            </th>
                            <th className="p-4 text-xs font-bold text-red-600">
                              تكلفة التعويض للمسؤولية المالية (replacement_cost)
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              ملاحظات الصنف
                            </th>
                            <th className="p-4 text-xs font-bold text-slate-500">
                              العمليات
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {custodyStoreList.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="p-8 text-center text-slate-400 text-sm"
                              >
                                مستودع العهد العام فارغ حالياً. يرجى إضافة أصناف
                                عهدة للمخزن.
                              </td>
                            </tr>
                          ) : (
                            custodyStoreList.map((item) => (
                              <tr
                                key={item.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="p-4 font-bold text-slate-900">
                                  {item.asset_name}
                                </td>
                                <td className="p-4 font-mono text-slate-600 text-sm">
                                  {item.serial_number || "-"}
                                </td>
                                <td className="p-4">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${item.quantity > 0 ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-400"}`}
                                  >
                                    {item.quantity} وحدات متاحة
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-red-600 font-mono text-sm">
                                  {item.replacement_cost} ج.م
                                </td>
                                <td className="p-4 text-slate-500 text-xs w-64">
                                  {item.notes || "-"}
                                </td>
                                <td className="p-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setStoreForm(item);
                                        setShowStoreModal(true);
                                      }}
                                      className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteStoreItem(item.id)
                                      }
                                      className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "production_bonuses" && (
              <div
                className="space-y-6 font-sans text-right animate-fadeIn"
                dir="rtl"
              >
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        سجل حوافز ومكافآت الإنتاج المالي
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">
                        اربط جودة إنتاج منتجات المطعم والورشة وصناعة الأغذية
                        بالمكافآت مباشرة. النظام يدعم التحويل المباشر لمكافأة
                        الراتب فور الاعتماد الموثق.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setProdBonusForm({
                          employee_id: "",
                          product_name: "",
                          units_produced: "",
                          rate_per_unit: "",
                          date: new Date().toISOString().split("T")[0],
                        });
                        setProdBonusEmpSearch("");
                        setShowProdBonusModal(true);
                      }}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md shadow-purple-600/10"
                    >
                      <Plus className="w-4 h-4" />
                      تسجيل عملية إنتاج مصنّع جديد
                    </button>
                  </div>

                  <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-right divide-y divide-slate-100 min-w-[700px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            الموظف المبدع
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            المنتج المصنع / الورشة
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            الوحدات التراكمية
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            السعر المالي للوحدة
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            إجمالي الحافز المحسوب
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            تاريخ تسجيل الوقع
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            حالة الدورة والاعتماد
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            الإجراءات
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {productionBonuses.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="p-8 text-center text-slate-400 text-sm"
                            >
                              لا توجد سجلات حوافز إنتاج مدخلة لهذا الشهر.
                            </td>
                          </tr>
                        ) : (
                          productionBonuses.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="p-4">
                                <span className="font-bold text-slate-900">
                                  {item.employee_name}
                                </span>
                              </td>
                              <td className="p-4 font-medium text-slate-800">
                                {item.product_name}
                              </td>
                              <td className="p-4 font-mono font-bold text-slate-600">
                                {item.units_produced} وحدة
                              </td>
                              <td className="p-4 font-bold text-slate-500">
                                {item.rate_per_unit} ج.م
                              </td>
                              <td className="p-4 font-bold text-purple-600 text-sm">
                                {item.calculated_bonus_amount} ج.م
                              </td>
                              <td className="p-4 text-slate-500 text-sm">
                                {item.date
                                  ? item.date.split("T")[0]
                                  : "غير محدد"}
                              </td>
                              <td className="p-4">
                                {item.approved === true ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    معتمد ومدرج بمسودة الراتب
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    بانتظار مراجعة الإدارة
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                {!item.approved && (
                                  <button
                                    onClick={() =>
                                      handleApproveProdBonusSubmit(item.id)
                                    }
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-purple-600/10"
                                  >
                                    اعتماد وصرف الحافز
                                  </button>
                                )}
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
          </div>
        )}
      </div>


      {/* Shift Modal */}
      <AnimatePresence>
        {showShiftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShiftModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveShift}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingShift.id ? "تعديل وردية" : "إضافة وردية جديدة"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-500">
                      اسم الوردية
                    </label>
                    <input
                      value={editingShift.name || ""}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          name: e.target.value,
                        })
                      }
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-500">
                        موعد الحضور
                      </label>
                      <input
                        value={editingShift.start_time || ""}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            start_time: e.target.value,
                          })
                        }
                        type="time"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-500">
                        موعد الانصراف
                      </label>
                      <input
                        value={editingShift.end_time || ""}
                        onChange={(e) =>
                          setEditingShift({
                            ...editingShift,
                            end_time: e.target.value,
                          })
                        }
                        type="time"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-500">
                      فترة السماح (بالدقائق)
                    </label>
                    <input
                      type="number"
                      value={editingShift.grace_period || 0}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          grace_period: parseInt(e.target.value),
                        })
                      }
                      placeholder="مثلاً: 15"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-purple-600/20"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dept Modal */}
      <AnimatePresence>
        {showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeptModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveDept}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingDept.id ? "تعديل قسم" : "إضافة قسم جديد"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-500">اسم القسم</label>
                    <input
                      value={editingDept.name || ""}
                      onChange={(e) =>
                        setEditingDept({ ...editingDept, name: e.target.value })
                      }
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-purple-600/20"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Branch Modal */}
      <AnimatePresence>
        {showBranchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBranchModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveBranch}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingBranch.id ? "تعديل فرع" : "إضافة فرع جديد"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowBranchModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-500">اسم الفرع</label>
                    <input
                      value={editingBranch.name || ""}
                      onChange={(e) =>
                        setEditingBranch({
                          ...editingBranch,
                          name: e.target.value,
                        })
                      }
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-purple-600/20"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBranchModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Penalty Modal */}
      <AnimatePresence>
        {showPenaltyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPenaltyModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSavePenalty}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingPenalty.id ? "تعديل جزاء" : "إضافة جزاء جديد"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowPenaltyModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-500">اسم الجزاء</label>
                    <input
                      value={editingPenalty.name || ""}
                      onChange={(e) =>
                        setEditingPenalty({
                          ...editingPenalty,
                          name: e.target.value,
                        })
                      }
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-500">تصنيف الجزاء / الاستقطاع</label>
                      <select
                        value={editingPenalty.category || "manual"}
                        onChange={(e) =>
                          setEditingPenalty({
                            ...editingPenalty,
                            category: e.target.value as any,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                      >
                        <optgroup label="جزاءات إدارية">
                          <option value="manual">يدوي / عام</option>
                          <option value="penalty">جزاء إداري</option>
                          <option value="delay">تأخير</option>
                          <option value="absence">غياب</option>
                          <option value="early_leave">انصراف مبكر</option>
                          <option value="missing_punch">نسيان بصمة</option>
                        </optgroup>
                        <optgroup label="استقطاعات وخصومات">
                          <option value="deduction">استقطاع عام</option>
                          <option value="discount">خصم خاص</option>
                          <option value="advance">سلفة / تقسيط</option>
                          <option value="insurance">تأمينات اجتماعية</option>
                          <option value="vacation_deduction">خصم إجازات</option>
                          <option value="uniform">خصم زي / عهدة</option>
                          <option value="hr">خصم HR إداري</option>
                        </optgroup>
                      </select>
                    </div>
                    {(editingPenalty.category === "delay" ||
                      editingPenalty.category === "early_leave") && (
                      <div className="space-y-2">
                        <label className="text-sm text-slate-500">
                          {editingPenalty.type === "per_minute_ratio"
                            ? "عدد الدقائق لكل وحدة خصم"
                            : "الحد الأدنى للتأخير (بالدقائق)"}
                        </label>
                        <input
                          type="number"
                          value={editingPenalty.threshold_minutes || 0}
                          onChange={(e) =>
                            setEditingPenalty({
                              ...editingPenalty,
                              threshold_minutes: parseInt(e.target.value),
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                          placeholder={
                            editingPenalty.type === "per_minute_ratio"
                              ? "مثال: 2 (يخصم مبلغ كل دقيقتين)"
                              : "مثال: 15"
                          }
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-500">نوع الخصم</label>
                      <select
                        value={editingPenalty.type ?? ""}
                        onChange={(e) =>
                          setEditingPenalty({
                            ...editingPenalty,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                      >
                        <option value="amount">مبلغ مالي ثابت</option>
                        <option value="days">أيام عمل (× معدل اليوم)</option>
                        <option value="hours">ساعات عمل (× معدل الساعة)</option>
                        <option value="per_minute">خصم بالدقيقة (مبلغ × عدد الدقائق)</option>
                        <option value="per_minute_ratio">خصم دقيقة لكل N دقائق</option>
                        <option value="shift_ratio">تلقائي حسب الوردية والراتب</option>
                      </select>
                    </div>
                    {editingPenalty.type === "shift_ratio" ? (
                      <div className="space-y-2">
                        <label className="text-sm text-slate-500">
                          طريقة الحساب
                        </label>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-bold">
                          ⚡ تلقائي - لا يحتاج قيمة
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          سيحسب النظام قيمة الدقيقة تلقائياً من: الراتب ÷ أيام العمل ÷ ساعات الوردية ÷ 60
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm text-slate-500">
                          {editingPenalty.type === "amount" && "المبلغ (ج.م)"}
                          {editingPenalty.type === "days" && "عدد الأيام"}
                          {editingPenalty.type === "hours" && "عدد الساعات"}
                          {editingPenalty.type === "per_minute" && "المبلغ لكل دقيقة (ج.م)"}
                          {editingPenalty.type === "per_minute_ratio" && "المبلغ لكل وحدة (ج.م)"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingPenalty.amount || 0}
                          onChange={(e) =>
                            setEditingPenalty({
                              ...editingPenalty,
                              amount: parseFloat(e.target.value),
                            })
                          }
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                  {/* Helper text explaining how the penalty will be calculated */}
                  {editingPenalty.type && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700 leading-relaxed">
                      {editingPenalty.type === "amount" && "💡 سيتم خصم مبلغ ثابت من راتب الموظف عند تطبيق هذا الجزاء."}
                      {editingPenalty.type === "days" && "💡 سيتم حساب: عدد الأيام × (الراتب الأساسي ÷ أيام العمل بالشهر)."}
                      {editingPenalty.type === "hours" && "💡 سيتم حساب: عدد الساعات × (الراتب الأساسي ÷ أيام العمل ÷ ساعات الوردية)."}
                      {editingPenalty.type === "per_minute" && "💡 سيتم خصم: المبلغ × عدد دقائق التأخير. مثال: 2 ج.م/دقيقة × 30 دقيقة = 60 ج.م."}
                      {editingPenalty.type === "per_minute_ratio" && `💡 سيتم خصم: المبلغ × عدد الوحدات (كل ${editingPenalty.threshold_minutes || 'N'} دقائق = وحدة واحدة). مثال: 5 ج.م كل دقيقتين × تأخير 10 دقائق = 5 × 5 = 25 ج.م.`}
                      {editingPenalty.type === "shift_ratio" && `💡 حساب تلقائي ذكي: قيمة الدقيقة = الراتب ÷ أيام العمل ÷ ساعات الوردية ÷ 60. مثال: راتب 5000 ÷ 26 يوم ÷ 8 ساعات ÷ 60 = 0.40 ج.م/دقيقة. لو حد التشغيل = ${editingPenalty.threshold_minutes || 'N'} دقيقة، فكل ${editingPenalty.threshold_minutes || 'N'} دقائق تأخير = خصم 0.40 ج.م. النظام بياخد بالورديه (ساعاتها) والراتب لكل موظف لوحده.`}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-500">ملاحظات</label>
                    <textarea
                      value={editingPenalty.notes || ""}
                      onChange={(e) =>
                        setEditingPenalty({
                          ...editingPenalty,
                          notes: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 h-20 text-slate-900"
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-purple-600/20"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPenaltyModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Award / Deduct Penalty Modal */}
      <AnimatePresence>
        {/* Employee Penalty History Side Panel */}
        {showPenaltyHistoryPanel && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setShowPenaltyHistoryPanel(false)}
          />
        )}
        <AnimatePresence>
          {showPenaltyHistoryPanel && penaltyHistoryEmployee && (
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              className="fixed inset-y-0 left-0 w-[480px] max-w-full bg-white border-l border-slate-200 shadow-2xl z-50 overflow-y-auto"
              dir="rtl"
            >
              {/* Panel Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 p-5 z-10">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg">
                      {penaltyHistoryEmployee.name?.charAt(0) || "م"}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{penaltyHistoryEmployee.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {penaltyHistoryEmployee.job_title || "موظف"} {penaltyHistoryEmployee.fingerprint_code ? `| كود: ${penaltyHistoryEmployee.fingerprint_code}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPenaltyHistoryPanel(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary Cards */}
                {employeePenaltySummary && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-red-600">{employeePenaltySummary.active_count || 0}</p>
                      <p className="text-[10px] text-red-400 font-bold">جزاء نشط</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-red-600">{Number(employeePenaltySummary.total_active_amount || 0).toFixed(0)}</p>
                      <p className="text-[10px] text-red-400 font-bold">ج.م إجمالي الخصم</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-slate-500">{employeePenaltySummary.cancelled_count || 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold">جزاء ملغي</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-black text-slate-500">{employeePenaltySummary.days_penalized || 0}</p>
                      <p className="text-[10px] text-slate-400 font-bold">يوم مُعاقَب</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Penalty History List */}
              <div className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-slate-600 mb-2">سجل الجزاءات الكامل</h4>

                {penaltyHistoryLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#0a5c5a] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : employeePenaltyHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-3 bg-emerald-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-300" />
                    </div>
                    <p className="text-slate-500 font-bold text-sm">لا توجد جزاءات مسجلة على هذا الموظف</p>
                    <p className="text-slate-400 text-xs mt-1">سجل الموظف نظيف</p>
                  </div>
                ) : (
                  employeePenaltyHistory.map((p: any) => {
                    const catColors: Record<string, { bg: string; color: string; border: string }> = {
                      delay: { bg: "bg-red-50", color: "text-red-600", border: "border-red-100" },
                      absence: { bg: "bg-amber-50", color: "text-amber-600", border: "border-amber-100" },
                      early_leave: { bg: "bg-orange-50", color: "text-orange-600", border: "border-orange-100" },
                      missing_punch: { bg: "bg-blue-50", color: "text-blue-600", border: "border-blue-100" },
                      manual: { bg: "bg-slate-50", color: "text-slate-600", border: "border-slate-200" },
                      penalty: { bg: "bg-purple-50", color: "text-purple-600", border: "border-purple-100" },
                    };
                    const cc = catColors[p.category] || catColors.manual;
                    const isActive = p.status === "active";
                    return (
                      <div
                        key={p.id}
                        className={`border ${isActive ? cc.border : "border-slate-100"} ${isActive ? cc.bg : "bg-slate-50/50 opacity-60"} rounded-2xl p-4 transition-all`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 ${cc.bg} ${cc.color} rounded-lg text-[11px] font-bold border ${cc.border}`}>
                              {p.category === "delay" ? "تأخير" : p.category === "absence" ? "غياب" : p.category === "early_leave" ? "انصراف مبكر" : p.category === "missing_punch" ? "نسيان بصمة" : "يدوي / عام"}
                            </span>
                            {p.reference_type === "auto" && (
                              <span className="px-2 py-0.5 bg-violet-50 text-violet-500 rounded text-[10px] font-bold">تلقائي</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isActive ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold">نشط</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[10px] font-bold line-through">ملغي</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
};
