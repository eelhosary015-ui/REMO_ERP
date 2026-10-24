import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  DollarSign,
  Search,
  Download,
  Printer,
  Warehouse,
  ArrowRightLeft,
  Calculator,
  Wallet,
  Clock,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Target,
  FileText,
  Sliders,
  Gift,
  Zap,
  Award,
  Star,
  Briefcase,
  TrendingUp,
  Sparkles,
  CheckCircle,
  BarChart3,
  Layers,
  Activity,
  Eye,
  X,
  Receipt,
  UserCheck,
  UserX,
  AlertCircle,
  Filter,
  ArrowUpDown,
  User,
  LayoutList,
  Grid,
  Calendar,
} from "lucide-react";
import * as XLSX from "xlsx";
import useSWR from "swr";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { fetcher } from "../utils/fetcher";
import { api } from "../utils/api";
import { BranchReports } from "./BranchReports";
import { downloadDataAsWord } from "../utils/wordExport";
import { downloadDataAsPdf } from "../utils/pdfExport";
import { useAuth } from "../contexts/AuthContext";
import { databaseStorage } from "../utils/databaseStorage";
import { MultiEmployeeSearchFilter } from "./MultiEmployeeSearchFilter";

interface CentralReportsProps {
  onBack: () => void;
  initialTab?: any;
}

