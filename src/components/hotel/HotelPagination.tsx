import React from "react";
import ReactPaginate from "react-paginate";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HotelPaginationProps {
  pageCount: number;
  onPageChange: (selectedItem: { selected: number }) => void;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
}

// تمت الاضافة: مكون ترقيم موحد للجداول الفندقية الكبيرة باستخدام react-paginate
export const HotelPagination: React.FC<HotelPaginationProps> = ({
  pageCount,
  onPageChange,
  currentPage = 0,
  totalItems,
  itemsPerPage = 20,
}) => {
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs">
      {totalItems !== undefined && (
        <div className="text-slate-500 font-medium">
          عرض <span className="font-bold text-slate-800">{currentPage * itemsPerPage + 1}</span> إلى{" "}
          <span className="font-bold text-slate-800">{Math.min((currentPage + 1) * itemsPerPage, totalItems)}</span> من أصل{" "}
          <span className="font-bold text-teal-700">{totalItems}</span> سجل
        </div>
      )}
      <ReactPaginate
        breakLabel="..."
        nextLabel={<ChevronLeft className="w-4 h-4" />}
        previousLabel={<ChevronRight className="w-4 h-4" />}
        onPageChange={onPageChange}
        pageRangeDisplayed={3}
        marginPagesDisplayed={1}
        pageCount={pageCount}
        forcePage={currentPage}
        renderOnZeroPageCount={null}
        containerClassName="flex items-center gap-1 list-none p-0 m-0"
        pageClassName="rounded-lg overflow-hidden"
        pageLinkClassName="px-3 py-1.5 block border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 transition"
        activeClassName="!border-teal-600"
        activeLinkClassName="!bg-teal-600 !text-white !border-teal-600 shadow-sm"
        previousClassName="rounded-lg overflow-hidden"
        previousLinkClassName="px-2.5 py-1.5 flex items-center justify-center border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
        nextClassName="rounded-lg overflow-hidden"
        nextLinkClassName="px-2.5 py-1.5 flex items-center justify-center border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
        disabledClassName="opacity-40 cursor-not-allowed pointer-events-none"
        breakClassName="px-2 text-slate-400"
      />
    </div>
  );
};
