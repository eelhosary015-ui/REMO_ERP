import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users, Search, Filter, Download, Printer, DollarSign, Clock,
  Briefcase, Building, CreditCard, Banknote, Landmark, ShieldCheck,
  ShieldAlert, Calendar, ArrowUpDown, ChevronDown, CheckCircle2,
  XCircle, AlertCircle, Sparkles, SlidersHorizontal, RefreshCw,
  Eye, FileSpreadsheet, Layers, UserCheck, Phone, IdCard,
  Percent, ChevronLeft, ChevronRight, X, User, ArrowRight,
  TrendingUp, Award, AlertTriangle, FileText, Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { Employee, HRDepartment, Branch, HRShift } from "../types";
import { databaseStorage } from "../utils/databaseStorage";
import { api } from "../utils/api";

/**
 * ✅ نفس قاعدة كشف المرتبات: التأمينات تُحسب من بنود التأمين المُعلَّمة "مفعّل" فقط.
 * البند غير المُفعّل لا يُخصم، ولو لا توجد بنود تأمين للموظف نرجع للمبلغ المحفوظ.
 */
const insuranceForEmployee = (emp: any): number => {
  const rawFlag = emp?.has_insurance;
  const enabled = rawFlag === true || rawFlag === 1 || ["1", "true", "yes", "نعم"].includes(String(rawFlag ?? "").trim().toLowerCase());
  if (!enabled) return 0;

  let components: any[] = [];
  if (Array.isArray(emp?.salary_components)) components = emp.salary_components;
  else if (typeof emp?.salary_components === "string") {
    try { components = JSON.parse(emp.salary_components) || []; } catch { components = []; }
  }

  const basic = Number(emp?.basic_salary || 0);
  let rows = 0;
  let total = 0;
  for (const comp of components) {
    if (!comp || !comp.name) continue;
    const name = String(comp.name);
    const isInsuranceRow =
      (comp.type === "استقطاع" || !comp.type) &&
      (name.includes("تأمين") || name.toLowerCase().includes("insurance"));
    if (!isInsuranceRow) continue;
    rows += 1;
    if (comp.is_active === false) continue;
    let amount = Number(comp.amount) || 0;
    if (comp.value_type === "نسبة من الأساسي") {
      amount = (basic * (Number(comp.discount_pct) || 0)) / 100;
    }
    total += amount;
  }
  return rows > 0 ? total : Number(emp?.insurance_amount || 0);
};

interface Props {
  employees: Employee[];
  departments: HRDepartment[];
  branches: Branch[];
  shifts: HRShift[];
  onBack?: () => void;
  onEditEmployee?: (emp: Employee, step?: number) => void;
}

