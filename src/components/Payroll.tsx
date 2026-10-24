import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  RefreshCw,
  Maximize2,
  CloudDownload,
  AlertCircle,
  Lock,
  Trash2,
  Plus,
  Settings,
  BarChart3,
  Users,
  Building2,
  TrendingUp,
  FileText,
  Calculator,
  Printer,
  Calendar,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Clock,
  CalendarX,
  // 🎯 أيقونات إضافية لنافذة تفاصيل لائحة الجزاءات
  ShieldAlert,
  ListChecks,
  Tag,
  Scale,
  CheckCircle,
  Wallet,
} from "lucide-react";
import { motion } from "motion/react";
import * as XLSX from "xlsx";
import useSWR from "swr";
import { fetcher } from "../utils/fetcher";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { PrintableReport } from "./PrintableReport";
import { MultiEmployeeSearchFilter } from "./MultiEmployeeSearchFilter";
import PayrollRunPanel from "./PayrollRunPanel";

interface PayrollProps {
  onBack: () => void;
  initialTab?: "approved" | "advances" | "bonuses" | "penalties" | "settings" | "reports" | "run";
  hideTabs?: boolean;
}

const parseWeeklyOffDays = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    if (raw.includes(",")) {
      return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
    return [raw.trim().toLowerCase()];
  }
  return [];
};

const formatWeeklyOffDays = (raw: any): string => {
  const days = parseWeeklyOffDays(raw);
  if (!days || days.length === 0) return "غير محدد (لم تُحدد أي أيام إجازة أسبوعية)";
  const dayMap: Record<string, string> = {
    sunday: "الأحد",
    monday: "الإثنين",
    tuesday: "الثلاثاء",
    wednesday: "الأربعاء",
    thursday: "الخميس",
    friday: "الجمعة",
    saturday: "السبت",
  };
  return days.map((d: string) => dayMap[d.toLowerCase()] || d).join("، ");
};

