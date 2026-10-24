import React, { useState } from "react";
import {
  Search,
  Filter,
  Plus,
  Printer,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  DollarSign,
  ChevronDown,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  RotateCcw,
  Send,
  MoreVertical,
  Layers,
  ArrowRightLeft
} from "lucide-react";
import { TreasuryCustody, TreasuryCustodyType, TreasuryAccount } from "../../../types";

interface ListViewProps {
  custodies: TreasuryCustody[];
  custodyTypes: TreasuryCustodyType[];
  accounts: TreasuryAccount[];
  employees: any[];
  branches: any[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  filterCategory: string;
  setFilterCategory: (c: string) => void;
  filterEmployee: string;
  setFilterEmployee: (e: string) => void;
  filterAccount: string;
  setFilterAccount: (a: string) => void;
  filterOverdueOnly: boolean;
  setFilterOverdueOnly: (o: boolean) => void;
  onNewCustody: () => void;
  onViewDetails: (custody: TreasuryCustody) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onIssueCustody: (custody: TreasuryCustody) => void;
  onOpenSettlement: (custody: TreasuryCustody) => void;
  onPrintVoucher: (custody: TreasuryCustody) => void;
  onExtendDueDate: (custody: TreasuryCustody) => void;
  onSendReminder: (custody: TreasuryCustody) => void;
}

export const CustodyListView: React.FC<ListViewProps> = ({
  custodies,
  custodyTypes,
  accounts,
  employees,
  branches,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  filterEmployee,
  setFilterEmployee,
  filterAccount,
  setFilterAccount,
  filterOverdueOnly,
  setFilterOverdueOnly,
  onNewCustody,
  onViewDetails,
  onApprove,
  onReject,
  onIssueCustody,
  onOpenSettlement,
  onPrintVoucher,
  onExtendDueDate,
  onSendReminder
}) => {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    if (isOverdue && ['active', 'issued', 'pending_settlement'].includes(status)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          متأخرة عن الاستحقاق
        </span>
      );
    }

