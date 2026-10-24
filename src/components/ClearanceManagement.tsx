import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  FileCheck,
  Printer,
  Search,
  Download,
  UserX,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  Package,
  FileText,
  RefreshCw,
  Plus,
  X,
  ShieldAlert,
  Key,
  BadgeCheck,
  Building,
  User,
  Info,
  Check,
  ArrowRight,
  Filter
} from "lucide-react";
import { api } from "../utils/api";

const exportToExcel = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "إخلاء الطرف");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

interface Employee {
  id: number;
  name: string;
  employee_code?: string;
  fingerprint_code?: string;
  job_title?: string;
  department_id?: number;
  branch_id?: number;
  hire_date?: string;
  status?: string;
  national_id?: string;
}

interface HRDepartment {
  id: number;
  name: string;
}

interface Branch {
  id: number;
  name: string;
}

interface ClearanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  department_id?: number;
  branch_id?: number;
  action: "clearance" | "reactivation";
  date: string;
  reason: string;
  financial_status: string;
  handover_status: string;
  notes: string;
  created_at?: string;
}

interface CustodyItem {
  id: number;
  employee_id: number;
  asset_name: string;
  serial_number?: string;
  received_date?: string;
  status: string;
  replacement_cost?: number;
  notes?: string;
}

interface ClearanceManagementProps {
  employees: Employee[];
  departments: HRDepartment[];
  branches: Branch[];
  onRefresh?: () => void;
}

