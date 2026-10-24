import React, { useState, useMemo } from "react";
import { Search, Moon, CheckCircle, AlertTriangle, ShieldCheck, Download, RefreshCw } from "lucide-react";
import { NightAuditRecord } from "../types";
import { HotelPagination } from "../HotelPagination";

interface NightAuditProps {
  audits: NightAuditRecord[];
  onRunNightAudit?: () => void;
  isRunning?: boolean;
  onExport: () => void;
}

// تمت الاضافة: تقرير وسجل المراجعة الليلية مع بحث مستقل وترقيم وزر تشغيل المراجعة الفندقية
export const NightAuditReport: React.FC<NightAuditProps> = ({
  audits,
  onRunNightAudit,
  isRunning = false,
  onExport
}) => {
  // تمت الاضافة: بحث مستقل
  const [auditSearch, setAuditSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const filteredAudits = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return audits;
    return audits.filter((a) => {
      const date = (a.audit_date || "").toLowerCase();
      const by = (a.audited_by || "").toLowerCase();
      const notes = (a.audit_notes || "").toLowerCase();
      return date.includes(q) || by.includes(q) || notes.includes(q);
    });
  }, [audits, auditSearch]);

  const pageCount = Math.ceil(filteredAudits.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredAudits.slice(start, start + itemsPerPage);
  }, [filteredAudits, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بتاريخ المراجعة، اسم المراجع، أو الملاحظات..."
            value={auditSearch}
            onChange={(e) => {
              setAuditSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {onRunNightAudit && (
            <button
              onClick={onRunNightAudit}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Moon className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
              {isRunning ? "جاري تشغيل المراجعة..." : "تشغيل المراجعة الليلية (End of Day)"}
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
                <th className="p-3">تاريخ دورة المراجعة</th>
                <th className="p-3">إجمالي الغرف</th>
                <th className="p-3">المشغولة</th>
                <th className="p-3">نسبة الإشغال</th>
                <th className="p-3">إيراد الإقامة</th>
                <th className="p-3">إيراد الخدمات والمطاعم</th>
                <th className="p-3">الضريبة 14%</th>
                <th className="p-3">الإجمالي العام</th>
                <th className="p-3">المراجع المسؤول</th>
                <th className="p-3">حالة الإقفال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد سجلات مراجعة ليلية مسجلة
                  </td>
                </tr>
              ) : (
                paginatedData.map((a, idx) => {
                  const auditDateFormatted = a.audit_date
                    ? new Date(a.audit_date).toLocaleDateString("ar-EG")
                    : "-";

                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-indigo-900 font-mono">
                        {auditDateFormatted}
                      </td>
                      <td className="p-3 font-mono">{a.total_rooms}</td>
                      <td className="p-3 font-mono font-bold text-teal-700">
                        {a.occupied_rooms}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-700">
                        {a.occupancy_rate}%
                      </td>
                      <td className="p-3 font-mono text-slate-800">
                        {Number(a.total_room_revenue || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-mono text-slate-800">
                        {Number(a.total_service_revenue || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {Number(a.total_tax || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 font-mono font-black text-indigo-950">
                        {Number(a.grand_total_revenue || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 text-slate-600">{a.audited_by || "النظام الآلي"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            a.status === "closed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {a.status === "closed" ? "مغلق ومرحل للحسابات" : "جاري المعالجة"}
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
          totalItems={filteredAudits.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
