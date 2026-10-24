import React, { useState, useMemo } from "react";
import { Search, Sparkles, CheckCircle, Clock, XCircle, Download } from "lucide-react";
import { HousekeepingTask, ServiceOrder } from "../types";
import { HotelPagination } from "../HotelPagination";

interface HousekeepingServicesProps {
  tasks: HousekeepingTask[];
  serviceOrders: ServiceOrder[];
  onUpdateTaskStatus?: (taskId: number, status: "clean" | "dirty" | "cleaning" | "inspected") => void;
  onExport: () => void;
}

// تمت الاضافة: تقرير خدمات الإشراف الداخلي وطلبات النزلاء مع بحث مستقل وترقيم
export const HousekeepingServices: React.FC<HousekeepingServicesProps> = ({
  tasks,
  serviceOrders,
  onUpdateTaskStatus,
  onExport
}) => {
  // تمت الاضافة: بحث مستقل
  const [hkSearch, setHkSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"tasks" | "orders">("tasks");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const filteredTasks = useMemo(() => {
    const q = hkSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const rNum = (t.room_number || "").toLowerCase();
      const staff = (t.assigned_staff_name || "").toLowerCase();
      const notes = (t.notes || "").toLowerCase();
      return rNum.includes(q) || staff.includes(q) || notes.includes(q);
    });
  }, [tasks, hkSearch]);

  const filteredOrders = useMemo(() => {
    const q = hkSearch.trim().toLowerCase();
    if (!q) return serviceOrders;
    return serviceOrders.filter((o) => {
      const rNum = (o.room_number || "").toLowerCase();
      const sName = (o.service_name || "").toLowerCase();
      const gName = (o.guest_name || "").toLowerCase();
      const staff = (o.staff_name || "").toLowerCase();
      return rNum.includes(q) || sName.includes(q) || gName.includes(q) || staff.includes(q);
    });
  }, [serviceOrders, hkSearch]);

  const currentDatasetLength = activeTab === "tasks" ? filteredTasks.length : filteredOrders.length;
  const pageCount = Math.ceil(currentDatasetLength / itemsPerPage);

  const paginatedTasks = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredTasks.slice(start, start + itemsPerPage);
  }, [filteredTasks, currentPage, itemsPerPage]);

  const paginatedOrders = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Sub Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("tasks");
              setCurrentPage(0);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "tasks"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            نظافة الغرف ({tasks.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("orders");
              setCurrentPage(0);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "orders"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            طلبات الخدمة ({serviceOrders.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم الغرفة، اسم الموظف، أو الخدمة..."
              value={hkSearch}
              onChange={(e) => {
                setHkSearch(e.target.value);
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
      </div>

      {/* Tables */}
      {activeTab === "tasks" ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">الغرفة</th>
                  <th className="p-3">الدور</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">المسؤول المكلف</th>
                  <th className="p-3">حالة النظافة</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3 text-center">تحديث الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد مهام إشراف داخلي مطابقة
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {t.room_number ? `غرفة ${t.room_number}` : "-"}
                      </td>
                      <td className="p-3 text-slate-600">الدور {t.floor || 1}</td>
                      <td className="p-3 text-slate-600">{t.room_type_name || "-"}</td>
                      <td className="p-3 font-bold text-slate-700">
                        {t.assigned_staff_name || "غير محدد"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.cleaning_status === "clean"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.cleaning_status === "inspected"
                              ? "bg-blue-100 text-blue-800"
                              : t.cleaning_status === "cleaning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.cleaning_status === "clean"
                            ? "نظيفة وجاهزة"
                            : t.cleaning_status === "inspected"
                            ? "تم الفحص والاعتماد"
                            : t.cleaning_status === "cleaning"
                            ? "جاري التنظيف"
                            : "تحتاج تنظيف (Dirty)"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{t.notes || "-"}</td>
                      <td className="p-3 text-center">
                        {onUpdateTaskStatus && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => onUpdateTaskStatus(t.id, "clean")}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-bold border border-emerald-200"
                            >
                              جاهزة
                            </button>
                            <button
                              onClick={() => onUpdateTaskStatus(t.id, "inspected")}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold border border-blue-200"
                            >
                              اعتماد
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <HotelPagination
            pageCount={pageCount}
            onPageChange={({ selected }) => setCurrentPage(selected)}
            currentPage={currentPage}
            totalItems={filteredTasks.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">الغرفة</th>
                  <th className="p-3">النزيل</th>
                  <th className="p-3">الخدمة المطلوبة</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">الموظف المنفذ</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      لا توجد طلبات خدمة مطابقة
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o, idx) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-slate-800">غرفة {o.room_number}</td>
                      <td className="p-3 font-bold text-slate-800">{o.guest_name || "-"}</td>
                      <td className="p-3 font-bold text-teal-800">{o.service_name}</td>
                      <td className="p-3 text-slate-600 capitalize">{o.service_category}</td>
                      <td className="p-3 font-mono">{o.quantity}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {Number(o.total_price || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 text-slate-600">{o.staff_name || "-"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            o.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "in_progress"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {o.status === "completed"
                            ? "مكتمل وتم الخصم"
                            : o.status === "in_progress"
                            ? "جاري التنفيذ"
                            : "قيد الانتظار"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <HotelPagination
            pageCount={pageCount}
            onPageChange={({ selected }) => setCurrentPage(selected)}
            currentPage={currentPage}
            totalItems={filteredOrders.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      )}
    </div>
  );
};
