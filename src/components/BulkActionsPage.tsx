import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Check,
  Fingerprint,
  Gavel,
  Gift,
  Bell,
  RefreshCw,
  X,
  Layers,
  MapPin,
  Building2,
  CheckSquare,
  Square
} from "lucide-react";
import { Employee, HRDepartment, Branch } from "../types";

interface BulkActionsPageProps {
  employees: Employee[];
  departments: HRDepartment[];
  branches: Branch[];
  selectedEmployeeIds: number[];
  setSelectedEmployeeIds: React.Dispatch<React.SetStateAction<number[]>>;
  bulkActionConfig: {
    fingerprint: string;
    penalty: { amount: string; reason: string };
    bonus: { amount: string; title: string };
    hr_summons: { active: boolean; title: string; message: string };
  };
  setBulkActionConfig: React.Dispatch<React.SetStateAction<any>>;
  handleApplyBulkActions: () => Promise<void>;
  bulkActionLoading: boolean;
}

export const BulkActionsPage: React.FC<BulkActionsPageProps> = ({
  employees,
  departments,
  branches,
  selectedEmployeeIds,
  setSelectedEmployeeIds,
  bulkActionConfig,
  setBulkActionConfig,
  handleApplyBulkActions,
  bulkActionLoading,
}) => {
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  // Filter employees for checklist
  const filteredChecklistEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        !empSearch ||
        String(emp.name || "").toLowerCase().includes(empSearch.toLowerCase()) ||
        String(emp.employee_code || "").toLowerCase().includes(empSearch.toLowerCase()) ||
        String(emp.fingerprint_code || "").toLowerCase().includes(empSearch.toLowerCase());
      const matchDept =
        deptFilter === "all" || String(emp.department_id) === deptFilter;
      const matchBranch =
        branchFilter === "all" || String(emp.branch_id) === branchFilter;
      return matchSearch && matchDept && matchBranch;
    });
  }, [employees, empSearch, deptFilter, branchFilter]);

  const handleToggleSelectEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredChecklistEmployees.map((e) => e.id);
    setSelectedEmployeeIds((prev) => {
      // union of current and filtered
      const union = new Set([...prev, ...filteredIds]);
      return Array.from(union);
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredIds = filteredChecklistEmployees.map((e) => e.id);
    setSelectedEmployeeIds((prev) =>
      prev.filter((id) => !filteredIds.includes(id))
    );
  };

  const handleResetForm = () => {
    setBulkActionConfig({
      fingerprint: "no_change",
      penalty: { amount: "", reason: "" },
      bonus: { amount: "", title: "" },
      hr_summons: {
        active: false,
        title: "🚨 إخطار استدعاء عاجل من الموارد البشرية (HR)",
        message: "يرجى الحضور فوراً إلى مكتب إدارة الموارد البشرية لمراجعة الإدارة.",
      },
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="bulk_actions_page_container">
      {/* Page Header */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-black text-xl text-slate-900 flex items-center gap-2.5">
            <span className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Layers className="w-6 h-6" />
            </span>
            <span>لوحة الإجراءات الجماعية والذكية</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            قم بتحديد مجموعة من الموظفين ثم طبق عليهم عدة قرارات إدارية دفعة واحدة بكل سهولة وتحديث فوري.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="text-xs bg-purple-100 text-purple-800 font-bold px-3 py-1.5 rounded-xl">
            عدد المحددين حالياً: {selectedEmployeeIds.length} موظف
          </span>
          {selectedEmployeeIds.length > 0 && (
            <button
              onClick={() => setSelectedEmployeeIds([])}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
            >
              إلغاء التحديد ❌
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Employee Checklist Selection) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>خطوة 1: اختيار وتحديد الموظفين المستهدفين</span>
            </h3>
          </div>

          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو كود الموظف..."
                value={empSearch ?? ""}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="w-full text-xs pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">القسم</label>
                <select
                  value={deptFilter ?? ""}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="all">كل الأقسام</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">الفرع</label>
                <select
                  value={branchFilter ?? ""}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selection helpers */}
          <div className="flex items-center gap-2 text-xs border-t border-b border-slate-50 py-2">
            <button
              onClick={handleSelectAllFiltered}
              className="flex-1 py-1 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-center font-bold transition-all"
            >
              تحديد كل المعروض ({filteredChecklistEmployees.length})
            </button>
            <button
              onClick={handleDeselectAllFiltered}
              className="flex-1 py-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-center font-bold transition-all"
            >
              إلغاء تحديد المعروض
            </button>
          </div>

          {/* Employees Checklist Scroll Area */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/60 pr-1">
            {filteredChecklistEmployees.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                لا توجد نتائج مطابقة لبحثك أو شروط الفلترة الحالية.
              </div>
            ) : (
              filteredChecklistEmployees.map((emp) => {
                const isSelected = selectedEmployeeIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleToggleSelectEmployee(emp.id)}
                    className={`flex items-center justify-between p-2.5 cursor-pointer rounded-xl transition-all ${
                      isSelected
                        ? "bg-purple-50/50 hover:bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-purple-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                          <span>{emp.name}</span>
                          {emp.employee_code && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                              {emp.employee_code}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {emp.department_name || "غير محدد"}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {emp.branch_name || "غير محدد"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          (emp.status || "active") === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : emp.status === "on_leave"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {(emp.status || "active") === "active"
                          ? "نشط"
                          : emp.status === "on_leave"
                          ? "إجازة"
                          : "موقوف"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Bulk Action Parameters & Submission) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-purple-600" />
                <span>خطوة 2: الإجراءات الجماعية المطلوب تطبيقها دفعة واحدة</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Action 1: Fingerprint (إيقاف أو تفعيل البصمة) */}
              <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-teal-800 font-extrabold text-xs">
                  <Fingerprint className="w-4 h-4 text-teal-600" />
                  <span>تحكم البصمة الجماعي</span>
                </div>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk_page_fingerprint"
                      checked={bulkActionConfig.fingerprint === "no_change"}
                      onChange={() =>
                        setBulkActionConfig((prev: any) => ({
                          ...prev,
                          fingerprint: "no_change",
                        }))
                      }
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>لا تغيير</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-emerald-600 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk_page_fingerprint"
                      checked={bulkActionConfig.fingerprint === "active"}
                      onChange={() =>
                        setBulkActionConfig((prev: any) => ({
                          ...prev,
                          fingerprint: "active",
                        }))
                      }
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>🟢 تشغيل البصمة</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-rose-600 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk_page_fingerprint"
                      checked={bulkActionConfig.fingerprint === "suspended"}
                      onChange={() =>
                        setBulkActionConfig((prev: any) => ({
                          ...prev,
                          fingerprint: "suspended",
                        }))
                      }
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>🔴 إيقاف البصمة</span>
                  </label>
                </div>
              </div>

              {/* Action 2: Penalty (إضافة جزاء مالي) */}
              <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs">
                  <Gavel className="w-4 h-4 text-rose-600" />
                  <span>خصم / جزاء مالي جماعي</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="المبلغ (ج.م)"
                    value={bulkActionConfig.penalty.amount ?? ""}
                    onChange={(e) =>
                      setBulkActionConfig((prev: any) => ({
                        ...prev,
                        penalty: { ...prev.penalty, amount: e.target.value },
                      }))
                    }
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="سبب الخصم..."
                    value={bulkActionConfig.penalty.reason ?? ""}
                    onChange={(e) =>
                      setBulkActionConfig((prev: any) => ({
                        ...prev,
                        penalty: { ...prev.penalty, reason: e.target.value },
                      }))
                    }
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Action 3: Bonus (إضافة مكافأة جماعية) */}
              <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <span>مكافأة جماعية</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="المبلغ (ج.م)"
                    value={bulkActionConfig.bonus.amount ?? ""}
                    onChange={(e) =>
                      setBulkActionConfig((prev: any) => ({
                        ...prev,
                        bonus: { ...prev.bonus, amount: e.target.value },
                      }))
                    }
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="سبب أو مسمى المكافأة..."
                    value={bulkActionConfig.bonus.title ?? ""}
                    onChange={(e) =>
                      setBulkActionConfig((prev: any) => ({
                        ...prev,
                        bonus: { ...prev.bonus, title: e.target.value },
                      }))
                    }
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Action 4: HR Summons Notification */}
              <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5">
                  <div className="flex items-center gap-2 text-indigo-800 font-extrabold text-xs">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <span>إخطار استدعاء للـ HR 📱</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkActionConfig.hr_summons.active}
                      onChange={(e) =>
                        setBulkActionConfig((prev: any) => ({
                          ...prev,
                          hr_summons: {
                            ...prev.hr_summons,
                            active: e.target.checked,
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                {bulkActionConfig.hr_summons.active ? (
                  <div className="space-y-1.5 animate-fadeIn">
                    <input
                      type="text"
                      value={bulkActionConfig.hr_summons.title ?? ""}
                      onChange={(e) =>
                        setBulkActionConfig((prev: any) => ({
                          ...prev,
                          hr_summons: {
                            ...prev.hr_summons,
                            title: e.target.value,
                          },
                        }))
                      }
                      className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 font-bold outline-none"
                      placeholder="عنوان الإخطار..."
                    />
                    <textarea
                      rows={2}
                      value={bulkActionConfig.hr_summons.message ?? ""}
                      onChange={(e) =>
                        setBulkActionConfig((prev: any) => ({
                          ...prev,
                          hr_summons: {
                            ...prev.hr_summons,
                            message: e.target.value,
                          },
                        }))
                      }
                      className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 outline-none"
                      placeholder="محتوى رسالة الاستدعاء على أبليكيشن الموبايل للموظفين..."
                    />
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    فعل التبديل لإرسال تنبيه فوري واستدعاء الموظفين المحددين على تطبيق الهاتف.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions Area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <button
                onClick={handleResetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2 px-3"
              >
                إعادة تعيين القرارات 🔄
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleApplyBulkActions}
                  disabled={bulkActionLoading}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl transition-all font-black text-xs shadow-md shadow-purple-600/10 flex items-center justify-center gap-2"
                >
                  {bulkActionLoading ? (
                    <>
                      <RefreshCw className="animate-spin w-4 h-4" />
                      <span>جاري معالجة وتطبيق القرارات الجماعية...</span>
                    </>
                  ) : (
                    <>
                      <span>تطبيق جميع القرارات على ({selectedEmployeeIds.length}) موظف ⚡</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