    switch (status) {
      case 'draft':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            مسودة
          </span>
        );
      case 'pending_approval':
      case 'pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            بانتظار الاعتماد
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            معتمدة (جاهزة للصرف)
          </span>
        );
      case 'issued':
      case 'paid':
      case 'active':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            نشطة / مستلمة
          </span>
        );
      case 'pending_settlement':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200">
            قيد التسوية
          </span>
        );
      case 'partially_settled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            تصفية جزئية
          </span>
        );
      case 'closed':
      case 'cleared':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            تمت التصفية والإغلاق
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            مرفوضة
          </span>
        );
      case 'canceled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-400">
            ملغاة
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const getCategoryBadge = (cat?: string, typeName?: string) => {
    return (
      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
        {typeName || cat || "عهدة عامة"}
      </span>
    );
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    filterStatus !== "all" ||
    filterCategory !== "all" ||
    filterEmployee !== "all" ||
    filterAccount !== "all" ||
    filterOverdueOnly;

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterEmployee("all");
    setFilterAccount("all");
    setFilterOverdueOnly(false);
  };

  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F]/g, "");
  };

  const filteredCustodies = React.useMemo(() => {
    return custodies.filter((cust) => {
      // 1. Search Query (supports Custody Number / Voucher, Employee Code, Employee Name, Purpose, Safe)
      if (searchQuery.trim()) {
        const q = normalizeText(searchQuery);
        const num = normalizeText(cust.custody_number || `CUS-${cust.id}`);
        const idStr = String(cust.id || "");
        const emp = normalizeText(cust.employee_name || "");
        const code = normalizeText(cust.employee_code || "");
        const empId = String(cust.employee_id || "");
        const purpose = normalizeText(cust.purpose || "");
        const safe = normalizeText(cust.account_name || "");
        const typeName = normalizeText(cust.custody_type_name || "");
        const branch = normalizeText(cust.branch_name || "");
        const dept = normalizeText(cust.employee_department || "");

        const matchesSearch =
          num.includes(q) ||
          idStr.includes(q) ||
          emp.includes(q) ||
          code.includes(q) ||
          empId.includes(q) ||
          dept.includes(q) ||
          purpose.includes(q) ||
          safe.includes(q) ||
          typeName.includes(q) ||
          branch.includes(q);

        if (!matchesSearch) return false;
      }

      // 2. Overdue filter
      if (filterOverdueOnly && !cust.is_overdue) {
        return false;
      }

      // 3. Status filter
      if (filterStatus && filterStatus !== "all") {
        if (filterStatus === "active" || filterStatus === "issued") {
          if (!["active", "issued", "paid"].includes(cust.status)) return false;
        } else if (filterStatus === "pending_approval" || filterStatus === "pending") {
          if (!["pending_approval", "pending"].includes(cust.status)) return false;
        } else if (filterStatus === "closed" || filterStatus === "cleared") {
          if (!["closed", "cleared", "fully_cleared"].includes(cust.status)) return false;
        } else if (filterStatus === "partially_settled") {
          if (!["partially_settled", "partially_cleared"].includes(cust.status)) return false;
        } else if (filterStatus === "rejected") {
          if (!["rejected", "cancelled", "canceled"].includes(cust.status)) return false;
        } else if (cust.status !== filterStatus) {
          return false;
        }
      }

      // 4. Category / Custody Type filter
      if (filterCategory && filterCategory !== "all") {
        if (filterCategory.startsWith("type_")) {
          const typeId = parseInt(filterCategory.replace("type_", ""), 10);
          if (cust.custody_type_id !== typeId) return false;
        } else {
          const cat = filterCategory.toLowerCase();
          const matchesType =
            (cust.custody_type && cust.custody_type.toLowerCase() === cat) ||
            (cust.custody_category && cust.custody_category.toLowerCase() === cat) ||
            (cust.custody_type_name && cust.custody_type_name.toLowerCase().includes(cat));
          if (!matchesType) return false;
        }
      }

      // 5. Employee filter
      if (filterEmployee && filterEmployee !== "all") {
        if (String(cust.employee_id) !== String(filterEmployee)) return false;
      }

      // 6. Safe / Account filter
      if (filterAccount && filterAccount !== "all") {
        if (String(cust.account_id) !== String(filterAccount)) return false;
      }

      return true;
    });
  }, [custodies, searchQuery, filterOverdueOnly, filterStatus, filterCategory, filterEmployee, filterAccount]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث برقم الصرفية / العهدة، كود الموظف، اسم الموظف، الغرض، أو الخزينة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                title="إعادة تعيين كافة الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            )}

            <button
              onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                filterOverdueOnly
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>المتأخرات فقط</span>
            </button>

            <button
              onClick={onNewCustody}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>صرف / طلب عهدة جديدة</span>
            </button>
          </div>
        </div>

        {/* Extended Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">الحالة الرقابية</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشطة / مستلمة</option>
              <option value="pending_settlement">قيد التسوية والمراجعة</option>
              <option value="partially_settled">مسواة جزئياً</option>
              <option value="pending_approval">بانتظار الاعتماد</option>
              <option value="approved">معتمدة جاهزة للصرف</option>
              <option value="closed">تمت التصفية والإغلاق</option>
              <option value="draft">مسودة</option>
              <option value="rejected">مرفوضة / ملغاة</option>
            </select>
          </div>

          {/* Type / Category Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">نوع وتصنيف العهدة</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="all">جميع أنواع وتصنيفات العهد</option>
              {custodyTypes && custodyTypes.length > 0 && (
                <optgroup label="أنواع العهد المعرفة">
                  {custodyTypes.map((t) => (
                    <option key={t.id} value={`type_${t.id}`}>
                      {t.name_ar} {t.code ? `(${t.code})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="التصنيفات العامة">
                <option value="cash">عهدة نقدية</option>
                <option value="asset">أصول ومعدات</option>
                <option value="equipment">أدوات تشغيل</option>
                <option value="inventory">أمانات بضاعة</option>
                <option value="vehicle">سيارات ومركبات</option>
                <option value="temporary">عهدة مؤقتة</option>
                <option value="permanent">عهدة مستديمة</option>
              </optgroup>
            </select>
          </div>

          {/* Employee Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">الموظف المستلم</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="all">جميع الموظفين</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code ? `[كود: ${emp.employee_code}] ` : ""}{emp.name} {emp.department ? `(${emp.department})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Safe / Account Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">الخزينة المانحة</label>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="all">جميع الخزائن والحسابات</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Summary Bar */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500 font-bold">
          <div className="flex items-center gap-2">
            <span>النتائج المعروضة:</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black">
              {filteredCustodies.length} عهدة
            </span>
            {hasActiveFilters && (
              <span className="text-[11px] text-amber-700 font-medium">
                (مفلترة من إجمالي {custodies.length} عهدة مسجلة)
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-800 text-[11px] font-black underline cursor-pointer"
            >
              مسح جميع الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Custodies Register Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 font-bold border-b border-slate-100">
                <th className="p-3.5">رقم العهدة</th>
                <th className="p-3.5">الموظف المسؤول</th>
                <th className="p-3.5">النوع والتصنيف</th>
                <th className="p-3.5">الخزينة المانحة</th>
                <th className="p-3.5">قيمة العهدة</th>
                <th className="p-3.5">المصروف / المتبقي</th>
                <th className="p-3.5">تاريخ الاستحقاق</th>
                <th className="p-3.5">الحالة الرقابية</th>
                <th className="p-3.5 text-center">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCustodies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-600">لا توجد سجلات عهد مطابقة لشروط البحث والفلترة المحددة</span>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="px-4 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition-colors"
                        >
                          مسح شروط الفلترة وإظهار الكل
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustodies.map((cust) => {
                  const amount = parseFloat((cust.amount as any) || 0);
                  const spent = parseFloat((cust.spent_amount as any) || (cust.cleared_amount as any) || 0);
                  const remaining = parseFloat((cust.remaining_amount as any) || (amount - spent) || 0);

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Custody Code */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-slate-900">
                          {cust.custody_number || `CUS-${cust.id}`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {cust.created_at ? new Date(cust.created_at).toLocaleDateString("ar-EG") : ""}
                        </div>
                      </td>

                      {/* Employee */}
                      <td className="p-3.5">
                        <div className="font-black text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{cust.employee_name || "موظف غير محدد"}</span>
                          {cust.employee_code && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold border border-slate-200">
                              #{cust.employee_code}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mr-5">
                          {cust.employee_department || (cust.employee_code ? `كود وظيفي: ${cust.employee_code}` : "---")}
                        </div>
                      </td>

                      {/* Type & Purpose */}
                      <td className="p-3.5">
                        {getCategoryBadge(cust.custody_category || cust.custody_type, cust.custody_type_name)}
                        <div className="text-[11px] text-slate-600 font-bold mt-1 max-w-[160px] truncate" title={cust.purpose}>
                          {cust.purpose || "---"}
                        </div>
                      </td>

                      {/* Safe / Account */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-700 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cust.account_name || "خزينة عامة"}</span>
                        </div>
                        {cust.branch_name && (
                          <div className="text-[10px] text-slate-400 mr-4.5">{cust.branch_name}</div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-indigo-700 text-sm">
                          {amount.toLocaleString()} <span className="text-[10px] text-slate-500">ج.م</span>
                        </div>
                      </td>

                      {/* Spent vs Remaining */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-600 font-bold" title="المصروف">
                            صرف: {spent.toLocaleString()}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-800 font-black" title="المتبقي">
                            باقي: {remaining.toLocaleString()}
                          </span>
                        </div>
                        {cust.returned_amount && parseFloat(cust.returned_amount as any) > 0 && (
                          <div className="text-[10px] text-blue-600 font-bold mt-0.5">
                            مسترد للخزينة: {parseFloat(cust.returned_amount as any).toLocaleString()} ج.م
                          </div>
                        )}
                      </td>

                      {/* Due Date & Overdue */}
                      <td className="p-3.5">
                        {cust.due_date ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-700 font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{new Date(cust.due_date).toLocaleDateString("ar-EG")}</span>
                            </div>
                            {cust.is_overdue && (
                              <span className="text-[10px] text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded">
                                متأخرة ({cust.overdue_days} يوم)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">غير محدد</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5">
                        {getStatusBadge(cust.status, cust.is_overdue)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 360 View Button */}
                          <button
                            onClick={() => onViewDetails(cust)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl transition-all"
                            title="عرض ملف العهدة الشامل (360°)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print Voucher */}
                          <button
                            onClick={() => onPrintVoucher(cust)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                            title="طباعة سند العهدة / التسوية"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Contextual Primary Action Button */}
                          {(cust.status === 'pending_approval' || cust.status === 'pending') && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onApprove(cust.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all"
                              >
                                موافقة
                              </button>
                              <button
                                onClick={() => onReject(cust.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[11px] font-bold transition-all"
                              >
                                رفض
                              </button>
                            </div>
                          )}

                          {cust.status === 'approved' && (
                            <button
                              onClick={() => onIssueCustody(cust)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black transition-all shadow-sm"
                            >
                              تسليم وصرف النقدية
                            </button>
                          )}

                          {['active', 'issued', 'paid', 'pending_settlement', 'partially_settled'].includes(cust.status) && (
                            <button
                              onClick={() => onOpenSettlement(cust)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all shadow-sm"
                            >
                              تصفية وتسوية
                            </button>
                          )}

                          {/* Quick Extend or Remind for Active/Overdue */}
                          {['active', 'issued', 'paid', 'pending_settlement'].includes(cust.status) && (
                            <button
                              onClick={() => onExtendDueDate(cust)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-all text-[11px]"
                              title="تمديد موعد الاستحقاق"
                            >
                              <Clock className="w-4 h-4" />
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
  );
};
