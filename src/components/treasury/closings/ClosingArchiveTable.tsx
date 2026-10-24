import React, { useState } from "react";
import {
  FileSpreadsheet,
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Clock,
  User,
  Building2,
  Layers,
  ArrowUpDown,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";
import { TreasuryClosing, TreasuryAccount } from "../../../types";

interface ClosingArchiveTableProps {
  closings: TreasuryClosing[];
  treasuries: TreasuryAccount[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewDetails: (closing: TreasuryClosing) => void;
  onPrintVoucher: (closing: TreasuryClosing) => void;
  // Filters
  filterTreasuryId: string;
  onFilterTreasuryChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  // Pagination
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  // Stats
  summary?: {
    total_closings: number;
    matched_count: number;
    deficit_count: number;
    surplus_count: number;
    total_book_amount: number;
    total_actual_amount: number;
    total_variance_amount: number;
  };
}

export const ClosingArchiveTable: React.FC<ClosingArchiveTableProps> = ({
  closings,
  treasuries,
  isLoading,
  onRefresh,
  onViewDetails,
  onPrintVoucher,
  filterTreasuryId,
  onFilterTreasuryChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchQueryChange,
  currentPage,
  totalPages,
  totalRecords,
  onPageChange,
  summary
}) => {
  const [isExporting, setIsExporting] = useState(false);

  // Format Dates nicely
  const formatDate = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  // Helper for Status Badge styling
  const getStatusBadge = (status: string, variance: number) => {
    if (status === "Matched" || variance === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          مطابق
        </span>
      );
    }
    if (status.includes("Deficit") || variance < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          عجز ({Math.abs(variance).toLocaleString("en-US")} ج.م)
        </span>
      );
    }
    if (status.includes("Surplus") || variance > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <TrendingUp className="w-3 h-3 text-blue-600" />
          زيادة (+{variance.toLocaleString("en-US")} ج.م)
        </span>
      );
    }
    if (status === "Settled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
          تمت التسوية
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  // Helper for Variance styling
  const getVarianceClass = (variance: number) => {
    if (variance === 0) return "text-emerald-700 bg-emerald-50/80 border-emerald-200";
    if (variance < 0) return "text-rose-700 bg-rose-50/80 border-rose-200 font-black";
    return "text-blue-700 bg-blue-50/80 border-blue-200 font-black";
  };

  // Excel Export Handler
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const exportData = closings.map((c, index) => ({
        "م": index + 1,
        "رقم الإقفال": `#${c.id}`,
        "اسم الخزينة": c.treasury_name || `خزينة ${c.treasury_id}`,
        "كود الخزينة": c.treasury_code || `SAFE-${c.treasury_id}`,
        "تاريخ الإقفال": c.closing_date ? new Date(c.closing_date).toLocaleDateString("ar-EG") : "-",
        "وقت الإقفال": c.closing_date ? new Date(c.closing_date).toLocaleTimeString("ar-EG") : "-",
        "رصيد أول المدة": c.opening_balance || 0,
        "إجمالي الإيداعات": c.total_deposits || 0,
        "إجمالي المنصرفات": c.total_withdrawals || 0,
        "الرصيد الدفتري (ج.م)": c.book_balance || 0,
        "الرصيد الفعلي المعدود (ج.م)": c.actual_balance || 0,
        "فارق الجرد (ج.م)": c.variance || 0,
        "حالة المطابقة": c.status || (c.variance === 0 ? "Matched" : c.variance < 0 ? "Deficit" : "Surplus"),
        "المسؤول عن الجرد": c.responsible_user || "-",
        "الملاحظات والتبرير": c.notes || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "أرشيف إقفال الخزائن");

      // Auto width for columns
      const maxCols = Object.keys(exportData[0] || {}).length;
      worksheet["!cols"] = Array(maxCols).fill({ wch: 18 });

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `سجل_إقفال_وجرد_الخزائن_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Export Excel error:", err);
      alert("حدث خطأ أثناء تصدير ملف الإكسيل");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="closing-archive-panel" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
      {/* 1. Header & Summary Stats */}
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              أرشيف وسجل إقفالات الخزينة والتدقيق
            </h2>
            <p className="text-xs text-slate-500">
              مراجعة سجلات الجرد التاريخية، تفاصيل الفئات النقدية وتتبع الفروقات
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={closings.length === 0 || isExporting}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              {isExporting ? "جاري التصدير..." : "تصدير Excel"}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Summary Metrics Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] text-slate-500 font-medium">إجمالي الإقفالات</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {summary.total_closings.toLocaleString("en-US")}
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
              <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> إقفالات متطابقة (0 فارق)
              </div>
              <div className="text-lg font-black text-emerald-800 mt-0.5">
                {summary.matched_count.toLocaleString("en-US")}
                <span className="text-xs font-normal text-emerald-600 mr-1.5">
                  ({summary.total_closings > 0 ? Math.round((summary.matched_count / summary.total_closings) * 100) : 0}%)
                </span>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100">
              <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" /> حالات عجز نقدي
              </div>
              <div className="text-lg font-black text-rose-800 mt-0.5">
                {summary.deficit_count.toLocaleString("en-US")}
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
              <div className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-600" /> حالات زيادة نقدية
              </div>
              <div className="text-lg font-black text-blue-800 mt-0.5">
                {summary.surplus_count.toLocaleString("en-US")}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Toolbar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Treasury Filter */}
        <div>
          <select
            value={filterTreasuryId}
            onChange={(e) => onFilterTreasuryChange(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="all">كل الخزائن والحسابات</option>
            {treasuries.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="all">كافة الحالات</option>
            <option value="Matched">متطابق تماماً (Matched)</option>
            <option value="Deficit - Pending Review">عجز - قيد المراجعة</option>
            <option value="Surplus - Pending Review">زيادة - قيد المراجعة</option>
            <option value="Settled">تمت التسوية والاعتماد</option>
            <option value="Reopened">معاد فتحه</option>
          </select>
        </div>

        {/* Date Range Start / End */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-1/2 bg-white border border-slate-300 text-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            title="من تاريخ"
          />
          <span className="text-xs text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-1/2 bg-white border border-slate-300 text-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            title="إلى تاريخ"
          />
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="بحث بالمسؤول أو الملاحظات..."
            className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl pr-8 pl-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* 3. Data Table */}
      <div className="flex-1 overflow-x-auto min-h-[320px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">جاري تحميل سجلات الإقفال...</p>
          </div>
        ) : closings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">لا توجد سجلات إقفال مطابقة للبحث</p>
              <p className="text-xs text-slate-500 mt-1">
                قم بتغيير معايير الفلترة أو قم بتسجيل إقفال جديد من الشاشة الجانبية
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="py-3 px-3.5">الخزينة / الفرع</th>
                <th className="py-3 px-3.5">تاريخ الإقفال</th>
                <th className="py-3 px-3.5 text-center">الرصيد الدفتري</th>
                <th className="py-3 px-3.5 text-center">الرصيد الفعلي</th>
                <th className="py-3 px-3.5 text-center">الفارق (Variance)</th>
                <th className="py-3 px-3.5">المسؤول</th>
                <th className="py-3 px-3.5 text-center">الحالة</th>
                <th className="py-3 px-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closings.map((closing) => {
                const varianceVal = Number(closing.variance || 0);

                return (
                  <tr
                    key={closing.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Treasury & Code */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">
                        {closing.treasury_name || `خزينة #${closing.treasury_id}`}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                          {closing.treasury_code || `SAFE-${closing.treasury_id}`}
                        </span>
                        {closing.branch_name && <span>• {closing.branch_name}</span>}
                      </div>
                    </td>

                    {/* Closing Date */}
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-slate-800">
                        {formatDate(closing.closing_date)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        سجل رقم #{closing.id}
                      </div>
                    </td>

                    {/* Book Balance */}
                    <td className="py-3 px-3.5 text-center">
                      <span className="font-bold text-slate-800 font-mono">
                        {Number(closing.book_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 mr-1">
                        {closing.treasury_currency || "ج.م"}
                      </span>
                    </td>

                    {/* Actual Balance */}
                    <td className="py-3 px-3.5 text-center">
                      <span className="font-bold text-indigo-700 font-mono bg-indigo-50/60 px-2 py-1 rounded-md border border-indigo-100">
                        {Number(closing.actual_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Variance */}
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-mono border ${getVarianceClass(
                          varianceVal
                        )}`}
                      >
                        {varianceVal > 0 ? `+${varianceVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : varianceVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Responsible User */}
                    <td className="py-3 px-3.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {closing.responsible_user || (closing as any).creator_username || "أمين الخزينة"}
                      </div>
                      {closing.notes && (
                        <div className="text-[10px] text-slate-500 max-w-[160px] truncate mt-0.5" title={closing.notes}>
                          {closing.notes}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3.5 text-center">
                      {getStatusBadge(closing.status, varianceVal)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewDetails(closing)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition"
                          title="عرض تفاصيل الفئات والجرد"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onPrintVoucher(closing)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                          title="طباعة محضر جرد الخزينة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Pagination Controls */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div>
          إجمالي السجلات: <strong className="text-slate-900">{totalRecords}</strong> • صفحة <strong className="text-slate-900">{currentPage}</strong> من <strong className="text-slate-900">{totalPages || 1}</strong>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            السابق
          </button>

          <span className="px-3 py-1 font-bold text-slate-800">
            {currentPage}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1"
          >
            التالي
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default ClosingArchiveTable;