export const HRDetailedEmployeeReport: React.FC<Props> = ({
  employees,
  departments,
  branches,
  shifts,
  onBack,
  onEditEmployee
}) => {
  // Date period for attendance and activity aggregation
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [salaryStatusFilter, setSalaryStatusFilter] = useState<string>("all");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("all");
  const [roleLevelFilter, setRoleLevelFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  // View Mode
  const [viewMode, setViewMode] = useState<"master" | "cards" | "payroll" | "shifts">("master");
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<Employee | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<string>("id");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Additional async data (Attendance, Penalties/Bonuses, Custodies, Leaves)
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [penaltiesData, setPenaltiesData] = useState<any[]>([]);
  const [bonusesData, setBonusesData] = useState<any[]>([]);
  const [custodiesData, setCustodiesData] = useState<any[]>([]);
  const [leavesData, setLeavesData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Column Visibility Controls
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    code: true,
    name: true,
    job: true,
    branch_dept: true,
    phone: true,
    national_id: true,
    basic_salary: true,
    allowances: true,
    total_salary: true,
    payment_method: true,
    bank_info: true,
    shift: true,
    work_hours: true,
    insurance: true,
    period_attendance: true,
    period_financials: true,
    status: true,
    actions: true,
  });
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Fetch related records for the selected period
  const fetchPeriodData = async () => {
    setIsLoadingData(true);
    try {
      // 1. Attendance
      // NOTE: /api/attendance returns a BARE ARRAY (not {data: [...]})
      // so handle both shapes to guarantee fingerprint records always load.
      const attRes = await api.get(`/api/attendance?startDate=${startDate}&endDate=${endDate}`);
      if (attRes.ok) {
        const d = await attRes.json();
        setAttendanceRecords(Array.isArray(d) ? d : (d?.data || []));
      }

      // 2. Penalties / Awards
      const penRes = await databaseStorage.getItem<any[]>("remo_pro_award_penalties", []);
      if (Array.isArray(penRes)) {
        setPenaltiesData(penRes.filter(p => (!p.date || (p.date >= startDate && p.date <= endDate))));
      }

      // 3. Bonuses
      const bonRes = await databaseStorage.getItem<any[]>("remo_production_bonuses", []);
      if (Array.isArray(bonRes)) {
        setBonusesData(bonRes.filter(b => (!b.date || (b.date >= startDate && b.date <= endDate))));
      }

      // 4. Custodies
      const custRes = await databaseStorage.getItem<any[]>("remo_pro_custody_records", []);
      if (Array.isArray(custRes)) {
        setCustodiesData(custRes);
      }

      // 5. Leaves
      const leaveRes = await databaseStorage.getItem<any[]>("remo_pro_leaves", []);
      if (Array.isArray(leaveRes)) {
        setLeavesData(leaveRes.filter(l => (!l.start_date || (l.start_date <= endDate && (l.end_date || l.start_date) >= startDate))));
      }
    } catch (e) {
      console.error("Error fetching detailed report period data:", e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchPeriodData();
  }, [startDate, endDate]);

  // Helper map for shifts
  const shiftMap = useMemo(() => {
    const m = new Map<number, HRShift>();
    shifts.forEach(s => m.set(Number(s.id), s));
    return m;
  }, [shifts]);

  // Helper map for departments & branches
  const deptMap = useMemo(() => {
    const m = new Map<number, string>();
    departments.forEach(d => m.set(Number(d.id), d.name));
    return m;
  }, [departments]);

  const branchMap = useMemo(() => {
    const m = new Map<number, string>();
    branches.forEach(b => m.set(Number(b.id), b.name));
    return m;
  }, [branches]);

  // Compute aggregated stats per employee for the active period
  const employeePeriodStats = useMemo(() => {
    const stats: Record<number, {
      presentDays: number;
      totalWorkHours: number;
      totalOvertimeHours: number;
      totalDelayMinutes: number;
      penaltiesCount: number;
      penaltiesAmount: number;
      bonusesCount: number;
      bonusesAmount: number;
      custodyCount: number;
      leavesCount: number;
    }> = {};

    employees.forEach(emp => {
      stats[emp.id] = {
        presentDays: 0,
        totalWorkHours: 0,
        totalOvertimeHours: 0,
        totalDelayMinutes: 0,
        penaltiesCount: 0,
        penaltiesAmount: 0,
        bonusesCount: 0,
        bonusesAmount: 0,
        custodyCount: 0,
        leavesCount: 0,
      };
    });

    // Aggregate attendance
    attendanceRecords.forEach(rec => {
      const empId = Number(rec.employee_id);
      if (stats[empId]) {
        if (rec.status === "present" || rec.status === "late") {
          stats[empId].presentDays += 1;
        }
        stats[empId].totalWorkHours += Number(rec.work_hours || 0);
        stats[empId].totalOvertimeHours += Number(rec.overtime || 0);
        stats[empId].totalDelayMinutes += Number(rec.delay_minutes || 0);
      }
    });

    // Aggregate penalties
    penaltiesData.forEach(p => {
      const empId = Number(p.employee_id);
      if (stats[empId]) {
        stats[empId].penaltiesCount += 1;
        stats[empId].penaltiesAmount += Number(p.amount || 0);
      }
    });

    // Aggregate bonuses
    bonusesData.forEach(b => {
      const empId = Number(b.employee_id);
      if (stats[empId]) {
        stats[empId].bonusesCount += 1;
        stats[empId].bonusesAmount += Number(b.amount || 0);
      }
    });

    // Aggregate custodies
    custodiesData.forEach(c => {
      const empId = Number(c.employee_id);
      if (stats[empId]) {
        stats[empId].custodyCount += 1;
      }
    });

    // Aggregate leaves
    leavesData.forEach(l => {
      const empId = Number(l.employee_id);
      if (stats[empId]) {
        stats[empId].leavesCount += Number(l.days_count || 1);
      }
    });

    return stats;
  }, [employees, attendanceRecords, penaltiesData, bonusesData, custodiesData, leavesData]);

  // Main Filtering Logic
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // 1. Text Search (Name, Code, Phone, National ID, Fingerprint, Job Title)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = String(emp.code || emp.employee_code || emp.id).toLowerCase();
        const name = String(emp.name || "").toLowerCase();
        const phone = String(emp.phone || "").toLowerCase();
        const natId = String(emp.national_id || "").toLowerCase();
        const fp = String(emp.fingerprint_code || "").toLowerCase();
        const job = String(emp.job_title || emp.position || "").toLowerCase();

        const match = code.includes(q) || name.includes(q) || phone.includes(q) ||
          natId.includes(q) || fp.includes(q) || job.includes(q);
        if (!match) return false;
      }

      // 2. Payment Method Filter (ATM, نقداً, تحويل بنكي, شيك)
      if (paymentMethodFilter !== "all") {
        const method = (emp as any).payment_method || "ATM";
        if (paymentMethodFilter === "atm" && method !== "ATM") return false;
        if (paymentMethodFilter === "cash" && method !== "نقداً" && method !== "cash") return false;
        if (paymentMethodFilter === "bank_transfer" && method !== "تحويل بنكي") return false;
        if (paymentMethodFilter === "cheque" && method !== "شيك") return false;
      }

      // 3. Salary Status & Range Filter
      const salary = Number(emp.basic_salary || 0);
      if (salaryStatusFilter === "with_salary" && salary <= 0) return false;
      if (salaryStatusFilter === "no_salary" && salary > 0) return false;
      if (salaryStatusFilter === "below_3000" && (salary === 0 || salary >= 3000)) return false;
      if (salaryStatusFilter === "3000_6000" && (salary < 3000 || salary > 6000)) return false;
      if (salaryStatusFilter === "6000_10000" && (salary < 6000 || salary > 10000)) return false;
      if (salaryStatusFilter === "above_10000" && salary < 10000) return false;
      if (salaryStatusFilter === "custom") {
        const min = salaryMin ? Number(salaryMin) : 0;
        const max = salaryMax ? Number(salaryMax) : Infinity;
        if (salary < min || salary > max) return false;
      }

      // 4. Shift Filter
      if (shiftFilter !== "all") {
        if (shiftFilter === "no_shift") {
          if (emp.shift_id || (emp.shifts && emp.shifts.length > 0)) return false;
        } else {
          const sId = Number(shiftFilter);
          const hasShift = emp.shift_id === sId || (Array.isArray(emp.shifts) && emp.shifts.includes(sId));
          if (!hasShift) return false;
        }
      }

      // 5. Department Filter
      if (deptFilter !== "all" && Number(emp.department_id) !== Number(deptFilter)) {
        return false;
      }

      // 6. Branch Filter
      if (branchFilter !== "all" && Number(emp.branch_id) !== Number(branchFilter)) {
        return false;
      }

      // 7. Status Filter
      if (statusFilter !== "all") {
        const s = (emp.status || "active").toLowerCase();
        if (statusFilter === "active" && s !== "active" && s !== "مفعل") return false;
        if (statusFilter === "inactive" && s !== "inactive" && s !== "موقوف" && s !== "معلق") return false;
        if (statusFilter === "probation" && s !== "probation" && s !== "تحت التجربة") return false;
        if (statusFilter === "on_leave" && s !== "on_leave" && s !== "في إجازة") return false;
      }

      // 8. Insurance Filter
      if (insuranceFilter === "insured" && !emp.has_insurance) return false;
      if (insuranceFilter === "not_insured" && emp.has_insurance) return false;

      // 9. Role Level
      if (roleLevelFilter !== "all") {
        if (roleLevelFilter === "head" && !emp.is_department_head && emp.role_level !== "head") return false;
        if (roleLevelFilter === "supervisor" && !emp.is_supervisor && emp.role_level !== "supervisor") return false;
        if (roleLevelFilter === "regular" && (emp.is_department_head || emp.is_supervisor)) return false;
      }

      // 10. Gender
      if (genderFilter !== "all" && (emp as any).gender !== genderFilter) {
        return false;
      }

      return true;
    });
  }, [
    employees, searchQuery, paymentMethodFilter, salaryStatusFilter, salaryMin, salaryMax,
    shiftFilter, deptFilter, branchFilter, statusFilter, insuranceFilter, roleLevelFilter, genderFilter
  ]);

  // Sort Filtered Employees
  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      let valA: any = a[sortField as keyof Employee] ?? "";
      let valB: any = b[sortField as keyof Employee] ?? "";

      if (sortField === "name") {
        valA = a.name || "";
        valB = b.name || "";
      } else if (sortField === "basic_salary") {
        valA = Number(a.basic_salary || 0);
        valB = Number(b.basic_salary || 0);
      } else if (sortField === "total_salary") {
        const allowA = Number((a as any).housing_allowance || 0) + Number((a as any).transport_allowance || 0) + Number((a as any).meal_allowance_amount || 0);
        const allowB = Number((b as any).housing_allowance || 0) + Number((b as any).transport_allowance || 0) + Number((b as any).meal_allowance_amount || 0);
        valA = Number(a.basic_salary || 0) + allowA;
        valB = Number(b.basic_salary || 0) + allowB;
      } else if (sortField === "payment_method") {
        valA = (a as any).payment_method || "ATM";
        valB = (b as any).payment_method || "ATM";
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredEmployees, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedEmployees.length / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedEmployees.slice(start, start + pageSize);
  }, [sortedEmployees, currentPage, pageSize]);

  // Intelligent Financial & Statistical Aggregations
  const statsSummary = useMemo(() => {
    let totalBasic = 0;
    let totalAllowances = 0;
    let countWithSalary = 0;
    let countNoSalary = 0;
    let countATM = 0;
    let sumATM = 0;
    let countCash = 0;
    let sumCash = 0;
    let countBank = 0;
    let sumBank = 0;
    let countCheque = 0;
    let sumCheque = 0;
    let countInsured = 0;
    let countWithShift = 0;

    filteredEmployees.forEach(emp => {
      const basic = Number(emp.basic_salary || 0);
      const allowances = Number((emp as any).housing_allowance || 0) +
        Number((emp as any).transport_allowance || 0) +
        Number((emp as any).meal_allowance_amount || (emp.has_meal_allowance ? 500 : 0)) +
        Number((emp as any).regularity_bonus || 0);

      const total = basic + allowances;

      totalBasic += basic;
      totalAllowances += allowances;

      if (basic > 0) countWithSalary++;
      else countNoSalary++;

      if (emp.has_insurance) countInsured++;
      if (emp.shift_id || (emp.shifts && emp.shifts.length > 0)) countWithShift++;

      const method = ((emp as any).payment_method || "ATM").trim();
      if (method === "ATM") {
        countATM++;
        sumATM += total;
      } else if (method === "نقداً" || method.toLowerCase() === "cash") {
        countCash++;
        sumCash += total;
      } else if (method === "تحويل بنكي") {
        countBank++;
        sumBank += total;
      } else if (method === "شيك") {
        countCheque++;
        sumCheque += total;
      } else {
        countATM++;
        sumATM += total;
      }
    });

    const avgSalary = filteredEmployees.length > 0 ? Math.round(totalBasic / filteredEmployees.length) : 0;
    const insuredPct = filteredEmployees.length > 0 ? Math.round((countInsured / filteredEmployees.length) * 100) : 0;
    const shiftPct = filteredEmployees.length > 0 ? Math.round((countWithShift / filteredEmployees.length) * 100) : 0;

    return {
      totalEmployees: filteredEmployees.length,
      totalBasic,
      totalAllowances,
      totalGross: totalBasic + totalAllowances,
      avgSalary,
      countWithSalary,
      countNoSalary,
      countATM,
      sumATM,
      countCash,
      sumCash,
      countBank,
      sumBank,
      countCheque,
      sumCheque,
      countInsured,
      insuredPct,
      countWithShift,
      shiftPct
    };
  }, [filteredEmployees]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setPaymentMethodFilter("all");
    setSalaryStatusFilter("all");
    setSalaryMin("");
    setSalaryMax("");
    setShiftFilter("all");
    setDeptFilter("all");
    setBranchFilter("all");
    setStatusFilter("all");
    setInsuranceFilter("all");
    setRoleLevelFilter("all");
    setGenderFilter("all");
    setCurrentPage(1);
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = sortedEmployees.map((emp, idx) => {
        const shiftObj = emp.shift_id ? shiftMap.get(Number(emp.shift_id)) : null;
        const shiftName = shiftObj?.name || emp.shift_name || "بدون وردية";
        const deptName = emp.department_name || (emp.department_id ? deptMap.get(Number(emp.department_id)) : "غير محدد");
        const branchName = emp.branch_name || (emp.branch_id ? branchMap.get(Number(emp.branch_id)) : "غير محدد");
        const stats = employeePeriodStats[emp.id] || { presentDays: 0, totalWorkHours: 0, totalOvertimeHours: 0, penaltiesAmount: 0, bonusesAmount: 0 };

        const basic = Number(emp.basic_salary || 0);
        const housing = Number((emp as any).housing_allowance || 0);
        const transport = Number((emp as any).transport_allowance || 0);
        const meal = Number((emp as any).meal_allowance_amount || (emp.has_meal_allowance ? 500 : 0));
        const totalAllowances = housing + transport + meal;
        const totalGross = basic + totalAllowances;
        const method = (emp as any).payment_method || "ATM";

        return {
          "م": idx + 1,
          "كود الموظف": emp.code || emp.employee_code || emp.id,
          "اسم الموظف": emp.name,
          "المسمى الوظيفي": emp.job_title || emp.position || "غير محدد",
          "الفرع": branchName,
          "القسم": deptName,
          "رقم الهاتف": emp.phone || "-",
          "الرقم القومي": emp.national_id || "-",
          "الراتب الأساسي": basic,
          "إجمالي البدلات": totalAllowances,
          "إجمالي الراتب": totalGross,
          "طريقة الصرف": method,
          "اسم البنك": (emp as any).bank_name || (emp as any).bank_sub_code || "-",
          "رقم الحساب / IBAN": (emp as any).bank_account || (emp as any).doctor_iban || "-",
          "نظام الوردية": shiftName,
          "مواعيد الوردية": shiftObj ? `${shiftObj.start_time} - ${shiftObj.end_time}` : "-",
          "ساعات العمل اليومية": shiftObj?.total_hours || emp.work_days || 8,
          "كود البصمة": emp.fingerprint_code || "-",
          "مؤمن عليه": emp.has_insurance ? "نعم" : "لا",
          "الرقم التأميني": (emp as any).social_insurance_no || "-",
          "أيام الحضور في الفترة": stats.presentDays,
          "ساعات العمل الفعلية": stats.totalWorkHours,
          "ساعات الإضافي": stats.totalOvertimeHours,
          "إجمالي الجزاءات (ج.م)": stats.penaltiesAmount,
          "إجمالي المكافآت (ج.م)": stats.bonusesAmount,
          "الحالة الوظيفية": emp.status === "active" ? "نشط" : emp.status === "probation" ? "تحت التجربة" : emp.status || "نشط",
          "تاريخ التعيين": (emp as any).hire_date || "-",
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "تقرير الموظفين المفصل");

      // Auto size columns
      const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({ wch: Math.max(key.length * 2, 14) }));
      ws["!cols"] = colWidths;

      XLSX.writeFile(wb, `تقرير_الموظفين_المفصل_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (e) {
      console.error("Export Excel error:", e);
      alert("حدث خطأ أثناء تصدير ملف Excel.");
    }
  };

  // Print Full Official Report
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 1. Header Toolbar & Quick Stats Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                title="رجوع"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900">
                  تقرير الموظفين المفصل والشامل
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                  {filteredEmployees.length} موظف مفلتر
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                كشف شامل لجميع بيانات الموظفين، تفاصيل الرواتب والبدلات، طرق الصرف (نقدي / ATM / بنكي)، الورديات وإحصائيات الفترة
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-purple-600" />
              <span>تخصيص الأعمدة</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* View Mode Switcher & Date Period Selection */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3">
          {/* View Modes */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setViewMode("master")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === "master"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>الجدول الشامل الكامل</span>
            </button>

            <button
              onClick={() => setViewMode("payroll")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === "payroll"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>تفصيل الرواتب والصرف</span>
            </button>

            <button
              onClick={() => setViewMode("shifts")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === "shifts"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>الورديات ومواعيد العمل</span>
            </button>

            <button
              onClick={() => setViewMode("cards")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === "cards"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>بطاقات الموظفين (Dossiers)</span>
            </button>
          </div>

          {/* Period Selection (من تاريخ - إلى تاريخ) */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs w-full md:w-auto">
            <span className="font-bold text-slate-600 flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              فترة الإحصائيات:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">من</span>
              <input
                type="date"
                value={startDate ?? ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 font-medium">إلى</span>
              <input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800"
              />
              <button
                onClick={fetchPeriodData}
                disabled={isLoadingData}
                className="p-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded transition-colors"
                title="تحديث بيانات الفترة"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Column Customizer Popover */}
        {showColumnPicker && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-purple-600" />
                <span>اختر الأعمدة المراد إظهارها في الجدول والطباعة والتصدير:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const allTrue: any = {};
                    Object.keys(visibleColumns).forEach(k => allTrue[k] = true);
                    setVisibleColumns(allTrue);
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-bold"
                >
                  إظهار الكل
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setShowColumnPicker(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-bold"
                >
                  إغلاق ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-medium">
              {[
                { id: "code", label: "الكود" },
                { id: "name", label: "اسم الموظف" },
                { id: "job", label: "المسمى الوظيفي" },
                { id: "branch_dept", label: "الفرع والقسم" },
                { id: "phone", label: "رقم الهاتف" },
                { id: "national_id", label: "الرقم القومي" },
                { id: "basic_salary", label: "الراتب الأساسي" },
                { id: "allowances", label: "إجمالي البدلات" },
                { id: "total_salary", label: "إجمالي الراتب" },
                { id: "payment_method", label: "طريقة الصرف" },
                { id: "bank_info", label: "البنك والحساب" },
                { id: "shift", label: "نظام الوردية" },
                { id: "work_hours", label: "ساعات العمل" },
                { id: "insurance", label: "التأمينات" },
                { id: "period_attendance", label: "حضور الفترة" },
                { id: "period_financials", label: "ماليات الفترة" },
                { id: "status", label: "الحالة" },
                { id: "actions", label: "الإجراءات" }
              ].map(col => (
                <label key={col.id} className="flex items-center gap-1.5 bg-white p-1.5 px-2 rounded-lg border border-slate-200 cursor-pointer hover:border-purple-300">
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.id]}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, [col.id]: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-purple-600 border-slate-300"
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Smart KPI Cards (Financial & Operational Breakdown) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Employees & Average Salary */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">إجمالي الموظفين المفلترين</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {statsSummary.totalEmployees} <span className="text-xs font-normal text-slate-400">موظف</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              متوسط الراتب: <span className="font-bold text-slate-800">{Number(statsSummary.avgSalary || 0).toLocaleString()} ج.م</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Total Salaries & Gross Payroll */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">إجمالي الرواتب الأساسية</span>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">
              {Number(statsSummary.totalBasic || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              مع البدلات: <span className="font-bold text-slate-800">{Number(statsSummary.totalGross || 0).toLocaleString()} ج.م</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Payment Method Breakdown (Cash vs ATM) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="w-full">
            <span className="text-[11px] font-bold text-slate-500 block">تفصيل طرق الصرف</span>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-center">
                <span className="text-[10px] font-bold text-amber-800 block">💵 نقداً (Cash)</span>
                <span className="text-xs font-black text-amber-900">{statsSummary.countCash} موظف</span>
                <span className="text-[10px] text-amber-700 block font-medium">({Number(statsSummary.sumCash || 0).toLocaleString()} ج.م)</span>
              </div>
              <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-center">
                <span className="text-[10px] font-bold text-blue-800 block">💳 ATM / بنك</span>
                <span className="text-xs font-black text-blue-900">{statsSummary.countATM + statsSummary.countBank} موظف</span>
                <span className="text-[10px] text-blue-700 block font-medium">Number({(statsSummary.sumATM + statsSummary.sumBank || 0).toLocaleString()} ج.م)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Insurance & Shifts Coverage */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">التغطية التأمينية والورديات</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-800">
                مؤمن عليهم: {statsSummary.insuredPct}%
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800">
                مسند لوردية: {statsSummary.shiftPct}%
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5 font-medium">
              بدون راتب محدد: <span className="font-bold text-red-600">{statsSummary.countNoSalary}</span> | براتب: <span className="font-bold text-emerald-600">{statsSummary.countWithSalary}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Sticky Smart Filter Bar (Matching Employees Page UI Exactly) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
        {/* Main Search & Primary Action Row */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-3">
          {/* Action & Clear Buttons */}
          <div className="flex flex-row-reverse items-center gap-2 w-full xl:w-auto justify-between xl:justify-start">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              مسح الفلاتر
            </button>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer border ${
                showAdvancedFilters
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>فلاتر تفصيلية متقدمة</span>
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="flex-1 flex flex-col md:flex-row-reverse items-center gap-2 w-full xl:w-auto">
            {/* Search Input Box */}
            <div className="flex w-full md:w-[360px] bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-colors">
              <input
                type="text"
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، الكود، الرقم القومي، الهاتف، البصمة..."
                className="flex-1 px-3 py-2 outline-none text-xs bg-white text-right font-medium placeholder:text-slate-400"
                dir="rtl"
              />
              <button className="bg-purple-600 px-3 flex items-center justify-center text-white hover:bg-purple-700 transition-colors shrink-0">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filter: Payment Method */}
            <div className="w-full md:w-44">
              <select
                value={paymentMethodFilter ?? ""}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-purple-500"
                title="تصفية بطريقة الصرف"
              >
                <option value="all">💳 كل طرق الصرف</option>
                <option value="atm">🏧 بطاقة ATM</option>
                <option value="cash">💵 نقداً (كاش)</option>
                <option value="bank_transfer">🏦 تحويل بنكي</option>
                <option value="cheque">📝 شيك بنكي</option>
              </select>
            </div>

            {/* Quick Filter: Salary Status */}
            <div className="w-full md:w-44">
              <select
                value={salaryStatusFilter ?? ""}
                onChange={(e) => setSalaryStatusFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-purple-500"
                title="تصفية بالراتب"
              >
                <option value="all">💰 كل حالات الرواتب</option>
                <option value="with_salary">✅ براتب مسجل (&gt; 0)</option>
                <option value="no_salary">❌ بدون راتب مسجل (0)</option>
                <option value="below_3000">أقل من 3,000 ج.م</option>
                <option value="3000_6000">3,000 - 6,000 ج.م</option>
                <option value="6000_10000">6,000 - 10,000 ج.م</option>
                <option value="above_10000">أكثر من 10,000 ج.م</option>
                <option value="custom">نطاق راتب مخصص...</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Filter Chips (بنود التصفية السريعة بنقرة واحدة) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-bold text-[11px] shrink-0">تصفية سريعة:</span>
          
          <button
            onClick={() => setPaymentMethodFilter(paymentMethodFilter === "cash" ? "all" : "cash")}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
              paymentMethodFilter === "cash"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            💵 نقداً فقط ({statsSummary.countCash})
          </button>

          <button
            onClick={() => setPaymentMethodFilter(paymentMethodFilter === "atm" ? "all" : "atm")}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
              paymentMethodFilter === "atm"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
            }`}
          >
            💳 ATM فقط ({statsSummary.countATM})
          </button>

          <button
            onClick={() => setSalaryStatusFilter(salaryStatusFilter === "with_salary" ? "all" : "with_salary")}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
              salaryStatusFilter === "with_salary"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            ✅ براتب مسجل ({statsSummary.countWithSalary})
          </button>

          <button
            onClick={() => setSalaryStatusFilter(salaryStatusFilter === "no_salary" ? "all" : "no_salary")}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
              salaryStatusFilter === "no_salary"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-red-50 text-red-800 hover:bg-red-100 border border-red-200"
            }`}
          >
            ❌ بدون راتب ({statsSummary.countNoSalary})
          </button>

          <button
            onClick={() => setShiftFilter(shiftFilter === "no_shift" ? "all" : "no_shift")}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
              shiftFilter === "no_shift"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            ⏰ بدون وردية مسندة
          </button>

          <button
            onClick={() => setInsuranceFilter(insuranceFilter === "insured" ? "all" : "insured")}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
              insuranceFilter === "insured"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200"
            }`}
          >
            🛡️ مؤمن عليهم فقط ({statsSummary.countInsured})
          </button>
        </div>

        {/* Advanced Filters Expandable Grid */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs animate-fadeIn">
            {/* 1. Shift Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">الوردية المسندة</label>
              <select
                value={shiftFilter ?? ""}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">كل الورديات</option>
                <option value="no_shift">بدون وردية مسندة</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
                ))}
              </select>
            </div>

            {/* 2. Department Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">القسم</label>
              <select
                value={deptFilter ?? ""}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">كل الأقسام</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Branch Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">الفرع</label>
              <select
                value={branchFilter ?? ""}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">كل الفروع</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Employment Status */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">الحالة الوظيفية</label>
              <select
                value={statusFilter ?? ""}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشط / على رأس العمل</option>
                <option value="probation">تحت فترة التجربة</option>
                <option value="on_leave">في إجازة</option>
                <option value="inactive">موقوف / معلق</option>
              </select>
            </div>

            {/* 5. Insurance Filter */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">الموقف التأميني</label>
              <select
                value={insuranceFilter ?? ""}
                onChange={(e) => setInsuranceFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">الكل</option>
                <option value="insured">مؤمن عليه اجتماعياً</option>
                <option value="not_insured">غير مؤمن عليه</option>
              </select>
            </div>

            {/* 6. Role Level */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">المستوى القيادي</label>
              <select
                value={roleLevelFilter ?? ""}
                onChange={(e) => setRoleLevelFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">كل المستويات</option>
                <option value="head">رئيس قسم / مدير</option>
                <option value="supervisor">مشرف</option>
                <option value="regular">موظف تنفيذي</option>
              </select>
            </div>

            {/* Custom Min/Max Salary Inputs if custom selected */}
            {salaryStatusFilter === "custom" && (
              <div className="col-span-full bg-purple-50 p-2.5 rounded-xl border border-purple-200 flex items-center gap-3">
                <span className="text-xs font-bold text-purple-900">تحديد نطاق الراتب الأساسي:</span>
                <input
                  type="number"
                  placeholder="الحد الأدنى (ج.م)"
                  value={salaryMin ?? ""}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-32"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="الحد الأقصى (ج.م)"
                  value={salaryMax ?? ""}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-32"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Main Content: Table / Payroll / Shifts / Cards */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center min-h-[400px] w-full py-16">
          <Search className="w-16 h-16 text-slate-300 mb-4 opacity-50" strokeWidth={1} />
          <p className="text-slate-600 font-bold mb-2 text-base">لا توجد نتائج مطابقة لشروط الفلترة المحددة</p>
          <p className="text-slate-400 text-xs mb-4">جرب تعديل طريقة الصرف أو نطاق الرواتب أو مسح معايير البحث</p>
          <button
            onClick={handleResetFilters}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            إعادة تعيين جميع الفلاتر
          </button>
        </div>
      ) : (
        <>
          {/* VIEW 1: Master Comprehensive Table */}
          {viewMode === "master" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-auto max-h-[calc(100vh-270px)] min-h-[450px] custom-scrollbar relative">
              <table className="w-full text-right min-w-[1200px] border-collapse relative">
                <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-30 shadow-xs">
                  <tr className="text-slate-800 font-bold text-xs">
                    {visibleColumns.code && (
                      <th
                        onClick={() => { setSortField("id"); setSortAsc(!sortAsc); }}
                        className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>الكود</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.name && (
                      <th
                        onClick={() => { setSortField("name"); setSortAsc(!sortAsc); }}
                        className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200 min-w-[180px] cursor-pointer hover:bg-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>الموظف</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.job && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">المسمى الوظيفي</th>
                    )}
                    {visibleColumns.branch_dept && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">الفرع / القسم</th>
                    )}
                    {visibleColumns.phone && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">الهاتف</th>
                    )}
                    {visibleColumns.national_id && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">الرقم القومي</th>
                    )}
                    {visibleColumns.basic_salary && (
                      <th
                        onClick={() => { setSortField("basic_salary"); setSortAsc(!sortAsc); }}
                        className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors text-emerald-800"
                      >
                        <div className="flex items-center gap-1">
                          <span>الراتب الأساسي</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.allowances && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">البدلات</th>
                    )}
                    {visibleColumns.total_salary && (
                      <th
                        onClick={() => { setSortField("total_salary"); setSortAsc(!sortAsc); }}
                        className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors text-purple-900 font-black"
                      >
                        <div className="flex items-center gap-1">
                          <span>إجمالي الراتب</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.payment_method && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">طريقة الصرف</th>
                    )}
                    {visibleColumns.bank_info && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">البنك / الحساب</th>
                    )}
                    {visibleColumns.shift && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">الوردية</th>
                    )}
                    {visibleColumns.work_hours && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">البصمة والساعات</th>
                    )}
                    {visibleColumns.insurance && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">التأمين</th>
                    )}
                    {visibleColumns.period_attendance && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">حضور الفترة</th>
                    )}
                    {visibleColumns.period_financials && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">جزاءات / مكافآت</th>
                    )}
                    {visibleColumns.status && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200">الحالة</th>
                    )}
                    {visibleColumns.actions && (
                      <th className="sticky top-0 bg-slate-100 p-3.5 z-30 border-b-2 border-slate-200 text-center">الإجراءات</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-xs">
                  {paginatedEmployees.map((emp, index) => {
                    const shiftObj = emp.shift_id ? shiftMap.get(Number(emp.shift_id)) : null;
                    const shiftName = shiftObj?.name || emp.shift_name || "بدون وردية";
                    const deptName = emp.department_name || (emp.department_id ? deptMap.get(Number(emp.department_id)) : "عام");
                    const branchName = emp.branch_name || (emp.branch_id ? branchMap.get(Number(emp.branch_id)) : "الرئيسي");

                    const basic = Number(emp.basic_salary || 0);
                    const housing = Number((emp as any).housing_allowance || 0);
                    const transport = Number((emp as any).transport_allowance || 0);
                    const meal = Number((emp as any).meal_allowance_amount || (emp.has_meal_allowance ? 500 : 0));
                    const otherAllow = Number((emp as any).other_allowance || 0);
                    const totalAllowances = housing + transport + meal + otherAllow;
                    const totalGross = basic + totalAllowances;

                    const method = ((emp as any).payment_method || "ATM").trim();
                    const stats = employeePeriodStats[emp.id] || { presentDays: 0, totalWorkHours: 0, totalOvertimeHours: 0, totalDelayMinutes: 0, penaltiesAmount: 0, bonusesAmount: 0 };

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Code */}
                        {visibleColumns.code && (
                          <td className="p-3.5 font-bold text-slate-700 font-mono">
                            {emp.code || emp.employee_code || `#${emp.id}`}
                          </td>
                        )}

                        {/* Name & Avatar */}
                        {visibleColumns.name && (
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0">
                                {emp.name?.charAt(0) || "م"}
                              </div>
                              <div>
                                <span className="font-black text-slate-900 block">{emp.name}</span>
                                <span className="text-[10px] text-slate-400">كود: {emp.fingerprint_code || emp.id}</span>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Job Title */}
                        {visibleColumns.job && (
                          <td className="p-3.5 font-bold text-slate-700">
                            {emp.job_title || emp.position || "موظف"}
                          </td>
                        )}

                        {/* Branch / Dept */}
                        {visibleColumns.branch_dept && (
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800 block">{deptName}</span>
                            <span className="text-[10px] text-slate-500">{branchName}</span>
                          </td>
                        )}

                        {/* Phone */}
                        {visibleColumns.phone && (
                          <td className="p-3.5 font-mono text-slate-600 dir-ltr text-right">
                            {emp.phone || "-"}
                          </td>
                        )}

                        {/* National ID */}
                        {visibleColumns.national_id && (
                          <td className="p-3.5 font-mono text-slate-600">
                            {emp.national_id || "-"}
                          </td>
                        )}

                        {/* Basic Salary */}
                        {visibleColumns.basic_salary && (
                          <td className="p-3.5 font-black text-emerald-700 font-mono">
                            {basic > 0 ? `${Number(basic || 0).toLocaleString()} ج.م` : <span className="text-red-500 font-bold">غير مسجل</span>}
                          </td>
                        )}

                        {/* Allowances */}
                        {visibleColumns.allowances && (
                          <td className="p-3.5 font-bold text-slate-600 font-mono">
                            {totalAllowances > 0 ? `+${Number(totalAllowances || 0).toLocaleString()} ج.م` : "-"}
                          </td>
                        )}

                        {/* Total Salary */}
                        {visibleColumns.total_salary && (
                          <td className="p-3.5 font-black text-purple-900 font-mono text-sm">
                            {Number(totalGross || 0).toLocaleString()} ج.م
                          </td>
                        )}

                        {/* Payment Method */}
                        {visibleColumns.payment_method && (
                          <td className="p-3.5">
                            {method === "ATM" ? (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                <CreditCard className="w-3 h-3" /> ATM
                              </span>
                            ) : method === "نقداً" || method.toLowerCase() === "cash" ? (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                                <Banknote className="w-3 h-3" /> نقداً (Cash)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 inline-flex items-center gap-1">
                                <Landmark className="w-3 h-3" /> {method}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Bank Info */}
                        {visibleColumns.bank_info && (
                          <td className="p-3.5 text-slate-600">
                            <span className="font-bold text-slate-800 block text-[11px]">
                              {(emp as any).bank_name || (emp as any).bank_sub_code || "-"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {(emp as any).bank_account || (emp as any).doctor_iban || ""}
                            </span>
                          </td>
                        )}

                        {/* Shift */}
                        {visibleColumns.shift && (
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800 block">{shiftName}</span>
                            {shiftObj && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                {shiftObj.start_time} - {shiftObj.end_time}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Work Hours & Fingerprint */}
                        {visibleColumns.work_hours && (
                          <td className="p-3.5">
                            <span className="font-bold text-slate-700 block">
                              بصمة: {emp.fingerprint_code || "غير مسجل"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {shiftObj?.total_hours || emp.work_days || 8} س/يوم
                            </span>
                          </td>
                        )}

                        {/* Insurance */}
                        {visibleColumns.insurance && (
                          <td className="p-3.5">
                            {emp.has_insurance ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> مؤمن عليه
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                غير مؤمن
                              </span>
                            )}
                          </td>
                        )}

                        {/* Period Attendance */}
                        {visibleColumns.period_attendance && (
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800 block">{stats.presentDays} يوم حضور</span>
                            <span className="text-[10px] text-slate-500 font-mono">{stats.totalWorkHours} ساعة عمل</span>
                          </td>
                        )}

                        {/* Period Financials */}
                        {visibleColumns.period_financials && (
                          <td className="p-3.5">
                            {stats.penaltiesAmount > 0 && (
                              <span className="text-[11px] font-bold text-red-600 block">
                                خصم: -{stats.penaltiesAmount} ج.م
                              </span>
                            )}
                            {stats.bonusesAmount > 0 && (
                              <span className="text-[11px] font-bold text-emerald-600 block">
                                حافز: +{stats.bonusesAmount} ج.م
                              </span>
                            )}
                            {stats.penaltiesAmount === 0 && stats.bonusesAmount === 0 && (
                              <span className="text-[11px] text-slate-400">-</span>
                            )}
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              emp.status === "active" || emp.status === "مفعل"
                                ? "bg-emerald-100 text-emerald-800"
                                : emp.status === "probation"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {emp.status === "active" ? "نشط" : emp.status === "probation" ? "تحت التجربة" : emp.status || "نشط"}
                            </span>
                          </td>
                        )}

                        {/* Actions */}
                        {visibleColumns.actions && (
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedEmployeeForModal(emp)}
                                className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors cursor-pointer"
                                title="عرض كشف الحساب والملف الكامل للموظف"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {onEditEmployee && (
                                <button
                                  onClick={() => onEditEmployee(emp, 2)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                  title="تعديل الموظف"
                                >
                                  <SlidersHorizontal className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: Financial & Payroll Breakdown View */}
          {viewMode === "payroll" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-auto max-h-[calc(100vh-270px)] min-h-[450px] custom-scrollbar relative">
              <table className="w-full text-right min-w-[1000px] border-collapse relative">
                <thead className="bg-emerald-800 text-white sticky top-0 z-30 shadow-xs text-xs font-bold">
                  <tr>
                    <th className="p-3.5">الكود</th>
                    <th className="p-3.5">اسم الموظف</th>
                    <th className="p-3.5">طريقة الصرف</th>
                    <th className="p-3.5">البنك / رقم الحساب</th>
                    <th className="p-3.5 text-emerald-200">الراتب الأساسي</th>
                    <th className="p-3.5">بدل سكن</th>
                    <th className="p-3.5">بدل انتقال</th>
                    <th className="p-3.5">بدل وجبة / أخرى</th>
                    <th className="p-3.5 text-amber-300 font-black">إجمالي المستحق</th>
                    <th className="p-3.5 text-rose-300">خصم التأمينات</th>
                    <th className="p-3.5 text-emerald-300 font-black">صافي الراتب التقديري</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-xs">
                  {paginatedEmployees.map(emp => {
                    const basic = Number(emp.basic_salary || 0);
                    const housing = Number((emp as any).housing_allowance || 0);
                    const transport = Number((emp as any).transport_allowance || 0);
                    const meal = Number((emp as any).meal_allowance_amount || (emp.has_meal_allowance ? 500 : 0));
                    const other = Number((emp as any).other_allowance || 0);
                    const gross = basic + housing + transport + meal + other;
                    const ins = insuranceForEmployee(emp);
                    const net = Math.max(0, gross - ins);
                    const method = (emp as any).payment_method || "ATM";

                    return (
                      <tr key={emp.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="p-3.5 font-bold font-mono text-slate-700">{emp.code || emp.id}</td>
                        <td className="p-3.5 font-black text-slate-900">{emp.name}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                            method === "ATM" ? "bg-blue-100 text-blue-800" :
                            method === "نقداً" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {method}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600 text-[11px]">
                          {(emp as any).bank_name || "-"} / {(emp as any).bank_account || (emp as any).doctor_iban || "-"}
                        </td>
                        <td className="p-3.5 font-black text-emerald-700 font-mono">{Number(basic || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono text-slate-600">{housing > 0 ? `${housing} ج.م` : "-"}</td>
                        <td className="p-3.5 font-mono text-slate-600">{transport > 0 ? `${transport} ج.م` : "-"}</td>
                        <td className="p-3.5 font-mono text-slate-600">{(meal + other) > 0 ? `${meal + other} ج.م` : "-"}</td>
                        <td className="p-3.5 font-black text-slate-900 font-mono">{Number(gross || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-bold text-red-600 font-mono">{ins > 0 ? `-${ins} ج.م` : "-"}</td>
                        <td className="p-3.5 font-black text-emerald-800 font-mono text-sm">{Number(net || 0 || 0).toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedEmployeeForModal(emp)}
                            className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold text-xs"
                          >
                            كشف حساب
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 3: Shifts & Schedules View */}
          {viewMode === "shifts" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-auto max-h-[calc(100vh-270px)] min-h-[450px] custom-scrollbar relative">
              <table className="w-full text-right min-w-[900px] border-collapse relative">
                <thead className="bg-blue-900 text-white sticky top-0 z-30 shadow-xs text-xs font-bold">
                  <tr>
                    <th className="p-3.5">الكود</th>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">القسم / الفرع</th>
                    <th className="p-3.5">كود البصمة</th>
                    <th className="p-3.5 text-blue-200">الوردية المسندة</th>
                    <th className="p-3.5">مواعيد الدخول والخروج</th>
                    <th className="p-3.5">ساعات العمل المقررة</th>
                    <th className="p-3.5">سماحية التأخير</th>
                    <th className="p-3.5">أيام الحضور في الفترة</th>
                    <th className="p-3.5">إجمالي الساعات الفعلية</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-xs">
                  {paginatedEmployees.map(emp => {
                    const shiftObj = emp.shift_id ? shiftMap.get(Number(emp.shift_id)) : null;
                    const stats = employeePeriodStats[emp.id] || { presentDays: 0, totalWorkHours: 0, totalOvertimeHours: 0 };

                    return (
                      <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="p-3.5 font-bold font-mono text-slate-700">{emp.code || emp.id}</td>
                        <td className="p-3.5 font-black text-slate-900">{emp.name}</td>
                        <td className="p-3.5 font-bold text-slate-700">{emp.department_name || "عام"}</td>
                        <td className="p-3.5 font-mono text-purple-700 font-black">{emp.fingerprint_code || "غير مسجل"}</td>
                        <td className="p-3.5 font-bold text-blue-900">{shiftObj?.name || emp.shift_name || "بدون وردية"}</td>
                        <td className="p-3.5 font-mono text-slate-700">{shiftObj ? `${shiftObj.start_time} - ${shiftObj.end_time}` : "-"}</td>
                        <td className="p-3.5 font-mono text-slate-700">{shiftObj?.total_hours || emp.work_days || 8} ساعات</td>
                        <td className="p-3.5 font-mono text-slate-600">{shiftObj?.grace_period || 15} دقيقة</td>
                        <td className="p-3.5 font-bold text-emerald-700 font-mono">{stats.presentDays} يوم</td>
                        <td className="p-3.5 font-bold text-blue-800 font-mono">{stats.totalWorkHours} ساعة</td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedEmployeeForModal(emp)}
                            className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-bold text-xs"
                          >
                            سجل الحضور
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 4: Comprehensive Employee Dossier Cards */}
          {viewMode === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedEmployees.map(emp => {
                const shiftObj = emp.shift_id ? shiftMap.get(Number(emp.shift_id)) : null;
                const basic = Number(emp.basic_salary || 0);
                const stats = employeePeriodStats[emp.id] || { presentDays: 0, totalWorkHours: 0, penaltiesAmount: 0, bonusesAmount: 0 };
                const method = (emp as any).payment_method || "ATM";

                return (
                  <div key={emp.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      {/* Top Row: Avatar & Basic Info */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-sm">
                            {emp.name?.charAt(0) || "م"}
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-sm leading-tight">{emp.name}</h3>
                            <span className="text-xs font-bold text-purple-700">{emp.job_title || emp.position || "موظف"}</span>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              كود: {emp.code || emp.id} | بصمة: {emp.fingerprint_code || "-"}
                            </div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          method === "ATM" ? "bg-blue-100 text-blue-800" :
                          method === "نقداً" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {method}
                        </span>
                      </div>

                      {/* Middle Details Grid */}
                      <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-bold">الراتب الأساسي</span>
                          <span className="font-black text-emerald-700 font-mono text-sm">{Number(basic || 0 || 0).toLocaleString()} ج.م</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-bold">الوردية</span>
                          <span className="font-bold text-slate-800 truncate block">{shiftObj?.name || "بدون وردية"}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-bold">حضور الفترة</span>
                          <span className="font-black text-blue-700 font-mono">{stats.presentDays} يوم ({stats.totalWorkHours}س)</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-bold">القسم / الفرع</span>
                          <span className="font-bold text-slate-800 truncate block">{emp.department_name || "عام"}</span>
                        </div>
                      </div>

                      {/* Phone & National ID */}
                      <div className="text-[11px] text-slate-500 space-y-0.5 mb-2">
                        <div className="flex items-center justify-between">
                          <span>الهاتف:</span>
                          <span className="font-mono text-slate-800 font-bold">{emp.phone || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>الرقم القومي:</span>
                          <span className="font-mono text-slate-800">{emp.national_id || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedEmployeeForModal(emp)}
                        className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>كشف الحساب والملف</span>
                      </button>
                      {onEditEmployee && (
                        <button
                          onClick={() => onEditEmployee(emp, 2)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                          title="تعديل الموظف"
                        >
                          تعديل
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls (Matching HR Exactly) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl font-bold text-xs text-slate-700 transition-colors cursor-pointer"
              >
                السابق
              </button>
              <span className="text-xs font-bold text-slate-600">
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl font-bold text-xs text-slate-700 transition-colors cursor-pointer"
              >
                التالي
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">عرض بالصفحة:</span>
              <select
                value={pageSize ?? ""}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700"
              >
                <option value={10}>10 موظفين</option>
                <option value={25}>25 موظف</option>
                <option value={50}>50 موظف</option>
                <option value={100}>100 موظف</option>
                <option value={500}>500 موظف</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* 5. Detailed Individual Employee Dossier Modal */}
      {selectedEmployeeForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black shadow-inner">
                  {selectedEmployeeForModal.name?.charAt(0) || "م"}
                </div>
                <div>
                  <h2 className="text-xl font-black">{selectedEmployeeForModal.name}</h2>
                  <p className="text-xs text-purple-200 mt-0.5 font-medium">
                    {selectedEmployeeForModal.job_title || "موظف"} | كود الموظف: {selectedEmployeeForModal.code || selectedEmployeeForModal.id} | البصمة: {selectedEmployeeForModal.fingerprint_code || "غير مسجل"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployeeForModal(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
              {/* Top Financial & Payment Breakdown Card */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-5">
                <h3 className="text-sm font-black text-purple-950 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-700" />
                  <span>البيانات المالية وطريقة الصرف</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 block font-bold">الراتب الأساسي</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {Number(selectedEmployeeForModal.basic_salary || 0 || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 block font-bold">طريقة الصرف</span>
                    <span className="text-sm font-black text-purple-900">
                      {(selectedEmployeeForModal as any).payment_method || "ATM"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 block font-bold">اسم البنك / الفرع</span>
                    <span className="text-xs font-bold text-slate-800">
                      {(selectedEmployeeForModal as any).bank_name || (selectedEmployeeForModal as any).bank_sub_code || "غير محدد"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-400 block font-bold">رقم الحساب / IBAN</span>
                    <span className="text-xs font-mono text-slate-800 font-bold">
                      {(selectedEmployeeForModal as any).bank_account || (selectedEmployeeForModal as any).doctor_iban || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Personal & Employment Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Info */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 mb-3 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>البيانات الشخصية والاتصال</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">الرقم القومي:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedEmployeeForModal.national_id || "-"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">رقم الهاتف:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedEmployeeForModal.phone || "-"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">العنوان:</span>
                      <span className="font-bold text-slate-800">{selectedEmployeeForModal.address || "-"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">المؤهل الدراسي:</span>
                      <span className="font-bold text-slate-800">{selectedEmployeeForModal.qualification || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">تاريخ الميلاد:</span>
                      <span className="font-mono font-bold text-slate-800">{(selectedEmployeeForModal as any).birth_date || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Job & Shifts Info */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 mb-3 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-purple-600" />
                    <span>البيانات الوظيفية والورديات</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">القسم:</span>
                      <span className="font-bold text-slate-800">{selectedEmployeeForModal.department_name || "عام"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">الفرع:</span>
                      <span className="font-bold text-slate-800">{selectedEmployeeForModal.branch_name || "الرئيسي"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">الوردية المسندة:</span>
                      <span className="font-bold text-blue-700">
                        {selectedEmployeeForModal.shift_id ? (shiftMap.get(Number(selectedEmployeeForModal.shift_id))?.name || "وردية مخصصة") : "بدون وردية"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">التأمين الاجتماعي:</span>
                      <span className="font-bold text-teal-800">
                        {selectedEmployeeForModal.has_insurance ? `مؤمن عليه (${(selectedEmployeeForModal as any).social_insurance_no || "مسجل"})` : "غير مؤمن"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">تاريخ التعيين:</span>
                      <span className="font-mono font-bold text-slate-800">{(selectedEmployeeForModal as any).hire_date || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Period Activity Summary */}
              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 mb-2 flex items-center justify-between">
                  <span>نشاط وحضور الموظف في الفترة ({startDate} إلى {endDate})</span>
                  <span className="text-[11px] text-purple-700 font-bold">
                    أيام الحضور: {employeePeriodStats[selectedEmployeeForModal.id]?.presentDays || 0} يوم
                  </span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">ساعات العمل</span>
                    <span className="font-black text-slate-800 font-mono">{employeePeriodStats[selectedEmployeeForModal.id]?.totalWorkHours || 0} س</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">ساعات الإضافي</span>
                    <span className="font-black text-emerald-700 font-mono">+{employeePeriodStats[selectedEmployeeForModal.id]?.totalOvertimeHours || 0} س</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">إجمالي الجزاءات</span>
                    <span className="font-black text-red-600 font-mono">-{employeePeriodStats[selectedEmployeeForModal.id]?.penaltiesAmount || 0} ج.م</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">إجمالي المكافآت</span>
                    <span className="font-black text-teal-700 font-mono">+{employeePeriodStats[selectedEmployeeForModal.id]?.bonusesAmount || 0} ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة ملف الموظف</span>
              </button>

              <button
                onClick={() => setSelectedEmployeeForModal(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
