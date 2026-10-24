import React, { useState, useMemo } from "react";
import { Search, Wrench, AlertTriangle, CheckCircle, Clock, Plus, Download } from "lucide-react";
import { MaintenanceTicket } from "../types";
import { HotelPagination } from "../HotelPagination";

interface MaintenanceProps {
  maintenanceList: MaintenanceTicket[];
  onOpenNewTicketModal?: () => void;
  onUpdateStatus?: (id: number, status: "open" | "in_progress" | "resolved" | "closed", cost?: number) => void;
  onExport: () => void;
}

// تمت الاضافة: تقرير وبلاغات الصيانة مع بحث مستقل وترقيم وتحديث الحالات المباشر
export const MaintenanceReport: React.FC<MaintenanceProps> = ({
  maintenanceList,
  onOpenNewTicketModal,
  onUpdateStatus,
  onExport
}) => {
  // تمت الاضافة: بحث مستقل لتقرير الصيانة
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const filteredTickets = useMemo(() => {
    const q = maintenanceSearch.trim().toLowerCase();
    return maintenanceList.filter((m) => {
      const matchStatus = statusFilter === "all" || m.status === statusFilter;
      if (!matchStatus) return false;
      if (!q) return true;
      const rNum = (m.room_number || "").toLowerCase();
      const prob = (m.problem || "").toLowerCase();
      const tech = (m.assigned_technician_name || "").toLowerCase();
      const desc = (m.description || "").toLowerCase();
      return rNum.includes(q) || prob.includes(q) || tech.includes(q) || desc.includes(q);
    });
  }, [maintenanceList, maintenanceSearch, statusFilter]);

  const pageCount = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage, itemsPerPage]);

  const totalCost = useMemo(() => {
    return filteredTickets.reduce((sum, m) => sum + Number(m.cost || 0), 0);
  }, [filteredTickets]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الغرفة، العطل، الفني المكلف، أو الوصف..."
            value={maintenanceSearch}
            onChange={(e) => {
              setMaintenanceSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="all">كل الحالات ({maintenanceList.length})</option>
            <option value="open">مفتوح / جاري ({maintenanceList.filter(m => m.status === 'open').length})</option>
            <option value="resolved">تم الإصلاح ({maintenanceList.filter(m => m.status === 'resolved' || m.status === 'closed').length})</option>
          </select>

          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl font-bold">
            تكاليف الصيانة: {Number(totalCost || 0 || 0).toLocaleString()} ج.م
          </div>

          {onOpenNewTicketModal && (
            <button
              onClick={onOpenNewTicketModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> بلاغ جديد
            </button>
          )}

          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> تصدير
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
                <th className="p-3">الغرفة</th>
                <th className="p-3">نوع المشكلة / العطل</th>
                <th className="p-3">الأولوية</th>
                <th className="p-3">الفني المسؤول</th>
                <th className="p-3">التكلفة الفعلية</th>
                <th className="p-3">تاريخ البلاغ</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد بلاغات صيانة مطابقة
                  </td>
                </tr>
              ) : (
                paginatedData.map((m, idx) => {
                  const createdFormatted = m.created_at
                    ? new Date(m.created_at).toLocaleDateString("ar-EG")
                    : "-";
                  const isOpen = m.status === "open" || m.status === "in_progress";

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {m.room_number ? `غرفة ${m.room_number}` : "-"}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{m.problem}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.priority === "urgent" || m.priority === "high"
                              ? "bg-rose-100 text-rose-800"
                              : m.priority === "medium"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {m.priority === "urgent"
                            ? "عاجل جداً"
                            : m.priority === "high"
                            ? "أولوية عالية"
                            : m.priority === "medium"
                            ? "متوسطة"
                            : "عادية"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{m.assigned_technician_name || "لم يحدد"}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {Number(m.cost || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 text-slate-500">{createdFormatted}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status === "resolved" || m.status === "closed"
                              ? "bg-emerald-100 text-emerald-800"
                              : m.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {m.status === "resolved" || m.status === "closed"
                            ? "تم الإصلاح"
                            : m.status === "in_progress"
                            ? "جاري العمل"
                            : "مفتوح (Open)"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isOpen && onUpdateStatus ? (
                          <button
                            onClick={() => onUpdateStatus(m.id, "resolved")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition border border-emerald-200"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> إغلاق وتأكيد الإصلاح
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
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
          totalItems={filteredTickets.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
