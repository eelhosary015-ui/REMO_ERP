import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
} from "lucide-react";

export interface ReportTablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

export function paginateData<T>(items: T[], currentPage: number, pageSize: number): T[] {
  const safePage = Math.max(1, currentPage);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export const ReportTablePagination: React.FC<ReportTablePaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  itemName = "سجل",
  className = "",
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startRecord = totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (safePage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safePage < totalPages - 2) {
        pages.push("...");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`px-4 py-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs select-none print:hidden ${className}`}
      dir="rtl"
    >
      {/* Records info & Page size selector */}
      <div className="flex flex-wrap items-center gap-4 text-slate-600">
        <div className="flex items-center gap-1.5 font-bold">
          <span>عرض من</span>
          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-black text-slate-800 shadow-2xs">
            {startRecord}
          </span>
          <span>إلى</span>
          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-black text-slate-800 shadow-2xs">
            {endRecord}
          </span>
          <span>من إجمالي</span>
          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded font-black shadow-2xs">
            {totalItems}
          </span>
          <span>{itemName}</span>
        </div>

        <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>

        {/* Rows per page selector */}
        <div className="flex items-center gap-1.5 font-bold">
          <ListFilter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">عدد الصفوف:</span>
          <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
            {pageSizeOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onPageSizeChange(opt);
                  onPageChange(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all ${
                  pageSize === opt
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400">صف/شيت</span>
        </div>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1.5">
        {/* First Page (Far Right in RTL) */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          title="الصفحة الأولى"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        {/* Previous Page (Right in RTL) */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs font-bold"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="hidden sm:inline">السابق</span>
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 py-1 text-slate-400 font-bold tracking-widest"
                >
                  ...
                </span>
              );
            }
            const isCurrent = p === safePage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs font-black transition-all ${
                  isCurrent
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page (Left in RTL) */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs font-bold"
        >
          <span className="hidden sm:inline">التالي</span>
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Last Page (Far Left in RTL) */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          title="الصفحة الأخيرة"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Page status indication */}
        <span className="text-[11px] font-bold text-slate-400 mr-2 hidden lg:inline">
          صفحة {safePage} من {totalPages}
        </span>
      </div>
    </div>
  );
};
