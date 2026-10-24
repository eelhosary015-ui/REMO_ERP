import React, { useState, useMemo } from "react";
import { Search, DollarSign, UserCheck, AlertCircle, Download } from "lucide-react";
import { GuestBalanceRow } from "../types";
import { HotelPagination } from "../HotelPagination";

interface GuestBalancesProps {
  balances: GuestBalanceRow[];
  onOpenPaymentModal?: (row: GuestBalanceRow) => void;
  onExport: () => void;
}

// تمت الاضافة: تقرير أرصدة النزلاء وحسابات الـ Guest Ledger مع بحث منفصل وترقيم
export const GuestBalances: React.FC<GuestBalancesProps> = ({
  balances,
  onOpenPaymentModal,
  onExport
}) => {
  // تمت الاضافة: بحث منفصل ومستقل لتقرير أرصدة النزلاء
  const [balanceSearch, setBalanceSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  // تمت الاضافة: useMemo للأداء العالي
  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((b) => {
      const gName = (b.guest_name || "").toLowerCase();
      const rNum = (b.room_number || "").toLowerCase();
      const resNum = (b.reservation_number || "").toLowerCase();
      const phone = (b.guest_phone || "").toLowerCase();
      return (
        gName.includes(q) ||
        rNum.includes(q) ||
        resNum.includes(q) ||
        phone.includes(q)
      );
    });
  }, [balances, balanceSearch]);

  const pageCount = Math.ceil(filteredBalances.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredBalances.slice(start, start + itemsPerPage);
  }, [filteredBalances, currentPage, itemsPerPage]);

  const totalOutstanding = useMemo(() => {
    return filteredBalances.reduce((sum, b) => sum + Number(b.balance || 0), 0);
  }, [filteredBalances]);

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، رقم الغرفة، رقم الحجز، أو هاتف النزيل..."
            value={balanceSearch}
            onChange={(e) => {
              setBalanceSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl font-bold">
            إجمالي المستحق: {Number(totalOutstanding || 0 || 0).toLocaleString()} ج.م
          </div>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> تصدير Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">رقم الحجز</th>
                <th className="p-3">اسم النزيل</th>
                <th className="p-3">الغرفة</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">إجمالي الفاتورة</th>
                <th className="p-3">المدفوع</th>
                <th className="p-3">الرصيد المتبقي</th>
                <th className="p-3">حالة الحساب</th>
                <th className="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد أرصدة معلقة مطابقة للبحث
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const hasDebt = Number(row.balance) > 0;
                  return (
                    <tr key={`guest-bal-${row.reservation_id ?? idx}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-teal-800">
                        {row.reservation_number}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{row.guest_name}</td>
                      <td className="p-3 font-bold text-slate-800">
                        {row.room_number ? `غرفة ${row.room_number}` : "-"}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{row.guest_phone || "-"}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {Number(row.grand_total || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        {Number(row.paid_total || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td
                        className={`p-3 font-black ${
                          hasDebt ? "text-rose-600" : "text-slate-400"
                        }`}
                      >
                        {Number(row.balance || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            !hasDebt
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {!hasDebt ? "مسدد بالكامل" : "مستحق تحصيل"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {hasDebt && onOpenPaymentModal ? (
                          <button
                            onClick={() => onOpenPaymentModal(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            <DollarSign className="w-3.5 h-3.5" /> تحصيل دفعة
                          </button>
                        ) : (
                          <span className="text-emerald-600 inline-flex items-center gap-1 font-bold text-xs">
                            <UserCheck className="w-3.5 h-3.5" /> خالص
                          </span>
                        )}
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
          totalItems={filteredBalances.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
