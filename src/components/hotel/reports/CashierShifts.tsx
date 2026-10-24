import React, { useState, useMemo } from "react";
import { Search, DollarSign, Clock, User, ShieldCheck, Download } from "lucide-react";
import { HotelPagination } from "../HotelPagination";

interface CashierShift {
  id: number;
  cashier_name: string;
  shift_name: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number;
  collected_cash: number;
  collected_card: number;
  total_collected: number;
  status: "open" | "closed";
}

interface CashierShiftsProps {
  shifts: CashierShift[];
  onExport: () => void;
}

// تمت الاضافة: تقرير ورديات الخزينة والاستقبال مع بحث مستقل وترقيم
export const CashierShifts: React.FC<CashierShiftsProps> = ({ shifts, onExport }) => {
  // تمت الاضافة: بحث مستقل
  const [shiftSearch, setShiftSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const filteredShifts = useMemo(() => {
    const q = shiftSearch.trim().toLowerCase();
    if (!q) return shifts;
    return shifts.filter((s) => {
      const name = (s.cashier_name || "").toLowerCase();
      const shift = (s.shift_name || "").toLowerCase();
      return name.includes(q) || shift.includes(q);
    });
  }, [shifts, shiftSearch]);

  const pageCount = Math.ceil(filteredShifts.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredShifts.slice(start, start + itemsPerPage);
  }, [filteredShifts, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم الكاشير أو اسم الوردية..."
            value={shiftSearch}
            onChange={(e) => {
              setShiftSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
        >
          <Download className="w-3.5 h-3.5" /> تصدير
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">مسؤول الوردية (الكاشير)</th>
                <th className="p-3">اسم الوردية</th>
                <th className="p-3">وقت فتح الوردية</th>
                <th className="p-3">وقت الإغلاق</th>
                <th className="p-3">العهدة الافتتاحية</th>
                <th className="p-3">المحصل نقداً</th>
                <th className="p-3">المحصل فيزا/بنك</th>
                <th className="p-3">إجمالي التحصيل</th>
                <th className="p-3">حالة الوردية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد ورديات كاشير مسجلة
                  </td>
                </tr>
              ) : (
                paginatedData.map((s, idx) => {
                  const openFormatted = s.opened_at
                    ? new Date(s.opened_at).toLocaleDateString("ar-EG")
                    : "-";
                  const closeFormatted = s.closed_at
                    ? new Date(s.closed_at).toLocaleDateString("ar-EG")
                    : "مستمرة";

                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{s.cashier_name}</td>
                      <td className="p-3 font-medium text-slate-700">{s.shift_name}</td>
                      <td className="p-3 text-slate-600">{openFormatted}</td>
                      <td className="p-3 text-slate-600">{closeFormatted}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {Number(s.opening_cash || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {Number(s.collected_cash || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-700">
                        {Number(s.collected_card || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-mono font-black text-teal-900">
                        {Number(s.total_collected || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "open"
                              ? "bg-emerald-100 text-emerald-800 animate-pulse"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {s.status === "open" ? "وردية مفتوحة" : "مغلقة ومراجعة"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <HotelPagination
          pageCount={pageCount}
          onPageChange={({ selected }) => setCurrentPage(selected)}
          currentPage={currentPage}
          totalItems={filteredShifts.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