export const Payroll: React.FC<PayrollProps> = ({
  onBack,
  initialTab,
  hideTabs,
}) => {
  const { user, hasExplicitPermission } = useAuth();
  
  // Helper function to strictly check specific payroll permissions
  const hasPayrollPermission = (permissionKey: string): boolean => {
    // Admin always has access
    if (user?.role === 'admin') return true;
    
    // Check explicit permission
    if (hasExplicitPermission(permissionKey)) return true;
    
    // Check raw permissions object for exact match
    if (user?.permissions) {
      const perms = user.permissions;
      if (perms[permissionKey] === true) return true;
      // Check if user has full salaries access
      if (perms['salaries'] === true || perms['salaries.full_access'] === true) return true;
    }
    
    return false;
  };
  const [activeTab, setActiveTab] = useState<
    "approved" | "advances" | "bonuses" | "penalties" | "settings" | "reports" | "run"
  >(() => {
    if (initialTab) return initialTab;
    const saved = localStorage.getItem("last_payroll_tab");
    return (saved as any) || "approved";
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab) {
      try {
        localStorage.setItem("last_payroll_tab", activeTab);
      } catch (_) {}
    }
  }, [activeTab]);

  const [bonusesTypes, setBonusesTypes] = useState<string[]>([
    "transport",
    "housing",
    "bonus",
    "delivery",
    "vacation",
  ]);
  const [advancesTypes, setAdvancesTypes] = useState<string[]>([
    "direct",
    "installment",
  ]);
  const [deductionsTypes, setDeductionsTypes] = useState<string[]>([
    "absence",
    "vacation_deduction",
    "cl",
    "shortage",
    "fellowship",
    "hr",
    "penalty",
  ]);

  useEffect(() => {
    const loadCustomTypes = async () => {
      try {
        const [resB, resA, resD] = await Promise.all([
          api.get("/api/system/settings/payroll_bonuses_types").catch(() => null),
          api.get("/api/system/settings/payroll_advances_types").catch(() => null),
          api.get("/api/system/settings/payroll_deductions_types").catch(() => null),
        ]);

        if (resB && resB.ok) {
          const val = await resB.json().catch(() => null);
          if (Array.isArray(val) && val.length > 0) {
            setBonusesTypes((prev) => dedupeTypeList([...prev, ...val]));
          }
        }

        if (resA && resA.ok) {
          const val = await resA.json().catch(() => null);
          if (Array.isArray(val) && val.length > 0) {
            setAdvancesTypes((prev) => dedupeTypeList([...prev, ...val]));
          }
        }

        if (resD && resD.ok) {
          const val = await resD.json().catch(() => null);
          if (Array.isArray(val) && val.length > 0) {
            setDeductionsTypes((prev) => dedupeTypeList([...prev, ...val]));
          }
        }
      } catch (err) {
        console.warn("Could not load custom payroll types (using defaults):", (err as any)?.message || err);
      }
    };

    loadCustomTypes();

    const handleSettingsUpdate = () => {
      loadCustomTypes();
    };
    window.addEventListener("payroll_settings_updated", handleSettingsUpdate);
    return () => {
      window.removeEventListener("payroll_settings_updated", handleSettingsUpdate);
    };
  }, []);

  const saveCustomTypes = async (key: string, list: string[]) => {
    try {
      const res = await api.post("/api/system/settings", { key, value: list });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("payroll_settings_updated"));
      }
      return res.ok;
    } catch (err) {
      console.error("Failed to save custom types:", err);
      return false;
    }
  };

  const getTypeLabel = (
    type: string,
    category?: "advances" | "bonuses" | "penalties",
  ) => {
    const translations: Record<string, string> = {
      // advances
      direct: "سلفة مباشرة",
      installment: "سلفة قسط",
      // bonuses
      transport: "بدل انتقال وركوب",
      housing: "بدل سكن",
      bonus: "مكافأة",
      delivery: "دليفري",
      vacation: "بدل إجازة",
      meal: "بدل وجبة",
      incentive: "حافز انتظام",
      work_nature: "بدل طبيعة عمل",
      phone: "بدل هاتف",
      commission: "عمولات",
      // penalties / deductions
      absence: "خصم غياب (إضافي)",
      vacation_deduction: "خصم إجازات",
      vacation_ded: "خصم إجازات",
      cl: "CL",
      shortage: "عجز",
      fellowship: "صندوق زمالة",
      hr: "خصم HR",
      penalty: "جزاء",
      delay: "خصم تأخير",
      uniform: "خصم زي",
      insurance: "تأمينات",
    };
    return translations[type] || type;
  };

  // 🎯 دوال مساعدة لعرض تفاصيل لائحة الجزاءات بالعربي
  const getPenaltyArabicName = (penalty: any): string => {
    // إذا كان هناك وصف عربي استخدمه
    if (penalty.description && penalty.description !== 'undefined') {
      return penalty.description;
    }
    
    // إنشاء اسم بناءً على النوع والتصنيف
    const category = penalty.category || penalty.type || '';
    const minutes = penalty.minutes || 0;
    
    switch(category) {
      case 'delay':
        return minutes > 0 ? `تأخير عن العمل (${minutes} دقيقة)` : 'تأخير عن العمل';
      case 'early_leave':
        return minutes > 0 ? `انصراف مبكر (${minutes} دقيقة)` : 'انصراف مبكر';
      case 'absence':
        return 'غياب بدون إذن';
      case 'missing_punch':
        return 'نسيان بصمة حضور/انصراف';
      case 'manual':
        return penalty.rule_name || 'جزاء يدوي';
      default:
        return `جزاء (${category || 'غير محدد'})`;
    }
  };

  const getPenaltyCategoryArabic = (category: string): string => {
    const categories: Record<string, string> = {
      delay: 'تأخير',
      early_leave: 'انصراف مبكر',
      absence: 'غياب',
      missing_punch: 'نسيان بصمة',
      manual: 'يدوي'
    };
    return categories[category] || category || 'غير محدد';
  };

  const getPenaltyCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      delay: 'bg-amber-500',
      early_leave: 'bg-orange-500',
      absence: 'bg-rose-500',
      missing_punch: 'bg-purple-500',
      manual: 'bg-slate-500'
    };
    return colors[category] || 'bg-slate-400';
  };

  const formatPenaltyDate = (date: string | Date): string => {
    if (!date) return 'غير محدد';
    
    try {
      const d = new Date(date);
      
      // التحقق من صحة التاريخ
      if (isNaN(d.getTime())) return String(date);
      
      const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const MONTH_NAMES_AR = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      
      const dayName = DAY_NAMES_AR[d.getDay()];
      const day = d.getDate();
      const month = MONTH_NAMES_AR[d.getMonth()];
      const year = d.getFullYear();
      
      return `${dayName}، ${day} ${month} ${year}`;
    } catch {
      return String(date);
    }
  };

  // ─── BUGFIX 2026-08-24 — DUPLICATE PAYROLL COLUMNS ───
  // The backend attaches each dynamic value under up to THREE row keys:
  //   row[t]          (raw type key, e.g. "delay")
  //   row[getLabel(t)] (Arabic label, e.g. "خصم تأخير")
  //   row[stdKey]      (normalized key, e.g. "delay")
  // The column-discovery loop used to treat EVERY unknown non-zero key as a
  // NEW column, so the same deduction rendered twice ("خصم تأخير" column
  // for key "delay" + another for key "خصم تأخير"). normalizeTypeKey()
  // mirrors the backend's getStandardKey() so aliases collapse to one key.
  const normalizeTypeKey = (name: string): string => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return "";
    if (n.includes("أساسي") || n.includes("basic")) return "basic";
    if (n.includes("وجبة") || n.includes("طعام") || n.includes("meal")) return "meal";
    if (n.includes("تأمين") || n.includes("insurance")) return "insurance";
    if (n.includes("انتقال") || n.includes("مواصلات") || n.includes("ركوب") || n.includes("transport")) return "transport";
    if (n.includes("سكن") || n.includes("اسكن") || n.includes("اسكان") || n.includes("السكن") || n.includes("housing")) return "housing";
    if (n.includes("مكافأة") || n.includes("مكافاه") || n.includes("مكافا") || n.includes("bonus")) return "bonus";
    if (n.includes("دليفري") || n.includes("توصيل") || n.includes("delivery")) return "delivery";
    if (n.includes("خصم إجاز") || n.includes("خصم اجاز") || n === "vacation_deduction" || n === "vacation_ded") return "vacation_deduction";
    if (n.includes("بدل إجاز") || n.includes("بدل اجاز") || n === "vacation") return "vacation";
    if (n.includes("إجازة") || n.includes("اجازة") || n.includes("vacation")) {
      return n.includes("خصم") || n.includes("deduction") ? "vacation_deduction" : "vacation";
    }
    if (n.includes("حافز") || n.includes("حوافز") || n.includes("incentive")) return "incentive";
    if (n.includes("طبيعة عمل") || n.includes("work_nature")) return "work_nature";
    if (n.includes("هاتف") || n.includes("تليفون") || n.includes("phone")) return "phone";
    if (n.includes("عمول") || n.includes("commission")) return "commission";
    if (n.includes("غياب") || n.includes("absence")) return "absence";
    if (n.includes("عجز") || n.includes("shortage")) return "shortage";
    if (n.includes("زمالة") || n.includes("fellowship")) return "fellowship";
    if (n.includes("جزاء") || n.includes("penalty")) return "penalty";
    if (n.includes("تأخير") || n.includes("delay")) return "delay";
    if (n.includes("زي ") || n === "زي" || n.includes("uniform")) return "uniform";
    if (n.includes("مباشر") || n.includes("direct")) return "direct";
    if (n.includes("قسط") || n.includes("installment")) return "installment";
    if (n.includes("hr") || n.includes("اتش ار")) return "hr";
    if (n.includes("cl") || n.includes("سي ال")) return "cl";
    return (name || "").trim();
  };

  // True when `key` is just an alias of an entry already in `list`
  // (same raw key, same normalized key, or same display label).
  const isAliasCovered = (key: string, list: string[]): boolean => {
    const kNorm = normalizeTypeKey(key);
    const kLower = (key || "").trim().toLowerCase();
    return list.some((t) => {
      const tNorm = normalizeTypeKey(t);
      const tLabel = (getTypeLabel(t) || t).trim().toLowerCase();
      return (
        t === key ||
        tNorm === kNorm ||
        tNorm === kLower ||
        tLabel === kLower ||
        tLabel === (getTypeLabel(key) || key).trim().toLowerCase()
      );
    });
  };

  // Keep only the first entry per normalized key AND per display label —
  // prevents "delay" + "خصم تأخير" both surviving a settings merge.
  const dedupeTypeList = (list: string[]): string[] => {
    const seenNorm = new Set<string>();
    const seenLabel = new Set<string>();
    const out: string[] = [];
    list.forEach((t) => {
      const n = normalizeTypeKey(t);
      const l = (getTypeLabel(t) || t).trim().toLowerCase();
      if (seenNorm.has(n) || seenLabel.has(l)) return;
      seenNorm.add(n);
      seenLabel.add(l);
      out.push(t);
    });
    return out;
  };
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  // حالة قفل الشهر المالي (من إعدادات «قفل وإغلاق الشهور المالي»).
  // قبل هذا كان القفل يُحفَظ في financial_periods دون أي أثر مرئي داخل مديول
  // المرتبات، فيبدو للمستخدم أن الإقفال لم يفعل شيئًا.
  const { data: lockedMonthsPayload } = useSWR<any>(
    `/api/security/locked-months?year=${selectedYear}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const lockedMonthsList: any[] = Array.isArray(lockedMonthsPayload)
    ? lockedMonthsPayload
    : Array.isArray(lockedMonthsPayload?.data)
      ? lockedMonthsPayload.data
      : [];
  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const isSelectedMonthLocked = lockedMonthsList.some(
    (row: any) =>
      row?.month === selectedMonthKey &&
      (row?.is_locked === true || row?.is_locked === "true"),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pagination state - 50 employees per page by default, adjustable
  const PAYROLL_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
  const [payrollPageSize, setPayrollPageSize] = useState(50);
  const [payrollCurrentPage, setPayrollCurrentPage] = useState(1);

  const [newBonusType, setNewBonusType] = useState("");
  const [newAdvanceType, setNewAdvanceType] = useState("");
  const [newDeductionType, setNewDeductionType] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPenaltyDetailsModal, setShowPenaltyDetailsModal] = useState(false);
  const [penaltyDetails, setPenaltyDetails] = useState<any[]>([]);
  const [penaltyDetailsLoading, setPenaltyDetailsLoading] = useState(false);
  const [penaltyDetailsEmployee, setPenaltyDetailsEmployee] = useState<any>(null);
  // 🎯 نافذة تفاصيل خصم لائحة الجزاءات
  const [showPolicyPenaltiesModal, setShowPolicyPenaltiesModal] = useState(false);
  const [policyPenaltiesDetails, setPolicyPenaltiesDetails] = useState<any>(null);
  const [showOffDayModal, setShowOffDayModal] = useState(false);
  const [offDayEmployee, setOffDayEmployee] = useState<any>(null);
  const [selectedEmployeeAttendance, setSelectedEmployeeAttendance] =
    useState<any>(null);
  const [attendanceModalDeductions, setAttendanceModalDeductions] = useState<any[]>([]);
  const [attendanceModalLoading, setAttendanceModalLoading] = useState(false);
  const [attendanceModalOverrides, setAttendanceModalOverrides] = useState<Record<string, { status: string; deductionId?: number; originalRecord?: any }>>({});
  const [pendingNewAbsences, setPendingNewAbsences] = useState<string[]>([]);
  const [pendingCanceledAbsences, setPendingCanceledAbsences] = useState<number[]>([]);
  const [pendingNewVacationDeductions, setPendingNewVacationDeductions] = useState<string[]>([]);
  const [pendingCanceledVacationDeductions, setPendingCanceledVacationDeductions] = useState<number[]>([]);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [absenceConfirmDialog, setAbsenceConfirmDialog] = useState<{
    isOpen: boolean;
    dateStr: string;
    dayNameAr: string;
    employeeName: string;
    originalRecord?: any;
    deductionType: 'absence' | 'vacation_deduction';
  } | null>(null);

  // Fetch company official holidays
  const { data: officialHolidaysData } = useSWR("/api/hr/official-holidays", fetcher);
  const officialHolidays = Array.isArray(officialHolidaysData) ? officialHolidaysData : [];

  const handleOpenAttendanceModal = async (empRow: any) => {
    setSelectedEmployeeAttendance(empRow);
    setShowAttendanceModal(true);
    setAttendanceModalLoading(true);
    setAttendanceModalOverrides({});
    setPendingNewAbsences([]);
    setPendingCanceledAbsences([]);
    setPendingNewVacationDeductions([]);
    setPendingCanceledVacationDeductions([]);
    
    try {
      const res = await api.get(`/api/payroll/deductions?year=${selectedYear}&month=${selectedMonth}&employee_id=${empRow.id}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.deductions) ? data.deductions : Array.isArray(data) ? data : [];
        setAttendanceModalDeductions(list);
      } else {
        setAttendanceModalDeductions([]);
      }
    } catch (e) {
      console.error("Failed to load deductions for employee", e);
      setAttendanceModalDeductions([]);
    } finally {
      setAttendanceModalLoading(false);
    }
  };

  // 🎯 دالة فتح نافذة تفاصيل خصم لائحة الجزاءات
  const handleOpenPolicyPenaltiesModal = (row: any) => {
    setPolicyPenaltiesDetails({
      employee: row,
      penalties: row.auto_penalties_details || [],
      total: row.auto_penalties || 0
    });
    setShowPolicyPenaltiesModal(true);
  };

  const [formData, setFormData] = useState<any>({});
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Show off-day attendance details modal
  const handleShowOffDayDetails = (employee: any) => {
    setOffDayEmployee(employee);
    setShowOffDayModal(true);
  };

  // Comprehensive Deduction Details State & Handler
  const [deductionDetailsModal, setDeductionDetailsModal] = useState<{
    isOpen: boolean;
    employee: any;
    deductionType: string;
    typeLabel: string;
    totalAmount: number;
    records: any[];
    loading: boolean;
  }>({
    isOpen: false,
    employee: null,
    deductionType: "",
    typeLabel: "",
    totalAmount: 0,
    records: [],
    loading: false
  });

  const handleShowDeductionDetails = async (employee: any, deductionType: string) => {
    const isAdvance = advancesTypes.includes(deductionType);
    const typeLabel = deductionType === "insurance" 
      ? "تأمينات اجتماعية" 
      : isAdvance 
        ? (getTypeLabel(deductionType, "advances") || deductionType)
        : (getTypeLabel(deductionType, "penalties") || deductionType);
    const currentVal = Number(employee[deductionType]) || 0;

    setDeductionDetailsModal({
      isOpen: true,
      employee,
      deductionType,
      typeLabel,
      totalAmount: currentVal,
      records: [],
      loading: true
    });

    try {
      let records: any[] = [];

      // 1. If it's an advance (direct or installment), query advances API
      if (deductionType === "direct" || deductionType === "installment") {
        try {
          const advRes = await api.get(
            `/api/payroll/advances?year=${selectedYear}&month=${selectedMonth}&employee_id=${employee.id}`
          );
          if (advRes.ok) {
            const advData = await advRes.json();
            const list = Array.isArray(advData?.advances) ? advData.advances : Array.isArray(advData) ? advData : [];
            const filtered = list.filter((a: any) => a.type === deductionType || !a.type);
            records = filtered.map((a: any) => ({
              id: a.id,
              date: a.date ? String(a.date).split('T')[0] : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
              type: a.type === "installment" ? "سلفة قسط" : "سلفة مباشرة",
              amount: a.type === "installment" ? (a.installment_amount || a.amount) : a.amount,
              notes: a.notes || (a.type === "installment" ? `قسط شهري من إجمالي ${a.amount} ج.م (${a.installments_count || 1} أقساط)` : `سلفة مباشرة`)
            }));
          }
        } catch (_err) {}
      } else {
        // 2. Fetch deductions from API
        const res = await api.get(
          `/api/payroll/deductions?year=${selectedYear}&month=${selectedMonth}&employee_id=${employee.id}`
        );
        if (res.ok) {
          const data = await res.json();
          const allDeductions = Array.isArray(data?.deductions) ? data.deductions : Array.isArray(data) ? data : [];
          
          records = allDeductions.filter((d: any) => {
            if (deductionType === "vacation_deduction") {
              return d.type === "vacation_deduction" || 
                     String(d.notes || "").includes("إجازة") || 
                     String(d.notes || "").includes("اجازة") || 
                     String(d.reason || "").includes("إجازة") ||
                     String(d.reason || "").includes("اجازة");
            } else if (deductionType === "absence") {
              return d.type === "absence" || String(d.notes || "").includes("غياب") || String(d.reason || "").includes("غياب");
            } else if (deductionType === "penalty") {
              return d.type === "penalty" || d.type === "delay" || d.type === "early_leave" || d.type === "manual" || d.type === "missing_punch";
            } else if (deductionType === "cl") {
              return d.type === "cl" || String(d.notes || "").toLowerCase().includes("cl");
            } else if (deductionType === "shortage") {
              return d.type === "shortage" || String(d.notes || "").includes("عجز");
            } else if (deductionType === "fellowship") {
              return d.type === "fellowship" || String(d.notes || "").includes("زمالة");
            } else if (deductionType === "hr") {
              return d.type === "hr" || String(d.notes || "").toLowerCase().includes("hr");
            }
            return d.type === deductionType;
          });
        }
      }

      // 3. Fallback: If no explicit row returned but currentVal > 0, generate structured explanation row
      if (records.length === 0 && currentVal > 0) {
        if (deductionType === "vacation_deduction") {
          const basic = Number(employee.basic) || 0;
          const dayVal = basic > 0 ? Number((basic / 30).toFixed(2)) : 0;
          const approxDays = dayVal > 0 ? (currentVal / dayVal).toFixed(1) : "1";
          records.push({
            date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
            type: "خصم إجازات",
            amount: currentVal,
            notes: `خصم إجازة محتسب من شيت الحضور والبصمة (${approxDays} يوم × ${dayVal} ج.م/يوم)`
          });
        } else if (deductionType === "absence") {
          records.push({
            date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
            type: "خصم غياب",
            amount: currentVal,
            notes: `خصم أيام الغياب المسجلة لشهر ${selectedMonth}/${selectedYear}`
          });
        } else if (deductionType === "insurance") {
          records.push({
            date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
            type: "تأمينات اجتماعية",
            amount: currentVal,
            notes: `حصة الموظف المستقطعة للتأمينات الاجتماعية`
          });
        } else {
          records.push({
            date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
            type: typeLabel,
            amount: currentVal,
            notes: `خصم ${typeLabel} مسجل في كشف المرتبات لشهر ${selectedMonth}/${selectedYear}`
          });
        }
      }

      setDeductionDetailsModal((prev) => ({
        ...prev,
        records,
        loading: false
      }));
    } catch (e) {
      console.error("Failed to fetch deduction details", e);
      setDeductionDetailsModal((prev) => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Fetch penalty/deduction details for a specific employee+month when the admin clicks the "جزاء" cell
  const handleShowPenaltyDetails = async (employee: any) => {
    handleShowDeductionDetails(employee, "penalty");
  };

  // SWR Hooks
  const { data: employeesData } = useSWR("/api/hr/employees", fetcher);
  const employees = Array.isArray(employeesData) ? employeesData : [];

  const { data: branchesData } = useSWR("/api/branches", fetcher);
  const branches = Array.isArray(branchesData) ? branchesData : [];

  const { data: departmentsData } = useSWR("/api/hr/departments", fetcher);
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  const {
    data: payrollDataRaw,
    isLoading: payrollLoading,
    mutate: mutatePayroll,
  } = useSWR(
    activeTab === "approved"
      ? `/api/payroll?year=${selectedYear}&month=${selectedMonth}&branch=${selectedBranch}&department=${selectedDepartment}`
      : null,
    fetcher,
  );
  const payrollData = Array.isArray(payrollDataRaw)
    ? payrollDataRaw
    : Array.isArray(payrollDataRaw?.payroll)
    ? payrollDataRaw.payroll
    : Array.isArray(payrollDataRaw?.data)
    ? payrollDataRaw.data
    : [];

  useEffect(() => {
    if (payrollData && Array.isArray(payrollData) && payrollData.length > 0) {
      const knownStandardBonuses = ['transport', 'housing', 'bonus', 'delivery', 'vacation', 'incentive', 'work_nature', 'phone', 'commission'];
      const knownStandardDeductions = ['absence', 'cl', 'shortage', 'fellowship', 'hr', 'penalty', 'delay', 'uniform'];
      const knownStandardAdvances = ['direct', 'installment'];

      // Reserved keys that are NOT salary-component columns — these are
      // structural fields on each payroll row and must never be treated as
      // bonus/deduction/advance columns even if the row object has them.
      const reservedKeys = new Set([
        'id', 'name', 'job', 'branch_name', 'basic', 'days', 'actual', 'meal',
        'insurance', 'totalAdd', 'totalDed', 'net', 'attendance_records',
        'weekly_off_days', 'off_day_attendance', 'overtime_bonus', 'is_hourly',
        'works_hourly', 'hourly_rate', 'minute_rate', 'total_worked_hours',
        'total_worked_minutes', 'total_worked_hours_display', 'shift_hours',
        'delivery_count', 'advanceInst', 'advanceDirect',
        // Internal backend echo keys also reserved
        'salary_components',
        // Auto penalties from policy - rendered as dedicated column
        'auto_penalties', 'auto_penalties_details',
        // 🎯 منع تكرار أعمدة الاستقطاعات المعروفة (CL، تأمينات، إلخ)
        // مع جميع أشكال الكتابة (صغيرة، كبيرة، مختلطة)
        'cl', 'CL', 'Cl', 'cL',
        'absence', 'ABSENCE', 'Absence',
        'shortage', 'SHORTAGE', 'Shortage',
        'fellowship', 'FELLOWSHIP', 'Fellowship',
        'hr', 'HR', 'Hr',
        'penalty', 'PENALTY', 'Penalty',
        'delay', 'DELAY', 'Delay',
        'uniform', 'UNIFORM', 'Uniform',
        'vacation_deduction', 'VACATION_DEDUCTION', 'Vacation_deduction',
        'vacation_ded', 'VACATION_DED', 'Vacation_ded',
        'insurance', 'INSURANCE', 'Insurance',
      ]);

      const newBonuses: string[] = [];
      const newDeductions: string[] = [];
      const newAdvances: string[] = [];

      payrollData.forEach((row: any) => {
        if (!row || typeof row !== 'object') return;
        Object.keys(row).forEach((key) => {
          if (reservedKeys.has(key)) return;

          // Skip keys whose value is 0/undefined for this row — without this
          // guard, EVERY row contributes dozens of zero-valued columns
          // (one per discovered type), making the table unreadable.
          const val = Number(row[key]);
          if (!isFinite(val) || val === 0) return;

          if (knownStandardBonuses.includes(key)) {
            if (!isAliasCovered(key, [...bonusesTypes, ...newBonuses])) newBonuses.push(key);
          } else if (knownStandardDeductions.includes(key)) {
            if (!isAliasCovered(key, [...deductionsTypes, ...newDeductions])) newDeductions.push(key);
          } else if (knownStandardAdvances.includes(key)) {
            if (!isAliasCovered(key, [...advancesTypes, ...newAdvances])) newAdvances.push(key);
          } else {
            // CUSTOM component — the user added a salary_component with a
            // name that doesn't match any of the standard English keys
            // (e.g. "بدل اسكان" with an extra alef, or any Arabic name).
            // The backend has already normalised these into the row under
            // their original name. We surface them as bonus columns by
            // default; the user can reclassify them in settings if needed.
            //
            // Heuristic to guess the category from the Arabic/English name
            // so we don't put a deduction column under "bonuses":
            const k = key.toLowerCase();
            const looksLikeDeduction =
              k.includes('خصم') || k.includes('استقطاع') ||
              k.includes('deduction') || k.includes('penalty') ||
              k.includes('جزاء') || k.includes('عجز') ||
              k.includes('shortage');
            const looksLikeAdvance =
              k.includes('سلف') || k.includes('قسط') ||
              k.includes('advance') || k.includes('installment');

            if (looksLikeDeduction) {
              if (!isAliasCovered(key, [...deductionsTypes, ...newDeductions])) newDeductions.push(key);
            } else if (looksLikeAdvance) {
              if (!isAliasCovered(key, [...advancesTypes, ...newAdvances])) newAdvances.push(key);
            } else {
              if (!isAliasCovered(key, [...bonusesTypes, ...newBonuses])) newBonuses.push(key);
            }
          }
        });
      });

      if (newBonuses.length > 0) {
        setBonusesTypes((prev) => dedupeTypeList([...prev, ...newBonuses]));
      }
      if (newDeductions.length > 0) {
        setDeductionsTypes((prev) => dedupeTypeList([...prev, ...newDeductions]));
      }
      if (newAdvances.length > 0) {
        setAdvancesTypes((prev) => dedupeTypeList([...prev, ...newAdvances]));
      }
    }
  }, [payrollData]);

  const {
    data: advancesData,
    isLoading: advancesLoading,
    mutate: mutateAdvances,
  } = useSWR(
    activeTab === "advances"
      ? `/api/payroll/advances?year=${selectedYear}&month=${selectedMonth}`
      : null,
    fetcher,
  );
  const advances = Array.isArray(advancesData)
    ? advancesData
    : Array.isArray(advancesData?.advances)
    ? advancesData.advances
    : Array.isArray(advancesData?.data)
    ? advancesData.data
    : [];

  const {
    data: bonusesData,
    isLoading: bonusesLoading,
    mutate: mutateBonuses,
  } = useSWR(
    activeTab === "bonuses"
      ? `/api/payroll/bonuses?year=${selectedYear}&month=${selectedMonth}`
      : null,
    fetcher,
  );
  const bonuses = Array.isArray(bonusesData)
    ? bonusesData
    : Array.isArray(bonusesData?.bonuses)
    ? bonusesData.bonuses
    : Array.isArray(bonusesData?.data)
    ? bonusesData.data
    : [];

  const {
    data: deductionsData,
    isLoading: deductionsLoading,
    mutate: mutateDeductions,
  } = useSWR(
    activeTab === "penalties"
      ? `/api/payroll/deductions?year=${selectedYear}&month=${selectedMonth}`
      : null,
    fetcher,
  );
  const deductions = Array.isArray(deductionsData)
    ? deductionsData
    : Array.isArray(deductionsData?.deductions)
    ? deductionsData.deductions
    : Array.isArray(deductionsData?.data)
    ? deductionsData.data
    : [];

  const fetchPayrollData = () => {
    mutatePayroll();
  };

  const loading =
    payrollLoading || advancesLoading || bonusesLoading || deductionsLoading;
  const handleDelete = async (id: number, type: string) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      const res = await api.delete(
        `/api/payroll/${type}/${id}?userId=${user?.id}`,
      );
      if (res.ok) {
        if (type === "advances") mutateAdvances();
        if (type === "bonuses") mutateBonuses();
        if (type === "deductions") mutateDeductions();
      } else {
        const data = await res.json();
        alert(data.error || "فشل الحذف");
      }
    } catch (error) {
      console.error(`Failed to delete ${type}`, error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let endpoint = "";
    if (activeTab === "advances") endpoint = "/api/payroll/advances";
    if (activeTab === "bonuses") endpoint = "/api/payroll/bonuses";
    if (activeTab === "penalties") endpoint = "/api/payroll/deductions";

    try {
      const res = await api.post(endpoint, {
        ...formData,
        date: `${selectedYear}-${selectedMonth.toString().padStart(2, "0")}-01`,
        userId: user?.id,
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({});
        if (activeTab === "advances") mutateAdvances();
        if (activeTab === "bonuses") mutateBonuses();
        if (activeTab === "penalties") mutateDeductions();
      } else {
        const data = await res.json();
        alert(data.error || "فشل الإضافة");
      }
    } catch (error) {
      console.error("Failed to add record", error);
    }
  };

  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(["all"]);
  const isAllEmpsSelected = selectedEmpIds.length === 0 || selectedEmpIds.includes("all");

  const parsedSearchTerms = searchQuery
    ? searchQuery.split(/[,+\n;|\t]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const filteredData = payrollData.filter((row: any) => {
    if (!isAllEmpsSelected) {
      const rowIdStr = String(row.employee_id || row.id || "");
      if (!selectedEmpIds.includes(rowIdStr)) return false;
    }

    if (parsedSearchTerms.length > 0) {
      const name = (row.name || row.employee_name || "").toLowerCase();
      const id = String(row.id || row.employee_id || "").toLowerCase();
      const code = String(row.fingerprint_code || "").toLowerCase();

      const matched = parsedSearchTerms.some(
        (t) => name.includes(t) || id.includes(t) || code.includes(t)
      );
      if (!matched) return false;
    }

    return true;
  });

  // Pagination calculations
  const payrollTotalPages = Math.max(1, Math.ceil(filteredData.length / payrollPageSize));
  const paginatedPayrollData = filteredData.slice(
    (payrollCurrentPage - 1) * payrollPageSize,
    payrollCurrentPage * payrollPageSize,
  );

  // Reset to page 1 when filters/search/page-size change
  useEffect(() => {
    setPayrollCurrentPage(1);
  }, [searchQuery, selectedYear, selectedMonth, selectedBranch, selectedDepartment, payrollPageSize]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleExport = () => {
    const exportData = filteredData.map((row: any) => {
      const item: any = {
        "الإسم الكامل للموظف": row.name,
        "الوظيفة المعتمدة": row.job,
        "الراتب الأساسي": row.basic,
        "أيام العمل": row.days,
        "المستحق الفعلي": row.actual,
        "بدل وجبه": row.meal,
      };

      // Add dynamic bonuses
      bonusesTypes.forEach((t) => {
        item[getTypeLabel(t, "bonuses")] = row[t] || 0;
      });

      item["إجمالي الإضافي"] = row.totalAdd;

      // Add dynamic deductions
      deductionsTypes.forEach((t) => {
        item[getTypeLabel(t, "penalties")] = row[t] || 0;
      });

      item["تأمينات"] = row.insurance;

      // Add dynamic advances
      advancesTypes.forEach((t) => {
        item[getTypeLabel(t, "advances")] = row[t] || 0;
      });

      // Add auto penalties from policy
      item["خصم لائحة"] = row.auto_penalties || 0;

      item["إجمالي الخصم"] = row.totalDed;
      item["صافي الأجر الصافي"] = row.net;

      return item;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, `كشف_الرواتب_${selectedYear}_${selectedMonth}.xlsx`);
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900"
      dir="rtl"
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex bg-slate-100 rounded-xl p-1">
            {!hideTabs ? (
              <>
                <button
                  onClick={() => setActiveTab("approved")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${
                    activeTab === "approved"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  كشوف الرواتب المعتمدة
                </button>
                <button
                  onClick={() => setActiveTab("run")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5 ${
                    activeTab === "run"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  إقفال وصرف المسير
                </button>
                <button
                  onClick={() => setActiveTab("advances")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${
                    activeTab === "advances"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  إدارة السلف
                </button>
                <button
                  onClick={() => setActiveTab("bonuses")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${
                    activeTab === "bonuses"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  المكافآت والبدلات
                </button>
                <button
                  onClick={() => setActiveTab("penalties")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${
                    activeTab === "penalties"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  الجزاءات والخصومات
                </button>
                {hasExplicitPermission('salaries.settings') && (
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5 ${
                      activeTab === "settings"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    إعدادات البنود
                  </button>
                )}
                <button
                  onClick={() => setActiveTab("reports")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5 ${
                    activeTab === "reports"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  تقارير المرتبات
                </button>
              </>
            ) : (
              <div className="px-6 py-2 rounded-lg font-bold text-sm bg-rose-600 text-white shadow-sm flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                {activeTab === "approved" && "كشوف الرواتب المعتمدة"}
                {activeTab === "advances" && "إدارة السلف"}
                {activeTab === "bonuses" && "المكافآت والبدلات"}
                {activeTab === "penalties" && "الجزاءات والخصومات"}
                {activeTab === "settings" && "إعدادات البنود"}
                {activeTab === "reports" && "تقارير المرتبات"}
                {activeTab === "run" && "إقفال وصرف المسير"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Bar - Sticky so it stays visible when scrolling the table */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            title="تصدير الكشف"
          >
            <CloudDownload className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            title="ملء الشاشة"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              fetchPayrollData();
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            تحديث البيانات
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
          <div className="w-full sm:w-[420px] md:w-[500px] lg:w-[580px]">
            <MultiEmployeeSearchFilter
              employees={employees}
              selectedEmployeeIds={selectedEmpIds}
              onSelectionChange={setSelectedEmpIds}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              placeholder="بحث متعدد بالاسم أو الكود (تفصل بينها فاصلة ,)..."
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            <select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent focus:outline-none text-sm font-bold text-slate-700"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-white">
                  سنة {y}
                </option>
              ))}
            </select>
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent focus:outline-none text-sm font-bold text-rose-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m} className="bg-white">
                  شهر {m}
                </option>
              ))}
            </select>
          </div>

          {/* أثـر قفل الشهر: يظهر هنا حتى يعرف المستخدم أن الشهر مقفل قبل أي إدخال */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-bold text-sm ${
              isSelectedMonthLocked
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
            title={
              isSelectedMonthLocked
                ? "الشهر مقفل ماليًا: لا يمكن إضافة أو تعديل السلف والمكافآت والخصومات والبصمات ولا إقفال/صرف المسير حتى فتح الشهر من الإعدادات"
                : "الشهر مفتوح للإدخال"
            }
          >
            <Lock className="w-4 h-4" />
            {isSelectedMonthLocked ? "شهر مقفل ماليًا" : "الشهر مفتوح"}
          </div>

          <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            <select
              value={selectedDepartment ?? ""}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-transparent focus:outline-none text-sm font-bold text-emerald-600"
            >
              <option value="all" className="bg-white">
                جميع الأقسام
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-white">
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            <select
              value={selectedBranch ?? ""}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent focus:outline-none text-sm font-bold text-blue-600"
            >
              <option value="all" className="bg-white">
                جميع فروع المجموعة
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Area - no overflow-auto here so thead sticky is relative to the dashboard scroll container */}
      <div className="flex-1 p-4">
        {activeTab === "run" && (
          <PayrollRunPanel
            year={selectedYear}
            month={selectedMonth}
            branch={selectedBranch}
            department={selectedDepartment}
          />
        )}

        {activeTab === "approved" && (
          <div className="bg-white rounded-xl">
            <table className="w-full text-center text-xs border-collapse">
              <thead className="sticky z-20" style={{ top: "79px" }}>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-700 w-48">
                    الإسم الكامل للموظف
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-700">
                    الوظيفة المعتمدة
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-700">
                    الراتب الأساسي
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-white bg-blue-600">
                    أيام العمل
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-white bg-emerald-600">
                    حضور إجازة
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-700 bg-blue-100">
                    المستحق الفعلي
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-800 bg-yellow-400">
                    بدل وجبه
                  </th>
                  {bonusesTypes.map((t) => (
                    <th
                      key={t}
                      className="p-3 border-l border-slate-300 font-bold text-slate-800 bg-yellow-400"
                    >
                      {getTypeLabel(t, "bonuses")}
                    </th>
                  ))}
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-900 bg-orange-400">
                    إجمالي الإضافي
                  </th>
                  {deductionsTypes.map((t) => (
                    <th
                      key={t}
                      className="p-3 border-l border-slate-300 font-bold text-slate-900 bg-emerald-400"
                    >
                      {getTypeLabel(t, "penalties")}
                    </th>
                  ))}
                  <th className="p-3 border-l border-slate-300 font-bold text-slate-900 bg-emerald-400">
                    تأمينات
                  </th>
                  {advancesTypes.map((t) => (
                    <th
                      key={t}
                      className="p-3 border-l border-slate-300 font-bold text-slate-900 bg-emerald-400"
                    >
                      {getTypeLabel(t, "advances")}
                    </th>
                  ))}
                  {/* 🎯 عمود خصم لائحة الجزاءات التلقائية - لون أخضر مثل باقي الخصومات */}
                  <th className="p-3 border-l border-slate-300 font-bold text-white bg-emerald-500">
                    خصم لائحة
                  </th>
                  <th className="p-3 border-l border-slate-300 font-bold text-white bg-slate-600">
                    إجمالي الخصم
                  </th>
                  <th className="p-3 font-bold text-slate-800 bg-slate-200">
                    صافي الأجر الصافي
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        11 +
                        bonusesTypes.length +
                        deductionsTypes.length +
                        advancesTypes.length
                      }
                      className="p-8 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
                        <p>جاري تحميل البيانات...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        11 +
                        bonusesTypes.length +
                        deductionsTypes.length +
                        advancesTypes.length
                      }
                      className="p-8 text-center text-slate-500"
                    >
                      لا توجد بيانات للعرض
                    </td>
                  </tr>
                ) : (
                  paginatedPayrollData.map((row: any, idx: any) => (
                    <tr
                      key={row.id != null ? `payroll-row-${row.id}-${idx}` : `payroll-idx-${idx}`}
                      className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    >
                      <td className="p-3 border-l border-slate-200 text-slate-900 font-bold text-right">
                        {row.name}
                      </td>
                      <td className="p-3 border-l border-slate-200 text-slate-600">
                        {row.job}
                      </td>
                      <td className="p-3 border-l border-slate-200 text-slate-900 font-bold">
                        {row.basic}
                      </td>
                      <td
                        className="p-3 border-l border-slate-200 text-blue-600 font-bold cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => {
                          handleOpenAttendanceModal(row);
                        }}
                      >
                        <div>
                          {(() => {
                            if (Array.isArray(row.attendance_records) && row.attendance_records.length > 0) {
                              const uniqueDates = new Set(
                                row.attendance_records
                                  .map((r: any) => String(r.date || "").split("T")[0].split(" ")[0])
                                  .filter(Boolean)
                              );
                              if (uniqueDates.size > 0) return uniqueDates.size;
                            }
                            return row.days || 0;
                          })()}
                        </div>
                        {row.is_hourly && (
                          <span className="text-[10px] text-slate-500 font-normal block">
                            ({row.total_worked_hours_display || `${row.total_worked_hours} س`})
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-l border-slate-200 text-center">
                        <button
                          type="button"
                          onClick={() => handleShowOffDayDetails(row)}
                          className={`font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1 min-w-[28px] ${
                            (row.off_day_attendance || 0) > 0
                              ? "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
                              : "text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                          }`}
                          title="اضغط لعرض تفاصيل الإجازة الأسبوعية وتفاصيل الحضور"
                        >
                          <span>{row.off_day_attendance || 0}</span>
                        </button>
                      </td>
                      <td className="p-3 border-l border-slate-200 text-slate-900">
                        <div className="flex flex-col">
                          <span className="font-bold">{row.actual}</span>
                          {row.is_hourly && (
                            <span
                              className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded mt-0.5 font-medium inline-block"
                              title={`حساب بالساعة والدقيقة: ${row.total_worked_hours_display || `${row.total_worked_hours} ساعة`} × ${row.hourly_rate} ج.م/ساعة (${row.minute_rate} ج.م/دقيقة)`}
                            >
                              ⏱️ {row.total_worked_hours_display || `${row.total_worked_hours} س`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-l border-slate-200 text-slate-700">
                        {row.meal}
                      </td>
                      {bonusesTypes.map((t) => (
                        <td
                          key={t}
                          className="p-3 border-l border-slate-200 text-slate-700"
                        >
                          {row[t] || 0}
                          {t === "delivery" && row.delivery_count > 0 && (
                            <span className="text-[10px] text-slate-400 block">
                              ({row.delivery_count} طلب)
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="p-3 border-l border-slate-200 text-orange-600 font-bold">
                        {row.totalAdd}
                      </td>
                      {deductionsTypes.map((t) => {
                        const val = Number(row[t]) || 0;
                        const label = getTypeLabel(t, "penalties") || t;
                        return (
                          <td
                            key={t}
                            className={`p-3 border-l border-slate-200 text-slate-700 transition-colors ${
                              val > 0
                                ? "cursor-pointer hover:bg-rose-50 hover:text-rose-900 group"
                                : ""
                            }`}
                            onClick={() => {
                              if (val > 0) {
                                handleShowDeductionDetails(row, t);
                              }
                            }}
                            title={
                              val > 0
                                ? `اضغط لعرض تفاصيل ${label} للموظف`
                                : ""
                            }
                          >
                            {val > 0 ? (
                              <span className="text-rose-600 font-bold underline decoration-dotted underline-offset-2 hover:text-rose-800 transition-colors">
                                {row[t]}
                              </span>
                            ) : (
                              row[t] || 0
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={`p-3 border-l border-slate-200 text-slate-700 transition-colors ${
                          (Number(row.insurance) || 0) > 0
                            ? "cursor-pointer hover:bg-blue-50"
                            : ""
                        }`}
                        onClick={() => {
                          if ((Number(row.insurance) || 0) > 0) {
                            handleShowDeductionDetails(row, "insurance");
                          }
                        }}
                        title={(Number(row.insurance) || 0) > 0 ? "اضغط لعرض تفاصيل التأمينات" : ""}
                      >
                        {(Number(row.insurance) || 0) > 0 ? (
                          <span className="text-slate-800 font-bold underline decoration-dotted underline-offset-2">
                            {row.insurance}
                          </span>
                        ) : (
                          row.insurance || 0
                        )}
                      </td>
                      {advancesTypes.map((t) => {
                        const val = Number(row[t]) || 0;
                        const label = getTypeLabel(t, "advances") || t;
                        return (
                          <td
                            key={t}
                            className={`p-3 border-l border-slate-200 text-slate-700 transition-colors ${
                              val > 0
                                ? "cursor-pointer hover:bg-amber-50"
                                : ""
                            }`}
                            onClick={() => {
                              if (val > 0) {
                                handleShowDeductionDetails(row, t);
                              }
                            }}
                            title={
                              val > 0
                                ? `اضغط لعرض تفاصيل ${label} للموظف`
                                : ""
                            }
                          >
                            {val > 0 ? (
                              <span className="text-amber-700 font-bold underline decoration-dotted underline-offset-2 hover:text-amber-900">
                                {row[t]}
                              </span>
                            ) : (
                              row[t] || 0
                            )}
                          </td>
                        );
                      })}
                      {/* 🎯 خلية خصم لائحة الجزاءات التلقائية - لون أخضر */}
                      <td 
                        className={`p-3 border-l border-slate-200 font-bold transition-colors ${
                          (Number(row.auto_penalties) || 0) > 0
                            ? "text-emerald-700 bg-emerald-50 cursor-pointer hover:bg-emerald-100"
                            : "text-slate-600"
                        }`}
                        onClick={() => {
                          if ((Number(row.auto_penalties) || 0) > 0) {
                            // فتح نافذة تفاصيل لائحة الجزاءات
                            handleOpenPolicyPenaltiesModal(row);
                          }
                        }}
                        title={
                          (Number(row.auto_penalties) || 0) > 0 
                            ? "اضغط لعرض تفاصيل الجزاءات من اللائحة" 
                            : "لا توجد جزاءات من اللائحة"
                        }
                      >
                        {(Number(row.auto_penalties) || 0) > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            {row.auto_penalties}
                          </span>
                        ) : (
                          row.auto_penalties || 0
                        )}
                      </td>
                      <td className="p-3 border-l border-slate-200 text-slate-900 font-bold bg-slate-100">
                        {row.totalDed}
                      </td>
                      <td className="p-3 text-slate-900 font-bold bg-slate-50">
                        {row.net}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls - shows when there are employees in the approved payroll tab */}
        {activeTab === "approved" && filteredData.length > 0 && (
          <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-bold">عرض</span>
              <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs">
                {(payrollCurrentPage - 1) * payrollPageSize + 1}
              </span>
              <span>إلى</span>
              <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs">
                {Math.min(payrollCurrentPage * payrollPageSize, filteredData.length)}
              </span>
              <span>من</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                {filteredData.length}
              </span>
              <span>موظف</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPayrollCurrentPage(1)}
                disabled={payrollCurrentPage === 1}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="الصفحة الأولى"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPayrollCurrentPage((p) => Math.max(1, p - 1))}
                disabled={payrollCurrentPage === 1}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="الصفحة السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {(() => {
                const pages: number[] = [];
                let startP = Math.max(1, payrollCurrentPage - 2);
                let endP = Math.min(payrollTotalPages, payrollCurrentPage + 2);
                if (payrollCurrentPage <= 3) endP = Math.min(payrollTotalPages, 5);
                if (payrollCurrentPage >= payrollTotalPages - 2) startP = Math.max(1, payrollTotalPages - 4);
                for (let i = startP; i <= endP; i++) pages.push(i);
                return pages.map((page) => (
                  <button
                    key={page}
                    onClick={() => setPayrollCurrentPage(page)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                      page === payrollCurrentPage
                        ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                        : "border border-slate-200 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    {page}
                  </button>
                ));
              })()}

              <button
                onClick={() => setPayrollCurrentPage((p) => Math.min(payrollTotalPages, p + 1))}
                disabled={payrollCurrentPage === payrollTotalPages}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="الصفحة التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPayrollCurrentPage(payrollTotalPages)}
                disabled={payrollCurrentPage === payrollTotalPages}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="الصفحة الأخيرة"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm text-slate-500 font-bold">
                صفحة {payrollCurrentPage} من {payrollTotalPages}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-slate-500 font-bold">موظف لكل صفحة</span>
                <select
                  value={payrollPageSize ?? ""}
                  onChange={(e) => setPayrollPageSize(parseInt(e.target.value))}
                  className="bg-transparent focus:outline-none text-sm font-bold text-slate-700 cursor-pointer"
                  title="عدد الموظفين المعروضين في كل صفحة"
                >
                  {PAYROLL_PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab !== "approved" && activeTab !== "settings" && activeTab !== "run" && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {activeTab === "advances" && "إدارة السلف"}
                {activeTab === "bonuses" && "المكافآت والبدلات"}
                {activeTab === "penalties" && "الجزاءات والخصومات"}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setEmployeeSearchQuery("");
                  setFormData({});
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors"
              >
                إضافة جديد
              </button>
            </div>

            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-3 font-bold text-slate-700">الموظف</th>
                  <th className="p-3 font-bold text-slate-700">المبلغ</th>
                  <th className="p-3 font-bold text-slate-700">النوع</th>
                  <th className="p-3 font-bold text-slate-700">ملاحظات</th>
                  <th className="p-3 font-bold text-slate-700 text-center">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {(Array.isArray(
                  activeTab === "advances"
                    ? advances
                    : activeTab === "bonuses"
                      ? bonuses
                      : deductions
                )
                  ? (activeTab === "advances"
                      ? advances
                      : activeTab === "bonuses"
                        ? bonuses
                        : deductions)
                  : []
                ).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3">{item.employee_name}</td>
                    <td className="p-3 font-bold">{item.amount}</td>
                    <td className="p-3">
                      {getTypeLabel(
                        item.type,
                        activeTab === "penalties"
                          ? "penalties"
                          : activeTab === "bonuses"
                            ? "bonuses"
                            : "advances",
                      )}
                    </td>
                    <td className="p-3">{item.notes || "---"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() =>
                          handleDelete(
                            item.id,
                            activeTab === "penalties"
                              ? "deductions"
                              : activeTab,
                          )
                        }
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                {(activeTab === "advances"
                  ? advances
                  : activeTab === "bonuses"
                    ? bonuses
                    : deductions
                ).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      لا توجد حركات مسجلة في هذا الشهر
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="border-b border-slate-200 pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-500" />
                إعدادات البنود والأنواع المخصصة
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                قم بإضافة وتعديل بنود المكافآت، السلف، والخصومات لإستخدامها في
                مديول الرواتب بالبرنامج.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overtime & Bonuses Types */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-[500px]">
                <h3 className="font-bold text-slate-800 mb-3 text-base flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  انواع الاضافي والبدلات
                </h3>

                {/* Add Input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newBonusType ?? ""}
                    onChange={(e) => setNewBonusType(e.target.value)}
                    placeholder="اسم البند الجديد... (مثال: بدل سكن)"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={async () => {
                      if (!newBonusType.trim()) {
                        alert("⚠️ يرجى إدخال اسم البند");
                        return;
                      }
                      const val = newBonusType.trim();
                      
                      // 🎯 تحقق شامل منع التكرار (بإهمال حالة الأحرف والتطبيع)
                      const normalizedNew = normalizeTypeKey(val);
                      const isDuplicate = bonusesTypes.some(existing => 
                        normalizeTypeKey(existing).toLowerCase() === normalizedNew.toLowerCase() ||
                        existing.toLowerCase() === val.toLowerCase()
                      );
                      
                      if (isDuplicate) {
                        alert(`❌ خطأ: البند "${val}" موجود مسبقاً!\n\nلا يمكن إضافة نفس البند أكثر من مرة.`);
                        return;
                      }
                      
                      // 🎯 التحقق من وجوده في الأنواع الأخرى أيضاً
                      const allExistingTypes = [...bonusesTypes, ...deductionsTypes, ...advancesTypes];
                      const existsInOtherCategory = allExistingTypes.some(existing => 
                        normalizeTypeKey(existing).toLowerCase() === normalizedNew.toLowerCase()
                      );
                      
                      if (existsInOtherCategory) {
                        alert(`⚠️ تحذير: اسم مشابه موجود في فئة أخرى!\n\nالبند "${val}" قد يكون مكرراً. هل تريد المتابعة؟`);
                      }
                      
                      const updated = dedupeTypeList([...bonusesTypes, val]);
                      const ok = await saveCustomTypes(
                        "payroll_bonuses_types",
                        updated,
                      );
                      if (ok) {
                        setBonusesTypes(updated);
                        setNewBonusType("");
                      } else {
                        alert("فشل في حفظ البند");
                      }
                    }}
                    className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center"
                    title="إضافة"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {bonusesTypes.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm"
                    >
                      <span className="text-sm text-slate-800 font-medium">
                        {getTypeLabel(item, "bonuses")}
                      </span>
                      <button
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `هل أنت متأكد من حذف بند "${getTypeLabel(item, "bonuses")}"؟`,
                            )
                          )
                            return;
                          const updated = bonusesTypes.filter(
                            (t) => t !== item,
                          );
                          const ok = await saveCustomTypes(
                            "payroll_bonuses_types",
                            updated,
                          );
                          if (ok) {
                            setBonusesTypes(updated);
                          } else {
                            alert("فشل في الحذف");
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {bonusesTypes.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      لا توجد بنود مدونة
                    </div>
                  )}
                </div>
              </div>

              {/* Advances Types */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-[500px]">
                <h3 className="font-bold text-slate-800 mb-3 text-base flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  انواع السلفيات
                </h3>

                {/* Add Input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newAdvanceType ?? ""}
                    onChange={(e) => setNewAdvanceType(e.target.value)}
                    placeholder="اسم البند الجديد... (مثال: سلفة طوارئ)"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={async () => {
                      if (!newAdvanceType.trim()) {
                        alert("⚠️ يرجى إدخال اسم البند");
                        return;
                      }
                      const val = newAdvanceType.trim();
                      
                      // 🎯 تحقق شامل منع التكرار (بإهمال حالة الأحرف والتطبيع)
                      const normalizedNew = normalizeTypeKey(val);
                      const isDuplicate = advancesTypes.some(existing => 
                        normalizeTypeKey(existing).toLowerCase() === normalizedNew.toLowerCase() ||
                        existing.toLowerCase() === val.toLowerCase()
                      );
                      
                      if (isDuplicate) {
                        alert(`❌ خطأ: البند "${val}" موجود مسبقاً!\n\nلا يمكن إضافة نفس البند أكثر من مرة.`);
                        return;
                      }
                      
                      // 🎯 التحقق من وجوده في الأنواع الأخرى أيضاً
                      const allExistingTypes = [...bonusesTypes, ...deductionsTypes, ...advancesTypes];
                      const existsInOtherCategory = allExistingTypes.some(existing => 
                        normalizeTypeKey(existing).toLowerCase() === normalizedNew.toLowerCase()
                      );
                      
                      if (existsInOtherCategory) {
                        alert(`⚠️ تحذير: اسم مشابه موجود في فئة أخرى!\n\nالبند "${val}" قد يكون مكرراً. هل تريد المتابعة؟`);
                      }
                      
                      const updated = dedupeTypeList([...advancesTypes, val]);
                      const ok = await saveCustomTypes(
                        "payroll_advances_types",
                        updated,
                      );
                      if (ok) {
                        setAdvancesTypes(updated);
                        setNewAdvanceType("");
                      } else {
                        alert("فشل في حفظ البند");
                      }
                    }}
                    className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center"
                    title="إضافة"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {advancesTypes.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm"
                    >
                      <span className="text-sm text-slate-800 font-medium">
                        {getTypeLabel(item, "advances")}
                      </span>
                      <button
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `هل أنت متأكد من حذف بند "${getTypeLabel(item, "advances")}"؟`,
                            )
                          )
                            return;
                          const updated = advancesTypes.filter(
                            (t) => t !== item,
                          );
                          const ok = await saveCustomTypes(
                            "payroll_advances_types",
                            updated,
                          );
                          if (ok) {
                            setAdvancesTypes(updated);
                          } else {
                            alert("فشل في الحذف");
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {advancesTypes.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      لا توجد بنود مدونة
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions & Penalties Types */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-[500px]">
                <h3 className="font-bold text-slate-800 mb-3 text-base flex items-center gap-2">
                  <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                  انواع الاستقطاعات والجزاءات
                </h3>

                {/* Add Input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newDeductionType ?? ""}
                    onChange={(e) => setNewDeductionType(e.target.value)}
                    placeholder="اسم البند الجديد... (مثال: عجز الكاش)"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={async () => {
                      if (!newDeductionType.trim()) {
                        alert("⚠️ يرجى إدخال اسم البند");
                        return;
                      }
                      const val = newDeductionType.trim();
                      
                      // 🎯 تحقق شامل منع التكرار (بإهمال حالة الأحرف والتطبيع)
                      const normalizedNew = normalizeTypeKey(val);
                      const isDuplicate = deductionsTypes.some(existing => 
                        normalizeTypeKey(existing).toLowerCase() === normalizedNew.toLowerCase() ||
                        existing.toLowerCase() === val.toLowerCase()
                      );
                      
                      if (isDuplicate) {
                        alert(`❌ خطأ: البند "${val}" موجود مسبقاً!\n\nلا يمكن إضافة نفس البند أكثر من مرة.`);
                        return;
                      }
                      
                      // 🎯 التحقق من وجوده في الأنواع الأخرى أيضاً
                      const allExistingTypes = [...bonusesTypes, ...deductionsTypes, ...advancesTypes];
                      const existsInOtherCategory = allExistingTypes.some(existing => 
                        normalizeTypeKey(existing).toLowerCase() === normalizedNew.toLowerCase()
                      );
                      
                      if (existsInOtherCategory) {
                        alert(`⚠️ تحذير: اسم مشابه موجود في فئة أخرى!\n\nالبند "${val}" قد يكون مكرراً. هل تريد المتابعة؟`);
                        // نسمح بالإضافة ولكن مع تحذير
                      }
                      
                      const updated = dedupeTypeList([...deductionsTypes, val]);
                      const ok = await saveCustomTypes(
                        "payroll_deductions_types",
                        updated,
                      );
                      if (ok) {
                        setDeductionsTypes(updated);
                        setNewDeductionType("");
                      } else {
                        alert("فشل في حفظ البند");
                      }
                    }}
                    className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center"
                    title="إضافة"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {deductionsTypes.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm"
                    >
                      <span className="text-sm text-slate-800 font-medium">
                        {getTypeLabel(item, "penalties")}
                      </span>
                      <button
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `هل أنت متأكد من حذف بند "${getTypeLabel(item, "penalties")}"؟`,
                            )
                          )
                            return;
                          const updated = deductionsTypes.filter(
                            (t) => t !== item,
                          );
                          const ok = await saveCustomTypes(
                            "payroll_deductions_types",
                            updated,
                          );
                          if (ok) {
                            setDeductionsTypes(updated);
                          } else {
                            alert("فشل في الحذف");
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {deductionsTypes.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      لا توجد بنود مدونة
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== REPORTS TAB ========== */}
      {activeTab === "reports" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Cards */}
          {(() => {
            const data = filteredData;
            const totalBasic = data.reduce((s: any, r: any) => s + (parseFloat(r.basic) || 0), 0);
            const totalNet = data.reduce((s: any, r: any) => s + (parseFloat(r.net) || 0), 0);
            const totalAdd = data.reduce((s: any, r: any) => s + (parseFloat(r.totalAdd) || 0), 0);
            const totalDed = data.reduce((s: any, r: any) => s + (parseFloat(r.totalDed) || 0), 0);
            const totalInsurance = data.reduce((s: any, r: any) => s + (parseFloat(r.insurance) || 0), 0);
            const totalMeal = data.reduce((s: any, r: any) => s + (parseFloat(r.meal) || 0), 0);
            const empCount = data.length;
            const avgSalary = empCount > 0 ? totalNet / empCount : 0;

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                    <Users className="w-6 h-6 mx-auto text-rose-500 mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{empCount}</p>
                    <p className="text-xs text-slate-500">عدد الموظفين</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                    <Calculator className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{Number(totalBasic || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">إجمالي الرواتب الأساسية</p>
                  </div>
                  <div className="bg-white border border-emerald-200 rounded-2xl p-4 text-center shadow-sm bg-emerald-50">
                    <TrendingUp className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
                    <p className="text-2xl font-bold text-emerald-700">{Number(totalAdd || 0).toLocaleString()}</p>
                    <p className="text-xs text-emerald-600">إجمالي الإضافات</p>
                  </div>
                  <div className="bg-white border border-red-200 rounded-2xl p-4 text-center shadow-sm bg-red-50">
                    <AlertCircle className="w-6 h-6 mx-auto text-red-500 mb-2" />
                    <p className="text-2xl font-bold text-red-600">{Number(totalDed || 0).toLocaleString()}</p>
                    <p className="text-xs text-red-500">إجمالي الخصومات</p>
                  </div>
                  <div className="bg-white border border-amber-200 rounded-2xl p-4 text-center shadow-sm bg-amber-50">
                    <FileText className="w-6 h-6 mx-auto text-amber-600 mb-2" />
                    <p className="text-2xl font-bold text-amber-700">{Number(totalInsurance || 0).toLocaleString()}</p>
                    <p className="text-xs text-amber-600">إجمالي التأمينات</p>
                  </div>
                  <div className="bg-white border border-purple-200 rounded-2xl p-4 text-center shadow-sm bg-purple-50">
                    <BarChart3 className="w-6 h-6 mx-auto text-purple-600 mb-2" />
                    <p className="text-2xl font-bold text-purple-700">{Number(totalNet || 0).toLocaleString()}</p>
                    <p className="text-xs text-purple-600">صافي المرتبات</p>
                  </div>
                </div>

                {/* Average salary card */}
                <div className="bg-gradient-to-l from-rose-600 to-rose-700 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-rose-200 text-sm">متوسط صافي الراتب للموظف</p>
                      <p className="text-3xl font-bold mt-1">{Number(avgSalary || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</p>
                      <p className="text-rose-300 text-xs mt-1">شهر {selectedMonth} / سنة {selectedYear}</p>
                    </div>
                    <div className="text-left space-y-1">
                      <p className="text-rose-200 text-xs">بدل وجبه إجمالي: {Number(totalMeal || 0).toLocaleString()}</p>
                      <p className="text-rose-200 text-xs">نسبة الخصومات: {totalBasic > 0 ? ((totalDed / totalBasic) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </div>
                </div>

                {/* Report 1: Summary by Department */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-slate-900">ملخص المرتبات حسب القسم</h3>
                    </div>
                    <button onClick={() => {
                      const deptMap: Record<string, { count: number; basic: number; net: number; add: number; ded: number }> = {};
                      data.forEach((r: any) => {
                        const dept = r.department_name || "غير محدد";
                        if (!deptMap[dept]) deptMap[dept] = { count: 0, basic: 0, net: 0, add: 0, ded: 0 };
                        deptMap[dept].count++;
                        deptMap[dept].basic += parseFloat(r.basic) || 0;
                        deptMap[dept].net += parseFloat(r.net) || 0;
                        deptMap[dept].add += parseFloat(r.totalAdd) || 0;
                        deptMap[dept].ded += parseFloat(r.totalDed) || 0;
                      });
                      const rows = Object.entries(deptMap).map(([dept, v]) => ({ "القسم": dept, "عدد الموظفين": v.count, "إجمالي الأساسي": v.basic, "إجمالي الإضافات": v.add, "إجمالي الخصومات": v.ded, "صافي المرتبات": v.net }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "By Department");
                      XLSX.writeFile(wb, `تقرير_المرتبات_حسب_القسم_${selectedYear}_${selectedMonth}.xlsx`);
                    }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors">
                      <Download className="w-3.5 h-3.5" /> تصدير Excel
                    </button>
                  </div>
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 font-bold text-slate-600">القسم</th>
                        <th className="p-3 font-bold text-slate-600">عدد الموظفين</th>
                        <th className="p-3 font-bold text-slate-600">إجمالي الأساسي</th>
                        <th className="p-3 font-bold text-slate-600">الإضافات</th>
                        <th className="p-3 font-bold text-slate-600">الخصومات</th>
                        <th className="p-3 font-bold text-slate-600">صافي المرتبات</th>
                        <th className="p-3 font-bold text-slate-600">نسبة من الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const deptMap: Record<string, { count: number; basic: number; net: number; add: number; ded: number }> = {};
                        data.forEach((r: any) => {
                          const dept = r.department_name || "غير محدد";
                          if (!deptMap[dept]) deptMap[dept] = { count: 0, basic: 0, net: 0, add: 0, ded: 0 };
                          deptMap[dept].count++;
                          deptMap[dept].basic += parseFloat(r.basic) || 0;
                          deptMap[dept].net += parseFloat(r.net) || 0;
                          deptMap[dept].add += parseFloat(r.totalAdd) || 0;
                          deptMap[dept].ded += parseFloat(r.totalDed) || 0;
                        });
                        return Object.entries(deptMap).sort((a, b) => b[1].net - a[1].net).map(([dept, v]) => (
                          <tr key={dept} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{dept}</td>
                            <td className="p-3 text-slate-600">{v.count}</td>
                            <td className="p-3 text-slate-700">{Number(v.basic || 0).toLocaleString()}</td>
                            <td className="p-3 text-emerald-600">{Number(v.add || 0).toLocaleString()}</td>
                            <td className="p-3 text-red-500">{Number(v.ded || 0).toLocaleString()}</td>
                            <td className="p-3 font-bold text-purple-700">{Number(v.net || 0).toLocaleString()}</td>
                            <td className="p-3 text-slate-500">{totalNet > 0 ? ((v.net / totalNet) * 100).toFixed(1) : 0}%</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Report 2: Bank Transfer List */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-900">كشف تحويل البنك (صافي المرتبات)</h3>
                    </div>
                    <button onClick={() => {
                      const rows = data.filter((r: any) => parseFloat(r.net) > 0).map((r: any) => ({ "اسم الموظف": r.name, "كود الموظف": r.employee_code || r.id, "البنك": r.bank_name || "غير محدد", "رقم الحساب": r.bank_account || "", "صافي المرتب": parseFloat(r.net) || 0 }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Bank Transfer");
                      XLSX.writeFile(wb, `كشف_تحويل_البنك_${selectedYear}_${selectedMonth}.xlsx`);
                    }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors">
                      <Download className="w-3.5 h-3.5" /> تصدير Excel
                    </button>
                  </div>
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 font-bold text-slate-600">#</th>
                        <th className="p-3 font-bold text-slate-600">اسم الموظف</th>
                        <th className="p-3 font-bold text-slate-600">البنك</th>
                        <th className="p-3 font-bold text-slate-600">رقم الحساب</th>
                        <th className="p-3 font-bold text-slate-600">صافي المرتب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.filter((r: any) => parseFloat(r.net) > 0).map((r: any, i: any) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-500">{i + 1}</td>
                          <td className="p-3 font-bold text-slate-900">{r.name}</td>
                          <td className="p-3 text-slate-600">{r.bank_name || "غير محدد"}</td>
                          <td className="p-3 text-slate-700 font-mono">{r.bank_account || "—"}</td>
                          <td className="p-3 font-bold text-emerald-700">{parseFloat(r.net || 0 || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                        <td colSpan={4} className="p-3 font-bold text-slate-900 text-left">الإجمالي</td>
                        <td className="p-3 font-bold text-emerald-700 text-lg">{data.reduce((s: any, r: any) => s + (parseFloat(r.net) || 0), 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Report 3: Salary Structure Analysis */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900">تحليل هيكل المرتبات (الأساسي vs الإضافات vs الخصومات)</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {data.length > 0 ? (() => {
                      const basicPct = totalBasic > 0 ? ((totalBasic / (totalBasic + totalAdd)) * 100).toFixed(1) : "0";
                      const addPct = totalBasic + totalAdd > 0 ? ((totalAdd / (totalBasic + totalAdd)) * 100).toFixed(1) : "0";
                      return (
                        <>
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-600">الراتب الأساسي</span>
                                <span className="font-bold text-slate-900">{Number(totalBasic || 0).toLocaleString()} ({basicPct}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-4">
                                <div className="bg-blue-500 h-4 rounded-full transition-all" style={{ width: `${basicPct}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-600">الإضافات والبدلات</span>
                                <span className="font-bold text-emerald-700">{Number(totalAdd || 0).toLocaleString()} ({addPct}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-4">
                                <div className="bg-emerald-500 h-4 rounded-full transition-all" style={{ width: `${addPct}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-600">الخصومات والتأمينات</span>
                                <span className="font-bold text-red-600">{Number(totalDed || 0).toLocaleString()} ({totalBasic > 0 ? ((totalDed / totalBasic) * 100).toFixed(1) : 0}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-4">
                                <div className="bg-red-500 h-4 rounded-full transition-all" style={{ width: `${Math.min(Number(totalBasic > 0 ? ((totalDed / totalBasic) * 100).toFixed(1) : 0), 100)}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 p-4 bg-slate-50 rounded-xl grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-slate-500">أعلى راتب صافي</p>
                              <p className="font-bold text-slate-900">{Math.max(...data.map((r: any) => parseFloat(r.net) || 0)).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">أقل راتب صافي</p>
                              <p className="font-bold text-slate-900">{Math.min(...data.map((r: any) => parseFloat(r.net) || 0)).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">إجمالي التكلفة على الشركة</p>
                              <p className="font-bold text-rose-600">{Number(totalBasic + totalAdd + totalInsurance + totalMeal || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </>
                      );
                    })() : (
                      <p className="text-center text-slate-400 py-8">لا توجد بيانات للشهر المحدد</p>
                    )}
                  </div>
                </div>

                {/* Report 4: Individual Payslips */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <h3 className="font-bold text-slate-900">كشف تفصيلي لكل موظف (إيصال المرتب)</h3>
                    </div>
                    <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors">
                      <Printer className="w-3.5 h-3.5" /> طباعة
                    </button>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto">
                    {data.slice(0, 20).map((r: any, rIdx: number) => (
                      <div key={r.id != null ? `slip-${r.id}-${rIdx}` : `slip-idx-${rIdx}`} className="border border-slate-200 rounded-2xl p-4 space-y-3 print:break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <p className="font-bold text-slate-900">{r.name}</p>
                            <p className="text-xs text-slate-500">{r.job} | {r.department_name || "غير محدد"}</p>
                          </div>
                          <p className="text-xs text-slate-400">شهر {selectedMonth}/{selectedYear}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-blue-50 rounded-lg p-2">
                            <p className="text-xs text-blue-500">الأساسي</p>
                            <p className="font-bold text-blue-700">{r.basic}</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2">
                            <p className="text-xs text-blue-500">المستحق الفعلي</p>
                            <p className="font-bold text-blue-700">{r.actual}</p>
                          </div>
                          <div className="bg-yellow-50 rounded-lg p-2">
                            <p className="text-xs text-yellow-600">بدل وجبه</p>
                            <p className="font-bold text-yellow-700">{r.meal}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-2">
                            <p className="text-xs text-emerald-500">إجمالي الإضافي</p>
                            <p className="font-bold text-emerald-700">{r.totalAdd}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2">
                            <p className="text-xs text-red-500">التأمينات</p>
                            <p className="font-bold text-red-600">{r.insurance}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2">
                            <p className="text-xs text-red-500">إجمالي الخصم</p>
                            <p className="font-bold text-red-600">{r.totalDed}</p>
                          </div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 flex items-center justify-between">
                          <span className="font-bold text-purple-700">صافي المرتب</span>
                          <span className="text-xl font-bold text-purple-800">{r.net}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Attendance Details Modal */}
      {showAttendanceModal && selectedEmployeeAttendance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-cairo">
          <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80 sticky top-0 z-20">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  تفاصيل أيام الحضور: <span className="text-blue-700">{selectedEmployeeAttendance.name}</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  شهر {selectedMonth} سنة {selectedYear} | المسمى الوظيفي: <span className="font-bold text-slate-700">{selectedEmployeeAttendance.job || '—'}</span> | الفرع: <span className="font-bold text-slate-700">{selectedEmployeeAttendance.branch_name || 'الفرع الرئيسي'}</span>
                </p>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="p-2 hover:bg-slate-200/80 rounded-xl transition-colors text-slate-500 hover:text-slate-800"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Hourly calculation banner if applicable */}
              {selectedEmployeeAttendance.is_hourly && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-purple-700 block">نظام الحساب</span>
                      <span className="text-sm font-black text-purple-900">⏱️ نظام العمل بالساعة والدقيقة</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-purple-700 block">إجمالي الساعات الشهرية</span>
                      <span className="text-lg font-black text-purple-900">{selectedEmployeeAttendance.total_worked_hours_display || `${selectedEmployeeAttendance.total_worked_hours} ساعة`}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-purple-700 block">سعر الساعة / الدقيقة</span>
                      <span className="text-sm font-bold text-purple-900">{selectedEmployeeAttendance.hourly_rate} ج.م/س ({selectedEmployeeAttendance.minute_rate} ج.م/د)</span>
                    </div>
                    <div className="bg-purple-100/70 border border-purple-300 rounded-lg px-3 py-1.5 text-left">
                      <span className="text-xs font-bold text-purple-700 block">المستحق الفعلي</span>
                      <span className="text-lg font-black text-purple-900">{selectedEmployeeAttendance.actual} ج.م</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Days of the Month (1 to end of month) */}
              {(() => {
                const numDays = new Date(selectedYear, selectedMonth, 0).getDate();
                const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
                const DAY_NAMES_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const offDays = parseWeeklyOffDays(selectedEmployeeAttendance?.weekly_off_days);
                const attendanceRecords = selectedEmployeeAttendance?.attendance_records || [];

                // Map official company holidays
                const officialHolidaysMap = new Map<string, string>();
                officialHolidays.forEach((h: any) => {
                  if (h.holiday_date) {
                    const dStr = String(h.holiday_date).split('T')[0];
                    officialHolidaysMap.set(dStr, h.name || 'عطلة رسمية');
                  }
                });

                // Map existing absence and vacation deductions from DB
                const existingAbsencesMap = new Map<string, number>();
                const existingVacationDeductionsMap = new Map<string, number>();
                attendanceModalDeductions.forEach((d: any) => {
                  if (d.date) {
                    const dStr = String(d.date).split('T')[0];
                    if (d.type === 'vacation_deduction' || d.type === 'cl' || (d.notes && d.notes.includes('خصم إجازة'))) {
                      if (!pendingCanceledVacationDeductions.includes(d.id)) {
                        existingVacationDeductionsMap.set(dStr, d.id);
                      }
                    } else if (d.type === 'absence' || (d.notes && d.notes.includes('غياب'))) {
                      if (!pendingCanceledAbsences.includes(d.id)) {
                        existingAbsencesMap.set(dStr, d.id);
                      }
                    }
                  }
                });

                // Helper to format time strings cleanly
                const fmtTime = (t: string) => {
                  if (!t) return "--";
                  const str = String(t).trim();
                  if (!str || str === "--" || str === "null" || str === "undefined") return "--";
                  
                  // Check if str is time-only like "08:15" or "08:15:00"
                  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
                    const parts = str.split(":");
                    const hh = parseInt(parts[0], 10);
                    const mm = parts[1];
                    const ampm = hh >= 12 ? "م" : "ص";
                    const h12 = hh % 12 || 12;
                    return `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
                  }

                  try {
                    const d = new Date(str);
                    if (isNaN(d.getTime())) return str;
                    return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });
                  } catch { return str; }
                };

                const monthDays = [];
                let attendedDaysCount = 0;
                let noPunchDaysCount = 0;
                let absenceDaysCount = 0;
                let vacationDeductionDaysCount = 0;

                for (let dayNum = 1; dayNum <= numDays; dayNum++) {
                  const dayStr = dayNum.toString().padStart(2, '0');
                  const monthStr = selectedMonth.toString().padStart(2, '0');
                  const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
                  const dateObj = new Date(selectedYear, selectedMonth - 1, dayNum);
                  const dayNameEn = DAY_NAMES_EN[dateObj.getDay()];
                  const dayNameAr = DAY_NAMES_AR[dateObj.getDay()];

                  const rec = attendanceRecords.find((r: any) => r.date && String(r.date).startsWith(dateStr));
                  const isWeeklyOffDay = offDays.includes(dayNameEn);
                  const officialHolidayName = officialHolidaysMap.get(dateStr);
                  const isOfficialHoliday = !!officialHolidayName;
                  const existingAbsenceDeductionId = existingAbsencesMap.get(dateStr);
                  const existingVacationDeductionId = existingVacationDeductionsMap.get(dateStr);
                  const isPendingNewAbsence = pendingNewAbsences.includes(dateStr);
                  const isPendingNewVacationDeduction = pendingNewVacationDeductions.includes(dateStr);

                  let status = "عدم وجود بصمة";
                  let checkIn = "--";
                  let checkOut = "--";
                  let workHours = "0س";
                  let actionType: 'convert_buttons' | 'mark_buttons' | 'cancel_absence' | 'cancel_vacation' | 'none' = 'none';

                  if (isPendingNewAbsence || existingAbsenceDeductionId) {
                    status = "غياب بخصم";
                    checkIn = "--";
                    checkOut = "--";
                    workHours = "0س";
                    actionType = 'cancel_absence';
                    absenceDaysCount++;
                  } else if (isPendingNewVacationDeduction || existingVacationDeductionId) {
                    status = "خصم إجازة";
                    checkIn = "--";
                    checkOut = "--";
                    workHours = "0س";
                    actionType = 'cancel_vacation';
                    vacationDeductionDaysCount++;
                  } else if (rec && (rec.check_in || rec.check_out || Number(rec.work_hours || 0) > 0)) {
                    checkIn = fmtTime(rec.check_in);
                    checkOut = fmtTime(rec.check_out);

                    let calcHours = Number(rec.work_hours || 0);
                    if (calcHours <= 0 && rec.check_in && rec.check_out) {
                      const tIn = new Date(rec.check_in).getTime();
                      const tOut = new Date(rec.check_out).getTime();
                      if (!isNaN(tIn) && !isNaN(tOut) && tOut > tIn) {
                        calcHours = (tOut - tIn) / 3600000;
                      }
                    }
                    workHours = `${calcHours.toFixed(1)}س`;

                    if (isWeeklyOffDay || isOfficialHoliday) {
                      status = "حضور إجازة";
                    } else {
                      status = "عادي";
                    }
                    actionType = 'convert_buttons';
                    attendedDaysCount++;
                  } else if (isOfficialHoliday) {
                    status = "عطلة رسمية";
                    actionType = 'none';
                  } else if (isWeeklyOffDay) {
                    status = "إجازة أسبوعية";
                    actionType = 'none';
                  } else {
                    status = "عدم وجود بصمة";
                    actionType = 'mark_buttons';
                    noPunchDaysCount++;
                  }

                  monthDays.push({
                    dayNum,
                    dateStr,
                    dayNameAr,
                    checkIn,
                    checkOut,
                    workHours,
                    status,
                    actionType,
                    rec,
                    existingAbsenceDeductionId,
                    existingVacationDeductionId,
                    officialHolidayName,
                    isWeeklyOffDay,
                    isOfficialHoliday
                  });
                }

                return (
                  <>
                    {/* Requirement 3: 4 Summary Cards at Top */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-800 block">حضور</span>
                            <span className="text-[11px] text-emerald-600 font-medium">أيام مسجلة</span>
                          </div>
                        </div>
                        <span className="text-xl font-black text-emerald-900">{attendedDaysCount} <span className="text-xs font-bold">يوم</span></span>
                      </div>

                      <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-amber-800 block">عدم وجود بصمة</span>
                            <span className="text-[11px] text-amber-600 font-medium">غير مخصومة</span>
                          </div>
                        </div>
                        <span className="text-xl font-black text-amber-900">{noPunchDaysCount} <span className="text-xs font-bold">يوم</span></span>
                      </div>

                      <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                            <UserX className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-rose-800 block">غياب محتسب</span>
                            <span className="text-[11px] text-rose-600 font-medium">مخصوم الأجر</span>
                          </div>
                        </div>
                        <span className="text-xl font-black text-rose-900">{absenceDaysCount} <span className="text-xs font-bold">يوم</span></span>
                      </div>

                      <div className="bg-orange-50/90 border border-orange-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 shrink-0">
                            <CalendarX className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-orange-800 block">خصم إجازات</span>
                            <span className="text-[11px] text-orange-600 font-medium">مخصوم الأجر</span>
                          </div>
                        </div>
                        <span className="text-xl font-black text-orange-900">{vacationDeductionDaysCount} <span className="text-xs font-bold">يوم</span></span>
                      </div>
                    </div>

                    {/* Requirement 1 & 4 & 7: Attendance Table with All Month Days & Action Control Column */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-slate-700">
                            <tr>
                              <th className="p-3 font-bold text-slate-700 w-24">التاريخ</th>
                              <th className="p-3 font-bold text-slate-700 w-24">اليوم</th>
                              <th className="p-3 font-bold text-slate-700 text-center">الحضور</th>
                              <th className="p-3 font-bold text-slate-700 text-center">الانصراف</th>
                              <th className="p-3 font-bold text-slate-700 text-center w-20">ساعات</th>
                              <th className="p-3 font-bold text-slate-700 text-center min-w-[130px]">الحالة</th>
                              {/* Requirement 4: Action / Attendance Control Column - Hidden if both permissions disabled */}
                              {(hasPayrollPermission('salaries.absence_conversion') || hasPayrollPermission('salaries.leave_deduction')) && (
                              <th className="p-3 font-extrabold text-sky-900 text-center bg-sky-100/90 border-r border-l border-sky-300 min-w-[180px] shadow-xs">
                                الإجراء / التحكم في الحضور
                              </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                            {monthDays.map((item) => {
                              // Custom row background based on status
                              let rowBgClass = "hover:bg-slate-50 bg-white";
                              if (item.status === "حضور إجازة") rowBgClass = "hover:bg-emerald-100/50 bg-emerald-50/40";
                              if (item.status === "عدم وجود بصمة") rowBgClass = "hover:bg-amber-100/60 bg-amber-50/50";
                              if (item.status === "إجازة أسبوعية") rowBgClass = "hover:bg-blue-100/50 bg-blue-50/40";
                              if (item.status === "عطلة رسمية") rowBgClass = "hover:bg-indigo-100/50 bg-indigo-50/40";
                              if (item.status === "غياب بخصم") rowBgClass = "hover:bg-rose-100/60 bg-rose-50/50";
                              if (item.status === "خصم إجازة") rowBgClass = "hover:bg-orange-100/60 bg-orange-50/50";

                              return (
                                <tr key={item.dayNum} className={`transition-colors ${rowBgClass}`}>
                                  <td className="p-3 font-mono text-xs font-bold text-slate-700">{item.dateStr}</td>
                                  <td className="p-3 font-bold text-slate-800">{item.dayNameAr}</td>
                                  <td className="p-3 font-mono text-center text-emerald-700 font-bold">{item.checkIn}</td>
                                  <td className="p-3 font-mono text-center text-rose-700 font-bold">{item.checkOut}</td>
                                  <td className="p-3 text-center font-bold text-slate-800">{item.workHours}</td>
                                  <td className="p-3 text-center whitespace-nowrap">
                                    {item.status === "عادي" && (
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
                                        عادي
                                      </span>
                                    )}
                                    {item.status === "حضور إجازة" && (
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                        حضور إجازة
                                      </span>
                                    )}
                                    {item.status === "عدم وجود بصمة" && (
                                      <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-black bg-amber-100/90 text-amber-950 border border-amber-400/90 whitespace-nowrap shadow-2xs">
                                        عدم وجود بصمة
                                      </span>
                                    )}
                                    {item.status === "إجازة أسبوعية" && (
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap">
                                        إجازة أسبوعية
                                      </span>
                                    )}
                                    {item.status === "عطلة رسمية" && (
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 whitespace-nowrap">
                                        عطلة رسمية ({item.officialHolidayName})
                                      </span>
                                    )}
                                    {item.status === "غياب بخصم" && (
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 whitespace-nowrap">
                                        غياب بخصم
                                      </span>
                                    )}
                                    {item.status === "خصم إجازة" && (
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300 whitespace-nowrap">
                                        خصم إجازة
                                      </span>
                                    )}
                                  </td>

                                  {/* Requirement 4: Action Column - Hidden if both permissions disabled */}
                                  {(hasPayrollPermission('salaries.absence_conversion') || hasPayrollPermission('salaries.leave_deduction')) && (
                                  <td className="p-2 text-center bg-sky-50/80 border-r border-l border-sky-200">
                                    {(item.actionType === 'convert_buttons' || item.actionType === 'mark_buttons') && (
                                      <div className="flex items-center justify-center gap-1.5">
                                        {hasPayrollPermission('salaries.absence_conversion') && (
                                          <button
                                            onClick={() => setAbsenceConfirmDialog({
                                              isOpen: true,
                                              dateStr: item.dateStr,
                                              dayNameAr: item.dayNameAr,
                                              employeeName: selectedEmployeeAttendance.name,
                                              originalRecord: item.rec,
                                              deductionType: 'absence'
                                            })}
                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center justify-center gap-1"
                                            title="تحويل لغياب بخصم"
                                          >
                                            <UserX className="w-3 h-3" />
                                            {item.actionType === 'convert_buttons' ? 'تحويل غياب' : 'احتساب غياب'}
                                          </button>
                                        )}
                                        {hasPayrollPermission('salaries.leave_deduction') && (
                                          <button
                                            onClick={() => setAbsenceConfirmDialog({
                                              isOpen: true,
                                              dateStr: item.dateStr,
                                              dayNameAr: item.dayNameAr,
                                              employeeName: selectedEmployeeAttendance.name,
                                              originalRecord: item.rec,
                                              deductionType: 'vacation_deduction'
                                            })}
                                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center justify-center gap-1"
                                            title="تحويل لخصم إجازة"
                                          >
                                            <CalendarX className="w-3 h-3" />
                                            خصم إجازة
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {item.actionType === 'cancel_absence' && (
                                      <button
                                        onClick={() => {
                                          if (item.existingAbsenceDeductionId) {
                                            setPendingCanceledAbsences(prev => Array.from(new Set([...prev, item.existingAbsenceDeductionId!])));
                                          }
                                          setPendingNewAbsences(prev => prev.filter(d => d !== item.dateStr));
                                        }}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center justify-center gap-1 mx-auto"
                                        title="إلغاء الغياب وإعادة اليوم لحالته"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        إلغاء الغياب
                                      </button>
                                    )}

                                    {item.actionType === 'cancel_vacation' && (
                                      <button
                                        onClick={() => {
                                          if (item.existingVacationDeductionId) {
                                            setPendingCanceledVacationDeductions(prev => Array.from(new Set([...prev, item.existingVacationDeductionId!])));
                                          }
                                          setPendingNewVacationDeductions(prev => prev.filter(d => d !== item.dateStr));
                                        }}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center justify-center gap-1 mx-auto"
                                        title="إلغاء خصم الإجازة وإعادة اليوم لحالته"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        إلغاء خصم الإجازة
                                      </button>
                                    )}

                                    {item.actionType === 'none' && (
                                      <span className="text-slate-400 font-extrabold text-sm">—</span>
                                    )}
                                  </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Requirement 6: Notice Banner */}
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5 font-medium leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>تنبيه هام:</strong> الأيام التي حالتها <span className="font-bold underline text-amber-950">"عدم وجود بصمة"</span> لا تخصم تلقائياً، يمكنك تحويلها لـ <span className="font-bold underline text-rose-700">"غياب بخصم"</span> أو <span className="font-bold underline text-orange-700">"خصم إجازة"</span> ليتم خصم اليوم من الموظف وإضافته للشيت. لا يمكن احتساب الإجازة الأسبوعية والعطلات الرسمية كخصم.
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Requirement 6: Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/90 gap-4">
              <div className="text-xs text-slate-500 font-bold">
                {pendingNewAbsences.length > 0 || pendingCanceledAbsences.length > 0 || pendingNewVacationDeductions.length > 0 || pendingCanceledVacationDeductions.length > 0 ? (
                  <span className="text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-lg">
                    تنبيه: توجد تغييرات معلقة لم تُحفظ بعد!
                  </span>
                ) : (
                  <span>اضغط على "حفظ التغييرات" لتطبيقها على كشف المرتبات</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors text-xs"
                >
                  إغلاق
                </button>
                <button
                  disabled={isSavingAttendance}
                  onClick={async () => {
                    if (!selectedEmployeeAttendance) return;
                    setIsSavingAttendance(true);
                    try {
                      const basicSalary = parseFloat(selectedEmployeeAttendance.basic) || 0;
                      const expectedDays = parseInt(selectedEmployeeAttendance.expectedDays || selectedEmployeeAttendance.work_days || 30) || 30;
                      const dayRate = expectedDays > 0 ? Number((basicSalary / expectedDays).toFixed(2)) : 0;

                      // Save new absences
                      for (const dateStr of pendingNewAbsences) {
                        await api.post('/api/payroll/deductions', {
                          employee_id: selectedEmployeeAttendance.id,
                          amount: dayRate,
                          type: 'absence',
                          date: dateStr,
                          notes: `خصم غياب يوم ${dateStr}`,
                          userId: user?.id
                        });
                      }

                      // Save new vacation deductions
                      for (const dateStr of pendingNewVacationDeductions) {
                        await api.post('/api/payroll/deductions', {
                          employee_id: selectedEmployeeAttendance.id,
                          amount: dayRate,
                          type: 'vacation_deduction',
                          date: dateStr,
                          notes: `خصم إجازة يوم ${dateStr}`,
                          userId: user?.id
                        });
                      }

                      // Delete canceled absences
                      for (const dedId of pendingCanceledAbsences) {
                        await api.delete(`/api/payroll/deductions/${dedId}?userId=${user?.id || ''}`);
                      }

                      // Delete canceled vacation deductions
                      for (const dedId of pendingCanceledVacationDeductions) {
                        await api.delete(`/api/payroll/deductions/${dedId}?userId=${user?.id || ''}`);
                      }

                      await mutatePayroll();
                      setShowAttendanceModal(false);
                    } catch (err) {
                      console.error("Failed to save attendance changes", err);
                      alert("حدث خطأ أثناء حفظ التغييرات");
                    } finally {
                      setIsSavingAttendance(false);
                    }
                  }}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold shadow-md transition-all text-xs flex items-center gap-2"
                >
                  {isSavingAttendance ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  حفظ التغييرات {(pendingNewAbsences.length + pendingNewVacationDeductions.length) > 0 ? `(${pendingNewAbsences.length + pendingNewVacationDeductions.length} جديد)` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 5: Absence / Vacation Deduction Confirmation Dialog Modal */}
      {absenceConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-60 p-4 font-cairo animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-right">
            <div className={`w-12 h-12 rounded-full border flex items-center justify-center mb-4 mx-auto ${
              absenceConfirmDialog.deductionType === 'vacation_deduction' 
                ? 'bg-amber-100 border-amber-200 text-amber-700' 
                : 'bg-rose-100 border-rose-200 text-rose-600'
            }`}>
              {absenceConfirmDialog.deductionType === 'vacation_deduction' ? <CalendarX className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center mb-2">
              {absenceConfirmDialog.deductionType === 'vacation_deduction' ? 'تأكيد احتساب خصم إجازة' : 'تأكيد احتساب وخصم الغياب'}
            </h3>
            <p className={`text-sm leading-relaxed mb-6 p-4 rounded-xl border text-center font-medium ${
              absenceConfirmDialog.deductionType === 'vacation_deduction'
                ? 'bg-amber-50/80 text-slate-800 border-amber-200'
                : 'bg-rose-50/80 text-slate-800 border-rose-200'
            }`}>
              {absenceConfirmDialog.deductionType === 'vacation_deduction' ? (
                <>سيتم احتساب يوم <span className="font-bold text-amber-800 font-mono">{absenceConfirmDialog.dateStr}</span> - <span className="font-bold text-amber-800">{absenceConfirmDialog.dayNameAr}</span> كـ <span className="font-black text-amber-900">"خصم إجازة"</span> للموظف <span className="font-bold text-slate-900">{absenceConfirmDialog.employeeName}</span> وخصم قيمته من الراتب وإضافته لعمود خصم الإجازات، هل أنت متأكد؟</>
              ) : (
                <>سيتم احتساب يوم <span className="font-bold text-rose-700 font-mono">{absenceConfirmDialog.dateStr}</span> - <span className="font-bold text-rose-700">{absenceConfirmDialog.dayNameAr}</span> غياب للموظف <span className="font-bold text-slate-900">{absenceConfirmDialog.employeeName}</span> وخصم قيمته من الراتب، هل أنت متأكد؟</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAbsenceConfirmDialog(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  const { dateStr, deductionType } = absenceConfirmDialog;
                  if (deductionType === 'vacation_deduction') {
                    setPendingNewVacationDeductions(prev => Array.from(new Set([...prev, dateStr])));
                    setPendingNewAbsences(prev => prev.filter(d => d !== dateStr));
                  } else {
                    setPendingNewAbsences(prev => Array.from(new Set([...prev, dateStr])));
                    setPendingNewVacationDeductions(prev => prev.filter(d => d !== dateStr));
                  }
                  setAbsenceConfirmDialog(null);
                }}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-md transition-all text-sm ${
                  absenceConfirmDialog.deductionType === 'vacation_deduction'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {absenceConfirmDialog.deductionType === 'vacation_deduction' ? 'تأكيد خصم الإجازة' : 'تأكيد الاحتساب والخصم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Details Modal - shows when admin clicks any deduction, leave deduction, penalty, or advance cell */}
      {deductionDetailsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col border border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-rose-50 via-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black shadow-sm">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    تفاصيل {deductionDetailsModal.typeLabel}: {deductionDetailsModal.employee?.name}
                  </h2>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">
                    شهر {selectedMonth} سنة {selectedYear} | الوظيفة: <span className="font-bold text-slate-700">{deductionDetailsModal.employee?.job || "—"}</span> | الفرع: <span className="font-bold text-slate-700">{deductionDetailsModal.employee?.branch_name || "—"}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeductionDetailsModal({ ...deductionDetailsModal, isOpen: false })}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 hover:text-slate-700"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs text-rose-600 font-bold block mb-1">إجمالي مبلغ الخصم</span>
                  <div className="text-2xl font-black text-rose-700">
                    {deductionDetailsModal.totalAmount.toFixed(2)} <span className="text-sm font-bold text-rose-600">ج.م</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs text-slate-600 font-bold block mb-1">عدد البنود والحركات</span>
                  <div className="text-2xl font-black text-slate-800">
                    {deductionDetailsModal.records.length} <span className="text-sm font-bold text-slate-500">حركة</span>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs text-blue-600 font-bold block mb-1">أجر اليوم التقديري (أساسي ÷ 30)</span>
                  <div className="text-2xl font-black text-blue-700">
                    {((Number(deductionDetailsModal.employee?.basic) || 0) / 30).toFixed(2)} <span className="text-sm font-bold text-blue-600">ج.م/يوم</span>
                  </div>
                </div>
              </div>

              {/* Action helper bar */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-slate-600">
                  نوع الاستقطاع: <span className="text-rose-700 font-black">{deductionDetailsModal.typeLabel}</span>
                </span>
                <button
                  onClick={() => {
                    const emp = deductionDetailsModal.employee;
                    setDeductionDetailsModal({ ...deductionDetailsModal, isOpen: false });
                    if (emp) handleOpenAttendanceModal(emp);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  عرض ومراجعة سجل الحضور والبصمة للموظف
                </button>
              </div>

              {/* Table or Loading / Empty State */}
              {deductionDetailsModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div>
                </div>
              ) : deductionDetailsModal.records.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-right text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="p-3.5 font-bold text-slate-700 w-12">#</th>
                        <th className="p-3.5 font-bold text-slate-700">التاريخ</th>
                        <th className="p-3.5 font-bold text-slate-700">نوع البند</th>
                        <th className="p-3.5 font-bold text-slate-700">المبلغ</th>
                        <th className="p-3.5 font-bold text-slate-700">سبب الخصم والتفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
                      {deductionDetailsModal.records.map((d: any, idx: number) => {
                        const typeLabels: Record<string, string> = {
                          penalty: "جزاء",
                          delay: "تأخير",
                          absence: "غياب",
                          vacation_deduction: "خصم إجازات",
                          early_leave: "انصراف مبكر",
                          missing_punch: "نسيان بصمة",
                          manual: "يدوي",
                          installment: "سلفة قسط",
                          direct: "سلفة مباشرة",
                          insurance: "تأمينات",
                          shortage: "عجز",
                          fellowship: "صندوق زمالة",
                          cl: "CL",
                          hr: "خصم HR",
                          uniform: "خصم زي",
                        };
                        const displayType = typeLabels[d.type] || d.type || deductionDetailsModal.typeLabel;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3.5 font-mono text-xs font-bold text-slate-700">
                              {d.date ? String(d.date).split('T')[0] : `${selectedYear}-${selectedMonth}`}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                                {displayType}
                              </span>
                            </td>
                            <td className="p-3.5 font-black text-rose-600 text-base">
                              {Number(d.amount || 0).toFixed(2)} <span className="text-xs font-bold text-rose-500">ج.م</span>
                            </td>
                            <td className="p-3.5 text-xs text-slate-700 leading-relaxed font-medium">
                              {d.notes || d.reason || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                  <p className="font-bold text-base text-slate-700">لا توجد تفاصيل خصومات مسجلة لهذا البند</p>
                  <p className="text-xs text-slate-400 mt-1">المبلغ الإجمالي هو 0 ج.م أو لا توجد حركات مسجلة</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs text-slate-500 font-medium">
                نظام إدارة الرواتب والاستقطاعات
              </span>
              <button
                onClick={() => setDeductionDetailsModal({ ...deductionDetailsModal, isOpen: false })}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-Day Attendance Details Modal - shows when admin clicks the "حضور إجازة" cell */}
      {showOffDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-emerald-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-emerald-600" />
                  حضور أيام الإجازة: {offDayEmployee?.name || offDayEmployee?.employee_name || "موظف"}
                </h2>
                <p className="text-sm text-slate-500">
                  شهر {selectedMonth} سنة {selectedYear} | {offDayEmployee?.off_day_attendance || 0} يوم حضور في الإجازة
                </p>
              </div>
              <button
                onClick={() => setShowOffDayModal(false)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
              >
                <AlertCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Summary card */}
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-emerald-600 font-bold">أيام حضور الإجازة</p>
                    <p className="text-2xl font-black text-emerald-700">{offDayEmployee?.off_day_attendance || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold">مكافأة الوقت الإضافي</p>
                    <p className="text-2xl font-black text-emerald-700">{offDayEmployee?.overtime_bonus || 0} ج.م</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold">الإجازة الأسبوعية المعتمدة</p>
                    <p className="text-sm font-bold text-emerald-700 mt-1">
                      {formatWeeklyOffDays(offDayEmployee?.weekly_off_days)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Off-day attendance table */}
              {(() => {
                const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
                const DAY_NAMES_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const offDays = parseWeeklyOffDays(offDayEmployee?.weekly_off_days);
                const rawRecords = Array.isArray(offDayEmployee?.attendance_records) ? offDayEmployee.attendance_records : [];

                const offDayRecords = rawRecords
                  .filter((rec: any) => {
                    try {
                      if (!rec?.date) return false;
                      const d = new Date(rec.date);
                      return offDays.includes(DAY_NAMES_EN[d.getDay()]);
                    } catch { return false; }
                  })
                  .sort((a: any, b: any) => String(a?.date || "").localeCompare(String(b?.date || "")));

                if (offDayRecords.length === 0) {
                  return (
                    <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-slate-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-emerald-600 opacity-50" />
                      <p className="font-bold text-slate-800 text-base mb-1">لا توجد سجلات حضور في أيام الإجازة</p>
                      <p className="text-xs text-slate-500">
                        الموظف <span className="font-bold text-slate-700">{offDayEmployee?.name || offDayEmployee?.employee_name}</span> لم يحضر في أيام الإجازة الأسبوعية المحددة ({formatWeeklyOffDays(offDayEmployee?.weekly_off_days)}) خلال شهر {selectedMonth} لسنة {selectedYear}.
                      </p>
                    </div>
                  );
                }

                const fmtTime = (t: string) => {
                  if (!t) return "—";
                  try {
                    const d = new Date(t);
                    return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });
                  } catch { return t; }
                };

                return (
                  <table className="w-full text-right text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-emerald-100 border-b border-emerald-300">
                        <th className="p-3 font-bold text-emerald-800">التاريخ</th>
                        <th className="p-3 font-bold text-emerald-800">اليوم</th>
                        <th className="p-3 font-bold text-emerald-800 text-center">الحضور</th>
                        <th className="p-3 font-bold text-emerald-800 text-center">الانصراف</th>
                        <th className="p-3 font-bold text-emerald-800 text-center">ساعات</th>
                        <th className="p-3 font-bold text-emerald-800 text-center">التأخير</th>
                        <th className="p-3 font-bold text-emerald-800 text-center">الإضافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {offDayRecords.map((rec: any, idx: number) => {
                        let dayName = "—";
                        try {
                          const d = new Date(rec.date);
                          dayName = DAY_NAMES_AR[d.getDay()] || "—";
                        } catch {}
                        return (
                          <tr key={idx} className="hover:bg-emerald-50/50 bg-emerald-50/20">
                            <td className="p-3 font-mono text-xs">{rec.date}</td>
                            <td className="p-3 font-bold text-emerald-700">{dayName}</td>
                            <td className="p-3 font-mono text-center text-emerald-600 font-bold">
                              {fmtTime(rec.check_in)}
                            </td>
                            <td className="p-3 font-mono text-center text-rose-600 font-bold">
                              {fmtTime(rec.check_out)}
                            </td>
                            <td className="p-3 text-center font-bold">
                              {Number(rec.work_hours || 0).toFixed(1)}س
                            </td>
                            <td className="p-3 text-center">
                              {rec.delay_minutes > 0 ? (
                                <span className="text-rose-600 font-bold text-xs">{rec.delay_minutes}د</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {Number(rec.overtime || 0) > 0 ? (
                                <span className="text-emerald-600 font-bold text-xs">{Number(rec.overtime).toFixed(1)}س</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setShowOffDayModal(false)}
                className="px-6 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 Policy Penalties Details Modal - نافذة تفاصيل خصم لائحة الجزاءات */}
      {showPolicyPenaltiesModal && policyPenaltiesDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-cairo">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-emerald-50/80 sticky top-0 z-20">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-emerald-600" />
                  تفاصيل خصم لائحة الجزاءات: <span className="text-emerald-700">{policyPenaltiesDetails.employee?.name}</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  شهر {selectedMonth} سنة {selectedYear} | المسمى الوظيفي: <span className="font-bold text-slate-700">{policyPenaltiesDetails.employee?.job || '—'}</span> | الفرع: <span className="font-bold text-slate-700">{policyPenaltiesDetails.employee?.branch_name || 'الفرع الرئيسي'}</span>
                </p>
              </div>
              <button
                onClick={() => setShowPolicyPenaltiesModal(false)}
                className="p-2 hover:bg-emerald-200/80 rounded-xl transition-colors text-slate-500 hover:text-slate-800"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                {/* Total Penalties Card */}
                <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-xs font-bold text-rose-800 block">إجمالي الخصم</span>
                    <span className="text-2xl font-black text-rose-900">{policyPenaltiesDetails.total?.toLocaleString() || '0'}</span>
                    <span className="text-xs font-bold text-rose-600 block">ج.م</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                </div>

                {/* Violations Count Card */}
                <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-xs font-bold text-amber-800 block">عدد المخالفات</span>
                    <span className="text-2xl font-black text-amber-900">{policyPenaltiesDetails.penalties?.length || 0}</span>
                    <span className="text-xs font-bold text-amber-600 block">مخالفة</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                {/* Policy Name Card */}
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 block">نوع الخصم</span>
                    <span className="text-sm font-black text-emerald-900">لائحة الجزاءات</span>
                    <span className="text-xs font-bold text-emerald-600 block">تلقائي</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Penalties List */}
              {policyPenaltiesDetails.penalties && policyPenaltiesDetails.penalties.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-emerald-600" />
                      قائمة المخالفات والجزاءات المطبقة
                    </h3>
                  </div>
                  
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                    {policyPenaltiesDetails.penalties.map((penalty: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-4 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            {/* Penalty Title - Arabic Description */}
                            <div className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getPenaltyCategoryColor(penalty.category || penalty.type)}`}></span>
                              {getPenaltyArabicName(penalty)}
                            </div>
                            
                            {/* Date and Details */}
                            <div className="text-xs text-slate-500 space-y-1 mt-2">
                              {penalty.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>التاريخ: {formatPenaltyDate(penalty.date)}</span>
                                </div>
                              )}
                              
                              {penalty.category && (
                                <div className="flex items-center gap-1.5">
                                  <Tag className="w-3.5 h-3.5" />
                                  <span>التصنيف: {getPenaltyCategoryArabic(penalty.category)}</span>
                                </div>
                              )}
                              
                              {penalty.minutes && Number(penalty.minutes) > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>المدة: {penalty.minutes} دقيقة</span>
                                </div>
                              )}
                              
                              {penalty.rule_name && (
                                <div className="flex items-center gap-1.5">
                                  <Scale className="w-3.5 h-3.5" />
                                  <span>القاعدة: {penalty.rule_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Amount Badge */}
                          <div className="shrink-0 bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1.5 rounded-lg">
                            <span className="text-xs font-bold block">الخصم</span>
                            <span className="text-lg font-black">{penalty.amount}</span>
                            <span className="text-[10px] font-bold">ج.م</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Empty State */
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">لا توجد جزاءات من اللائحة</h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    لم يتم تطبيق أي جزاءات من لائحة الجزاءات على هذا الموظف خلال شهر {selectedMonth} لسنة {selectedYear}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    هذا يعني أن الموظف التزم بالحضور والانصراف دون مخالفات
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end">
              <button
                onClick={() => setShowPolicyPenaltiesModal(false)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors text-sm flex items-center gap-2 shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md text-slate-800">
            <h2 className="text-xl font-bold mb-4">
              إضافة{" "}
              {activeTab === "advances"
                ? "سلفة"
                : activeTab === "bonuses"
                  ? "مكافأة/بدل"
                  : "جزاء/خصم"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-bold mb-1">الموظف</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو الكود..."
                    value={employeeSearchQuery ?? ""}
                    onChange={(e) => {
                      setEmployeeSearchQuery(e.target.value);
                      setShowEmployeeDropdown(true);
                      setFormData({ ...formData, employee_id: "" });
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    className="w-full border border-slate-300 rounded-lg py-2 pr-10 pl-4 focus:outline-none focus:border-rose-500"
                  />
                </div>
                {showEmployeeDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {employees
                      .filter(
                        (emp) =>
                          (emp.name || "")
                            .toLowerCase()
                            .includes(
                              (employeeSearchQuery || "").toLowerCase(),
                            ) ||
                          (emp.fingerprint_code &&
                            emp.fingerprint_code.includes(
                              employeeSearchQuery,
                            )) ||
                          (emp.id &&
                            emp.id.toString().includes(employeeSearchQuery)),
                      )
                      .map((emp) => (
                        <div
                          key={emp.id}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                          onClick={() => {
                            setFormData({ ...formData, employee_id: emp.id });
                            setEmployeeSearchQuery(emp.name);
                            setShowEmployeeDropdown(false);
                          }}
                        >
                          <div className="font-bold">{emp.name}</div>
                          <div className="text-xs text-slate-500">
                            كود: {emp.fingerprint_code || emp.id}
                          </div>
                        </div>
                      ))}
                    {employees.filter(
                      (emp) =>
                        (emp.name || "")
                          .toLowerCase()
                          .includes(
                            (employeeSearchQuery || "").toLowerCase(),
                          ) ||
                        (emp.fingerprint_code &&
                          emp.fingerprint_code.includes(employeeSearchQuery)) ||
                        (emp.id &&
                          emp.id.toString().includes(employeeSearchQuery)),
                    ).length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        لا توجد نتائج
                      </div>
                    )}
                  </div>
                )}
                {/* Hidden input to make sure the form requires an employee to be selected */}
                <input
                  type="hidden"
                  required
                  value={formData.employee_id || ""}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">المبلغ</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">النوع</label>
                <select
                  required
                  value={formData.type || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">اختر النوع</option>
                  {activeTab === "advances" &&
                    advancesTypes.map((t) => (
                      <option key={t} value={t}>
                        {getTypeLabel(t, "advances")}
                      </option>
                    ))}
                  {activeTab === "bonuses" &&
                    bonusesTypes.map((t) => (
                      <option key={t} value={t}>
                        {getTypeLabel(t, "bonuses")}
                      </option>
                    ))}
                  {activeTab === "penalties" &&
                    deductionsTypes.map((t) => (
                      <option key={t} value={t}>
                        {getTypeLabel(t, "penalties")}
                      </option>
                    ))}
                </select>
              </div>

              {formData.type === "installment" && (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-1">
                      عدد الأقساط
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.installments_count || 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          installments_count: e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">
                      قيمة القسط الشهري
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.installment_amount || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          installment_amount: e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-bold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Printable Report Integration */}
      <PrintableReport
        title={
          activeTab === "approved"
            ? "كشف رواتب الموظفين المعتمد"
            : "تقرير الجزاءات والخصومات"
        }
        subtitle={`لشهر ${selectedMonth} لسنة ${selectedYear}`}
      >
        <table className="report-table">
          <thead>
            {activeTab === "approved" ? (
              <tr>
                <th>الموظف</th>
                <th>الوظيفة</th>
                <th>الراتب الأساسي</th>
                <th>الأيام</th>
                <th>حضور إجازة</th>
                <th>الفعلي</th>
                <th>بدل وجبة</th>
                {bonusesTypes.map((t) => (
                  <th key={t}>{getTypeLabel(t, "bonuses")}</th>
                ))}
                <th>إجمالي الإضافي</th>
                {deductionsTypes.map((t) => (
                  <th key={t}>{getTypeLabel(t, "penalties")}</th>
                ))}
                <th>تأمينات</th>
                {advancesTypes.map((t) => (
                  <th key={t}>{getTypeLabel(t, "advances")}</th>
                ))}
                <th>إجمالي الخصم</th>
                <th>صافي الأجر الصافي</th>
              </tr>
            ) : (
              <tr>
                <th>الموظف</th>
                <th>المبلغ</th>
                <th>النوع</th>
                <th>ملاحظات</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === "approved"
              ? paginatedPayrollData.map((row: any, rIdx: number) => (
                  <tr key={row.id != null ? `approved-row-${row.id}-${rIdx}` : `approved-idx-${rIdx}`}>
                    <td>{row.name}</td>
                    <td>{row.job}</td>
                    <td>{row.basic}</td>
                    <td>{row.days}</td>
                    <td>{row.off_day_attendance || 0}</td>
                    <td>{row.actual}</td>
                    <td>{row.meal}</td>
                    {bonusesTypes.map((t) => (
                      <td key={t}>{row[t] || 0}</td>
                    ))}
                    <td className="font-bold">{row.totalAdd}</td>
                    {deductionsTypes.map((t) => (
                      <td
                        key={t}
                        className={(row[t] || 0) > 0 ? "cursor-pointer text-rose-600 font-bold underline" : ""}
                        onClick={() => {
                          if ((row[t] || 0) > 0) handleShowDeductionDetails(row, t);
                        }}
                      >
                        {row[t] || 0}
                      </td>
                    ))}
                    <td
                      className={(row.insurance || 0) > 0 ? "cursor-pointer font-bold underline" : ""}
                      onClick={() => {
                        if ((row.insurance || 0) > 0) handleShowDeductionDetails(row, "insurance");
                      }}
                    >
                      {row.insurance}
                    </td>
                    {advancesTypes.map((t) => (
                      <td 
                        key={t}
                        className={(row[t] || 0) > 0 ? "cursor-pointer text-amber-700 font-bold underline" : ""}
                        onClick={() => {
                          if ((row[t] || 0) > 0) handleShowDeductionDetails(row, t);
                        }}
                      >
                        {row[t] || 0}
                      </td>
                    ))}
                    <td className="font-bold">{row.totalDed}</td>
                    <td className="font-bold">{row.net}</td>
                  </tr>
                ))
              : (Array.isArray(
                  activeTab === "advances"
                    ? advances
                    : activeTab === "bonuses"
                      ? bonuses
                      : deductions
                )
                  ? (activeTab === "advances"
                      ? advances
                      : activeTab === "bonuses"
                        ? bonuses
                        : deductions)
                  : []
                ).map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.employee_name}</td>
                    <td className="font-bold">{item.amount}</td>
                    <td>
                      {getTypeLabel(
                        item.type,
                        activeTab === "penalties"
                          ? "penalties"
                          : activeTab === "bonuses"
                            ? "bonuses"
                            : "advances",
                      )}
                    </td>
                    <td>{item.notes}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </PrintableReport>
    </div>
  );
};