export const ClearanceManagement: React.FC<ClearanceManagementProps> = ({
  employees,
  departments,
  branches,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"new" | "records" | "custody_tracker">("new");
  
  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [empSearchQuery, setEmpSearchQuery] = useState<string>("");
  const [showEmpDropdown, setShowEmpDropdown] = useState<boolean>(false);
  
  const [clearanceDate, setClearanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState<string>("استقالة برغبة الموظف");
  const [customReason, setCustomReason] = useState<string>("");
  const [handoverStatus, setHandoverStatus] = useState<string>("تم تسليم العهدة بالكامل وبدون خسائر");
  const [financialStatus, setFinancialStatus] = useState<string>("تم تسوية وتصفية المستحقات المالية بالكامل");
  const [notes, setNotes] = useState<string>("");
  const [autoSettleCustody, setAutoSettleCustody] = useState<boolean>(true);
  
  // Checklist / Approval States for enterprise workflow
  const [hrCheck, setHrCheck] = useState<boolean>(true);
  const [financeCheck, setFinanceCheck] = useState<boolean>(true);
  const [custodyCheck, setCustodyCheck] = useState<boolean>(true);
  const [accessCheck, setAccessCheck] = useState<boolean>(true);
  const [managerCheck, setManagerCheck] = useState<boolean>(true);

  // Selected Employee Active Custody Items
  const [activeCustody, setActiveCustody] = useState<CustodyItem[]>([]);
  const [loadingCustody, setLoadingCustody] = useState<boolean>(false);

  // Clearance Records State
  const [clearanceRecords, setClearanceRecords] = useState<ClearanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);

  // Search & Filter for Records
  const [searchRecordText, setSearchRecordText] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  // Printable Document Modal
  const [printModalRecord, setPrintModalRecord] = useState<{
    record: ClearanceRecord | null;
    empDetails?: Employee | null;
    custodyItems?: CustodyItem[];
  } | null>(null);

  // Status Alerts
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Reactivate Modal State
  const [reactivateEmp, setReactivateEmp] = useState<ClearanceRecord | null>(null);
  const [reactivateReason, setReactivateReason] = useState<string>("إعادة تفعيل الموظف مباشرة برغبة الإدارة");
  const [isReactivating, setIsReactivating] = useState<boolean>(false);

  // Fetch clearance records
  const fetchClearanceRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get("/api/hr/clearance-records");
      const data = await res.json();
      setClearanceRecords(data || []);
    } catch (err) {
      console.error("Failed to load clearance records", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchClearanceRecords();
  }, []);

  // Whenever employee is selected, fetch their active custody
  useEffect(() => {
    if (!selectedEmpId) {
      setActiveCustody([]);
      return;
    }
    const empIdNum = Number(selectedEmpId);
    if (isNaN(empIdNum)) return;

    setLoadingCustody(true);
    api
      .get(`/api/hr/custody?employee_id=${empIdNum}`)
      .then(async (res) => {
        const data = await res.json();
        const items: CustodyItem[] = data || [];
        const activeOnly = items.filter(
          (i) => i.status === "handed_over" || i.status === "issued"
        );
        setActiveCustody(activeOnly);
      })
      .catch((err) => {
        console.error("Failed to fetch employee custody", err);
      })
      .finally(() => {
        setLoadingCustody(false);
      });
  }, [selectedEmpId]);

  const selectedEmployee = employees.find(
    (e) => e.id.toString() === selectedEmpId
  );

  const getDeptName = (deptId?: number) => {
    if (!deptId) return "غير محدد";
    const d = departments.find((dp) => dp.id === deptId);
    return d ? d.name : "القسم الرئيسي";
  };

  const getBranchName = (branchId?: number) => {
    if (!branchId) return "غير محدد";
    const b = branches.find((br) => br.id === branchId);
    return b ? b.name : "الفرع الرئيسي";
  };

  // Submit Clearance
  const handleClearanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedEmpId) {
      setErrorMessage("برجاء اختيار الموظف المراد إجراء إخلاء الطرف له.");
      return;
    }

    const finalReason = reason === "أخرى" ? customReason : reason;
    if (!finalReason.trim()) {
      setErrorMessage("يرجى تحديد سبب إخلاء الطرف.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/hr/employees/${selectedEmpId}/clearance`, {
        date: clearanceDate,
        reason: finalReason,
        financial_status: financialStatus,
        handover_status: handoverStatus,
        notes: notes || `تم إجراء إخلاء طرف رسمي واعتماده من الأقسام.`,
        settle_custody: autoSettleCustody
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        setSuccessMessage(data.message || "تم تسجيل وتأكيد إخلاء الطرف بنجاح!");
        fetchClearanceRecords();
        if (onRefresh) onRefresh();

        // Show print certificate modal preview for newly cleared employee
        const emp = employees.find((e) => e.id.toString() === selectedEmpId);
        setPrintModalRecord({
          record: {
            id: Date.now(),
            employee_id: Number(selectedEmpId),
            employee_name: emp?.name || "الموظف",
            employee_code: emp?.fingerprint_code || emp?.employee_code || String(selectedEmpId),
            department_id: emp?.department_id,
            branch_id: emp?.branch_id,
            action: "clearance",
            date: clearanceDate,
            reason: finalReason,
            financial_status: financialStatus,
            handover_status: handoverStatus,
            notes: notes || "إخلاء طرف رسمي ومعتمد",
            created_at: new Date().toISOString()
          },
          empDetails: emp,
          custodyItems: activeCustody
        });

        // Reset Form
        setSelectedEmpId("");
        setEmpSearchQuery("");
        setNotes("");
        setActiveCustody([]);
      } else {
        setErrorMessage(data?.error || "حدث خطأ أثناء إجراء إخلاء الطرف.");
      }
    } catch (err: any) {
      console.error("Clearance submit error:", err);
      const errMsg = err.message || "تعذر إكمال عملية إخلاء الطرف";
      setErrorMessage(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reactivate Employee
  const handleReactivateSubmit = async () => {
    if (!reactivateEmp) return;
    setIsReactivating(true);
    try {
      const res = await api.post(`/api/hr/employees/${reactivateEmp.employee_id}/reactivate`, {
        date: new Date().toISOString().split("T")[0],
        reason: reactivateReason,
        notes: "تمت إعادة تفعيل الموظف عبر المنظومة المؤسسية"
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        setSuccessMessage("تمت إعادة تفعيل الموظف بنجاح وحذف قرار الإخلاء من قائمته الفعالة.");
        setReactivateEmp(null);
        fetchClearanceRecords();
        if (onRefresh) onRefresh();
      } else {
        alert(data?.error || "فشل إعادة التفعيل");
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء إعادة التفعيل");
    } finally {
      setIsReactivating(false);
    }
  };

  // Filtered clearance records
  const filteredRecords = clearanceRecords.filter((rec) => {
    const query = searchRecordText.toLowerCase();
    const matchSearch =
      !query ||
      String(rec.employee_name || "").toLowerCase().includes(query) ||
      String(rec.employee_code || "").toLowerCase().includes(query) ||
      (rec.reason && String(rec.reason).toLowerCase().includes(query)) ||
      (rec.notes && String(rec.notes).toLowerCase().includes(query));

    const matchDept = deptFilter === "all" || rec.department_id?.toString() === deptFilter;
    const matchBranch = branchFilter === "all" || rec.branch_id?.toString() === branchFilter;
    const matchAction = actionFilter === "all" || rec.action === actionFilter;

    return matchSearch && matchDept && matchBranch && matchAction;
  });

  // Calculate Metrics
  const totalClearances = clearanceRecords.filter((r) => r.action === "clearance").length;
  const totalReactivations = clearanceRecords.filter((r) => r.action === "reactivation").length;
  const terminatedEmployeesCount = employees.filter((e) => e.status === "terminated").length;

  // Export to Excel handler
  const handleExportExcel = () => {
    const dataToExport = filteredRecords.map((rec) => ({
      "اسم الموظف": rec.employee_name,
      "كود الموظف": rec.employee_code,
      "نوع الحركة": rec.action === "clearance" ? "إخلاء طرف" : "إعادة تفعيل",
      "التاريخ": rec.date,
      "السبب": rec.reason,
      "موقف العهدة": rec.handover_status,
      "الموقف المالي": rec.financial_status,
      "القسم": getDeptName(rec.department_id),
      "الفرع": getBranchName(rec.branch_id),
      "الملاحظات": rec.notes
    }));
    exportToExcel(dataToExport, `سجل_إخلاء_الطرف_المؤسسي_${new Date().toISOString().split("T")[0]}`);
  };

  return (
    <div className="space-y-6 font-sans text-right dir-rtl animate-fadeIn pb-12" dir="rtl">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center justify-center pl-8">
          <BadgeCheck className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                الإصدار المؤسسي المعتمد
              </span>
              <span className="bg-slate-700/50 text-slate-300 text-xs px-2.5 py-1 rounded-full font-mono">
                HR-CLEARANCE-v3.0
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              مركز إدارة إخلاء الطرف والمخالصة النهائية
            </h2>
            <p className="text-slate-300 text-xs md:text-sm max-w-3xl leading-relaxed">
              منظومة إشراف واعتماد متكاملة لإنهاء الخدمة وتصفية المستحقات المالية والعهد المسلمة وفق المعايير الإدارية والرقابية للشركات والمؤسسات الكبرى.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchClearanceRecords();
                if (onRefresh) onRefresh();
              }}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/60 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer backdrop-blur-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRecords ? "animate-spin" : ""}`} />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-bold block">إجمالي حركات الإخلاء</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{totalClearances}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center flex-shrink-0">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-bold block">الموظفون المخلون (الإنهاء)</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{terminatedEmployeesCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-bold block">حالات إعادة التفعيل</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{totalReactivations}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-bold block">الموظفون النشطون الآن</span>
            <span className="text-2xl font-black text-slate-800 font-mono">
              {employees.filter((e) => e.status !== "terminated").length}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sub-Tab Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("new")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "new"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>طلب وإجراء إخلاء طرف جديد</span>
          </button>

          <button
            onClick={() => setActiveSubTab("records")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "records"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>سجل وأرشيف المخالصات ({clearanceRecords.length})</span>
          </button>
        </div>

        {activeSubTab === "records" && (
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>
        )}
      </div>

      {/* Global Alert Messages */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: NEW CLEARANCE FORM */}
      {activeSubTab === "new" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <UserX className="w-5 h-5 text-red-600" />
                    تفاصيل وثيقة المخالصة وإخلاء الطرف الرسمية
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    قم باختيار الموظف ومراجعة موقف العهد والمالية قبل إتمام الاعتماد النهائي.
                  </p>
                </div>
                <span className="bg-red-50 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-100">
                  إجراء حساس وسري
                </span>
              </div>

              <form onSubmit={handleClearanceSubmit} className="space-y-6">
                {/* 1. Employee Search & Selection */}
                <div className="space-y-2 relative">
                  <label className="text-xs font-extrabold text-slate-700 block">
                    اختيار الموظف المراد إخلاء طرفه *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، كود الموظف، أو كود البصمة..."
                      value={empSearchQuery ?? ""}
                      onChange={(e) => {
                        setEmpSearchQuery(e.target.value);
                        setShowEmpDropdown(true);
                      }}
                      onFocus={() => setShowEmpDropdown(true)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
                    />
                    <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                  </div>

                  {showEmpDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowEmpDropdown(false)} />
                      <div className="absolute z-40 right-0 left-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl divide-y divide-slate-100">
                        {employees
                          .filter((emp) => emp.status !== "terminated")
                          .filter((emp) => {
                            const q = empSearchQuery.toLowerCase();
                            return (
                              !q ||
                              String(emp.name || "").toLowerCase().includes(q) ||
                              String(emp.fingerprint_code || "").toLowerCase().includes(q) ||
                              String(emp.employee_code || "").toLowerCase().includes(q)
                            );
                          })
                          .map((emp) => (
                            <div
                              key={emp.id}
                              onClick={() => {
                                setSelectedEmpId(emp.id.toString());
                                setEmpSearchQuery(`${emp.name} (كود: ${emp.fingerprint_code || emp.id})`);
                                setShowEmpDropdown(false);
                              }}
                              className="p-3.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs font-bold transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-mono text-xs">
                                  {emp.name.charAt(0)}
                                </div>
                                <div>
                                  <span className="text-slate-900 block font-black">{emp.name}</span>
                                  <span className="text-slate-400 text-[11px] font-normal">
                                    {emp.job_title || "موظف"} • {getDeptName(emp.department_id)}
                                  </span>
                                </div>
                              </div>
                              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-mono text-[11px]">
                                كود: #{emp.fingerprint_code || emp.employee_code || emp.id}
                              </span>
                            </div>
                          ))}

                        {employees.filter((e) => e.status !== "terminated").length === 0 && (
                          <div className="p-4 text-center text-slate-400 text-xs">
                            لا يوجد موظفون نشطون مطايقون للبحث.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Selected Employee Profile Card */}
                {selectedEmployee && (
                  <div className="bg-gradient-to-r from-slate-50 to-amber-50/40 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center text-base font-mono shadow-sm">
                          {selectedEmployee.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{selectedEmployee.name}</h4>
                          <p className="text-xs text-slate-500 font-medium">
                            {selectedEmployee.job_title || "مسمى غير محدد"} • {getDeptName(selectedEmployee.department_id)} • {getBranchName(selectedEmployee.branch_id)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1 rounded-xl font-mono font-bold shadow-2xs">
                          كود البصمة: #{selectedEmployee.fingerprint_code || selectedEmployee.id}
                        </span>
                      </div>
                    </div>

                    {/* Active Custody Alert Inside Profile */}
                    <div className="pt-1">
                      {loadingCustody ? (
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري فحص العهد المسجلة باسم الموظف...</span>
                        </div>
                      ) : activeCustody.length > 0 ? (
                        <div className="bg-amber-100/80 border border-amber-300 text-amber-900 p-3 rounded-xl text-xs font-bold space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-amber-950 font-black">
                              <Package className="w-4 h-4 text-amber-700" />
                              تنبيه: يوجد لدى الموظف ({activeCustody.length}) عهدة نشطة حالياً!
                            </span>
                            <span className="bg-amber-200/70 text-amber-900 text-[10px] px-2 py-0.5 rounded-full">
                              يلزم التصفية
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {activeCustody.map((item) => (
                              <span
                                key={item.id}
                                className="bg-white text-slate-800 border border-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1"
                              >
                                📦 {item.asset_name} {item.serial_number ? `(${item.serial_number})` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>لا توجد أي عهدة مفتوحة مسجلة على هذا الموظف.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Enterprise Department Approval Matrix Checklist */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      مصفوفة توثيق واعتمادات الأقسام المؤسسية (Approval Workflow)
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold">تحديد الاعتمادات المكتملة</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <label className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                      hrCheck ? "bg-white border-emerald-300 text-slate-800 shadow-2xs" : "bg-slate-100 border-slate-200 text-slate-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={hrCheck}
                        onChange={(e) => setHrCheck(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold block text-slate-900">1. اعتماد الموارد البشرية (HR)</span>
                        <span className="text-[11px] text-slate-500 font-normal">إنهاء العقد، توثيق سبب المغادرة ورسالة الموظف</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                      financeCheck ? "bg-white border-emerald-300 text-slate-800 shadow-2xs" : "bg-slate-100 border-slate-200 text-slate-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={financeCheck}
                        onChange={(e) => setFinanceCheck(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold block text-slate-900">2. اعتماد الإدارة المالية (Finance)</span>
                        <span className="text-[11px] text-slate-500 font-normal">تصفية الرواتب، السلف المسحوبة والخصومات</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                      custodyCheck ? "bg-white border-emerald-300 text-slate-800 shadow-2xs" : "bg-slate-100 border-slate-200 text-slate-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={custodyCheck}
                        onChange={(e) => setCustodyCheck(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold block text-slate-900">3. إدارة العهد والأصول (Custody)</span>
                        <span className="text-[11px] text-slate-500 font-normal">استلام الأجهزة، أدوات العمل، والسيارات</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                      accessCheck ? "bg-white border-emerald-300 text-slate-800 shadow-2xs" : "bg-slate-100 border-slate-200 text-slate-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={accessCheck}
                        onChange={(e) => setAccessCheck(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold block text-slate-900">4. إدارة الأمن والبصمة (Security)</span>
                        <span className="text-[11px] text-slate-500 font-normal">تعطيل بصمة الموظف وسحب كروت الدخول</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 4. Dates & Reasons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">تاريخ إخلاء الطرف المعتمد *</label>
                    <input
                      type="date"
                      required
                      value={clearanceDate ?? ""}
                      onChange={(e) => setClearanceDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">سبب إخلاء الطرف *</label>
                    <select
                      required
                      value={reason ?? ""}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    >
                      <option value="استقالة برغبة الموظف">استقالة برغبة الموظف الشخصية</option>
                      <option value="إنهاء العقد من قبل المنشأة">إنهاء العقد من طرف المنشأة</option>
                      <option value="عدم تجديد العقد">انتهاء مدة العقد وعدم التجديد</option>
                      <option value="فصل تأديبي بموجب اللائحة">فصل تأديبي وفق لائحة العمل</option>
                      <option value="بلوغ سن التقاعد (المعاش)">بلوغ سن التقاعد القانوني</option>
                      <option value="أخرى">سبب آخر (تحديد متقدم)</option>
                    </select>
                  </div>
                </div>

                {reason === "أخرى" && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-xs font-bold text-slate-700 block">اكتب سبب إخلاء الطرف بالتفصيل *</label>
                    <input
                      type="text"
                      required
                      placeholder="اكتب السبب الإداري لإنهاء الخدمة..."
                      value={customReason ?? ""}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>
                )}

                {/* 5. Handover & Financial Status Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">موقف تسليم العهد والأصول *</label>
                    <select
                      required
                      value={handoverStatus ?? ""}
                      onChange={(e) => setHandoverStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    >
                      <option value="تم تسليم العهدة بالكامل وبدون خسائر">تم تسليم كافة العهد بالكامل وبحالة سليمة</option>
                      <option value="معلق جزئياً (في انتظار التسليم النهائي)">معلق جزئياً (تصفية معلقة)</option>
                      <option value="لا توجد عهدة مسجلة على الموظف">لا توجد عهدة مسجلة على الموظف أصلاً</option>
                      <option value="تلف/فقدان عهدة مع التسويه المالية">تلف أو فقدان عهدة مع إجراء الخصم المالي</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">الموقف المالي والمستحقات *</label>
                    <select
                      required
                      value={financialStatus ?? ""}
                      onChange={(e) => setFinancialStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    >
                      <option value="تم تسوية وتصفية المستحقات المالية بالكامل">تم تسوية وتصفية المستحقات والسلف بالكامل</option>
                      <option value="خاضع للتصفية والمراجعة اللاحقة">خاضع للتصفية الميدانية والمالية لاحقاً</option>
                      <option value="لا توجد أي مستحقات مالية">لا توجد مستحقات مالية متبقية</option>
                    </select>
                  </div>
                </div>

                {/* 6. Auto-Settle Custody Checkbox */}
                {activeCustody.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Package className="w-5 h-5 text-amber-700 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-black text-amber-950 block">التصفية التلقائية للعهدة</span>
                        <span className="text-[11px] text-amber-800">
                          تحويل العهد المفتوحة إلى حالة "مستردة" وإعادتها لمستودع العهد تلقائياً.
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSettleCustody}
                        onChange={(e) => setAutoSettleCustody(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                )}

                {/* 7. Additional Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">ملاحظات المخالصة والتوثيق المالي والإداري</label>
                  <textarea
                    rows={3}
                    placeholder="اكتب أي ملاحظات خاصة بخصومات السلف، مستحقات نهاية الخدمة، أو تفاصيل التسليم..."
                    value={notes ?? ""}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>

                {/* 8. Action Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedEmpId}
                  className={`w-full py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    isSubmitting || !selectedEmpId
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                      : "bg-red-700 hover:bg-red-800 shadow-red-700/20 active:scale-[0.99]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>جاري معالجة الاعتماد وتحديث قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="w-5 h-5" />
                      <span>اعتماد إخلاء الطرف وتصفية الموظف رسمياً</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Helper Sidebar & Regulatory Guidelines */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm border-b border-slate-800 pb-3">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>الضوابط والتبعات التنظيمية المترتبة</span>
              </div>

              <ul className="text-xs text-slate-300 space-y-3 leading-relaxed list-disc list-inside pr-1">
                <li>
                  <strong>حظر البصمة الفوري:</strong> يتم إيقاف وتجميد كود البصمة الخاص بالموظف تلقائياً لمنع تسجيل أي حركات حضور جديدة.
                </li>
                <li>
                  <strong>إغلاق الحساب والمستندات:</strong> يتم قفل أي حساب مستخدم مرتبط بالموظف وأرشفة ملفه بالكامل.
                </li>
                <li>
                  <strong>الأرشفة الدائمة:</strong> يتم حفظ المخالصة كأرشيف رسمي يمكن الرجوع إليه واستخراج وثيقة الإخلاء في أي وقت.
                </li>
                <li>
                  <strong>إمكانية إعادة التفعيل:</strong> توفر المنظومة خيار "إعادة تفعيل الموظف" لاحقاً إذا رغبت المنشأة في إعادة تعيينه.
                </li>
              </ul>
            </div>

            {/* Quick Stats Summary */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building className="w-4 h-4 text-slate-600" />
                تفاصيل الهيكلية الإدارية
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي الأقسام:</span>
                  <span className="font-bold text-slate-900">{departments.length} أقسام</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>الفروع المسجلة:</span>
                  <span className="font-bold text-slate-900">{branches.length} فروع</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CLEARANCE RECORDS ARCHIVE */}
      {activeSubTab === "records" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Search & Filter Controls */}
          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Text Search */}
              <div className="md:col-span-1 space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">البحث بالنص</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم، الكود، السبب..."
                    value={searchRecordText ?? ""}
                    onChange={(e) => setSearchRecordText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 pr-9 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              {/* Department Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">فلترة بالقسم</label>
                <select
                  value={deptFilter ?? ""}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="all">كل الأقسام</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id.toString()}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">فلترة بالفرع</label>
                <select
                  value={branchFilter ?? ""}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id.toString()}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">نوع الحركة</label>
                <select
                  value={actionFilter ?? ""}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="all">جميع الحركات</option>
                  <option value="clearance">إخلاء طرف فقط</option>
                  <option value="reactivation">إعادة تفعيل فقط</option>
                </select>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <th className="p-4">اسم الموظف</th>
                    <th className="p-4">كود الموظف</th>
                    <th className="p-4">نوع الحركة</th>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">القسم والفرع</th>
                    <th className="p-4">السبب والمعالجة</th>
                    <th className="p-4">موقف العهدة والمالية</th>
                    <th className="p-4 text-center">الإجراءات والطباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loadingRecords ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>جاري تحميل أراشيف وسجلات إخلاء الطرف...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد سجلات إخلاء طرف مطابقة للفلاتر المختارة.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => {
                      const empDetails = employees.find((e) => e.id === rec.employee_id);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <span className="font-black text-slate-900 block text-sm">{rec.employee_name}</span>
                            <span className="text-[11px] text-slate-400">معرّف الموظف: #{rec.employee_id}</span>
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg font-mono font-bold text-[11px]">
                              #{rec.employee_code || rec.employee_id}
                            </span>
                          </td>
                          <td className="p-4">
                            {rec.action === "clearance" ? (
                              <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">
                                <UserX className="w-3.5 h-3.5" />
                                إخلاء طرف
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" />
                                إعادة تفعيل
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-800">{rec.date}</td>
                          <td className="p-4 text-slate-600">
                            <div>{getDeptName(rec.department_id)}</div>
                            <div className="text-[11px] text-slate-400">{getBranchName(rec.branch_id)}</div>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-slate-800 block">{rec.reason || "غير محدد"}</span>
                            {rec.notes && (
                              <span className="text-[11px] text-slate-500 line-clamp-1">{rec.notes}</span>
                            )}
                          </td>
                          <td className="p-4 space-y-1">
                            <div className="text-[11px]">
                              <span className="text-slate-400 font-bold">العهدة: </span>
                              <span className="text-slate-800 font-bold">{rec.handover_status || "سليمة"}</span>
                            </div>
                            <div className="text-[11px]">
                              <span className="text-slate-400 font-bold">المالية: </span>
                              <span className="text-slate-800 font-bold">{rec.financial_status || "مصفاة"}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Print Official Certificate */}
                              <button
                                onClick={() => {
                                  setPrintModalRecord({
                                    record: rec,
                                    empDetails: empDetails || null
                                  });
                                }}
                                title="معاينة وطباعة الشهادة الرسمية"
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>النموذج الرسمي</span>
                              </button>

                              {/* Reactivate Employee */}
                              {rec.action === "clearance" && (
                                <button
                                  onClick={() => setReactivateEmp(rec)}
                                  title="إعادة تفعيل الموظف"
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>تفعيل</span>
                                </button>
                              )}
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

      {/* REACTIVATE EMPLOYEE MODAL */}
      {reactivateEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                إعادة تفعيل الموظف المخلي
              </h3>
              <button onClick={() => setReactivateEmp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 font-bold space-y-1">
              <span className="block font-black">الموظف: {reactivateEmp.employee_name}</span>
              <span className="block text-[11px]">كود البصمة: #{reactivateEmp.employee_code}</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">سبب إعادة التفعيل الإداري *</label>
              <textarea
                rows={3}
                value={reactivateReason ?? ""}
                onChange={(e) => setReactivateReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReactivateSubmit}
                disabled={isReactivating}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                {isReactivating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأكيد إعادة التفعيل وتفعيل البصمة</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setReactivateEmp(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE OFFICIAL CLEARANCE CERTIFICATE MODAL */}
      {printModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 space-y-6 my-8 animate-scaleUp relative font-sans text-right dir-rtl" dir="rtl">
            {/* Modal Controls Top Bar */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-700" />
                <span className="text-sm font-black text-slate-900">معاينة وثيقة إخلاء الطرف الرسمية</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الوثيقة الرسمية (A4)</span>
                </button>
                <button
                  onClick={() => setPrintModalRecord(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet Content */}
            <div id="printable-clearance-certificate" className="space-y-6 p-6 border-2 border-slate-800 rounded-2xl bg-white text-slate-900">
              {/* Certificate Header */}
              <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4">
                <div className="space-y-1">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">إقرار ونموذج إخلاء طرف رسمي</h1>
                  <p className="text-xs font-bold text-slate-600">منظومة إدارة الموارد البشرية والشؤون الإدارية</p>
                </div>
                <div className="text-left font-mono text-xs text-slate-600 border-r-2 border-slate-800 pr-4">
                  <div>Ref No: <span className="font-bold text-slate-900">CLR-{printModalRecord.record?.id}</span></div>
                  <div>Date: <span className="font-bold text-slate-900">{printModalRecord.record?.date}</span></div>
                </div>
              </div>

              {/* Employee Personal Details Grid */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-700" />
                  أولاً: البيانات الأساسية للموظف
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">اسم الموظف الرباعي:</span>
                    <span className="font-black text-slate-900">{printModalRecord.record?.employee_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">كود الموظف / البصمة:</span>
                    <span className="font-bold font-mono text-slate-900">#{printModalRecord.record?.employee_code}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">المسمى الوظيفي:</span>
                    <span className="font-bold text-slate-900">{printModalRecord.empDetails?.job_title || "موظف"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">القسم الإداري:</span>
                    <span className="font-bold text-slate-900">{getDeptName(printModalRecord.record?.department_id)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">الفرع / الموقع:</span>
                    <span className="font-bold text-slate-900">{getBranchName(printModalRecord.record?.branch_id)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">سبب إنهاء الخدمة:</span>
                    <span className="font-bold text-slate-900">{printModalRecord.record?.reason}</span>
                  </div>
                </div>
              </div>

              {/* Clearance Status Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  ثانياً: موقف تصفية العهد والمستحقات المالي
                </h3>
                <table className="w-full text-right border border-slate-300 text-xs rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 border-l border-slate-300">البند / الممارسات</th>
                      <th className="p-2.5 border-l border-slate-300">الحالة المعتمدة</th>
                      <th className="p-2.5">البيان والملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-bold border-l border-slate-300">تسليم العهد والأجهزة</td>
                      <td className="p-2.5 font-bold text-emerald-800 border-l border-slate-300">{printModalRecord.record?.handover_status}</td>
                      <td className="p-2.5 text-slate-600">تم الفحص الميداني للعهد المسجلة واستردادها</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold border-l border-slate-300">المستحقات المالية والسلف</td>
                      <td className="p-2.5 font-bold text-emerald-800 border-l border-slate-300">{printModalRecord.record?.financial_status}</td>
                      <td className="p-2.5 text-slate-600">تمت التسوية وتصفية الحساب المالي بالكامل</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold border-l border-slate-300">صلاحية البصمة والدخول</td>
                      <td className="p-2.5 font-bold text-red-700 border-l border-slate-300">ملغاة ومحظورة</td>
                      <td className="p-2.5 text-slate-600">تم تعطيل كود البصمة من أجهزة الحضور والأنظمة</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Official Legal Declaration Text */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-xs leading-relaxed space-y-1 text-slate-800">
                <span className="font-black block text-slate-900">ثالثاً: إقرار وتعهد الموظف بالمخالصة النهائية:</span>
                <p className="text-slate-700">
                  "أقر أنا الموظف المذكور أعلاه بأنني قد استلمت كافة مستحقاتي المالية ورواتبي وبدلاتي عن فترة عملي بالكامل، وقد تم تسليم كافة العهد والأجهزة والوثائق التي بحوزتي الخاصة بالشركة، وأصبح ذمتي مالياً وإدارياً مخلية تجاه المنشأة اعتباراً من هذا التاريخ."
                </p>
              </div>

              {/* Signatures & Stamps Table */}
              <div className="pt-4 border-t-2 border-slate-800">
                <div className="grid grid-cols-4 gap-4 text-center text-[11px] font-bold text-slate-800">
                  <div className="space-y-8">
                    <span>توقيع الموظف</span>
                    <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                  </div>
                  <div className="space-y-8">
                    <span>مدير الموارد البشرية</span>
                    <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                  </div>
                  <div className="space-y-8">
                    <span>المدير المالي</span>
                    <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                  </div>
                  <div className="space-y-8">
                    <span>ختم المنشأة الرسمي</span>
                    <div className="w-16 h-16 border-2 border-slate-300 rounded-full mx-auto flex items-center justify-center text-[9px] text-slate-400 font-mono">
                      STAMP
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
