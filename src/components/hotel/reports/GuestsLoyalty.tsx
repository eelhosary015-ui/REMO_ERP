import React, { useState, useMemo } from "react";
import { Search, Award, Star, Gift, Users, Download } from "lucide-react";
import { HotelGuest } from "../types";
import { HotelPagination } from "../HotelPagination";

interface GuestsLoyaltyProps {
  guests: HotelGuest[];
  onExport: () => void;
}

// تمت الاضافة: تقرير ولاء النزلاء وبرنامج النقاط مع بحث مستقل وترقيم
export const GuestsLoyalty: React.FC<GuestsLoyaltyProps> = ({ guests, onExport }) => {
  // تمت الاضافة: بحث مستقل
  const [guestSearch, setGuestSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const filteredGuests = useMemo(() => {
    const q = guestSearch.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => {
      const name = (g.full_name || "").toLowerCase();
      const phone = (g.phone || "").toLowerCase();
      const nat = (g.nationality || "").toLowerCase();
      const idNum = (g.id_number || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || nat.includes(q) || idNum.includes(q);
    });
  }, [guests, guestSearch]);

  const pageCount = Math.ceil(filteredGuests.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredGuests.slice(start, start + itemsPerPage);
  }, [filteredGuests, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، رقم الهاتف، الجنسية، أو الرقم القومي..."
            value={guestSearch}
            onChange={(e) => {
              setGuestSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
        >
          <Download className="w-3.5 h-3.5" /> تصدير Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">اسم النزيل</th>
                <th className="p-3">رقم الهاتف</th>
                <th className="p-3">الجنسية</th>
                <th className="p-3">عدد مرات الإقامة</th>
                <th className="p-3">إجمالي الإنفاق التراكمي</th>
                <th className="p-3">فئة الولاء (Tier)</th>
                <th className="p-3">نقاط الولاء</th>
                <th className="p-3">آخر إقامة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    لا يوجد نزلاء مطابقون لمعايير البحث
                  </td>
                </tr>
              ) : (
                paginatedData.map((g, idx) => {
                  const stays = Number(g.stays_count || 1);
                  const totalSpent = Number(g.total_spent || 0);

                  // تصنيف الولاء التلقائي
                  let tier = "Silver";
                  let tierColor = "bg-slate-100 text-slate-800 border-slate-300";
                  if (stays >= 10 || totalSpent >= 50000) {
                    tier = "VIP Platinum";
                    tierColor = "bg-purple-100 text-purple-800 border-purple-300";
                  } else if (stays >= 5 || totalSpent >= 20000) {
                    tier = "Gold Member";
                    tierColor = "bg-amber-100 text-amber-800 border-amber-300";
                  }

                  const points = Math.round(totalSpent / 10);
                  const lastVisitFormatted = g.last_visit_date
                    ? new Date(g.last_visit_date).toLocaleDateString("ar-EG")
                    : "-";

                  return (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{g.full_name}</td>
                      <td className="p-3 font-mono text-slate-600">{g.phone || "-"}</td>
                      <td className="p-3 text-slate-600">{g.nationality || "مصري"}</td>
                      <td className="p-3 font-bold text-slate-900">{stays} إقامات</td>
                      <td className="p-3 font-mono font-bold text-teal-800">
                        {Number(totalSpent || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierColor}`}
                        >
                          {tier}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-600 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {points} نقطة
                      </td>
                      <td className="p-3 text-slate-500">{lastVisitFormatted}</td>
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
          totalItems={filteredGuests.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