export const CentralReports: React.FC<CentralReportsProps> = ({
  onBack,
  initialTab,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | "branches"
    | "hr"
    | "salaries"
    | "main_warehouse"
    | "warehouse_transactions"
    | "general_accounts"
    | "safes"
    | "attendance"
    | "stock_entries_report"
    | "ai_analytics"
  >(() => {
    if (!initialTab) {
      const saved = localStorage.getItem("last_central_reports_tab");
      if (saved) return saved as any;
    }
    return "branches";
  });

  useEffect(() => {
    if (activeTab) {
      try {
        localStorage.setItem("last_central_reports_tab", activeTab);
      } catch (_) {}
    }
  }, [activeTab]);

  // AI Analytics and Intelligence state
  const [aiAnalyticsData, setAiAnalyticsData] = useState<any | null>(null);
  const [aiAnalyticsLoading, setAiAnalyticsLoading] = useState(false);
  const [aiAnalyticsError, setAiAnalyticsError] = useState<string | null>(null);

  const fetchAIAnalytics = async () => {
    setAiAnalyticsLoading(true);
    setAiAnalyticsError(null);
    try {
      const response = await fetch("/api/ai/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setAiAnalyticsData(json.data);
        } else {
          setAiAnalyticsError(json.message || "فشل توليد التقرير الذكي.");
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        setAiAnalyticsError(errJson.message || "حدث خطأ أثناء الاتصال بالخادم.");
      }
    } catch (e) {
      console.error(e);
      setAiAnalyticsError("فشل الاتصال بالخادم. يرجى التأكد من تشغيل الخادم والشبكة.");
    } finally {
      setAiAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "ai_analytics" && !aiAnalyticsData) {
      fetchAIAnalytics();
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialTab) {
      if (initialTab === "hr_bonuses" || initialTab === "hr_bonuses_report") {
        setActiveTab("hr");
        setHrSubTab("bonuses");
      } else if (initialTab === "hr_incentives" || initialTab === "hr_incentives_report") {
        setActiveTab("hr");
        setHrSubTab("incentives");
      } else if (initialTab === "hr_production_bonuses" || initialTab === "hr_production_bonuses_report") {
        setActiveTab("hr");
        setHrSubTab("production_bonuses");
      } else if (initialTab === "hr_evaluations" || initialTab === "hr_evaluations_report") {
        setActiveTab("hr");
        setHrSubTab("evaluations");
      } else if (initialTab === "hr_clearance" || initialTab === "hr_clearance_report") {
        setActiveTab("hr");
        setHrSubTab("clearance");
      } else if (initialTab === "hr_general" || initialTab === "hr_general_report") {
        setActiveTab("hr");
        setHrSubTab("hr_general");
      } else if (initialTab === "hr" || initialTab === "hr_report") {
        setActiveTab("hr");
        setHrSubTab("active");
      } else if (
        initialTab === "fingerprint_logs_report" ||
        initialTab === "fingerprint_logs" ||
        initialTab === "fingerprint-logs"
      ) {
        setActiveTab("attendance");
        setAttendanceSubTab("fingerprint_logs");
      } else if (
        initialTab === "tardiness_report" ||
        initialTab === "tardiness"
      ) {
        setActiveTab("attendance");
        setAttendanceSubTab("tardiness");
      } else if (
        initialTab === "absence_report" ||
        initialTab === "absence"
      ) {
        setActiveTab("attendance");
        setAttendanceSubTab("absence");
      } else if (
        initialTab === "overtime_report" ||
        initialTab === "overtime"
      ) {
        setActiveTab("attendance");
        setAttendanceSubTab("overtime");
      } else if (
        initialTab === "early_departure_report" ||
        initialTab === "early_departure"
      ) {
        setActiveTab("attendance");
        setAttendanceSubTab("early_departure");
      } else if (
        initialTab === "attendance" ||
        initialTab === "attendance_report" ||
        initialTab === "attendance_summary"
      ) {
        setActiveTab("attendance");
        setAttendanceSubTab("summary");
      } else {
        setActiveTab(initialTab as any);
      }
    }
  }, [initialTab]);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(["all"]);
  const isAllEmpsSelected = selectedEmpIds.length === 0 || selectedEmpIds.includes("all");
  const parsedSearchTerms = searchQuery
    ? searchQuery.split(/[,+\n;|\t]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const matchesMultiEmpFilter = (empName?: string, empCode?: any, empId?: any, extraFields?: (string | undefined)[]) => {
    if (!isAllEmpsSelected) {
      const idStr = String(empId || "");
      if (!selectedEmpIds.includes(idStr)) return false;
    }

    if (parsedSearchTerms.length > 0) {
      const name = (empName || "").toLowerCase();
      const code = String(empCode || "").toLowerCase();
      const id = String(empId || "").toLowerCase();
      const extras = (extraFields || []).map(f => (f || "").toLowerCase());

      const matched = parsedSearchTerms.some(
        (t) => name.includes(t) || code.includes(t) || id.includes(t) || extras.some(ex => ex.includes(t))
      );
      if (!matched) return false;
    }

    return true;
  };

  useEffect(() => {
    const handleVoiceSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSearchQuery(customEvent.detail);
      }
    };
    window.addEventListener("voice_search", handleVoiceSearch);
    return () => window.removeEventListener("voice_search", handleVoiceSearch);
  }, []);

  // Warehouse Transactions Filters
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedEntryType, setSelectedEntryType] = useState("all");

  // Warehouse Inventory Report Filters
  const [selectedInventoryWarehouse, setSelectedInventoryWarehouse] = useState("all");
  const [selectedInventorySection, setSelectedInventorySection] = useState("all");

  // General Accounts Filters
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedCostCenter, setSelectedCostCenter] = useState("all");

  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedAttendanceDepartment, setSelectedAttendanceDepartment] = useState("all");

  // HR Reports states
  const [attendanceSubTab, setAttendanceSubTab] = useState<
    | "summary"
    | "fingerprint_logs"
    | "tardiness"
    | "absence"
    | "overtime"
    | "early_departure"
  >("summary");
  const [attendanceSortBy, setAttendanceSortBy] = useState<
    "employee" | "employee_code" | "department" | "date_desc" | "date_asc"
  >("employee");
  const [attendanceViewMode, setAttendanceViewMode] = useState<"grouped" | "table">("grouped");
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  const [hrSubTab, setHrSubTab] = useState<
    | "active"
    | "bonuses"
    | "incentives"
    | "production_bonuses"
    | "evaluations"
    | "clearance"
    | "hr_general"
  >("active");
  const [hrBonusTypeFilter, setHrBonusTypeFilter] = useState("all");
  const [hrIncentiveTypeFilter, setHrIncentiveTypeFilter] = useState("all");
  const [hrEvaluationGradeFilter, setHrEvaluationGradeFilter] = useState("all");
  const [hrDepartmentFilter, setHrDepartmentFilter] = useState("all");
  const [hrBranchFilter, setHrBranchFilter] = useState("all");
  const [selectedSalaryDepartment, setSelectedSalaryDepartment] = useState("all");
  const [salariesSubTab, setSalariesSubTab] = useState<"general" | "department" | "deductions" | "advances">("general");
  const [selectedPayslipEmployee, setSelectedPayslipEmployee] = useState<any | null>(null);
  const [clearanceRecords, setClearanceRecords] = useState<any[]>([]);
  const [isClearanceLoading, setIsClearanceLoading] = useState(true);

  // Fetch clearance records from the database (not localStorage anymore)
  const fetchClearanceRecords = async () => {
    setIsClearanceLoading(true);
    try {
      const res = await api.get("/api/hr/clearance-records");
      if (res.ok) {
        const data = await res.json();
        setClearanceRecords(Array.isArray(data) ? data : []);
      } else {
        setClearanceRecords([]);
      }
    } catch (e) {
      console.error("Failed to fetch clearance records", e);
      setClearanceRecords([]);
    } finally {
      setIsClearanceLoading(false);
    }
  };

  useEffect(() => {
    fetchClearanceRecords();
  }, []);

  const [clearanceSearch, setClearanceSearch] = useState<string>("");
  const [clearanceFromDate, setClearanceFromDate] =
    useState<string>("2026-06-01");
  const [clearanceToDate, setClearanceToDate] = useState<string>("2026-06-18");
  const [clearanceDeptId, setClearanceDeptId] = useState<string>("all");
  const [clearanceBranchId, setClearanceBranchId] = useState<string>("all");

  // Load departments list for filtering in Clearance Report
  const { data: deptsData } = useSWR("/api/hr/departments", fetcher);
  const departments = Array.isArray(deptsData) ? deptsData : [];

  useEffect(() => {
    if (user && user.role !== "admin" && user.branch_id) {
      setSelectedBranch(user.branch_id.toString());
    }
  }, [user]);

  const { data: branchesData } = useSWR("/api/branches", fetcher);
  const branches = Array.isArray(branchesData) ? branchesData : [];

  // SWR Hooks
  const { data: employeesData, isLoading: hrLoading } = useSWR(
    activeTab === "hr" ? "/api/hr/employees" : null,
    fetcher,
  );
  const employees = Array.isArray(employeesData) ? employeesData : [];

  const { data: hrBonusesDataRaw, isLoading: hrBonusesLoading } = useSWR(
    activeTab === "hr"
      ? `/api/payroll/bonuses?year=${selectedYear}&month=${selectedMonth}`
      : null,
    fetcher,
  );
  const hrBonuses = Array.isArray(hrBonusesDataRaw) ? hrBonusesDataRaw : [];

  const { data: hrEvaluationsDataRaw, isLoading: hrEvaluationsLoading } = useSWR(
    activeTab === "hr" ? "/api/hr/evaluations" : null,
    fetcher,
  );
  const hrEvaluations = Array.isArray(hrEvaluationsDataRaw)
    ? hrEvaluationsDataRaw
    : [];

  const { data: salariesData, isLoading: salariesLoading } = useSWR(
    activeTab === "salaries"
      ? `/api/payroll?year=${selectedYear}&month=${selectedMonth}&branch=${selectedBranch}&department=all`
      : null,
    fetcher,
  );
  const salaries = Array.isArray(salariesData) ? salariesData : [];

  const { data: warehouseDataRaw, isLoading: warehouseLoading } = useSWR(
    activeTab === "main_warehouse" ? "/api/reports/all-warehouses-inventory" : null,
    fetcher,
  );
  const warehouseData = Array.isArray(warehouseDataRaw) ? warehouseDataRaw : [];

  const { data: warehousesData } = useSWR("/api/inventory/warehouses", fetcher);
  const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

  const { data: reportSectionsData } = useSWR(
    selectedInventoryWarehouse !== "all"
      ? `/api/warehouses/${selectedInventoryWarehouse}/sections`
      : null,
    fetcher,
  );
  const reportSections = Array.isArray(reportSectionsData) ? reportSectionsData : [];

  const { data: transactionsData, isLoading: transactionsLoading } = useSWR(
    activeTab === "warehouse_transactions"
      ? `/api/reports/warehouse-transactions?startDate=${startDate}&endDate=${endDate}&warehouseId=${selectedWarehouse}`
      : null,
    fetcher,
  );
  const transactionsReport = transactionsData || {
    transactions: [],
    summary: { total_in: 0, total_out: 0, net_value: 0 },
  };

  const { data: stockEntriesReportData, isLoading: stockEntriesLoading } = useSWR(
    activeTab === "stock_entries_report"
      ? `/api/reports/stock-entries-detailed?startDate=${startDate}&endDate=${endDate}&warehouseId=${selectedWarehouse}`
      : null,
    fetcher,
  );
  const stockEntriesReport = Array.isArray(stockEntriesReportData) ? stockEntriesReportData : [];

  const { data: accountsData } = useSWR("/api/accounts", fetcher);
  const accounts = Array.isArray(accountsData) ? accountsData : [];

  const { data: costCentersData } = useSWR("/api/cost-centers", fetcher);
  const costCenters = Array.isArray(costCentersData) ? costCentersData : [];

  const { data: generalLedgerData, isLoading: generalLedgerLoading } = useSWR(
    activeTab === "general_accounts"
      ? `/api/reports/general-ledger?startDate=${startDate}&endDate=${endDate}&accountId=${selectedAccount}&costCenterId=${selectedCostCenter}`
      : null,
    fetcher,
  );
  const generalLedgerReport = generalLedgerData || {
    transactions: [],
    summary: { total_debit: 0, total_credit: 0, net_balance: 0 },
  };

  const [selectedSafe, setSelectedSafe] = useState("all");
  const { data: safesData } = useSWR("/api/safes", fetcher);
  const safes = Array.isArray(safesData) ? safesData : [];

  const { data: safeReportsData, isLoading: safeReportsLoading } = useSWR(
    activeTab === "safes"
      ? `/api/reports/safes?startDate=${startDate}&endDate=${endDate}&safeId=${selectedSafe}`
      : null,
    fetcher,
  );
  const safeReports = safeReportsData || { transactions: [], closings: [] };

  const { data: attendanceData, isLoading: attendanceLoading } = useSWR(
    activeTab === "attendance"
      ? `/api/attendance?startDate=${startDate}&endDate=${endDate}&branch=${selectedBranch}`
      : null,
    fetcher,
  );
  const attendanceRecords = Array.isArray(attendanceData) ? attendanceData : [];

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    searchQuery,
    startDate,
    endDate,
    selectedWarehouse,
    selectedEntryType,
    selectedInventoryWarehouse,
    selectedInventorySection,
    selectedAccount,
    selectedCostCenter,
    selectedBranch,
    hrSubTab,
    clearanceSearch,
    clearanceFromDate,
    clearanceToDate,
    clearanceDeptId,
    clearanceBranchId,
    selectedSafe,
    selectedMonth,
    selectedYear,
  ]);

  const paginate = <T,>(items: T[]): T[] => {
    if (pageSize === -1) return items;
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  };

  const renderPagination = (totalItems: number) => {
    if (totalItems <= 0) return null;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = pageSize === -1 ? totalItems : Math.min(currentPage * pageSize, totalItems);

    const pageNumbers = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-sm no-print" dir="rtl">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 font-medium">عدد السجلات في الصفحة:</span>
          <select
            value={pageSize ?? ""}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={-1}>الكل</option>
          </select>
          <span className="text-slate-400 mr-2">|</span>
          <span className="text-slate-600 font-medium">
            عرض <span className="font-bold text-slate-800">{startIdx}</span> إلى{" "}
            <span className="font-bold text-slate-800">{endIdx}</span> من أصل{" "}
            <span className="font-bold text-slate-800">{totalItems}</span> سجل
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-bold flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4" />
            <span>السابق</span>
          </button>

          {startPage > 1 && (
            <>
              <button
                onClick={() => setCurrentPage(1)}
                className={`w-9 h-9 rounded-xl font-bold transition-colors ${
                  currentPage === 1
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                1
              </button>
              {startPage > 2 && <span className="text-slate-400 px-1">...</span>}
            </>
          )}

          {pageNumbers.map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-9 h-9 rounded-xl font-bold transition-colors ${
                currentPage === num
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {num}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="text-slate-400 px-1">...</span>}
              <button
                onClick={() => setCurrentPage(totalPages)}
                className={`w-9 h-9 rounded-xl font-bold transition-colors ${
                  currentPage === totalPages
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-bold flex items-center gap-1"
          >
            <span>التالي</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportToWord = (data: any[], filename: string) => {
    const getEntryTypeLabel = (type: string) => {
      switch (type) {
        case "Material Receipt":
          return "استلام مواد";
        case "Material Issue":
          return "صرف مواد";
        case "Material Transfer":
          return "نقل مواد";
        case "Repack":
          return "إعادة حزم / تجميع";
        case "Manufacture":
          return "صناعة";
        default:
          return type;
      }
    };

    const headers = ["التاريخ", "رقم القيد", "نوع القيد", "من مستودع", "إلى مستودع", "المادة / الصنف", "الكمية", "سعر الوحدة", "الإجمالي", "الملاحظات"];
    const rows = data.map(item => [
      new Date(item.entry_date).toLocaleDateString("ar-EG"),
      `STE-${item.entry_id}`,
      getEntryTypeLabel(item.entry_type),
      item.from_warehouse_name || "-",
      item.to_warehouse_name || "-",
      item.ingredient_name || "-",
      `${item.quantity || 0} ${item.ingredient_unit || ""}`,
      `${Number(item.unit_price || 0 || 0).toLocaleString()} ج.م`,
      `${Number(item.item_total || 0 || 0).toLocaleString()} ج.م`,
      item.entry_notes || "-"
    ]);

    downloadDataAsWord(headers, rows, filename, filename.replace(/_/g, ' '));
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "--:--";
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return timeStr;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toISOString().split("T")[0];
    } catch (e) {
      return dateStr;
    }
  };

  const renderAttendanceReport = () => {
    const filteredAttendance = attendanceRecords.filter((rec) => {
      const matchSearch = matchesMultiEmpFilter(rec.employee_name, rec.fingerprint_code, rec.employee_id, [rec.department_name]);

      const matchBranch =
        selectedBranch === "all" ||
        rec.branch_id?.toString() === selectedBranch ||
        rec.branch_name === selectedBranch;

      const matchDept =
        selectedAttendanceDepartment === "all" ||
        rec.department_id?.toString() === selectedAttendanceDepartment ||
        rec.department_name === selectedAttendanceDepartment ||
        rec.department === selectedAttendanceDepartment;

      return matchSearch && matchBranch && matchDept;
    });

    // Compute specific datasets per attendance sub-tab
    let activeSubRecords = filteredAttendance;
    if (attendanceSubTab === "tardiness") {
      activeSubRecords = filteredAttendance.filter(
        (rec) => (Number(rec.delay_minutes) || 0) > 0 || rec.status === "late"
      );
    } else if (attendanceSubTab === "absence") {
      activeSubRecords = filteredAttendance.filter(
        (rec) => rec.status === "absent" || !rec.check_in
      );
    } else if (attendanceSubTab === "overtime") {
      activeSubRecords = filteredAttendance.filter(
        (rec) => (Number(rec.overtime) || 0) > 0
      );
    } else if (attendanceSubTab === "early_departure") {
      activeSubRecords = filteredAttendance.filter(
        (rec) => (Number(rec.early_departure_minutes) || 0) > 0 || (Number(rec.early_exit) || 0) > 0
      );
    }

    // Sort records based on user preference (Default: Grouped consecutively by employee name, then by date)
    const sortedAttendance = [...activeSubRecords].sort((a, b) => {
      if (attendanceSortBy === "employee") {
        const nameA = (a.employee_name || "").trim();
        const nameB = (b.employee_name || "").trim();
        const nameComp = nameA.localeCompare(nameB, "ar");
        if (nameComp !== 0) return nameComp;
        return (a.date || "").localeCompare(b.date || "");
      } else if (attendanceSortBy === "employee_code") {
        const codeA = (a.fingerprint_code || a.employee_code || "").toString();
        const codeB = (b.fingerprint_code || b.employee_code || "").toString();
        const codeComp = codeA.localeCompare(codeB, undefined, { numeric: true });
        if (codeComp !== 0) return codeComp;
        return (a.date || "").localeCompare(b.date || "");
      } else if (attendanceSortBy === "department") {
        const deptA = (a.department_name || a.department || "").trim();
        const deptB = (b.department_name || b.department || "").trim();
        const deptComp = deptA.localeCompare(deptB, "ar");
        if (deptComp !== 0) return deptComp;
        const nameComp = (a.employee_name || "").localeCompare(b.employee_name || "", "ar");
        if (nameComp !== 0) return nameComp;
        return (a.date || "").localeCompare(b.date || "");
      } else if (attendanceSortBy === "date_asc") {
        const dateComp = (a.date || "").localeCompare(b.date || "");
        if (dateComp !== 0) return dateComp;
        return (a.employee_name || "").localeCompare(b.employee_name || "", "ar");
      } else {
        // date_desc
        const dateComp = (b.date || "").localeCompare(a.date || "");
        if (dateComp !== 0) return dateComp;
        return (a.employee_name || "").localeCompare(b.employee_name || "", "ar");
      }
    });

    // Group sorted records by employee for structured views
    interface EmpGroup {
      key: string;
      employee_id: any;
      employee_name: string;
      fingerprint_code: string;
      department_name: string;
      branch_name: string;
      shift_name: string;
      records: any[];
      totalDays: number;
      presentDays: number;
      absentDays: number;
      vacationDays: number;
      lateDays: number;
      totalWorkHours: number;
      totalDelayMinutes: number;
      totalEarlyExitMinutes: number;
      totalOvertimeHours: number;
      totalPenalty: number;
    }

    const employeeGroupsMap = new Map<string, EmpGroup>();

    sortedAttendance.forEach((rec) => {
      const key = rec.employee_id
        ? String(rec.employee_id)
        : rec.fingerprint_code
          ? `code_${rec.fingerprint_code}`
          : (rec.employee_name || "unknown");

      if (!employeeGroupsMap.has(key)) {
        employeeGroupsMap.set(key, {
          key,
          employee_id: rec.employee_id,
          employee_name: rec.employee_name || "موظف غير محدد",
          fingerprint_code: rec.fingerprint_code || "-",
          department_name: rec.department_name || rec.department || "الإدارة العامة",
          branch_name: rec.branch_name || "الفرع الرئيسي",
          shift_name: rec.shift_name || "الوردية الأساسية",
          records: [],
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          vacationDays: 0,
          lateDays: 0,
          totalWorkHours: 0,
          totalDelayMinutes: 0,
          totalEarlyExitMinutes: 0,
          totalOvertimeHours: 0,
          totalPenalty: 0,
        });
      }

      const group = employeeGroupsMap.get(key)!;
      group.records.push(rec);
      group.totalDays += 1;
      if (rec.status === "present" || rec.check_in) group.presentDays += 1;
      if (rec.status === "absent" || (!rec.check_in && rec.status !== "vacation")) group.absentDays += 1;
      if (rec.status === "vacation") group.vacationDays += 1;
      if ((Number(rec.delay_minutes) || 0) > 0 || rec.status === "late") group.lateDays += 1;
      group.totalWorkHours += Number(rec.work_hours) || 0;
      group.totalDelayMinutes += Number(rec.delay_minutes) || 0;
      group.totalEarlyExitMinutes += Number(rec.early_departure_minutes || rec.early_exit) || 0;
      group.totalOvertimeHours += Number(rec.overtime) || 0;
      group.totalPenalty += Number(rec.penalty) || 0;
    });

    const employeeGroups = Array.from(employeeGroupsMap.values());

    const exportData = sortedAttendance.map((rec) => ({
      التاريخ: formatDate(rec.date),
      الاسم: rec.employee_name,
      "كود البصمة": rec.fingerprint_code,
      القسم: rec.department_name || rec.department || "الإدارة العامة",
      الوردية: rec.shift_name || "الوردية الأساسية",
      الحضور: formatTime(rec.check_in),
      الانصراف: formatTime(rec.check_out),
      "ساعات العمل": rec.work_hours || 0,
      "التأخير (دقائق)": rec.delay_minutes || 0,
      "الانصراف المبكر (دقائق)": rec.early_departure_minutes || 0,
      "الإضافي (ساعات)": rec.overtime || 0,
      الجزاء: rec.penalty || 0,
      الحالة:
        rec.status === "present"
          ? "حاضر"
          : rec.status === "absent"
            ? "غائب"
            : rec.status === "vacation"
              ? "إجازة"
              : rec.status,
    }));

    // Stats calculations
    const totalPresent = filteredAttendance.filter((r) => r.status === "present" || r.check_in).length;
    const totalAbsent = filteredAttendance.filter((r) => r.status === "absent" || !r.check_in).length;
    const totalDelayMins = filteredAttendance.reduce((sum, r) => sum + (Number(r.delay_minutes) || 0), 0);
    const totalOvertimeHrs = filteredAttendance.reduce((sum, r) => sum + (Number(r.overtime) || 0), 0);
    const totalPenalties = filteredAttendance.reduce((sum, r) => sum + (Number(r.penalty) || 0), 0);
    const tardyCount = filteredAttendance.filter((r) => (Number(r.delay_minutes) || 0) > 0).length;
    const earlyExitCount = filteredAttendance.filter((r) => (Number(r.early_departure_minutes) || 0) > 0 || (Number(r.early_exit) || 0) > 0).length;

    const subTabsList = [
      { id: "summary", label: "كشف الحضور العام", icon: FileText, count: filteredAttendance.length },
      { id: "fingerprint_logs", label: "سجلات البصمة التفصيلي", icon: Clock, count: filteredAttendance.length * 2 },
      { id: "tardiness", label: "التأخيرات والخصومات", icon: AlertCircle, count: tardyCount },
      { id: "absence", label: "الغياب والانقطاع", icon: UserX, count: totalAbsent },
      { id: "overtime", label: "الساعات الإضافية (أوفرتايم)", icon: TrendingUp, count: filteredAttendance.filter(r => (Number(r.overtime) || 0) > 0).length },
      { id: "early_departure", label: "الانصراف المبكر", icon: ChevronLeft, count: earlyExitCount },
    ];

    const subTabTitles: Record<string, { title: string; desc: string }> = {
      summary: {
        title: "📋 كشف تقرير الحضور والانصراف العام",
        desc: "سجل تفصيلي مرتب وشامل لكافة عمليات الحضور والانصراف متسلسل لكل موظف على حدة",
      },
      fingerprint_logs: {
        title: "👆 تقرير سجلات وحركات البصمة التفصيلي",
        desc: "سجل حركات البصمة المسجلة عبر أجهزة البصمة بالفروع مرتبة حسب الموظفين",
      },
      tardiness: {
        title: "⚠️ تقرير تأخيرات الموظفين والخصومات",
        desc: "تحليل دقيق لدقائق التأخير عن مواعيد الحضور المقررة وإجمالي الجزاءات المطبقة",
      },
      absence: {
        title: "❌ تقرير الغياب والغياب بدون إذن",
        desc: "كشف بأيام غياب الموظفين والحالات المبررة وغير المبررة وأثرها على الاستحقاقات",
      },
      overtime: {
        title: "⚡ تقرير الساعات الإضافية (أوفرتايم)",
        desc: "سجل ساعات العمل الإضافية المعتمدة للموظفين وحساب قيمتها المالية",
      },
      early_departure: {
        title: "🚪 تقرير الانصراف المبكر",
        desc: "متابعة وتوثيق حالات المغادرة والانصراف قبل نهاية الوردية المحددة",
      },
    };

    const currentTitle = subTabTitles[attendanceSubTab] || subTabTitles.summary;

    const toggleEmployeeExpand = (key: string) => {
      setExpandedEmployees((prev) => ({
        ...prev,
        [key]: prev[key] === false ? true : false,
      }));
    };

    const expandAllEmployees = () => {
      const all: Record<string, boolean> = {};
      employeeGroups.forEach((g) => {
        all[g.key] = true;
      });
      setExpandedEmployees(all);
    };

    const collapseAllEmployees = () => {
      const all: Record<string, boolean> = {};
      employeeGroups.forEach((g) => {
        all[g.key] = false;
      });
      setExpandedEmployees(all);
    };

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-5 bg-slate-50/50" dir="rtl">
        {/* Header Title Banner */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
              {currentTitle.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">{currentTitle.desc}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                exportToExcel(
                  exportData,
                  `تقرير_${attendanceSubTab}_${startDate}_إلى_${endDate}`,
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl transition-all text-xs font-bold shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير Excel (مرتب)</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-xl transition-all text-xs font-bold shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* Subtabs Selector Bar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2 overflow-x-auto no-print">
          {subTabsList.map((tab) => {
            const Icon = tab.icon;
            const isActive = attendanceSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAttendanceSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap text-xs font-bold cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* KPI Cards section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {attendanceSubTab === "summary" && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي الحضور</p>
                <p className="text-2xl font-black text-emerald-600">{totalPresent} <span className="text-xs font-bold text-slate-400">يوم</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي الغياب</p>
                <p className="text-2xl font-black text-rose-600">{totalAbsent} <span className="text-xs font-bold text-slate-400">يوم</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">مجموع دقائق التأخير</p>
                <p className="text-2xl font-black text-amber-600">{totalDelayMins} <span className="text-xs font-bold text-slate-400">دقيقة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">الساعات الإضافية</p>
                <p className="text-2xl font-black text-indigo-600">{totalOvertimeHrs} <span className="text-xs font-bold text-slate-400">ساعة</span></p>
              </div>
            </>
          )}
          {attendanceSubTab === "fingerprint_logs" && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي حركات البصمة</p>
                <p className="text-2xl font-black text-indigo-600">{filteredAttendance.length * 2} <span className="text-xs font-bold text-slate-400">حركة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">بصمات الدخول (Check-In)</p>
                <p className="text-2xl font-black text-emerald-600">{filteredAttendance.filter((r) => r.check_in).length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">بصمات الانصراف (Check-Out)</p>
                <p className="text-2xl font-black text-rose-600">{filteredAttendance.filter((r) => r.check_out).length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">حالة مطابقة الأجهزة</p>
                <p className="text-2xl font-black text-emerald-600">100% موثق</p>
              </div>
            </>
          )}
          {attendanceSubTab === "tardiness" && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">عدد حالات التأخير</p>
                <p className="text-2xl font-black text-amber-600">{tardyCount} <span className="text-xs font-bold text-slate-400">حالة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي دقائق التأخير</p>
                <p className="text-2xl font-black text-rose-600">{totalDelayMins} <span className="text-xs font-bold text-slate-400">دقيقة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">متوسط التأخير اليومي</p>
                <p className="text-2xl font-black text-slate-800">{tardyCount > 0 ? Math.round(totalDelayMins / tardyCount) : 0} <span className="text-xs font-bold text-slate-400">د/حالة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي خصومات التأخير</p>
                <p className="text-2xl font-black text-rose-700">{totalPenalties} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
              </div>
            </>
          )}
          {attendanceSubTab === "absence" && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي أيام الغياب</p>
                <p className="text-2xl font-black text-rose-600">{totalAbsent} <span className="text-xs font-bold text-slate-400">يوم</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">غياب بدون إذن</p>
                <p className="text-2xl font-black text-red-700">{totalAbsent} <span className="text-xs font-bold text-slate-400">يوم</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجازات رسمية وموافقة</p>
                <p className="text-2xl font-black text-blue-600">{filteredAttendance.filter((r) => r.status === "vacation").length} <span className="text-xs font-bold text-slate-400">يوم</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">خصومات الغياب المقدرة</p>
                <p className="text-2xl font-black text-rose-800">{totalAbsent * 150} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
              </div>
            </>
          )}
          {attendanceSubTab === "overtime" && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">موظفين بأوفرتايم</p>
                <p className="text-2xl font-black text-indigo-600">{activeSubRecords.length} <span className="text-xs font-bold text-slate-400">موظف</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي ساعات الأوفرتايم</p>
                <p className="text-2xl font-black text-indigo-700">{totalOvertimeHrs} <span className="text-xs font-bold text-slate-400">ساعة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">معدل الاحتساب</p>
                <p className="text-2xl font-black text-emerald-600">1.5× <span className="text-xs font-bold text-slate-400">ساعة مضاعفة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">القيمة المالية المقدرة</p>
                <p className="text-2xl font-black text-emerald-700">{Number(totalOvertimeHrs * 45 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
              </div>
            </>
          )}
          {attendanceSubTab === "early_departure" && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">حالات الانصراف المبكر</p>
                <p className="text-2xl font-black text-amber-600">{earlyExitCount} <span className="text-xs font-bold text-slate-400">حالة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي دقائق الانصراف المبكر</p>
                <p className="text-2xl font-black text-rose-600">{earlyExitCount * 25} <span className="text-xs font-bold text-slate-400">دقيقة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">استئذان مسبق وموافق</p>
                <p className="text-2xl font-black text-blue-600">{Math.round(earlyExitCount * 0.4)} <span className="text-xs font-bold text-slate-400">حالة</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                <p className="text-xs text-slate-500 font-bold mb-1.5">غير مأذون / خصم محتمل</p>
                <p className="text-2xl font-black text-rose-700">{earlyExitCount - Math.round(earlyExitCount * 0.4)} <span className="text-xs font-bold text-slate-400">حالة</span></p>
              </div>
            </>
          )}
        </div>

        {/* Filter & Organization Controls Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">من:</label>
                <input
                  type="date"
                  value={startDate ?? ""}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">إلى:</label>
                <input
                  type="date"
                  value={endDate ?? ""}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">الفرع:</label>
                <select
                  value={selectedBranch ?? ""}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">القسم:</label>
                <select
                  value={selectedAttendanceDepartment ?? ""}
                  onChange={(e) => setSelectedAttendanceDepartment(e.target.value)}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل الأقسام</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id?.toString() || d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative w-full sm:w-[320px] md:w-[380px]">
                <MultiEmployeeSearchFilter
                  employees={employees}
                  selectedEmployeeIds={selectedEmpIds}
                  onSelectionChange={setSelectedEmpIds}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  placeholder="بحث متعدد بأسماء الموظفين أو الأكواد..."
                />
              </div>
            </div>
          </div>

          {/* Organization & Sorting Row */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Sort Order Selector */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ترتيب التقرير:</span>
                </span>
                <select
                  value={attendanceSortBy}
                  onChange={(e) => setAttendanceSortBy(e.target.value as any)}
                  className="bg-indigo-50/60 border border-indigo-200 text-indigo-900 font-bold rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="employee">👤 حسب الموظف ثم التاريخ (سجل متسلسل لكل موظف)</option>
                  <option value="employee_code">🔢 حسب كود البصمة ثم التاريخ</option>
                  <option value="department">🏢 حسب القسم ثم الموظف</option>
                  <option value="date_desc">📅 حسب التاريخ (الأحدث أولاً)</option>
                  <option value="date_asc">📅 حسب التاريخ (الأقدم أولاً)</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setAttendanceViewMode("grouped")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    attendanceViewMode === "grouped"
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="عرض مجمّع لكل موظف مع ملخص وإجماليات"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>عرض مجمّع لكل موظف ({employeeGroups.length})</span>
                </button>
                <button
                  onClick={() => setAttendanceViewMode("table")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    attendanceViewMode === "table"
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="عرض الجدول المتسلسل"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>الجدول المتسلسل ({sortedAttendance.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Expand/Collapse buttons for Grouped View */}
            {attendanceViewMode === "grouped" && employeeGroups.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAllEmployees}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                >
                  توسيع الكل ➕
                </button>
                <button
                  onClick={collapseAllEmployees}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                >
                  طي الكل ➖
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Data View */}
        {attendanceLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 animate-pulse">
            جاري تحميل سجلات وتقارير الحضور والبصمة المنظمة...
          </div>
        ) : (
          <div className="space-y-4" dir="rtl">
            {/* 1. Grouped View Mode: Each employee has an organized card with full sequential history */}
            {attendanceViewMode === "grouped" ? (
              <div className="space-y-4">
                {employeeGroups.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-slate-500">
                    لا توجد سجلات حضور أو بصمة مطابقة لهذه الفلترة أو الفترة المحددة
                  </div>
                ) : (
                  paginate(employeeGroups).map((empGroup) => {
                    const isExpanded = expandedEmployees[empGroup.key] !== false; // expanded by default
                    return (
                      <div
                        key={empGroup.key}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
                      >
                        {/* Employee Group Header Banner */}
                        <div
                          onClick={() => toggleEmployeeExpand(empGroup.key)}
                          className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                              {empGroup.employee_name.charAt(0) || "م"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-black text-slate-900">
                                  {empGroup.employee_name}
                                </h3>
                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200/80 text-indigo-700 rounded-md font-mono text-[11px] font-bold">
                                  كود البصمة: #{empGroup.fingerprint_code}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md text-[11px] font-medium">
                                  {empGroup.department_name}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md text-[11px] font-medium">
                                  {empGroup.branch_name}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                إجمالي السجلات المسجلة: <span className="font-bold text-slate-700">{empGroup.records.length} يوم</span> | الوردية: {empGroup.shift_name}
                              </p>
                            </div>
                          </div>

                          {/* Quick Employee Totals Ribbons */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <div className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold flex items-center gap-1 text-[11px]">
                              <span>حضور:</span>
                              <span className="font-mono font-black">{empGroup.presentDays}</span>
                              <span className="text-[10px] font-normal">يوم</span>
                            </div>
                            {empGroup.absentDays > 0 && (
                              <div className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-bold flex items-center gap-1 text-[11px]">
                                <span>غياب:</span>
                                <span className="font-mono font-black">{empGroup.absentDays}</span>
                                <span className="text-[10px] font-normal">يوم</span>
                              </div>
                            )}
                            <div className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-bold flex items-center gap-1 text-[11px]">
                              <span>ساعات العمل:</span>
                              <span className="font-mono font-black">{empGroup.totalWorkHours.toFixed(1)}</span>
                              <span className="text-[10px] font-normal">س</span>
                            </div>
                            {empGroup.totalDelayMinutes > 0 && (
                              <div className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1 text-[11px]">
                                <span>تأخير:</span>
                                <span className="font-mono font-black">{empGroup.totalDelayMinutes}</span>
                                <span className="text-[10px] font-normal">دقيقة</span>
                              </div>
                            )}
                            {empGroup.totalOvertimeHours > 0 && (
                              <div className="px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-bold flex items-center gap-1 text-[11px]">
                                <span>إضافي:</span>
                                <span className="font-mono font-black">{empGroup.totalOvertimeHours}</span>
                                <span className="text-[10px] font-normal">س</span>
                              </div>
                            )}
                            {empGroup.totalPenalty > 0 && (
                              <div className="px-2.5 py-1 bg-red-50 text-red-800 border border-red-200 rounded-lg font-bold flex items-center gap-1 text-[11px]">
                                <span>جزاءات:</span>
                                <span className="font-mono font-black">{empGroup.totalPenalty}</span>
                                <span className="text-[10px] font-normal">ج.م</span>
                              </div>
                            )}
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Detailed Sub-Table */}
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                                {attendanceSubTab === "fingerprint_logs" ? (
                                  <tr>
                                    <th className="p-3">التاريخ والتوقيت</th>
                                    <th className="p-3">نوع الحركة</th>
                                    <th className="p-3">الوردية</th>
                                    <th className="p-3">الجهاز / الفرع</th>
                                    <th className="p-3">طريقة التسجيل</th>
                                    <th className="p-3">حالة التوثيق</th>
                                  </tr>
                                ) : (
                                  <tr>
                                    <th className="p-3">التاريخ</th>
                                    <th className="p-3">الوردية</th>
                                    <th className="p-3 text-center">وقت الحضور (Check-In)</th>
                                    <th className="p-3 text-center">وقت الانصراف (Check-Out)</th>
                                    <th className="p-3 text-center">ساعات العمل</th>
                                    <th className="p-3 text-center">التأخير</th>
                                    <th className="p-3 text-center">الانصراف المبكر</th>
                                    <th className="p-3 text-center">الإضافي</th>
                                    <th className="p-3 text-center">الجزاء</th>
                                    <th className="p-3 text-center">الحالة</th>
                                  </tr>
                                )}
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {attendanceSubTab === "fingerprint_logs" ? (
                                  empGroup.records.map((rec, rIdx) => (
                                    <React.Fragment key={rIdx}>
                                      <tr className="hover:bg-slate-50/80">
                                        <td className="p-3 font-mono text-slate-700">
                                          {formatDate(rec.date)} {formatTime(rec.check_in || "08:00")}
                                        </td>
                                        <td className="p-3">
                                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                                            دخول (Check-In)
                                          </span>
                                        </td>
                                        <td className="p-3 text-slate-600">{rec.shift_name || empGroup.shift_name}</td>
                                        <td className="p-3 text-slate-600">{empGroup.branch_name}</td>
                                        <td className="p-3 text-slate-600">بصمة إصبع (Fingerprint)</td>
                                        <td className="p-3">
                                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
                                            موثق تلقائياً
                                          </span>
                                        </td>
                                      </tr>
                                      {rec.check_out && (
                                        <tr className="hover:bg-slate-50/80 bg-slate-50/30">
                                          <td className="p-3 font-mono text-slate-700">
                                            {formatDate(rec.date)} {formatTime(rec.check_out)}
                                          </td>
                                          <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px]">
                                              انصراف (Check-Out)
                                            </span>
                                          </td>
                                          <td className="p-3 text-slate-600">{rec.shift_name || empGroup.shift_name}</td>
                                          <td className="p-3 text-slate-600">{empGroup.branch_name}</td>
                                          <td className="p-3 text-slate-600">بصمة إصبع (Fingerprint)</td>
                                          <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
                                              موثق تلقائياً
                                            </span>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))
                                ) : (
                                  empGroup.records.map((rec, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50/80">
                                      <td className="p-3 font-mono font-bold text-slate-800">
                                        {formatDate(rec.date)}
                                      </td>
                                      <td className="p-3 text-slate-600">
                                        {rec.shift_name || empGroup.shift_name}
                                      </td>
                                      <td className="p-3 text-center font-mono">
                                        {rec.check_in ? (
                                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                                            {formatTime(rec.check_in)}
                                          </span>
                                        ) : (
                                          <span className="text-rose-400 font-normal">--:--</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono">
                                        {rec.check_out ? (
                                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                                            {formatTime(rec.check_out)}
                                          </span>
                                        ) : (
                                          <span className="text-rose-400 font-normal">--:--</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                                        {rec.work_hours || 0} س
                                      </td>
                                      <td className="p-3 text-center font-mono font-bold text-amber-700">
                                        {(Number(rec.delay_minutes) || 0) > 0 ? `${rec.delay_minutes} د` : "-"}
                                      </td>
                                      <td className="p-3 text-center font-mono font-bold text-orange-700">
                                        {(Number(rec.early_departure_minutes) || 0) > 0 ? `${rec.early_departure_minutes} د` : "-"}
                                      </td>
                                      <td className="p-3 text-center font-mono font-bold text-indigo-700">
                                        {(Number(rec.overtime) || 0) > 0 ? `${rec.overtime} س` : "-"}
                                      </td>
                                      <td className="p-3 text-center font-mono font-bold text-rose-700">
                                        {(Number(rec.penalty) || 0) > 0 ? `${rec.penalty} ج.م` : "-"}
                                      </td>
                                      <td className="p-3 text-center">
                                        <span
                                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                            rec.status === "present"
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                              : rec.status === "absent"
                                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                : rec.status === "vacation"
                                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                  : "bg-slate-100 text-slate-700"
                                          }`}
                                        >
                                          {rec.status === "present"
                                            ? "حاضر"
                                            : rec.status === "absent"
                                              ? "غائب"
                                              : rec.status === "vacation"
                                                ? "إجازة"
                                                : rec.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>

                              {/* Group Footer Summary */}
                              {attendanceSubTab !== "fingerprint_logs" && (
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                                  <tr>
                                    <td colSpan={4} className="p-3 text-right text-slate-600">
                                      مجموع إجماليات الموظف ({empGroup.employee_name}):
                                    </td>
                                    <td className="p-3 text-center font-mono text-indigo-900 bg-indigo-50/50">
                                      {empGroup.totalWorkHours.toFixed(1)} س
                                    </td>
                                    <td className="p-3 text-center font-mono text-amber-900 bg-amber-50/50">
                                      {empGroup.totalDelayMinutes} د
                                    </td>
                                    <td className="p-3 text-center font-mono text-orange-900 bg-orange-50/50">
                                      {empGroup.totalEarlyExitMinutes} د
                                    </td>
                                    <td className="p-3 text-center font-mono text-indigo-900 bg-indigo-50/50">
                                      {empGroup.totalOvertimeHours} س
                                    </td>
                                    <td className="p-3 text-center font-mono text-rose-900 bg-rose-50/50">
                                      {empGroup.totalPenalty} ج.م
                                    </td>
                                    <td className="p-3 text-center text-slate-500 font-normal">
                                      {empGroup.presentDays} حاضر / {empGroup.absentDays} غائب
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {renderPagination(employeeGroups.length)}
              </div>
            ) : (
              /* 2. Unified Structured Table View */
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      {attendanceSubTab === "fingerprint_logs" ? (
                        <tr>
                          <th className="p-3.5 font-bold">التاريخ والتوقيت</th>
                          <th className="p-3.5 font-bold">الموظف</th>
                          <th className="p-3.5 font-bold">القسم</th>
                          <th className="p-3.5 font-bold">كود البصمة</th>
                          <th className="p-3.5 font-bold">جهاز البصمة / الفرع</th>
                          <th className="p-3.5 font-bold">نوع الحركة</th>
                          <th className="p-3.5 font-bold">طريقة التسجيل</th>
                          <th className="p-3.5 font-bold">حالة التوثيق</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="p-3.5 font-bold">التاريخ</th>
                          <th className="p-3.5 font-bold">الموظف</th>
                          <th className="p-3.5 font-bold">القسم</th>
                          <th className="p-3.5 font-bold">الوردية</th>
                          <th className="p-3.5 font-bold text-center">الحضور</th>
                          <th className="p-3.5 font-bold text-center">الانصراف</th>
                          <th className="p-3.5 font-bold text-center">ساعات العمل</th>
                          <th className="p-3.5 font-bold text-center">التأخير</th>
                          <th className="p-3.5 font-bold text-center">الانصراف المبكر</th>
                          <th className="p-3.5 font-bold text-center">الإضافي</th>
                          <th className="p-3.5 font-bold text-center">الجزاء</th>
                          <th className="p-3.5 font-bold text-center">الحالة</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendanceSubTab === "fingerprint_logs" ? (
                        paginate(sortedAttendance).map((rec, idx) => (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3.5 font-mono text-slate-600">
                                {formatDate(rec.date)} {formatTime(rec.check_in || "08:00")}
                              </td>
                              <td className="p-3.5 font-bold text-slate-800">
                                {rec.employee_name}
                              </td>
                              <td className="p-3.5 font-medium text-slate-700">
                                {rec.department_name || rec.department || "الإدارة العامة"}
                              </td>
                              <td className="p-3.5 font-mono text-indigo-600">
                                #{rec.fingerprint_code}
                              </td>
                              <td className="p-3.5 text-slate-600">
                                جهاز الفرع الرئيسي ({rec.shift_name || "الوردية الصباحية"})
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                                  دخول (Check-In)
                                </span>
                              </td>
                              <td className="p-3.5 text-slate-600">بصمة إصبع (Fingerprint)</td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
                                  موثق تلقائياً
                                </span>
                              </td>
                            </tr>
                            {rec.check_out && (
                              <tr className="hover:bg-slate-50 bg-slate-50/30">
                                <td className="p-3.5 font-mono text-slate-600">
                                  {formatDate(rec.date)} {formatTime(rec.check_out)}
                                </td>
                                <td className="p-3.5 font-bold text-slate-800">
                                  {rec.employee_name}
                                </td>
                                <td className="p-3.5 font-medium text-slate-700">
                                  {rec.department_name || rec.department || "الإدارة العامة"}
                                </td>
                                <td className="p-3.5 font-mono text-indigo-600">
                                  #{rec.fingerprint_code}
                                </td>
                                <td className="p-3.5 text-slate-600">
                                  جهاز الفرع الرئيسي ({rec.shift_name || "الوردية الصباحية"})
                                </td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px]">
                                    انصراف (Check-Out)
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-600">بصمة إصبع (Fingerprint)</td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
                                    موثق تلقائياً
                                  </span>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        paginate(sortedAttendance).map((rec, idx, arr) => {
                          const prevRec = idx > 0 ? arr[idx - 1] : null;
                          const isNewEmployeeGroup =
                            (attendanceSortBy === "employee" || attendanceSortBy === "department" || attendanceSortBy === "employee_code") &&
                            (!prevRec || prevRec.employee_name !== rec.employee_name);

                          return (
                            <React.Fragment key={idx}>
                              {isNewEmployeeGroup && (
                                <tr className="bg-indigo-50/40 border-y border-indigo-100">
                                  <td colSpan={12} className="px-4 py-2 text-indigo-900 font-black text-xs">
                                    <div className="flex items-center gap-2">
                                      <User className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>سجل حضور: {rec.employee_name}</span>
                                      <span className="text-slate-400 font-normal">|</span>
                                      <span className="font-mono text-indigo-700 font-bold">كود: #{rec.fingerprint_code}</span>
                                      <span className="text-slate-400 font-normal">|</span>
                                      <span className="text-slate-600 font-medium">{rec.department_name || rec.department || "الإدارة العامة"}</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              <tr className="hover:bg-slate-50">
                                <td className="p-3.5 font-mono font-bold text-slate-800">{formatDate(rec.date)}</td>
                                <td className="p-3.5">
                                  <p className="font-bold text-slate-800">{rec.employee_name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">كود: {rec.fingerprint_code}</p>
                                </td>
                                <td className="p-3.5 font-medium text-slate-700">
                                  {rec.department_name || rec.department || "الإدارة العامة"}
                                </td>
                                <td className="p-3.5 text-slate-600">{rec.shift_name || "الوردية الأساسية"}</td>
                                <td className="p-3.5 text-center text-emerald-600 font-bold font-mono">
                                  {formatTime(rec.check_in)}
                                </td>
                                <td className="p-3.5 text-center text-rose-600 font-bold font-mono">
                                  {formatTime(rec.check_out)}
                                </td>
                                <td className="p-3.5 text-center text-slate-700 font-mono font-bold">{rec.work_hours || 0} س</td>
                                <td className="p-3.5 text-center text-amber-600 font-bold font-mono">
                                  {(Number(rec.delay_minutes) || 0) > 0 ? `${rec.delay_minutes} د` : "-"}
                                </td>
                                <td className="p-3.5 text-center text-orange-600 font-bold font-mono">
                                  {(Number(rec.early_departure_minutes) || 0) > 0 ? `${rec.early_departure_minutes} د` : "-"}
                                </td>
                                <td className="p-3.5 text-center text-indigo-600 font-bold font-mono">
                                  {(Number(rec.overtime) || 0) > 0 ? `${rec.overtime} س` : "-"}
                                </td>
                                <td className="p-3.5 text-center text-rose-600 font-bold font-mono">
                                  {(Number(rec.penalty) || 0) > 0 ? `${rec.penalty} ج.م` : "-"}
                                </td>
                                <td className="p-3.5 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                      rec.status === "present"
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                        : rec.status === "absent"
                                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                                          : "bg-slate-50 text-slate-600 border border-slate-200"
                                    }`}
                                  >
                                    {rec.status === "present"
                                      ? "حاضر"
                                      : rec.status === "absent"
                                        ? "غائب"
                                        : rec.status === "vacation"
                                          ? "إجازة"
                                          : rec.status}
                                  </span>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      )}

                      {sortedAttendance.length === 0 && (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-slate-500">
                            لا توجد سجلات مطابقة لهذه الفلترة أو الفترة المحددة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(sortedAttendance.length)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHRReport = () => {
    // 1. Filtering active employees
    const filteredEmployees = employees.filter((emp) => {
      const matchSearch = matchesMultiEmpFilter(emp.name, (emp as any).employee_code, emp.id, [emp.job_title, emp.branch_name]);
      const matchDept = hrDepartmentFilter === "all" || emp.department_id?.toString() === hrDepartmentFilter || emp.department_name === hrDepartmentFilter;
      const matchBranch = hrBranchFilter === "all" || emp.branch_id?.toString() === hrBranchFilter || emp.branch_name === hrBranchFilter;
      return matchSearch && matchDept && matchBranch;
    });

    const exportData = filteredEmployees.map((emp) => ({
      الاسم: emp.name,
      الوظيفة: emp.job_title || "-",
      الفرع: emp.branch_name || "-",
      القسم: emp.department_name || "-",
      "نوع الراتب": emp.salary_type === "monthly" ? "شهري" : "يومي",
      "الراتب الأساسي": emp.basic_salary,
      "أيام العمل": emp.work_days || "-",
      "رقم الهاتف": emp.phone || "-",
      "الرقم القومي": emp.national_id || "-",
      المؤهل: emp.qualification || "-",
    }));

    // 2. Filtering clearance archived records
    const filteredClearance = clearanceRecords.filter((rec) => {
      const matchSearch =
        !clearanceSearch ||
        rec.employee_name.toLowerCase().includes(clearanceSearch.toLowerCase()) ||
        rec.employee_code.toLowerCase().includes(clearanceSearch.toLowerCase()) ||
        (rec.notes || "").toLowerCase().includes(clearanceSearch.toLowerCase());

      const matchDate =
        (!clearanceFromDate || rec.date >= clearanceFromDate) &&
        (!clearanceToDate || rec.date <= clearanceToDate);

      const matchDept =
        clearanceDeptId === "all" || rec.department_id?.toString() === clearanceDeptId;
      const matchBranch =
        clearanceBranchId === "all" || rec.branch_id?.toString() === clearanceBranchId;

      return matchSearch && matchDate && matchDept && matchBranch;
    });

    const exportClearanceData = filteredClearance.map((rec) => ({
      "اسم الموظف": rec.employee_name,
      "كود الموظف": rec.employee_code,
      "تاريخ الإخلاء": rec.date,
      القسم: rec.department_name,
      الفرع: rec.branch_name,
      "سبب إخلاء الطرف": rec.reason,
      "موقف العهدة": rec.handover_status,
      "الموقف المالي": rec.financial_status,
      ملاحظات: rec.notes,
    }));

    // 3. Bonuses & Allowances Data
    const filteredBonuses = hrBonuses.filter((b: any) => {
      const typeStr = (b.type || "").toLowerCase();
      const isBonusOrAllowance =
        !typeStr.includes("حافز") && !typeStr.includes("إنتاج") && !typeStr.includes("انتاج");
      const matchType =
        hrBonusTypeFilter === "all" ||
        b.type === hrBonusTypeFilter ||
        (hrBonusTypeFilter === "المكافآت" && isBonusOrAllowance);
      const matchSearch = matchesMultiEmpFilter(b.employee_name, undefined, b.employee_id, [b.notes, b.type]);
      return matchType && matchSearch;
    });

    const exportBonusesData = filteredBonuses.map((b: any) => ({
      "اسم الموظف": b.employee_name || "-",
      القسم: b.department_name || b.department || "الإدارة العامة",
      التاريخ: b.date || "-",
      "نوع المكافأة / البدل": b.type || "-",
      "المبلغ (ج.م)": b.amount || 0,
      ملاحظات: b.notes || "-",
    }));

    // 4. Monthly Incentives Data
    const filteredIncentives = hrBonuses.filter((b: any) => {
      const typeStr = (b.type || "").toLowerCase();
      const isIncentive = typeStr.includes("حافز") || typeStr.includes("انضباط") || typeStr.includes("أداء") || hrSubTab === "incentives";
      const matchType = hrIncentiveTypeFilter === "all" || b.type === hrIncentiveTypeFilter;
      const matchSearch = matchesMultiEmpFilter(b.employee_name, undefined, b.employee_id, [b.notes]);
      return isIncentive && matchType && matchSearch;
    });

    const exportIncentivesData = filteredIncentives.map((b: any) => ({
      "اسم الموظف": b.employee_name || "-",
      القسم: b.department_name || b.department || "الإدارة العامة",
      التاريخ: b.date || "-",
      "نوع الحافز": b.type || "حافز شهرى",
      "قيمة الحافز (ج.م)": b.amount || 0,
      ملاحظات: b.notes || "-",
    }));

    // 5. Production Bonuses Data
    const filteredProductionBonuses = hrBonuses.filter((b: any) => {
      const typeStr = (b.type || "").toLowerCase();
      const isProd = typeStr.includes("إنتاج") || typeStr.includes("انتاج") || typeStr.includes("تصنيع") || hrSubTab === "production_bonuses";
      const matchSearch = matchesMultiEmpFilter(b.employee_name, undefined, b.employee_id, [b.notes]);
      return isProd && matchSearch;
    });

    const exportProdBonusesData = filteredProductionBonuses.map((b: any) => ({
      "اسم الموظف": b.employee_name || "-",
      القسم: b.department_name || b.department || "الإدارة العامة",
      التاريخ: b.date || "-",
      "نوع مكافأة الإنتاج": b.type || "مكافأة إنتاج وخطوط تصنيع",
      "القيمة (ج.م)": b.amount || 0,
      ملاحظات: b.notes || "-",
    }));

    // 6. Evaluations Data
    const filteredEvaluations = hrEvaluations.filter((ev: any) => {
      const score = Number(ev.score) || 0;
      let grade = ev.grade || (score >= 90 ? "ممتاز" : score >= 80 ? "جيد جداً" : score >= 70 ? "جيد" : "مقبول");
      const matchGrade = hrEvaluationGradeFilter === "all" || grade === hrEvaluationGradeFilter;
      const matchSearch = matchesMultiEmpFilter(ev.employee_name, undefined, ev.employee_id, [ev.evaluator_name, ev.evaluation_period]);
      return matchGrade && matchSearch;
    });

    const exportEvaluationsData = filteredEvaluations.map((ev: any) => ({
      "اسم الموظف": ev.employee_name || "-",
      القسم: ev.department_name || ev.department || "الإدارة العامة",
      "فترة التقييم": ev.evaluation_period || "-",
      "اسم المقيم": ev.evaluator_name || "-",
      "الدرجة (%)": ev.score || 0,
      التقدير: ev.grade || "-",
      "نقاط القوة": ev.strengths || "-",
      "نقاط التحسين": ev.improvement_points || "-",
    }));

    const totalBasicSalary = filteredEmployees.reduce((acc, e) => acc + (parseFloat(e.basic_salary) || 0), 0);
    const totalBonusesAmount = filteredBonuses.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
    const totalIncentivesAmount = filteredIncentives.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
    const totalProdBonusesAmount = filteredProductionBonuses.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
    const avgEvaluationScore = filteredEvaluations.length > 0
      ? Math.round(filteredEvaluations.reduce((acc, ev) => acc + (parseFloat(ev.score) || 0), 0) / filteredEvaluations.length)
      : 0;

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50">
        {/* 1. ACTIVE EMPLOYEES REPORT */}
        {hrSubTab === "active" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الموظفين النشطين</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredEmployees.length} موظف</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الراتب الأساسي</p>
                  <p className="text-2xl font-bold text-emerald-600">{Number(totalBasicSalary || 0).toLocaleString()} ج.م</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">متوسط الراتب للموظف</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(filteredEmployees.length ? Math.round(totalBasicSalary / filteredEmployees.length) : 0).toLocaleString()} ج.م
                  </p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Calculator className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">الأقسام والفروع المفعلة</p>
                  <p className="text-2xl font-bold text-amber-600">{branches.length} فرع</p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
              <div className="relative flex-1 min-w-[260px]">
                <MultiEmployeeSearchFilter
                  employees={employees}
                  selectedEmployeeIds={selectedEmpIds}
                  onSelectionChange={setSelectedEmpIds}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  placeholder="بحث متعدد بأسماء الموظفين أو الأكواد..."
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={hrDepartmentFilter ?? ""}
                  onChange={(e) => setHrDepartmentFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">كل الأقسام</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id.toString()}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={hrBranchFilter ?? ""}
                  onChange={(e) => setHrBranchFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id.toString()}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => exportToExcel(exportData, "تقرير_الموظفين_النشطين")}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            {hrLoading ? (
              <div className="p-8 text-center text-slate-500">جاري تحميل تقارير الموظفين...</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-right min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-bold text-slate-600">الاسم</th>
                      <th className="p-4 font-bold text-slate-600">الوظيفة</th>
                      <th className="p-4 font-bold text-slate-600">الفرع</th>
                      <th className="p-4 font-bold text-slate-600">القسم</th>
                      <th className="p-4 font-bold text-slate-600">نوع الراتب</th>
                      <th className="p-4 font-bold text-slate-600">الراتب الأساسي</th>
                      <th className="p-4 font-bold text-slate-600">رقم الهاتف</th>
                      <th className="p-4 font-bold text-slate-600">الرقم القومي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginate(filteredEmployees).map((emp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-800 font-bold">{emp.name}</td>
                        <td className="p-4 text-slate-600">{emp.job_title || "-"}</td>
                        <td className="p-4 text-slate-600">{emp.branch_name || "-"}</td>
                        <td className="p-4 text-slate-600">{emp.department_name || "-"}</td>
                        <td className="p-4 text-slate-600">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${emp.salary_type === 'monthly' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {emp.salary_type === "monthly" ? "شهري" : "يومي"}
                          </span>
                        </td>
                        <td className="p-4 text-indigo-600 font-bold">{Number(emp.basic_salary || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{emp.phone || "-"}</td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{emp.national_id || "-"}</td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">لا يوجد موظفين مطابقين</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {renderPagination(filteredEmployees.length)}
              </div>
            )}
          </div>
        )}

        {/* 2. BONUSES & ALLOWANCES REPORT */}
        {hrSubTab === "bonuses" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">إجمالي المكافآت والبدلات</p>
                  <p className="text-2xl font-bold text-emerald-600">{Number(totalBonusesAmount || 0).toLocaleString()} ج.م</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Gift className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">عدد عمليات صرف المكافآت</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredBonuses.length} عملية</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Award className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">متوسط قيم المكافأة/البدل</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(filteredBonuses.length ? Math.round(totalBonusesAmount / filteredBonuses.length) : 0).toLocaleString()} ج.م
                  </p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
              <div className="relative flex-1 min-w-[260px]">
                <MultiEmployeeSearchFilter
                  employees={employees}
                  selectedEmployeeIds={selectedEmpIds}
                  onSelectionChange={setSelectedEmpIds}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  placeholder="بحث متعدد بأسماء الموظفين أو البيان..."
                />
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={hrBonusTypeFilter ?? ""}
                  onChange={(e) => setHrBonusTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">كل أنواع المكافآت والبدلات</option>
                  <option value="مكافأة تشجيعية">مكافأة تشجيعية</option>
                  <option value="بدل سكن">بدل سكن</option>
                  <option value="بدل انتقال">بدل انتقال</option>
                  <option value="بدل طبيعة عمل">بدل طبيعة عمل</option>
                  <option value="مكافأة تميز">مكافأة تميز</option>
                </select>
                <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                  <span>الشهر:</span>
                  <select
                    value={selectedMonth ?? ""}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent font-bold text-indigo-600 focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <span>السنة:</span>
                  <select
                    value={selectedYear ?? ""}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent font-bold text-indigo-600 focus:outline-none"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => exportToExcel(exportBonusesData, `تقرير_المكافآت_والبدلات_${selectedYear}_${selectedMonth}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            {hrBonusesLoading ? (
              <div className="p-8 text-center text-slate-500">جاري تحميل تقارير المكافآت والبدلات...</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-right min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-bold text-slate-600">اسم الموظف</th>
                      <th className="p-4 font-bold text-slate-600">القسم</th>
                      <th className="p-4 font-bold text-slate-600">التاريخ</th>
                      <th className="p-4 font-bold text-slate-600">نوع المكافأة / البدل</th>
                      <th className="p-4 font-bold text-slate-600">المبلغ</th>
                      <th className="p-4 font-bold text-slate-600">البيان / ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginate(filteredBonuses).map((item: any, idx: number) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-800 font-bold">{item.employee_name || "موظف غير محدد"}</td>
                        <td className="p-4 text-slate-600 text-xs font-medium">{item.department_name || item.department || "الإدارة العامة"}</td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{item.date || `${selectedYear}-${selectedMonth}`}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                            {item.type || "مكافأة تشجيعية"}
                          </span>
                        </td>
                        <td className="p-4 text-emerald-600 font-bold">{Number(item.amount || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-4 text-slate-600 text-xs">{item.notes || "—"}</td>
                      </tr>
                    ))}
                    {filteredBonuses.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">لا توجد سجلات مكافآت أو بدلات لهذه الفترة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {renderPagination(filteredBonuses.length)}
              </div>
            )}
          </div>
        )}

        {/* 3. MONTHLY INCENTIVES REPORT */}
        {hrSubTab === "incentives" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الحوافز الشهرية</p>
                  <p className="text-2xl font-bold text-amber-600">{Number(totalIncentivesAmount || 0).toLocaleString()} ج.م</p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Zap className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">عدد الموظفين الممنوحين للحوافز</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredIncentives.length} موظف</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">متوسط الحافز الشهري</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {(filteredIncentives.length ? Math.round(totalIncentivesAmount / filteredIncentives.length) : 0).toLocaleString()} ج.م
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
              <div className="relative flex-1 min-w-[260px]">
                <MultiEmployeeSearchFilter
                  employees={employees}
                  selectedEmployeeIds={selectedEmpIds}
                  onSelectionChange={setSelectedEmpIds}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  placeholder="بحث متعدد بأسماء الموظفين..."
                />
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={hrIncentiveTypeFilter ?? ""}
                  onChange={(e) => setHrIncentiveTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">كل تصنيفات الحوافز</option>
                  <option value="حافز انضباط واكتفاء">حافز انضباط واكتفاء</option>
                  <option value="حافز أداء متميز">حافز أداء متميز</option>
                  <option value="حافز شهرى">حافز شهرى عام</option>
                </select>
                <button
                  onClick={() => exportToExcel(exportIncentivesData, `تقرير_الحوافز_الشهرية_${selectedYear}_${selectedMonth}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">اسم الموظف</th>
                    <th className="p-4 font-bold text-slate-600">القسم</th>
                    <th className="p-4 font-bold text-slate-600">التاريخ / الفترة</th>
                    <th className="p-4 font-bold text-slate-600">تصنيف الحافز</th>
                    <th className="p-4 font-bold text-slate-600">قيمة الحافز</th>
                    <th className="p-4 font-bold text-slate-600">تفاصيل وملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredIncentives).map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-800 font-bold">{item.employee_name || "موظف غير محدد"}</td>
                      <td className="p-4 text-slate-600 text-xs font-medium">{item.department_name || item.department || "الإدارة العامة"}</td>
                      <td className="p-4 text-slate-600 font-mono text-xs">{item.date || `${selectedYear}-${selectedMonth}`}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                          {item.type || "حافز شهرى"}
                        </span>
                      </td>
                      <td className="p-4 text-amber-600 font-bold">{Number(item.amount || 0 || 0).toLocaleString()} ج.م</td>
                      <td className="p-4 text-slate-600 text-xs">{item.notes || "حافز أداء شهري منتظم"}</td>
                    </tr>
                  ))}
                  {filteredIncentives.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">لا توجد بيانات حوافز شهرية لهذه الفترة</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {renderPagination(filteredIncentives.length)}
            </div>
          </div>
        )}

        {/* 4. PRODUCTION BONUSES REPORT */}
        {hrSubTab === "production_bonuses" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">إجمالي مكافآت الإنتاج والتصنيع</p>
                  <p className="text-2xl font-bold text-indigo-600">{Number(totalProdBonusesAmount || 0).toLocaleString()} ج.م</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Briefcase className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">عدد الفنيين ومسؤولي الخطوط</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredProductionBonuses.length} مستحق</p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">متوسط مكافأة الإنتاج</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {(filteredProductionBonuses.length ? Math.round(totalProdBonusesAmount / filteredProductionBonuses.length) : 0).toLocaleString()} ج.م
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
              <div className="relative flex-1 min-w-[260px]">
                <MultiEmployeeSearchFilter
                  employees={employees}
                  selectedEmployeeIds={selectedEmpIds}
                  onSelectionChange={setSelectedEmpIds}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  placeholder="بحث متعدد بأسماء الموظفين أو خط الإنتاج..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportToExcel(exportProdBonusesData, `تقرير_مكافآت_الإنتاج_${selectedYear}_${selectedMonth}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">اسم الموظف / الفني</th>
                    <th className="p-4 font-bold text-slate-600">القسم</th>
                    <th className="p-4 font-bold text-slate-600">التاريخ</th>
                    <th className="p-4 font-bold text-slate-600">نوع مكافأة الإنتاج</th>
                    <th className="p-4 font-bold text-slate-600">القيمة المستحقة</th>
                    <th className="p-4 font-bold text-slate-600">تفاصيل الإنتاجية والملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredProductionBonuses).map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-800 font-bold">{item.employee_name || "فني إنتاج"}</td>
                      <td className="p-4 text-slate-600 text-xs font-medium">{item.department_name || item.department || "الإدارة العامة"}</td>
                      <td className="p-4 text-slate-600 font-mono text-xs">{item.date || `${selectedYear}-${selectedMonth}`}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">
                          {item.type || "مكافأة إنتاج وخطوط تصنيع"}
                        </span>
                      </td>
                      <td className="p-4 text-indigo-600 font-bold">{Number(item.amount || 0 || 0).toLocaleString()} ج.م</td>
                      <td className="p-4 text-slate-600 text-xs">{item.notes || "مكافأة جودة وإنتاجية صالة الطعام والتجهيز"}</td>
                    </tr>
                  ))}
                  {filteredProductionBonuses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">لا توجد بيانات مكافآت إنتاج لهذه الفترة</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {renderPagination(filteredProductionBonuses.length)}
            </div>
          </div>
        )}

        {/* 5. PERFORMANCE APPRAISAL REPORT */}
        {hrSubTab === "evaluations" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">متوسط التقييم العام</p>
                  <p className="text-2xl font-bold text-indigo-600">{avgEvaluationScore}%</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Star className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">عدد التقييمات المسجلة</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredEvaluations.length} تقييم</p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">نسبة الحاصلين على ممتاز</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {filteredEvaluations.length
                      ? Math.round(
                          (filteredEvaluations.filter((ev: any) => (Number(ev.score) || 0) >= 90).length /
                            filteredEvaluations.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
              <div className="relative flex-1 min-w-[260px]">
                <MultiEmployeeSearchFilter
                  employees={employees}
                  selectedEmployeeIds={selectedEmpIds}
                  onSelectionChange={setSelectedEmpIds}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  placeholder="بحث متعدد بأسماء الموظفين أو المقيم..."
                />
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={hrEvaluationGradeFilter ?? ""}
                  onChange={(e) => setHrEvaluationGradeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">كل التقديرات</option>
                  <option value="ممتاز">ممتاز (90-100%)</option>
                  <option value="جيد جداً">جيد جداً (80-89%)</option>
                  <option value="جيد">جيد (70-79%)</option>
                  <option value="مقبول">مقبول (&lt;70%)</option>
                </select>
                <button
                  onClick={() => exportToExcel(exportEvaluationsData, "تقرير_تقييمات_الأداء_والإنتاجية")}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            {hrEvaluationsLoading ? (
              <div className="p-8 text-center text-slate-500">جاري تحميل تقارير تقييم الأداء...</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-right min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-bold text-slate-600">اسم الموظف</th>
                      <th className="p-4 font-bold text-slate-600">القسم</th>
                      <th className="p-4 font-bold text-slate-600">فترة التقييم</th>
                      <th className="p-4 font-bold text-slate-600">المقيم</th>
                      <th className="p-4 font-bold text-slate-600">الدرجة الكلية</th>
                      <th className="p-4 font-bold text-slate-600">التقدير العام</th>
                      <th className="p-4 font-bold text-slate-600">نقاط القوة</th>
                      <th className="p-4 font-bold text-slate-600">نقاط التحسين</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginate(filteredEvaluations).map((ev: any, idx: number) => {
                      const score = Number(ev.score) || 0;
                      const grade =
                        ev.grade ||
                        (score >= 90 ? "ممتاز" : score >= 80 ? "جيد جداً" : score >= 70 ? "جيد" : "مقبول");
                      return (
                        <tr key={ev.id || idx} className="hover:bg-slate-50">
                          <td className="p-4 text-slate-800 font-bold">{ev.employee_name || "موظف"}</td>
                          <td className="p-4 text-slate-600 text-xs font-medium">{ev.department_name || ev.department || "الإدارة العامة"}</td>
                          <td className="p-4 text-slate-600 font-mono text-xs">{ev.evaluation_period || "2026-07"}</td>
                          <td className="p-4 text-slate-600 text-xs">{ev.evaluator_name || "مدير الموارد البشرية"}</td>
                          <td className="p-4 font-bold text-indigo-600">{score}%</td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                grade === "ممتاز"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : grade === "جيد جداً"
                                  ? "bg-blue-100 text-blue-800"
                                  : grade === "جيد"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {grade}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 text-xs">{ev.strengths || "الالتزام بالجدول والسرعة"}</td>
                          <td className="p-4 text-slate-600 text-xs">{ev.improvement_points || "التواصل وتوثيق المستندات"}</td>
                        </tr>
                      );
                    })}
                    {filteredEvaluations.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">لا توجد تقييمات أداء مسجلة في هذه الفترة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {renderPagination(filteredEvaluations.length)}
              </div>
            )}
          </div>
        )}

        {/* 6. CLEARANCE ARCHIVES REPORT */}
        {hrSubTab === "clearance" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-slate-500 text-xs font-bold mb-2">
                  بحث باسم الموظف أو الكود
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو كود الموظف..."
                    value={clearanceSearch ?? ""}
                    onChange={(e) => setClearanceSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pr-10 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm text-right font-sans"
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-4" />
                </div>
              </div>

              <div className="w-full md:w-auto flex gap-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-slate-500 text-xs font-bold mb-2">من تاريخ</label>
                  <input
                    type="date"
                    value={clearanceFromDate ?? ""}
                    onChange={(e) => setClearanceFromDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-right font-sans"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-slate-500 text-xs font-bold mb-2">إلى تاريخ</label>
                  <input
                    type="date"
                    value={clearanceToDate ?? ""}
                    onChange={(e) => setClearanceToDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-right font-sans"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-[150px]">
                <label className="block text-slate-500 text-xs font-bold mb-2">فلترة بالقسم</label>
                <select
                  value={clearanceDeptId ?? ""}
                  onChange={(e) => setClearanceDeptId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm text-right cursor-pointer font-sans"
                >
                  <option value="all">كل الأقسام</option>
                  {departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id.toString()}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[150px]">
                <label className="block text-slate-500 text-xs font-bold mb-2">فلترة بالفرع</label>
                <select
                  value={clearanceBranchId ?? ""}
                  onChange={(e) => setClearanceBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm text-right cursor-pointer font-sans"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map((br: any) => (
                    <option key={br.id} value={br.id.toString()}>{br.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    exportToExcel(
                      exportClearanceData,
                      `تقرير_إخلاء_الطرف_${new Date().toISOString().split("T")[0]}`,
                    )
                  }
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-5 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors font-sans"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 text-slate-500 text-sm border-b border-slate-200">
                      <th className="p-4 font-bold">الإجراء</th>
                      <th className="p-4 font-bold">اسم الموظف</th>
                      <th className="p-4 font-bold">كود الموظف</th>
                      <th className="p-4 font-bold">التاريخ</th>
                      <th className="p-4 font-bold">القسم والفرع</th>
                      <th className="p-4 font-bold">السبب / التفاصيل</th>
                      <th className="p-4 font-bold">موقف العهدة والمالية</th>
                      <th className="p-4 font-bold">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {paginate(filteredClearance).map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/50 text-sm">
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                              rec.action === "reactivation"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {rec.action === "reactivation" ? "↻ إعادة تفعيل" : "إخلاء طرف"}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900">{rec.employee_name}</td>
                        <td className="p-4 font-mono font-bold text-indigo-600">{rec.employee_code}</td>
                        <td className="p-4 font-mono text-slate-500">{rec.date}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700">{rec.department_name || rec.department_id || "—"}</span>
                            <span className="text-slate-400 text-xs">{rec.branch_name || rec.branch_id || "—"}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                              rec.action === "reactivation"
                                ? "bg-emerald-100 text-emerald-800"
                                : rec.reason === "استقالة"
                                ? "bg-amber-100 text-amber-800"
                                : rec.reason === "فصل تأديبي"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {rec.reason || "—"}
                          </span>
                        </td>
                        <td className="p-4 space-y-1">
                          {rec.action === "reactivation" ? (
                            <span className="text-xs font-bold text-emerald-600">إعادة تفعيل للعمل</span>
                          ) : (
                            <>
                              <div className="flex gap-1.5 items-center">
                                <span className="text-xs text-slate-400">العهدة:</span>
                                <span className={`text-xs font-bold ${rec.handover_status?.includes("بالكامل") ? "text-emerald-600" : "text-amber-600"}`}>
                                  {rec.handover_status || "—"}
                                </span>
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <span className="text-xs text-slate-400">المالية:</span>
                                <span className={`text-xs font-bold ${rec.financial_status?.includes("بالكامل") ? "text-emerald-600" : "text-amber-600"}`}>
                                  {rec.financial_status || "—"}
                                </span>
                              </div>
                            </>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-600">{rec.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredClearance.length)}
            </div>
            {filteredClearance.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                لا توجد سجلات إخلاء طرف أو إعادة تفعيل مطابقة.
              </div>
            )}
          </div>
        )}

        {/* 7. GENERAL HR & ADMINISTRATIVE OVERVIEW */}
        {hrSubTab === "hr_general" && (
          <div className="space-y-6 animate-fadeIn" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">إجمالي القوة البشرية</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredEmployees.length} موظف</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">عدد الفروع العاملة</p>
                  <p className="text-2xl font-bold text-blue-600">{branches.length} فرع</p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">عدد الأقسام الإدارية</p>
                  <p className="text-2xl font-bold text-amber-600">{departments.length} قسم</p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Layers className="w-6 h-6" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">معدل الانضباط العام</p>
                  <p className="text-2xl font-bold text-emerald-600">96.8%</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">ملخص الشؤون الإدارية والهيكل الوظيفي</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportToExcel(exportData, "تقرير_الشؤون_الإدارية_والهيكل_الوظيفي")}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير Excel</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-sm mb-3">توزيع الموظفين حسب الأقسام</h4>
                  <div className="space-y-2">
                    {departments.map((dept: any) => {
                      const count = filteredEmployees.filter(
                        (e) => e.department_id?.toString() === dept.id.toString() || e.department_name === dept.name
                      ).length;
                      const pct = filteredEmployees.length ? Math.round((count / filteredEmployees.length) * 100) : 0;
                      return (
                        <div key={dept.id} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{dept.name}</span>
                            <span>{count} موظف ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-sm mb-3">توزيع الموظفين حسب الفروع</h4>
                  <div className="space-y-2">
                    {branches.map((br: any) => {
                      const count = filteredEmployees.filter(
                        (e) => e.branch_id?.toString() === br.id.toString() || e.branch_name === br.name
                      ).length;
                      const pct = filteredEmployees.length ? Math.round((count / filteredEmployees.length) * 100) : 0;
                      return (
                        <div key={br.id} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{br.name}</span>
                            <span>{count} موظف ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStockEntriesReport = () => {
    const filteredReport = stockEntriesReport.filter((item: any) => {
      const matchesType = selectedEntryType === "all" || item.entry_type === selectedEntryType;
      if (!matchesType) return false;

      const search = (searchQuery || "").toLowerCase();
      return (
        (item.ingredient_name || "").toLowerCase().includes(search) ||
        (item.from_warehouse_name || "").toLowerCase().includes(search) ||
        (item.to_warehouse_name || "").toLowerCase().includes(search) ||
        (item.entry_notes || "").toLowerCase().includes(search) ||
        `ste-${item.entry_id}`.toLowerCase().includes(search)
      );
    });

    const getEntryTypeLabel = (type: string) => {
      switch (type) {
        case "Material Receipt":
          return "استلام مواد";
        case "Material Issue":
          return "صرف مواد";
        case "Material Transfer":
          return "نقل مواد";
        case "Repack":
          return "إعادة حزم / تجميع";
        case "Manufacture":
          return "صناعة";
        default:
          return type;
      }
    };

    const getEntryTypeColor = (type: string) => {
      switch (type) {
        case "Material Receipt":
          return "text-emerald-600 bg-emerald-50 border border-emerald-100";
        case "Material Issue":
          return "text-rose-600 bg-rose-50 border border-rose-100";
        case "Material Transfer":
          return "text-blue-600 bg-blue-50 border border-blue-100";
        case "Repack":
          return "text-amber-600 bg-amber-50 border border-amber-100";
        case "Manufacture":
          return "text-indigo-600 bg-indigo-50 border border-indigo-100";
        default:
          return "text-slate-600 bg-slate-50 border border-slate-100";
      }
    };

    const exportStockEntriesToExcel = (data: any[]) => {
      const cleanData = data.map(item => ({
        "التاريخ": new Date(item.entry_date).toLocaleDateString("ar-EG"),
        "رقم القيد": `STE-${item.entry_id}`,
        "نوع القيد": getEntryTypeLabel(item.entry_type),
        "من مستودع": item.from_warehouse_name || "-",
        "إلى مستودع": item.to_warehouse_name || "-",
        "المادة / الصنف": item.ingredient_name || "-",
        "الكمية": `${item.quantity || 0} ${item.ingredient_unit || ""}`,
        "سعر الوحدة": `${Number(item.unit_price || 0 || 0).toLocaleString()} ج.م`,
        "الإجمالي": `${Number(item.item_total || 0 || 0).toLocaleString()} ج.م`,
        "الملاحظات": item.entry_notes || "-"
      }));
      exportToExcel(cleanData, "تقرير_قيود_المخزن");
    };

    // Calculate Summary Metrics
    const totalEntriesCount = Array.from(new Set(filteredReport.map((i: any) => i.entry_id))).length;
    const totalValue = filteredReport.reduce((acc: number, item: any) => acc + (Number(item.item_total) || 0), 0);

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-slate-500 font-bold mb-1 text-sm">إجمالي عدد القيود</h3>
              <p className="text-3xl font-extrabold text-slate-800">{totalEntriesCount}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600">
              <Clock className="w-8 h-8" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-slate-500 font-bold mb-1 text-sm">إجمالي قيمة قيود المخزون</h3>
              <p className="text-3xl font-extrabold text-emerald-600">
                {Number(totalValue || 0).toLocaleString()} ج.م
              </p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">من:</label>
              <input
                type="date"
                value={startDate ?? ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm font-semibold text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">إلى:</label>
              <input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm font-semibold text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">المخزن:</label>
              <select
                value={selectedWarehouse ?? ""}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">كل المخازن</option>
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">نوع القيد:</label>
              <select
                value={selectedEntryType ?? ""}
                onChange={(e) => setSelectedEntryType(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 text-sm font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">كل الأنواع</option>
                <option value="Material Receipt">استلام مواد</option>
                <option value="Material Issue">صرف مواد</option>
                <option value="Material Transfer">نقل مواد</option>
                <option value="Repack">إعادة حزم / تجميع</option>
                <option value="Manufacture">صناعة</option>
              </select>
            </div>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في القيود والتفاصيل..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 focus:outline-none focus:border-indigo-500 text-sm font-semibold text-slate-700"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportStockEntriesToExcel(filteredReport)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-bold text-xs"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => {
                exportToWord(filteredReport, "تقرير_قيود_المخزن");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-bold text-xs"
            >
              <FileText className="w-4 h-4" />
              <span>Word</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-bold text-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / PDF</span>
            </button>
          </div>
        </div>

        {stockEntriesLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-4 bg-slate-200 rounded w-24 animate-pulse"></div>
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 flex gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="h-4 bg-slate-100 rounded w-24"></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">التاريخ</th>
                    <th className="p-4 font-bold text-slate-600">رقم القيد</th>
                    <th className="p-4 font-bold text-slate-600">نوع القيد</th>
                    <th className="p-4 font-bold text-slate-600">من مستودع</th>
                    <th className="p-4 font-bold text-slate-600">إلى مستودع</th>
                    <th className="p-4 font-bold text-slate-600">المادة / الصنف</th>
                    <th className="p-4 font-bold text-slate-600">الكمية</th>
                    <th className="p-4 font-bold text-slate-600">سعر الوحدة</th>
                    <th className="p-4 font-bold text-slate-600">الإجمالي</th>
                    <th className="p-4 font-bold text-slate-600">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredReport).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600">
                        {new Date(item.entry_date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700">
                        STE-{item.entry_id.toString().padStart(4, "0")}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${getEntryTypeColor(item.entry_type)}`}>
                          {getEntryTypeLabel(item.entry_type)}
                        </span>
                      </td>
                      <td className="p-4 text-slate-700 font-semibold">{item.from_warehouse_name || "-"}</td>
                      <td className="p-4 text-slate-700 font-semibold">{item.to_warehouse_name || "-"}</td>
                      <td className="p-4 text-slate-800 font-bold">{item.ingredient_name || "-"}</td>
                      <td className="p-4 text-slate-700 font-semibold">
                        {item.quantity || 0} {item.ingredient_unit || ""}
                      </td>
                      <td className="p-4 text-slate-600 font-semibold">
                        {Number(item.unit_price || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-4 text-emerald-600 font-extrabold">
                        {Number(item.item_total || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-4 text-slate-500 text-xs max-w-xs truncate">
                        {item.entry_notes || "-"}
                      </td>
                    </tr>
                  ))}
                  {filteredReport.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                        لا توجد قيود مطابقة للخيارات المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredReport.length)}
          </div>
        )}
      </div>
    );
  };

  const renderGeneralAccountsReport = () => {
    const transactions = generalLedgerReport.transactions || [];
    const summary = generalLedgerReport.summary || {
      total_debit: 0,
      total_credit: 0,
      net_balance: 0,
    };

    const filteredTransactions = transactions.filter(
      (t: any) =>
        (t.description || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (t.account_name || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (t.reference || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()),
    );

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-bold mb-2">إجمالي المدين</h3>
            <p className="text-2xl font-bold text-emerald-600">
              {Number(summary.total_debit || 0 || 0).toLocaleString()} ج.م
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-bold mb-2">إجمالي الدائن</h3>
            <p className="text-2xl font-bold text-rose-600">
              {Number(summary.total_credit || 0 || 0).toLocaleString()} ج.م
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-bold mb-2">صافي الرصيد</h3>
            <p
              className={`text-2xl font-bold ${summary.net_balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {Number(summary.net_balance || 0 || 0).toLocaleString()} ج.م
            </p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">من:</label>
              <input
                type="date"
                value={startDate ?? ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">إلى:</label>
              <input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                الحساب:
              </label>
              <select
                value={selectedAccount ?? ""}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 max-w-[200px]"
              >
                <option value="all">كل الحسابات</option>
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                مركز التكلفة:
              </label>
              <select
                value={selectedCostCenter ?? ""}
                onChange={(e) => setSelectedCostCenter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 max-w-[200px]"
              >
                <option value="all">كل المراكز</option>
                {costCenters.map((cc: any) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في القيود..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportToExcel(filteredTransactions, "تقرير_الحسابات_العامة")
              }
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {generalLedgerLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-4 bg-slate-200 rounded w-24 animate-pulse"
                ></div>
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 flex gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div
                      key={j}
                      className="h-4 bg-slate-100 rounded w-24"
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">التاريخ</th>
                    <th className="p-4 font-bold text-slate-600">رقم القيد</th>
                    <th className="p-4 font-bold text-slate-600">البيان</th>
                    <th className="p-4 font-bold text-slate-600">الحساب</th>
                    <th className="p-4 font-bold text-slate-600 text-center">
                      مدين
                    </th>
                    <th className="p-4 font-bold text-slate-600 text-center">
                      دائن
                    </th>
                    <th className="p-4 font-bold text-slate-600">مركز التكلفة</th>
                    <th className="p-4 font-bold text-slate-600">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredTransactions).map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600">
                        {new Date(t.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-4 text-slate-600 font-mono">
                        #{t.entry_id}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">
                          {t.description}
                        </p>
                        {t.reference && (
                          <p className="text-xs text-slate-400">{t.reference}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">
                          {t.account_name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {t.account_code}
                        </p>
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-600">
                        {(t.debit || 0) > 0
                          ? Number(t.debit || 0 || 0).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-4 text-center font-bold text-rose-600">
                        {(t.credit || 0) > 0
                          ? Number(t.credit || 0 || 0).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-4 text-slate-600">
                        {t.cost_center_name || "-"}
                      </td>
                      <td className="p-4 text-slate-500 text-sm">
                        {t.notes || "-"}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        لا توجد حركات في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredTransactions.length)}
          </div>
        )}
      </div>
    );
  };

  const renderWarehouseTransactionsReport = () => {
    const transactions = transactionsReport.transactions || [];
    const summary = transactionsReport.summary || {
      total_in: 0,
      total_out: 0,
      net_value: 0,
    };

    const filteredTransactions = transactions.filter(
      (t: any) =>
        (t.ingredient_name || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (t.warehouse_name || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (t.notes || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()),
    );

    const getTypeLabel = (type: string) => {
      switch (type) {
        case "in":
          return "إضافة";
        case "out":
          return "صرف";
        case "transfer_in":
          return "تحويل وارد";
        case "transfer_out":
          return "تحويل صادر";
        case "purchase":
          return "شراء";
        case "adjustment":
          return "تسوية";
        default:
          return type;
      }
    };

    const getTypeColor = (type: string) => {
      switch (type) {
        case "in":
        case "transfer_in":
        case "purchase":
          return "text-emerald-600 bg-emerald-50";
        case "out":
        case "transfer_out":
          return "text-rose-600 bg-rose-50";
        case "adjustment":
          return "text-blue-600 bg-blue-50";
        default:
          return "text-slate-600 bg-slate-50";
      }
    };

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-bold mb-2">
              إجمالي الوارد (قيمة)
            </h3>
            <p className="text-2xl font-bold text-emerald-600">
              {Number(summary.total_in || 0 || 0).toLocaleString()} ج.م
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-bold mb-2">
              إجمالي الصادر (قيمة)
            </h3>
            <p className="text-2xl font-bold text-rose-600">
              {Number(summary.total_out || 0 || 0).toLocaleString()} ج.م
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-bold mb-2">صافي الحركة</h3>
            <p
              className={`text-2xl font-bold ${summary.net_value >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {Number(summary.net_value || 0 || 0).toLocaleString()} ج.م
            </p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">من:</label>
              <input
                type="date"
                value={startDate ?? ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">إلى:</label>
              <input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                المخزن:
              </label>
              <select
                value={selectedWarehouse ?? ""}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">كل المخازن</option>
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في الحركات..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportToExcel(filteredTransactions, "تقرير_حركات_المخازن")
              }
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {transactionsLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-4 bg-slate-200 rounded w-24 animate-pulse"
                ></div>
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 flex gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div
                      key={j}
                      className="h-4 bg-slate-100 rounded w-24"
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">التاريخ</th>
                    <th className="p-4 font-bold text-slate-600">نوع الحركة</th>
                    <th className="p-4 font-bold text-slate-600">المخزن</th>
                    <th className="p-4 font-bold text-slate-600">الصنف</th>
                    <th className="p-4 font-bold text-slate-600">الكمية</th>
                    <th className="p-4 font-bold text-slate-600">
                      التكلفة (الوحدة)
                    </th>
                    <th className="p-4 font-bold text-slate-600">
                      إجمالي القيمة
                    </th>
                    <th className="p-4 font-bold text-slate-600">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredTransactions).map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600">
                        {new Date(t.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-bold ${getTypeColor(t.type)}`}
                        >
                          {getTypeLabel(t.type)}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{t.warehouse_name}</td>
                      <td className="p-4 text-slate-800 font-bold">
                        {t.ingredient_name}
                      </td>
                      <td className="p-4 text-slate-600 dir-ltr text-right">
                        {t.quantity} {t.unit}
                      </td>
                      <td className="p-4 text-slate-600">{t.cost} ج.م</td>
                      <td
                        className={`p-4 font-bold ${t.total_value >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {Number(Math.abs(t.total_value || 0)).toLocaleString()} ج.م
                      </td>
                      <td className="p-4 text-slate-500 text-sm">
                        {t.notes || "-"}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        لا توجد حركات في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredTransactions.length)}
          </div>
        )}
      </div>
    );
  };

  const renderSalariesReport = () => {
    const filteredSalaries = salaries.filter((sal) =>
      matchesMultiEmpFilter(sal.name, undefined, sal.employee_id || sal.id, [sal.branch_name, sal.department_name, sal.department])
    );

    // Aggregate totals for KPI summary cards
    const totalEmployeesCount = filteredSalaries.length;
    const totalBasicSalary = filteredSalaries.reduce((acc, sal) => acc + (Number(sal.basic) || 0), 0);
    const totalAllowancesAndBonuses = filteredSalaries.reduce(
      (acc, sal) =>
        acc +
        (Number(sal.meal) || 0) +
        (Number(sal.housing) || 0) +
        (Number(sal.delivery) || 0) +
        (Number(sal.bonus) || 0) +
        (Number(sal.vacation) || 0),
      0,
    );
    const totalGrossPayroll = totalBasicSalary + totalAllowancesAndBonuses;
    const totalDeductionsAndLoans = filteredSalaries.reduce(
      (acc, sal) =>
        acc +
        (Number(sal.advanceInst) || 0) +
        (Number(sal.advanceDirect) || 0) +
        (Number(sal.hr) || 0) +
        (Number(sal.penalty) || 0) +
        (Number(sal.absence) || 0) +
        (Number(sal.shortage) || 0) +
        (Number(sal.fellowship) || 0) +
        (Number(sal.cl) || 0) +
        (Number(sal.insurance) || 0),
      0,
    );
    const totalNetPayroll = filteredSalaries.reduce((acc, sal) => acc + (Number(sal.net) || 0), 0);

    const exportData = filteredSalaries.map((sal) => ({
      الاسم: sal.name,
      القسم: sal.department_name || sal.department || "الإدارة العامة",
      الفرع: sal.branch_name || "-",
      "الراتب الأساسي": sal.basic,
      "أيام الحضور": sal.days,
      "بدل الوجبة": sal.meal,
      "بدل السكن والمواصفات": sal.housing,
      "بدل خطوط ودليفري": sal.delivery,
      "المكافآت والحوافز": sal.bonus,
      "بدل الإجازات": sal.vacation,
      "إجمالي المستحقات":
        (Number(sal.basic) || 0) +
        (Number(sal.meal) || 0) +
        (Number(sal.housing) || 0) +
        (Number(sal.delivery) || 0) +
        (Number(sal.bonus) || 0) +
        (Number(sal.vacation) || 0),
      "سلف أقساط ومباشرة": (Number(sal.advanceInst) || 0) + (Number(sal.advanceDirect) || 0),
      "جزاءات وتأخيرات": (Number(sal.hr) || 0) + (Number(sal.penalty) || 0),
      "خصم الغياب": sal.absence,
      "خصم العجز والنقدية": sal.shortage,
      "صندوق الزمالة": sal.fellowship,
      "التأمينات والضرائب": sal.insurance,
      "إجمالي الاستقطاعات":
        (Number(sal.advanceInst) || 0) +
        (Number(sal.advanceDirect) || 0) +
        (Number(sal.hr) || 0) +
        (Number(sal.penalty) || 0) +
        (Number(sal.absence) || 0) +
        (Number(sal.shortage) || 0) +
        (Number(sal.fellowship) || 0) +
        (Number(sal.cl) || 0) +
        (Number(sal.insurance) || 0),
      "الصافي المستحق الصرف": sal.net,
    }));

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-5 bg-slate-50/50" dir="rtl">
        {/* Top Title Banner */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              <span>تقرير مسيرات وتفاصيل وحدات الرواتب الشاملة</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              عرض البيانات المالية الكاملة لكافة الموظفين بالنظام، تفاصيل الاستقطاعات، الخصومات، التأمينات وإصدار مفردات المرتب المعتمدة.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                exportToExcel(
                  exportData,
                  `تقرير_المرتبات_الشامل_${selectedYear}_${selectedMonth}`,
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl transition-all text-xs font-bold shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-xl transition-all text-xs font-bold shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الشيت</span>
            </button>
          </div>
        </div>

        {/* KPI Summaries Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
            <p className="text-xs text-slate-500 font-bold mb-1.5">عدد الموظفين بالنظام</p>
            <p className="text-2xl font-black text-slate-800">
              {totalEmployeesCount} <span className="text-xs font-bold text-slate-400">موظف</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
            <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي الأجور والاستحقاقات</p>
            <p className="text-2xl font-black text-emerald-600">
              {Number(totalGrossPayroll || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
            <p className="text-xs text-slate-500 font-bold mb-1.5">إجمالي الخصومات والاستقطاعات</p>
            <p className="text-2xl font-black text-rose-600">
              {Number(totalDeductionsAndLoans || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
            <p className="text-xs text-slate-500 font-bold mb-1.5">صافي الرواتب المستحقة الصرف</p>
            <p className="text-2xl font-black text-indigo-600">
              {Number(totalNetPayroll || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">الشهر:</label>
              <select
                value={selectedMonth ?? ""}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    شهر {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">السنة:</label>
              <select
                value={selectedYear ?? ""}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                  <option key={y} value={y}>
                    سنة {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">الفرع:</label>
              <select
                value={selectedBranch ?? ""}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              >
                <option value="all">كل الفروع</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-[380px] md:w-[480px]">
              <MultiEmployeeSearchFilter
                employees={employees}
                selectedEmployeeIds={selectedEmpIds}
                onSelectionChange={setSelectedEmpIds}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                placeholder="بحث متعدد بأسماء الموظفين أو الفروع..."
              />
            </div>
          </div>
        </div>

        {salariesLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-4 bg-slate-200 rounded w-24 animate-pulse"></div>
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 flex gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="h-4 bg-slate-100 rounded w-24"></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80">
                  <tr>
                    <th className="p-3.5 font-bold text-slate-700">اسم الموظف</th>
                    <th className="p-3.5 font-bold text-slate-700">القسم</th>
                    <th className="p-3.5 font-bold text-slate-700">الفرع</th>
                    <th className="p-3.5 font-bold text-slate-700">الأساسي</th>
                    <th className="p-3.5 font-bold text-slate-700">أيام العمل</th>
                    <th className="p-3.5 font-bold text-emerald-600">البدلات والمكافآت</th>
                    <th className="p-3.5 font-bold text-rose-600">السلف والمستقطعات</th>
                    <th className="p-3.5 font-bold text-rose-600">الجزاءات والخصومات</th>
                    <th className="p-3.5 font-bold text-slate-700">التأمينات والضرائب</th>
                    <th className="p-3.5 font-bold text-indigo-700">صافي المستحق</th>
                    <th className="p-3.5 font-bold text-center text-slate-700 no-print">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paginate(filteredSalaries).map((sal: any, idx: number) => {
                    const grossAdditions =
                      (Number(sal.meal) || 0) +
                      (Number(sal.housing) || 0) +
                      (Number(sal.delivery) || 0) +
                      (Number(sal.bonus) || 0) +
                      (Number(sal.vacation) || 0);
                    const totalAdvances = (Number(sal.advanceInst) || 0) + (Number(sal.advanceDirect) || 0);
                    const totalPenaltiesAndAbsence =
                      (Number(sal.hr) || 0) +
                      (Number(sal.penalty) || 0) +
                      (Number(sal.absence) || 0) +
                      (Number(sal.shortage) || 0) +
                      (Number(sal.fellowship) || 0) +
                      (Number(sal.cl) || 0);

                    return (
                      <tr key={sal.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 text-slate-900 font-bold whitespace-nowrap">{sal.name}</td>
                        <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">
                          {sal.department_name || sal.department || "الإدارة العامة"}
                        </td>
                        <td className="p-3.5 text-slate-600 whitespace-nowrap">{sal.branch_name || "-"}</td>
                        <td className="p-3.5 font-bold text-slate-800">{Number(sal.basic || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-slate-600 font-bold">{sal.days || 30} يوم</td>
                        <td className="p-3.5 text-emerald-600 font-bold">
                          +{Number(grossAdditions || 0).toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 text-rose-600 font-bold">
                          -{Number(totalAdvances || 0).toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 text-rose-600 font-bold">
                          -{Number(totalPenaltiesAndAbsence || 0).toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 text-slate-600">{Number(sal.insurance || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-indigo-700 font-black text-sm whitespace-nowrap">
                          {Number(sal.net || 0 || 0).toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap no-print">
                          <button
                            onClick={() => setSelectedPayslipEmployee(sal)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200/80 transition-all shadow-2xs"
                            title="إصدار شيت مفردات المرتب التفصيلي للموظف"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>مفردات مرتب</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSalaries.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500 font-medium">
                        لا توجد بيانات مرتبات معتمدة لهذا الشهر بالنظام
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredSalaries.length)}
          </div>
        )}

        {/* Individual Employee Payslip Modal */}
        {selectedPayslipEmployee && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 md:p-8 space-y-6 printable-report border border-slate-200 my-8">
              {/* Modal Control Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-slate-800 text-base">
                    تقرير مفردات مرتب تفصيلي للموظف
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة قسيمة الراتب</span>
                  </button>
                  <button
                    onClick={() => setSelectedPayslipEmployee(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Official Payslip Header */}
              <div className="text-center space-y-2 border-b-2 border-slate-900 pb-5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>الجمهورية المصرية</span>
                  <span className="text-sm font-black text-slate-900">إدارة الموارد البشرية والحسابات</span>
                  <span>التاريخ: {new Date().toLocaleDateString("ar-EG")}</span>
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  بيان مفردات مرتب ورصيد مستحقات موظف (Pay Slip)
                </h1>
                <p className="text-xs font-bold text-indigo-700">
                  عن شهر {selectedMonth} لسنة {selectedYear}
                </p>
              </div>

              {/* Employee Information Box */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">اسم الموظف:</span>
                  <span className="text-slate-900 font-black text-sm">{selectedPayslipEmployee.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">الإدارة / القسم:</span>
                  <span className="text-slate-800 font-bold">
                    {selectedPayslipEmployee.department_name || selectedPayslipEmployee.department || "الإدارة العامة"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">الفرع / الموقع:</span>
                  <span className="text-slate-800 font-bold">{selectedPayslipEmployee.branch_name || "الفرع الرئيسي"}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">أيام الحضور والعمل:</span>
                  <span className="text-emerald-700 font-black">{selectedPayslipEmployee.days || 30} يوم معتمد</span>
                </div>
              </div>

              {/* Detailed Earnings vs Deductions Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Earnings Column */}
                <div className="border border-emerald-200 rounded-2xl overflow-hidden bg-emerald-50/20">
                  <div className="bg-emerald-600 text-white p-3 font-black text-center text-xs">
                    البنود الدائنة والاستحقاقات (+)
                  </div>
                  <div className="p-4 space-y-2.5">
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5">
                      <span className="text-slate-700 font-medium">الراتب الأساسي:</span>
                      <span className="font-bold text-slate-900">{Number(selectedPayslipEmployee.basic || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5">
                      <span className="text-slate-700 font-medium">بدل الوجبة:</span>
                      <span className="font-bold text-slate-900">{Number(selectedPayslipEmployee.meal || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5">
                      <span className="text-slate-700 font-medium">بدل سكن ومواصفات:</span>
                      <span className="font-bold text-slate-900">{Number(selectedPayslipEmployee.housing || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5">
                      <span className="text-slate-700 font-medium">بدل خطوط ودليفري:</span>
                      <span className="font-bold text-slate-900">{Number(selectedPayslipEmployee.delivery || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5">
                      <span className="text-slate-700 font-medium">المكافآت والحوافز التشجيعية:</span>
                      <span className="font-bold text-slate-900">{Number(selectedPayslipEmployee.bonus || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5">
                      <span className="text-slate-700 font-medium">بدل الإجازات والتعويضات:</span>
                      <span className="font-bold text-slate-900">{Number(selectedPayslipEmployee.vacation || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-black text-emerald-800 text-sm border-t border-emerald-300">
                      <span>إجمالي الاستحقاقات:</span>
                      <span>
                        {(
                          (Number(selectedPayslipEmployee.basic) || 0) +
                          (Number(selectedPayslipEmployee.meal) || 0) +
                          (Number(selectedPayslipEmployee.housing) || 0) +
                          (Number(selectedPayslipEmployee.delivery) || 0) +
                          (Number(selectedPayslipEmployee.bonus) || 0) +
                          (Number(selectedPayslipEmployee.vacation) || 0)
                        ).toLocaleString()}{" "}
                        ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="border border-rose-200 rounded-2xl overflow-hidden bg-rose-50/20">
                  <div className="bg-rose-600 text-white p-3 font-black text-center text-xs">
                    البنود المدينة والاستقطاعات (-)
                  </div>
                  <div className="p-4 space-y-2.5">
                    <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                      <span className="text-slate-700 font-medium">خصم السلف (أقساط ومباشرة):</span>
                      <span className="font-bold text-rose-700">
                        {(
                          (Number(selectedPayslipEmployee.advanceInst) || 0) +
                          (Number(selectedPayslipEmployee.advanceDirect) || 0)
                        ).toLocaleString()}{" "}
                        ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                      <span className="text-slate-700 font-medium">جزاءات وتأخيرات HR:</span>
                      <span className="font-bold text-rose-700">
                        {(
                          (Number(selectedPayslipEmployee.hr) || 0) +
                          (Number(selectedPayslipEmployee.penalty) || 0)
                        ).toLocaleString()}{" "}
                        ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                      <span className="text-slate-700 font-medium">خصم غياب بدون إذن:</span>
                      <span className="font-bold text-rose-700">{Number(selectedPayslipEmployee.absence || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                      <span className="text-slate-700 font-medium">خصم عجز النقدية:</span>
                      <span className="font-bold text-rose-700">{Number(selectedPayslipEmployee.shortage || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                      <span className="text-slate-700 font-medium">اشتراك صندوق الزمالة:</span>
                      <span className="font-bold text-rose-700">{Number(selectedPayslipEmployee.fellowship || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                      <span className="text-slate-700 font-medium">التأمينات الاجتماعية والضرائب:</span>
                      <span className="font-bold text-rose-700">{Number(selectedPayslipEmployee.insurance || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-black text-rose-800 text-sm border-t border-rose-300">
                      <span>إجمالي الاستقطاعات:</span>
                      <span>
                        {(
                          (Number(selectedPayslipEmployee.advanceInst) || 0) +
                          (Number(selectedPayslipEmployee.advanceDirect) || 0) +
                          (Number(selectedPayslipEmployee.hr) || 0) +
                          (Number(selectedPayslipEmployee.penalty) || 0) +
                          (Number(selectedPayslipEmployee.absence) || 0) +
                          (Number(selectedPayslipEmployee.shortage) || 0) +
                          (Number(selectedPayslipEmployee.fellowship) || 0) +
                          (Number(selectedPayslipEmployee.cl) || 0) +
                          (Number(selectedPayslipEmployee.insurance) || 0)
                        ).toLocaleString()}{" "}
                        ج.م
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Net Payable Box */}
              <div className="bg-indigo-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div>
                  <span className="text-indigo-200 text-xs font-bold block mb-1">الصافي المستحق الصرف نهائياً للموظف:</span>
                  <span className="text-xs text-indigo-300">مبلغ محول بالحساب البنكي / النقدي المعتمد</span>
                </div>
                <div className="text-3xl font-black text-amber-300 dir-ltr text-right">
                  {Number(selectedPayslipEmployee.net || 0 || 0).toLocaleString()} <span className="text-sm text-white">ج.م</span>
                </div>
              </div>

              {/* Official Signature Boxes */}
              <div className="pt-6 border-t border-slate-300 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs font-bold text-slate-600">
                <div className="space-y-8 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p>إعداد شؤون العاملين</p>
                  <p className="border-t border-slate-300 pt-2 text-slate-400">التوقيع: ....................</p>
                </div>
                <div className="space-y-8 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p>المراجع والمدقق المالي</p>
                  <p className="border-t border-slate-300 pt-2 text-slate-400">التوقيع: ....................</p>
                </div>
                <div className="space-y-8 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p>اعتماد إدارة الشركة</p>
                  <p className="border-t border-slate-300 pt-2 text-slate-400">التوقيع: ....................</p>
                </div>
                <div className="space-y-8 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p>توقيع الموظف بالاستلام</p>
                  <p className="border-t border-slate-300 pt-2 text-slate-400">التوقيع: ....................</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMainWarehouseReport = () => {
    const data = Array.isArray(warehouseData) ? warehouseData : [];
    
    // Filter logic
    const filteredData = data.filter((item) => {
      // Warehouse filter
      if (selectedInventoryWarehouse !== "all" && item.warehouse_id !== Number(selectedInventoryWarehouse)) {
        return false;
      }
      // Section filter
      if (selectedInventorySection !== "all") {
        if (selectedInventorySection === "none") {
          if (item.section_id) return false;
        } else if (item.section_id !== Number(selectedInventorySection)) {
          return false;
        }
      }
      // Search query filter (search for single item/ingredient)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = (item.ingredient_name || "").toLowerCase().includes(query);
        const matchesCategory = (item.category || "").toLowerCase().includes(query);
        const matchesCode = (item.item_code || "").toLowerCase().includes(query);
        const matchesGroup = (item.item_group || "").toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesCode && !matchesGroup) {
          return false;
        }
      }
      return true;
    });

    // Statistical summary calculations
    const totalItemsCount = filteredData.length;
    const totalQuantity = filteredData.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    const totalValue = filteredData.reduce((acc, item) => acc + (Number(item.quantity || 0) * (Number(item.cost) || 0)), 0);
    const reorderCount = filteredData.filter(item => Number(item.quantity || 0) <= Number(item.min_quantity || 0)).length;

    // Export Excel
    const handleExportExcel = () => {
      const excelRows = filteredData.map(item => ({
        "كود الصنف": item.item_code || "-",
        "اسم الصنف": item.ingredient_name,
        "التصنيف": item.category || "-",
        "المستودع": item.warehouse_name || "-",
        "القسم الفرعي": item.section_name || "عام / غير مصنف",
        "الكمية المتاحة": Number(item.quantity || 0),
        "الوحدة": item.unit || "-",
        "سعر التكلفة (ج.م)": Number(item.cost || 0),
        "إجمالي القيمة (ج.م)": Number(item.quantity || 0) * Number(item.cost || 0),
        "الحد الأدنى": Number(item.min_quantity || 0),
        "الحالة": Number(item.quantity || 0) <= Number(item.min_quantity || 0) ? "يحتاج إعادة طلب" : "متوفر"
      }));
      exportToExcel(excelRows, "تقرير_جرد_المخازن_التفصيلي");
    };

    // Export Word
    const handleExportWord = () => {
      const headers = ["كود الصنف", "اسم الصنف", "التصنيف", "المستودع", "القسم الفرعي", "الكمية المتاحة", "التكلفة", "إجمالي القيمة", "الحالة"];
      const rows = filteredData.map(item => [
        item.item_code || "-",
        item.ingredient_name,
        item.category || "-",
        item.warehouse_name || "-",
        item.section_name || "عام / غير مصنف",
        `${Number(item.quantity || 0)} ${item.unit || ""}`,
        `${Number(item.cost || 0 || 0).toLocaleString()} ج.م`,
        `${(Number(item.quantity || 0) * Number(item.cost || 0)).toLocaleString()} ج.م`,
        Number(item.quantity || 0) <= Number(item.min_quantity || 0) ? "يحتاج إعادة طلب" : "متوفر"
      ]);
      downloadDataAsWord(headers, rows, "تقرير_جرد_المخازن_التفصيلي", "تقرير جرد المخازن التفصيلي");
    };

    // Export PDF using html2pdf
    const handleExportPDF = async () => {
      const headers = [
        "كود الصنف", "اسم الصنف", "التصنيف", "المستودع", "القسم", "الكمية", "الوحدة", "التكلفة", "الإجمالي", "الحالة"
      ];

      const rows = filteredData.map((item) => [
        item.item_code || "-",
        item.ingredient_name,
        item.category || "-",
        item.warehouse_name || "-",
        item.section_name || "عام",
        Number(item.quantity || 0).toString(),
        item.unit || "-",
        `${Number(item.cost || 0 || 0).toLocaleString()} ج.م`,
        `${(Number(item.quantity || 0) * Number(item.cost || 0)).toLocaleString()} ج.م`,
        Number(item.quantity || 0) <= Number(item.min_quantity || 0) ? "تحت حد الطلب" : "متوفر"
      ]);

      await downloadDataAsPdf(headers, rows, "تقرير_جرد_المخازن_التفصيلي", "تقرير جرد المخازن والتكلفة");
    };

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Dynamic Controls / Filters */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500">🏢 المستودع المستهدف:</span>
                <select
                  value={selectedInventoryWarehouse ?? ""}
                  onChange={(e) => {
                    setSelectedInventoryWarehouse(e.target.value);
                    setSelectedInventorySection("all");
                  }}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm min-w-[200px]"
                >
                  <option value="all">🌐 جميع المستودعات بالفروع</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      🏢 {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInventoryWarehouse !== "all" && (
                <div className="flex items-center gap-2 animate-fadeIn">
                  <span className="text-sm font-bold text-slate-500">🏷️ القسم الفرعي:</span>
                  <select
                    value={selectedInventorySection ?? ""}
                    onChange={(e) => setSelectedInventorySection(e.target.value)}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm min-w-[180px]"
                  >
                    <option value="all">📦 الكل ({data.filter(item => item.warehouse_id === Number(selectedInventoryWarehouse)).length} صنف)</option>
                    <option value="none">❓ غير مصنف ({data.filter(item => item.warehouse_id === Number(selectedInventoryWarehouse) && !item.section_id).length} صنف)</option>
                    {reportSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        🏷️ {sec.name} ({data.filter(item => item.warehouse_id === Number(selectedInventoryWarehouse) && item.section_id === sec.id).length} صنف)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="البحث بالاسم، الكود، أو فئة الصنف..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-10 pl-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-semibold">
              تم العثور على <strong className="text-indigo-600 font-bold">{totalItemsCount}</strong> أصناف مطابقة للبحث
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer border-none"
              >
                <Download className="w-3.5 h-3.5" />
                تحميل Excel 📊
              </button>
              <button
                onClick={handleExportWord}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer border-none"
              >
                <FileText className="w-3.5 h-3.5" />
                تحميل Word 📝
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer border-none"
              >
                <Download className="w-3.5 h-3.5" />
                تحميل PDF 📄
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer border-none"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة 🖨️
              </button>
            </div>
          </div>
        </div>

        {/* Statistical Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">عدد الأصناف المجرودة</span>
              <span className="text-2xl font-black text-slate-800">{totalItemsCount} صنف</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">إجمالي كمية المخزون</span>
              <span className="text-2xl font-black text-slate-800">{totalQuantity.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">رأس المال المخزني (تقديري)</span>
              <span className="text-2xl font-black text-indigo-600">{Number(totalValue || 0).toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/70 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">أصناف تحت حد الطلب</span>
              <span className="text-2xl font-black text-rose-600">{reorderCount} صنف</span>
            </div>
          </div>
        </div>

        {warehouseLoading ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-4 bg-slate-200 rounded w-24 animate-pulse"></div>
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 flex gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="h-4 bg-slate-100 rounded w-24"></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-4">كود الصنف</th>
                    <th className="p-4">اسم الصنف</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">المستودع</th>
                    <th className="p-4">القسم الفرعي</th>
                    <th className="p-4 text-center">الكمية المتاحة</th>
                    <th className="p-4">التكلفة (ج.م)</th>
                    <th className="p-4">القيمة الإجمالية</th>
                    <th className="p-4">الحد الأدنى</th>
                    <th className="p-4 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginate(filteredData).map((item, idx) => {
                    const totalVal = Number(item.quantity || 0) * Number(item.cost || 0);
                    const isLow = Number(item.quantity || 0) <= Number(item.min_quantity || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-semibold text-slate-500">
                          {item.item_code || "-"}
                        </td>
                        <td className="p-4 font-bold text-slate-800">
                          {item.ingredient_name}
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {item.category || "-"}
                        </td>
                        <td className="p-4 font-semibold text-slate-600">
                          🏢 {item.warehouse_name || "-"}
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200/50">
                            🏷️ {item.section_name || "عام / غير مصنف"}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-base font-bold text-indigo-600">
                          {item.quantity} <span className="text-xs text-slate-400 font-normal mr-0.5">{item.unit || ""}</span>
                        </td>
                        <td className="p-4 font-mono font-semibold text-slate-600">
                          {Number(item.cost || 0 || 0).toLocaleString()} ج.م
                        </td>
                        <td className="p-4 font-mono font-bold text-indigo-600">
                          {Number(totalVal || 0).toLocaleString()} ج.م
                        </td>
                        <td className="p-4 font-mono text-slate-400">
                          {item.min_quantity} {item.unit}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-bold inline-block border ${
                              !isLow
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {!isLow ? "✅ متوفر بكثرة" : "⚠️ يحتاج طلب"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400 font-semibold">
                        لا توجد نتائج مطابقة لخيارات التصفية والبحث الحالية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredData.length)}
          </div>
        )}
      </div>
    );
  };

  const [safeReportType, setSafeReportType] = useState<
    "transactions" | "closings"
  >("transactions");

  const renderSafeReports = () => {
    const transactions = safeReports.transactions || [];
    const closings = safeReports.closings || [];

    const filteredTransactions = transactions.filter(
      (t: any) =>
        (t["البيان"] || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (t["الخزينة"] || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()),
    );

    const filteredClosings = closings.filter((c: any) =>
      (c["الخزينة"] || "")
        .toLowerCase()
        .includes((searchQuery || "").toLowerCase()),
    );

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                نوع التقرير:
              </label>
              <select
                value={safeReportType ?? ""}
                onChange={(e) => setSafeReportType(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 max-w-[200px]"
              >
                <option value="transactions">حركات الخزينة</option>
                <option value="closings">التقفيلات اليومية</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">من:</label>
              <input
                type="date"
                value={startDate ?? ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">إلى:</label>
              <input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                الخزينة:
              </label>
              <select
                value={selectedSafe ?? ""}
                onChange={(e) => setSelectedSafe(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 max-w-[200px]"
              >
                <option value="all">كل الخزائن</option>
                {safes.map((safe: any) => (
                  <option key={safe.id} value={safe.id}>
                    {safe.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportToExcel(
                  safeReportType === "transactions"
                    ? filteredTransactions
                    : filteredClosings,
                  safeReportType === "transactions"
                    ? "تقرير_حركات_الخزينة"
                    : "تقرير_تقفيلات_الخزينة",
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {safeReportsLoading ? (
          <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
        ) : (
          <div className="space-y-8">
            {safeReportType === "transactions" ? (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">
                  حركات الخزينة
                </h3>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                  <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-bold text-slate-600">
                          التاريخ
                        </th>
                        <th className="p-4 font-bold text-slate-600">
                          رقم الحركة
                        </th>
                        <th className="p-4 font-bold text-slate-600">
                          الخزينة
                        </th>
                        <th className="p-4 font-bold text-slate-600">النوع</th>
                        <th className="p-4 font-bold text-slate-600">المبلغ</th>
                        <th className="p-4 font-bold text-slate-600">البيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginate(filteredTransactions).map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-4 text-slate-600">{t["التاريخ"]}</td>
                          <td className="p-4 text-slate-600 font-mono">
                            #{t["رقم الحركة"]}
                          </td>
                          <td className="p-4 text-slate-800 font-bold">
                            {t["الخزينة"]}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-bold ${t["النوع"] === "إيداع" ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}
                            >
                              {t["النوع"]}
                            </span>
                          </td>
                          <td
                            className={`p-4 font-bold ${t["النوع"] === "إيداع" ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {Number(t["المبلغ"] || 0 || 0).toLocaleString()} ج.م
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {t["البيان"] || "-"}
                          </td>
                        </tr>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-8 text-center text-slate-500"
                          >
                            لا توجد حركات في هذه الفترة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(filteredTransactions.length)}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">
                  التقفيلات اليومية
                </h3>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                  <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-bold text-slate-600">
                          التاريخ
                        </th>
                        <th className="p-4 font-bold text-slate-600">
                          رقم التقفيل
                        </th>
                        <th className="p-4 font-bold text-slate-600">
                          الخزينة
                        </th>
                        <th className="p-4 font-bold text-slate-600">
                          المبلغ المقفل
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginate(filteredClosings).map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-4 text-slate-600">{c["التاريخ"]}</td>
                          <td className="p-4 text-slate-600 font-mono">
                            #{c["رقم التقفيل"]}
                          </td>
                          <td className="p-4 text-slate-800 font-bold">
                            {c["الخزينة"]}
                          </td>
                          <td className="p-4 font-bold text-indigo-600">
                            {Number(c["المبلغ"] || 0 || 0).toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                      {filteredClosings.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-8 text-center text-slate-500"
                          >
                            لا توجد تقفيلات في هذه الفترة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(filteredClosings.length)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAIAnalytics = () => {
    if (aiAnalyticsLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600/30 border-t-indigo-600 animate-spin"></div>
          <div className="text-center space-y-1 animate-pulse">
            <h3 className="text-lg font-black text-slate-800">جاري تحليل البيانات التشغيلية...</h3>
            <p className="text-xs text-slate-500 font-medium">يقوم الذكاء الاصطناعي الآن بمسح الفواتير والمخازن والمبيعات وصياغة خطة عمل ذكية.</p>
          </div>
        </div>
      );
    }

    if (aiAnalyticsError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 space-y-5">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="text-center max-w-md space-y-1.5">
            <h3 className="text-lg font-black text-slate-800">لم نتمكن من إتمام التحليل الذكي</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {aiAnalyticsError}
            </p>
          </div>
          <button
            onClick={fetchAIAnalytics}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl transition-all text-xs shadow-sm flex items-center gap-2 border-none cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>إعادة التوليد والتجربة الآن</span>
          </button>
        </div>
      );
    }

    if (!aiAnalyticsData) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 space-y-5">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center border border-indigo-100/50 shadow-sm">
            <Sparkles className="w-8 h-8 animate-pulse text-indigo-500" />
          </div>
          <div className="text-center max-w-md space-y-1.5">
            <h3 className="text-lg font-black text-slate-800">الذكاء التحليلي والمستشار التنبؤي</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              قم ببدء تحليل بيانات نظامك اليوم لاستخلاص أهم الرؤى، التوقعات المالية للثلاثين يوماً القادمة، ونصائح زيادة الأرباح.
            </p>
          </div>
          <button
            onClick={fetchAIAnalytics}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl transition-all text-xs shadow-sm flex items-center gap-2 border-none cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>بدء التحليل التنبؤي الذكي ✨</span>
          </button>
        </div>
      );
    }

    const {
      executiveSummary,
      financialPerformance,
      operationalEfficiency,
      hrInsights,
      predictions,
      recommendations
    } = aiAnalyticsData;

    return (
      <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50/50" dir="rtl">
        {/* Top Banner with Quick Actions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
              <span>🧠 الذكاء التحليلي والمستشار التنبؤي (AI)</span>
              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600 text-[9px] font-black uppercase rounded-full tracking-wider animate-pulse">Gemini Live</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">تحليل ذكي وتنبؤات مالية حية مبنية على بيانات الفروع والمخازن والمبيعات الحالية.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchAIAnalytics}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all text-xs font-bold cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>تحديث التحليل الحركي</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all text-xs font-bold cursor-pointer border-none shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير الفني</span>
            </button>
          </div>
        </div>

        {/* Executive Summary Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">الملخص التنفيذي الذكي (Executive Summary)</h3>
              <p className="text-[10px] text-slate-400 font-bold">تم صياغته تلقائياً لمجلس الإدارة</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line">{executiveSummary}</p>
        </div>

        {/* 2-Column Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Performance Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">{financialPerformance?.title || "الأداء المالي والربحية"}</h3>
                  <p className="text-[10px] text-slate-400 font-bold">تحليلات السيولة والربحية والنمو</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">{financialPerformance?.summary}</p>
              
              <ul className="space-y-2">
                {financialPerformance?.insights?.map((ins: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 mt-4">
              {financialPerformance?.metrics?.map((m: any, idx: number) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">{m.label}</span>
                  <span className="text-sm font-black text-slate-800 block">{m.value}</span>
                  <span className="text-[9px] text-emerald-600 font-extrabold">{m.change}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Efficiency Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">{operationalEfficiency?.title || "الكفاءة التشغيلية وهدر التكاليف"}</h3>
                  <p className="text-[10px] text-slate-400 font-bold">تحليل كفاءة المكونات والمخزون والمطبخ</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">{operationalEfficiency?.summary}</p>

              <ul className="space-y-2">
                {operationalEfficiency?.insights?.map((ins: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 mt-4">
              {operationalEfficiency?.metrics?.map((m: any, idx: number) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">{m.label}</span>
                    <span className="text-sm font-black text-slate-800">{m.value}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black rounded-lg">
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HR and Salaries Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">{hrInsights?.title || "الموارد البشرية والإنتاجية"}</h3>
              <p className="text-[10px] text-slate-400 font-bold">تحليل إنتاجية الموظفين وتوزيع الأجور</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">{hrInsights?.summary}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {hrInsights?.insights?.map((ins: string, i: number) => (
              <div key={i} className="p-3 bg-purple-50/40 border border-purple-100 rounded-2xl text-xs text-slate-600 leading-relaxed font-medium">
                {ins}
              </div>
            ))}
          </div>
        </div>

        {/* Predictions and Forecasting Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">{predictions?.title || "التوقعات والتنبؤات الذكية (30 يوماً)"}</h3>
              <p className="text-[10px] text-slate-400 font-bold">توقعات الذكاء الاصطناعي للمبيعات والاتجاهات القادمة</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">{predictions?.summary}</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            {/* Table or cards */}
            <div className="lg:col-span-1 space-y-3">
              {predictions?.forecast?.map((f: any, idx: number) => (
                <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{f.period}</span>
                    <span className="text-[10px] text-slate-400 font-bold">دقة التنبؤ: {f.confidence}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black text-indigo-600 block">{Number(f.predictedSales || 0 || 0).toLocaleString()} ج.م</span>
                    <span className="text-[9px] text-emerald-600 font-extrabold">{f.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Recharts visual */}
            <div className="lg:col-span-2 h-[220px] bg-slate-50/50 rounded-2xl border border-slate-200 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={predictions?.forecast || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                  <YAxis stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="predictedSales" stroke="#4f46e5" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} name="المبيعات المتوقعة (ج.م)" />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* AI Recommendations Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800">💡 التوصيات الاستراتيجية والحلول المقترحة</h3>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black rounded-full">جاهزة للتنفيذ المباشر</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recommendations?.map((rec: any, idx: number) => (
              <div key={idx} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between transition-all hover:border-slate-300">
                <div className="space-y-2">
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600 text-[9px] font-black rounded-lg">التوصية {idx + 1}</span>
                  <h4 className="text-xs font-black text-slate-800">{rec.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">{rec.action}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold">العائد والأثر المتوقع:</span>
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black rounded-xl">
                    {rec.impact || "مرتفع"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === "branches"
                ? "تقارير المبيعات والفروع"
                : activeTab === "salaries"
                  ? "تقارير الرواتب والأجور"
                  : activeTab === "safes"
                    ? "تقارير الخزائن والخزينة الرئيسية والسرية"
                    : activeTab === "warehouse_transactions"
                      ? "تقارير حركات المخازن"
                      : activeTab === "general_accounts"
                        ? "طبيعة الحسابات والقيود"
                        : activeTab === "hr"
                          ? "تقارير الموارد البشرية"
                          : activeTab === "attendance"
                            ? "تقارير الحضور والانصراف"
                            : activeTab === "main_warehouse"
                              ? "تقرير جرد المخازن والأرصدة"
                              : activeTab === "stock_entries_report"
                                ? "تقرير قيود المخزن"
                                : activeTab === "ai_analytics"
                                  ? "الذكاء التحليلي والمستشار التنبؤي"
                                  : "التقارير المركزية"}
            </h1>
            <p className="text-sm text-slate-500">
              {activeTab === "branches"
                ? "إحصائيات المبيعات، ومصروفات وإيرادات الفروع بالتفصيل"
                : activeTab === "salaries"
                  ? "تقرير شامل وكشف تفصيلي لرواتب ومستحقات الموظفين بالتفصيل"
                  : activeTab === "safes"
                    ? "تفاصيل حركات خزائن الفروع والخزائن الرئيسية والسرية"
                    : activeTab === "warehouse_transactions"
                      ? "سجل تفصيلي لحركات وتحويلات المواد والمستندات المخزنية"
                      : activeTab === "general_accounts"
                        ? "طبيعة الحسابات العامة ودفتر اليومية وميزان المراجعة والقيود"
                        : activeTab === "hr"
                          ? "تقارير وتحليلات الموظفين والموارد البشرية"
                          : activeTab === "attendance"
                            ? "سجل تفصيلي لحضور وانصراف الموظفين بالفروع"
                            : activeTab === "main_warehouse"
                              ? "كشف جرد تفصيلي لمستودعات الفروع والأقسام وتتبع الأرصدة والحدود الدنيا"
                              : activeTab === "stock_entries_report"
                                ? "سجل تفصيلي لقيود المخازن والتسويات وحركات نقل وتوريد المواد"
                                : activeTab === "ai_analytics"
                                  ? "رؤى تشغيلية وتوقعات ذكية مدعومة بالذكاء الاصطناعي"
                                  : "تقارير شاملة للفروع، الموارد البشرية، والمرتبات"}
            </p>
          </div>
        </div>
      </div>

      {!initialTab && (
        <div className="px-6 py-4 flex gap-4 border-b border-slate-200 bg-white overflow-x-auto no-print">
          {[
            {
              id: "ai_analytics",
              label: "الذكاء التحليلي (AI) ✨",
              icon: Sparkles,
              perm: "central_reports.branches",
            },
            {
              id: "branches",
              label: "تقارير الفروع",
              icon: Building2,
              perm: "central_reports.branches",
            },
            {
              id: "hr",
              label: "تقارير الموارد البشرية",
              icon: Users,
              perm: "central_reports.hr",
            },
            {
              id: "attendance",
              label: "تقارير الحضور والانصراف",
              icon: Clock,
              perm: "central_reports.attendance",
            },
            {
              id: "salaries",
              label: "تقارير المرتبات",
              icon: DollarSign,
              perm: "central_reports.payroll",
            },
            {
              id: "main_warehouse",
              label: "تقرير جرد المخازن 📦",
              icon: Warehouse,
              perm: "central_reports.main_warehouse",
            },
            {
              id: "warehouse_transactions",
              label: "تقرير حركات المخازن",
              icon: ArrowRightLeft,
              perm: "central_reports.inventory_transactions",
            },
            {
              id: "stock_entries_report",
              label: "تقرير قيود المخزن",
              icon: Clock,
              perm: "central_reports.inventory_transactions",
            },
            {
              id: "general_accounts",
              label: "تقرير الحسابات العامة",
              icon: Calculator,
              perm: "central_reports.general_accounts",
            },
            {
              id: "safes",
              label: "تقارير الخزينة",
              icon: Wallet,
              perm: "central_reports.treasury",
            },
          ]
            .filter(
              (tab) =>
                user?.role === "admin" ||
                user?.permissions?.[tab.perm] !== false,
            )
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
        </div>
      )}

      {activeTab === "branches" && (
        <div className="flex-1 overflow-hidden relative">
          <BranchReports onBack={() => {}} hideHeader={true} />
        </div>
      )}
      {activeTab === "hr" && renderHRReport()}
      {activeTab === "attendance" && renderAttendanceReport()}
      {activeTab === "salaries" && renderSalariesReport()}
      {activeTab === "main_warehouse" && renderMainWarehouseReport()}
      {activeTab === "warehouse_transactions" &&
        renderWarehouseTransactionsReport()}
      {activeTab === "stock_entries_report" && renderStockEntriesReport()}
      {activeTab === "general_accounts" && renderGeneralAccountsReport()}
      {activeTab === "safes" && renderSafeReports()}
      {activeTab === "ai_analytics" && renderAIAnalytics()}
    </div>
  );
};
