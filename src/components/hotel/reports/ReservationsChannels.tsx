import React, { useState, useMemo } from "react";
import { Search, Calendar, Globe, User, Download } from "lucide-react";
import { HotelReservation } from "../types";
import { HotelPagination } from "../HotelPagination";

interface ReservationsChannelsProps {
  reservations: HotelReservation[];
  onExport: () => void;
}

// تمت الاضافة: تقرير الحجوزات وقنوات التوزيع مع بحث منفصل وترقيم وتنسيق تاريخ محلي
export const ReservationsChannels: React.FC<ReservationsChannelsProps> = ({
  reservations,
  onExport
}) => {
  // تمت الاضافة: بحث منفصل ومستقل
  const [channelSearch, setChannelSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  // إحصائيات قنوات الحجز
  const channelStats = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    reservations.forEach((r) => {
      const src = r.reservation_source || "direct";
      if (!counts[src]) counts[src] = { count: 0, total: 0 };
      counts[src].count += 1;
      counts[src].total += Number(r.total_amount || 0);
    });
    return counts;
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    return reservations.filter((r) => {
      const matchChannel =
        selectedChannel === "all" || (r.reservation_source || "direct") === selectedChannel;
      if (!matchChannel) return false;
      if (!q) return true;
      const gName = (r.guest_name || "").toLowerCase();
      const resNum = (r.reservation_number || "").toLowerCase();
      const rNum = (r.room_number || "").toLowerCase();
      return gName.includes(q) || resNum.includes(q) || rNum.includes(q);
    });
  }, [reservations, channelSearch, selectedChannel]);

  const pageCount = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredReservations.slice(start, start + itemsPerPage);
  }, [filteredReservations, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Channel Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(channelStats).map(([src, stat], sIdx) => (
          <div
            key={`chan-stat-${src}-${sIdx}`}
            onClick={() => {
              setSelectedChannel(selectedChannel === src ? "all" : src);
              setCurrentPage(0);
            }}
            className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm ${
              selectedChannel === src
                ? "bg-teal-50 border-teal-500 ring-2 ring-teal-500/20"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-500 capitalize">
                {src === "direct"
                  ? "حجز مباشر (FrontDesk)"
                  : src === "booking.com"
                  ? "Booking.com"
                  : src === "expedia"
                  ? "Expedia"
                  : src === "phone"
                  ? "هاتف / اتصال"
                  : src}
              </span>
              <Globe className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-xl font-black text-slate-900">{stat.count} حجز</div>
            <div className="text-xs text-slate-500 mt-1">
              {Number(stat.total || 0 || 0).toLocaleString()} ج.م
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الحجز، اسم النزيل، أو الغرفة..."
            value={channelSearch}
            onChange={(e) => {
              setChannelSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>
        <div className="flex items-center gap-2">
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
                <th className="p-3">القناة / المصدر</th>
                <th className="p-3">تاريخ الوصول</th>
                <th className="p-3">تاريخ المغادرة</th>
                <th className="p-3">قيمة الحجز</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد حجوزات مطابقة لمعايير البحث
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  // تمت الاضافة: تنسيق التواريخ محلياً
                  const inFormatted = row.check_in_date
                    ? new Date(row.check_in_date).toLocaleDateString("ar-EG")
                    : "-";
                  const outFormatted = row.check_out_date
                    ? new Date(row.check_out_date).toLocaleDateString("ar-EG")
                    : "-";

                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
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
                      <td className="p-3 font-medium text-slate-600 capitalize">
                        {row.reservation_source || "direct"}
                      </td>
                      <td className="p-3 text-slate-600">{inFormatted}</td>
                      <td className="p-3 text-slate-600">{outFormatted}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {Number(row.total_amount || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === "checked_in"
                              ? "bg-teal-100 text-teal-800"
                              : row.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {row.status}
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
          totalItems={filteredReservations.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
