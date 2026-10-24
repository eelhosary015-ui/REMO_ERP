import { useCallback, useState } from "react";

/**
 * حالة ترقيم موحّدة لكل جداول النظام: 25 / 50 / 100 صف مع تنقل.
 * التصميم: الحالة هنا، والتقطيع بدالة pageRows النقية عند الرسم، والشريط أسفل الجدول.
 * الشريط يختفي تمامًا لو البيانات لا تتجاوز حجم الصفحة (لا تغيير على شكل الشاشات الصغيرة).
 */
export interface PaginationState {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
}

export function usePaginationState(initialPageSize = 25): PaginationState {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPage(1);
  }, []);
  return { page, setPage, pageSize, setPageSize };
}

/** تقطيع نقي (بدون أي حالة) — يُستدعى عند رسم الصفوف فقط. */
export function pageRows<T>(items: T[] | null | undefined, pg: PaginationState): T[] {
  const list = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil(list.length / pg.pageSize));
  const page = Math.min(Math.max(1, pg.page), totalPages);
  return list.slice((page - 1) * pg.pageSize, page * pg.pageSize);
}

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/** شريط التنقل — نفس شكل ترقيم التكاليف التشغيلية. يختفي إذا كانت النتيجة صفحة واحدة. */
export function PaginationBar({ page, pageSize, total, onPage, onPageSize }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const from = Math.min(start + 1, total);
  const to = Math.min(start + pageSize, total);

  const pages: number[] = [];
  const firstPage = Math.max(1, safePage - 2);
  const lastPage = Math.min(totalPages, firstPage + 4);
  for (let p = firstPage; p <= lastPage; p += 1) pages.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <span>عرض</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          aria-label="عدد الصفوف في الصفحة"
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>صف</span>
        <span className="text-slate-400">•</span>
        <span className="tabular-nums">
          {from}–{to} من {total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(1)} disabled={safePage === 1}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
          الأولى
        </button>
        <button type="button" onClick={() => onPage(safePage - 1)} disabled={safePage === 1}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
          السابق
        </button>
        {pages.map((pageNumber) => (
          <button key={pageNumber} type="button" onClick={() => onPage(pageNumber)}
            aria-current={pageNumber === safePage ? "page" : undefined}
            className={pageNumber === safePage
              ? "min-w-[32px] px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black shadow-sm"
              : "min-w-[32px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100"}>
            {pageNumber}
          </button>
        ))}
        <button type="button" onClick={() => onPage(safePage + 1)} disabled={safePage === totalPages}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
          التالي
        </button>
        <button type="button" onClick={() => onPage(totalPages)} disabled={safePage === totalPages}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
          الأخيرة
        </button>
      </div>
    </div>
  );
}

export default PaginationBar;
