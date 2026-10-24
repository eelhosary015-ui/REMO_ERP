import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, Users, Calendar, Clock, DollarSign, Activity, 
  Printer, User, Building, ShieldCheck, Download, Filter 
} from "lucide-react";
import { Employee, HRDepartment, Branch, HRShift } from "../types";
import { databaseStorage } from "../utils/databaseStorage";
import { api } from "../utils/api";
import { MultiEmployeeSearchFilter } from "./MultiEmployeeSearchFilter";

interface Props {
  employees: Employee[];
  departments: HRDepartment[];
  branches: Branch[];
  shifts: HRShift[];
  evaluations: any[];
}

export const HRComprehensiveReport: React.FC<Props> = ({
  employees,
  departments,
  branches,
  shifts,
  evaluations
}) => {
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(["all"]);
  const [searchQueryText, setSearchQueryText] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [penaltiesData, setPenaltiesData] = useState<any[]>([]);
  const [custodies, setCustodies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Compute active filtered employees list
  const isAllSelected = selectedEmpIds.length === 0 || selectedEmpIds.includes("all");
  
  const targetEmployees = employees.filter((emp) => {
    if (isAllSelected) {
      if (!searchQueryText.trim()) return true;
      const q = searchQueryText.toLowerCase().trim();
      return (
        emp.name.toLowerCase().includes(q) ||
        String(emp.id).toLowerCase().includes(q) ||
        (emp.fingerprint_code && String(emp.fingerprint_code).toLowerCase().includes(q))
      );
    }
    return selectedEmpIds.includes(String(emp.id));
  });

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      // Fetch attendance
      // NOTE: /api/attendance returns a BARE ARRAY (not {data: [...]})
      // so handle both shapes to guarantee fingerprint records always load.
      const attRes = await api.get(`/api/attendance?startDate=${startDate}&endDate=${endDate}`);
      if (attRes.ok) {
        const d = await attRes.json();
        setAttendanceData(Array.isArray(d) ? d : (d?.data || []));
      }

      // Fetch penalties/bonuses
      const penRes = await databaseStorage.getItem<any[]>("remo_pro_award_penalties", []);
      setPenaltiesData(penRes.filter(p => p.date >= startDate && p.date <= endDate));

      // Fetch custody
      const custRes = await databaseStorage.getItem<any[]>("remo_pro_custody_records", []);
      setCustodies(custRes || []);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>التقرير الشامل للموظفين (${targetEmployees.length} موظف)</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; color: #333; }
            h1, h2, h3 { color: #1e40af; }
            .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f3f4f6; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            .bg-emerald { background: #d1fae5; color: #065f46; }
            .bg-rose { background: #ffe4e6; color: #9f1239; }
            .bg-blue { background: #dbeafe; color: #1e40af; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>التقرير الشامل لبيانات وحضور الموظفين</h1>
            <p>من: ${startDate} | إلى: ${endDate} | عدد الموظفين في التقرير: ${targetEmployees.length}</p>
          </div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          {/* Multi-Employee Search & Selector */}
          <div className="flex-1 w-full">
            <MultiEmployeeSearchFilter
              employees={employees}
              selectedEmployeeIds={selectedEmpIds}
              onSelectionChange={(newIds, query) => {
                setSelectedEmpIds(newIds);
                setSearchQueryText(query || "");
              }}
              label="تحديد الموظفين المشمولين في التقرير (يمكن اختيار أكثر من موظف)"
              placeholder="ابحث بالاسم أو الكود أو أضف أسماء بفاصلة..."
            />
          </div>

          <div className="w-full lg:w-44">
            <label className="block text-xs font-bold text-slate-500 mb-2">من تاريخ</label>
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            />
          </div>

          <div className="w-full lg:w-44">
            <label className="block text-xs font-bold text-slate-500 mb-2">إلى تاريخ</label>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            />
          </div>

          <button
            onClick={handlePrint}
            disabled={targetEmployees.length === 0 || isLoading}
            className="w-full lg:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير ({targetEmployees.length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-10 rounded-3xl flex flex-col items-center justify-center border border-slate-200 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-500 font-bold">جاري معالجة وتجميع تقارير الموظفين...</p>
        </div>
      ) : targetEmployees.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div ref={printRef} className="space-y-10">
            
            {/* Multi-Employee Comparative Summary Table */}
            <div className="card bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  جدول مقارنة ملخص أداء الموظفين المحددين بالبحث ({targetEmployees.length} موظف)
                </h3>
                <span className="text-xs text-slate-500 font-medium">الفترة: من {startDate} إلى {endDate}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">الموظف</th>
                      <th className="p-2.5">الفرع والقسم</th>
                      <th className="p-2.5 text-center bg-emerald-50 text-emerald-900">أيام الحضور</th>
                      <th className="p-2.5 text-center bg-blue-50 text-blue-900">ساعات العمل</th>
                      <th className="p-2.5 text-center bg-indigo-50 text-indigo-900">الإضافي</th>
                      <th className="p-2.5 text-center bg-rose-50 text-rose-900">إجمالي الخصومات</th>
                      <th className="p-2.5 text-center bg-amber-50 text-amber-900">التقييم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {targetEmployees.map((emp, index) => {
                      const empAtt = attendanceData.filter(a => String(a.employee_id) === String(emp.id) || a.employee_name === emp.name);
                      const empPen = penaltiesData.filter(p => String(p.employee_id) === String(emp.id));
                      const empEvalsList = evaluations.filter(e => String(e.employee_id) === String(emp.id));
                      
                      const dept = departments.find(d => d.id === emp.department_id);
                      const branch = branches.find(b => b.id === emp.branch_id);

                      const presentDays = empAtt.length;
                      const workHours = empAtt.reduce((sum, a) => sum + (Number(a.work_hours) || 0), 0).toFixed(1);
                      const overtime = empAtt.reduce((sum, a) => sum + (Number(a.overtime) || 0), 0).toFixed(1);
                      const penTotal = empAtt.reduce((sum, a) => sum + (Number(a.penalty) || 0), 0) + empPen.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                      const avgE = empEvalsList.length > 0 
                        ? (empEvalsList.reduce((s, e) => s + (Number(e.score) || 0), 0) / empEvalsList.length).toFixed(1)
                        : "-";

                      return (
                        <tr key={emp.id} className="hover:bg-white transition-colors">
                          <td className="p-2.5 font-mono text-slate-400">{index + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">
                            {emp.name}
                            <span className="block text-[10px] text-slate-400 font-mono">كود: #{emp.id}</span>
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {branch?.name || "فرع رئيسي"} - {dept?.name || "عام"}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30">{presentDays} يوم</td>
                          <td className="p-2.5 text-center font-mono font-bold text-blue-700 bg-blue-50/30">{workHours} س</td>
                          <td className="p-2.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30">{overtime} س</td>
                          <td className="p-2.5 text-center font-mono font-bold text-rose-700 bg-rose-50/30">{penTotal} ج.م</td>
                          <td className="p-2.5 text-center font-mono font-bold text-amber-700 bg-amber-50/30">{avgE}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Detailed Blocks for Selected Employees */}
            {targetEmployees.map((selectedEmp) => {
              const dept = departments.find(d => d.id === selectedEmp.department_id);
              const branch = branches.find(b => b.id === selectedEmp.branch_id);
              const shift = shifts.find(s => s.id === selectedEmp.shifts?.[0]);
              
              const empAtt = attendanceData.filter(a => String(a.employee_id) === String(selectedEmp.id) || a.employee_name === selectedEmp.name);
              const empPen = penaltiesData.filter(p => String(p.employee_id) === String(selectedEmp.id));
              const empCust = custodies.filter(c => String(c.employee_id) === String(selectedEmp.id));
              const empEvals = evaluations.filter(e => String(e.employee_id) === String(selectedEmp.id));

              const totalPresent = empAtt.length;
              const totalWorkHours = empAtt.reduce((sum, a) => sum + (Number(a.work_hours) || 0), 0).toFixed(1);
              const totalOvertime = empAtt.reduce((sum, a) => sum + (Number(a.overtime) || 0), 0).toFixed(1);
              const totalPenalties = empAtt.reduce((sum, a) => sum + (Number(a.penalty) || 0), 0).toFixed(1);
              const avgEval = empEvals.length > 0 
                ? (empEvals.reduce((s, e) => s + (Number(e.score) || 0), 0) / empEvals.length).toFixed(1) 
                : "غير متوفر";

              return (
                <div key={selectedEmp.id} className="border-t-2 border-slate-200 pt-8 space-y-6">
                  <div className="bg-blue-900 text-white p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold">{selectedEmp.name}</h2>
                      <p className="text-xs text-blue-200 mt-0.5">
                        كود: #{selectedEmp.fingerprint_code || selectedEmp.id} • {selectedEmp.job_title || "موظف"} • {branch?.name || "الفرع الرئيسي"}
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-blue-800 px-3 py-1 rounded-xl font-bold">
                      المرتب الأساسي: {Number(selectedEmp.basic_salary || 0).toLocaleString()} ج.م
                    </span>
                  </div>

                  {/* Personal & Job Info Grid */}
                  <div className="grid-2">
                    <div className="card">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <User className="w-4 h-4 text-blue-600" />
                        البيانات الشخصية والأساسية
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">اسم الموظف:</span>
                          <span className="font-bold text-slate-800">{selectedEmp.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">رقم الهاتف:</span>
                          <span className="font-bold text-slate-800" dir="ltr">{selectedEmp.phone || "غير مسجل"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">الرقم القومي:</span>
                          <span className="font-bold text-slate-800">{selectedEmp.national_id || "غير مسجل"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">تاريخ التعيين:</span>
                          <span className="font-bold text-slate-800">{selectedEmp.hire_date || "غير مسجل"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Building className="w-4 h-4 text-indigo-600" />
                        البيانات الوظيفية
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">المسمى الوظيفي:</span>
                          <span className="font-bold text-slate-800">{selectedEmp.job_title || "غير مسجل"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">القسم:</span>
                          <span className="font-bold text-slate-800">{dept?.name || "غير محدد"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">الفرع:</span>
                          <span className="font-bold text-slate-800">{branch?.name || "غير محدد"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">الوردية:</span>
                          <span className="font-bold text-slate-800">{shift?.name || "غير محدد"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Leave Balances & Consumption Summary */}
                  {(() => {
                    const annualBal = selectedEmp.annual_leave_balance !== undefined && selectedEmp.annual_leave_balance !== null ? Number(selectedEmp.annual_leave_balance) : 21;
                    const sickBal = selectedEmp.sick_leave_balance !== undefined && selectedEmp.sick_leave_balance !== null ? Number(selectedEmp.sick_leave_balance) : 14;
                    const casualBal = selectedEmp.casual_leave_balance !== undefined && selectedEmp.casual_leave_balance !== null ? Number(selectedEmp.casual_leave_balance) : 6;

                    const annualConsumed = Math.max(0, 21 - annualBal);
                    const sickConsumed = Math.max(0, 14 - sickBal);
                    const casualConsumed = Math.max(0, 6 - casualBal);

                    return (
                      <div className="card bg-purple-50/50 p-4 rounded-xl border border-purple-200">
                        <h3 className="text-xs font-bold text-purple-900 mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          تقرير رصيد واستهلاك الإجازات للموظف
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-purple-900">🏖️ الإجازة السنوية</span>
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">الإجمالي: 21 يوم</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                              <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                                <div className="text-[10px] text-amber-700">المستهلك</div>
                                <div className="font-bold text-amber-900">{annualConsumed} يوم</div>
                              </div>
                              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                <div className="text-[10px] text-emerald-700">المتبقي</div>
                                <div className="font-bold text-emerald-900">{annualBal} يوم</div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-purple-900">⚡ الإجازة العارضة</span>
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">الإجمالي: 6 أيام</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                              <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                                <div className="text-[10px] text-amber-700">المستهلك</div>
                                <div className="font-bold text-amber-900">{casualConsumed} يوم</div>
                              </div>
                              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                <div className="text-[10px] text-emerald-700">المتبقي</div>
                                <div className="font-bold text-emerald-900">{casualBal} يوم</div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-purple-900">🏥 الإجازة المرضية</span>
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">الإجمالي: 14 يوم</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                              <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                                <div className="text-[10px] text-amber-700">المستهلك</div>
                                <div className="font-bold text-amber-900">{sickConsumed} يوم</div>
                              </div>
                              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                <div className="text-[10px] text-emerald-700">المتبقي</div>
                                <div className="font-bold text-emerald-900">{sickBal} يوم</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Summary Metrics */}
                  <div className="card bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      إحصائيات الموظف خلال الفترة المحددة
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 mb-0.5">أيام الحضور</div>
                        <div className="text-base font-bold text-slate-800">{totalPresent} يوم</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 mb-0.5">ساعات العمل الفعلية</div>
                        <div className="text-base font-bold text-emerald-600">{totalWorkHours} س</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 mb-0.5">الساعات الإضافية</div>
                        <div className="text-base font-bold text-blue-600">{totalOvertime} س</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 mb-0.5">إجمالي الخصومات</div>
                        <div className="text-base font-bold text-rose-600">{totalPenalties} ج.م</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 mb-0.5">متوسط التقييم</div>
                        <div className="text-base font-bold text-amber-500">{avgEval} / 5</div>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Logs */}
                  <div className="card">
                    <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Clock className="w-4 h-4 text-sky-600" />
                      سجل الحضور والانصراف التفصيلي
                    </h3>
                    {empAtt.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold">
                              <th className="p-2">التاريخ</th>
                              <th className="p-2">وقت الدخول</th>
                              <th className="p-2">وقت الخروج</th>
                              <th className="p-2">ساعات العمل</th>
                              <th className="p-2">إضافي</th>
                              <th className="p-2">تأخير/خصم</th>
                              <th className="p-2">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empAtt.map((att, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-mono">{att.date ? new Date(att.date).toLocaleDateString("en-CA") : ""}</td>
                                <td dir="ltr" className="p-2 text-right font-mono">{att.check_in ? new Date(att.check_in).toLocaleTimeString("en-US", {hour: '2-digit', minute:'2-digit'}) : "-"}</td>
                                <td dir="ltr" className="p-2 text-right font-mono">{att.check_out ? new Date(att.check_out).toLocaleTimeString("en-US", {hour: '2-digit', minute:'2-digit'}) : "-"}</td>
                                <td className="p-2 font-mono">{att.work_hours || 0} س</td>
                                <td className="p-2 font-mono">{att.overtime || 0} س</td>
                                <td className="p-2 font-mono">{att.penalty || 0} ج.م</td>
                                <td className="p-2">
                                  <span className={`badge ${att.status === 'present' ? 'bg-emerald' : 'bg-rose'}`}>
                                    {att.status === 'present' ? 'حاضر' : att.status === 'absent' ? 'غائب' : att.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs text-center py-3">لا توجد سجلات حضور مسجلة لهذا الموظف في هذه الفترة.</p>
                    )}
                  </div>

                  {/* Custody */}
                  {empCust.length > 0 && (
                    <div className="card">
                      <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <ShieldCheck className="w-4 h-4 text-violet-600" />
                        عهد الموظف المسجلة
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold">
                              <th className="p-2">تاريخ التسليم</th>
                              <th className="p-2">اسم العهدة</th>
                              <th className="p-2">القيمة التقديرية</th>
                              <th className="p-2">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empCust.map((c, idx) => (
                              <tr key={idx}>
                                <td className="p-2 font-mono">{c.issue_date}</td>
                                <td className="p-2 font-bold">{c.item_name}</td>
                                <td className="p-2 font-mono">{c.estimated_value || 0} ج.م</td>
                                <td className="p-2">
                                  <span className={`badge ${c.status === 'active' ? 'bg-blue' : 'bg-emerald'}`}>
                                    {c.status === 'active' ? 'بحوزة الموظف' : 'تم الرد'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}

          </div>
        </div>
      ) : (
        <div className="bg-white p-10 rounded-3xl flex flex-col items-center justify-center border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-blue-600 opacity-80" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">التقرير الشامل للموظفين</h3>
          <p className="text-slate-500 max-w-md mx-auto text-xs font-medium">
            يرجى كتابة اسم أو كود الموظف، أو اختيار الموظفين المطلوبين في حقل البحث أعلاه لاستعراض التقرير الشامل والمقارنة بين أداهم وحضورهم.
          </p>
        </div>
      )}
    </div>
  );
};
