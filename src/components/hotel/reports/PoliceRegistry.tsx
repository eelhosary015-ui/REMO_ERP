import React, { useState, useMemo } from "react";
import { Search, Shield, Eye, Download, Printer } from "lucide-react";
import { HotelReservation } from "../types";
import { HotelPagination } from "../HotelPagination";

interface PoliceRegistryProps {
  reservations: HotelReservation[];
  onViewDocModal: (res: HotelReservation) => void;
  onExport: () => void;
  onPrint: () => void;
}

// تمت الاضافة: تقرير دفتر الشرطة والسياحة مع بحث مستقل وترقيم وتنسيق تاريخ محلي
export const PoliceRegistry: React.FC<PoliceRegistryProps> = ({
  reservations,
  onViewDocModal,
  onExport,
  onPrint
}) => {
  // تمت الاضافة: فصل حقل البحث ليكون مستقلاً تماماً عن باقي التبويبات
  const [policeSearch, setPoliceSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  // تمت الاضافة: useMemo لتحسين أداء الفلترة والبحث
  const filteredData = useMemo(() => {
    const q = policeSearch.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter((r) => {
      const gName = (r.guest_name || "").toLowerCase();
      const gNat = (r.guest_nationality || "").toLowerCase();
      const gId = (r.guest_id_number || "").toLowerCase();
      const gPass = (r.guest_passport_number || "").toLowerCase();
      const rNum = (r.room_number || "").toLowerCase();
      const resNum = (r.reservation_number || "").toLowerCase();
      return (
        gName.includes(q) ||
        gNat.includes(q) ||
        gId.includes(q) ||
        gPass.includes(q) ||
        rNum.includes(q) ||
        resNum.includes(q)
      );
    });
  }, [reservations, policeSearch]);

  const pageCount = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث في سجل الشرطة بالاسم، الرقم القومي، الجواز، أو رقم الغرفة..."
            value={policeSearch}
            onChange={(e) => {
              setPoliceSearch(e.target.value);
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
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة الكشف
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
                <th className="p-3">اسم النزيل الرباعي</th>
                <th className="p-3">الجنسية</th>
                <th className="p-3">الرقم القومي / الجواز</th>
                <th className="p-3">الغرفة</th>
                <th className="p-3">تاريخ الدخول</th>
                <th className="p-3">تاريخ المغادرة</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">المستندات الأمنية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد بيانات مطابقة لسجل الشرطة
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const hasDoc = !!(
                    row.guest_id_photo_front ||
                    row.guest_passport_photo ||
                    row.guest_personal_photo ||
                    row.id_photo_front ||
                    row.passport_photo ||
                    row.personal_photo
                  );

                  // تمت الاضافة: تنسيق التاريخ باستخدام toLocaleDateString('ar-EG')
                  const checkInFormatted = row.check_in_date
                    ? new Date(row.check_in_date).toLocaleDateString("ar-EG")
                    : "-";
                  const checkOutFormatted = row.check_out_date
                    ? new Date(row.check_out_date).toLocaleDateString("ar-EG")
                    : "-";

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-teal-800">
                        {row.reservation_number}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {row.guest_name || "نزيل غير محدد"}
                      </td>
                      <td className="p-3 text-slate-600">
                        {row.guest_nationality || "مصري"}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {row.guest_id_number || row.guest_passport_number || "-"}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {row.room_number ? `غرفة ${row.room_number}` : "-"}
                      </td>
                      <td className="p-3 text-slate-600">{checkInFormatted}</td>
                      <td className="p-3 text-slate-600">{checkOutFormatted}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === "checked_in"
                              ? "bg-teal-100 text-teal-800"
                              : row.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : row.status === "checked_out"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {row.status === "checked_in"
                            ? "مقيم حالياً"
                            : row.status === "confirmed"
                            ? "مؤكد"
                            : row.status === "checked_out"
                            ? "غادر"
                            : row.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {hasDoc ? (
                          <button
                            onClick={() => onViewDocModal(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold transition border border-teal-200"
                          >
                            <Eye className="w-3.5 h-3.5" /> عرض المستند
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500 text-xs font-medium">
                            <Shield className="w-3.5 h-3.5" /> غير مرفق
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
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
