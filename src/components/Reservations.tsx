import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Phone,
  User,
  Check,
  X,
  Trash2,
  Edit,
  FileText,
  Download,
  Printer,
} from "lucide-react";
import { api, authHeaders } from "../utils/api";

interface Branch {
  id: number;
  name: string;
}

interface Reservation {
  id: number;
  branch_id: number;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  guests_count: number;
  table_number: number | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes: string;
}

interface ReservationsProps {
  selectedBranch: Branch | null;
  onBack: () => void;
  subView?: string;
}

export const Reservations: React.FC<ReservationsProps> = ({
  selectedBranch,
  onBack,
  subView,
}) => {
  if (subView === "reservations_report") {
    return (
      <ReservationsReportView selectedBranch={selectedBranch} onBack={onBack} />
    );
  }

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    reservation_date: new Date().toISOString().split("T")[0],
    reservation_time: "20:00",
    guests_count: 2,
    table_number: "",
    notes: "",
  });

  useEffect(() => {
    fetchReservations();
  }, [selectedBranch, selectedDate]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/reservations", window.location.origin);
      if (selectedBranch && selectedBranch.id)
        url.searchParams.append("branchId", selectedBranch.id.toString());
      if (selectedDate) url.searchParams.append("date", selectedDate);

      const res = await fetch(url.toString(), {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setReservations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch reservations", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        branch_id: selectedBranch?.id || 1,
        table_number: formData.table_number
          ? parseInt(formData.table_number)
          : null,
      };

      const url = editingId
        ? `/api/reservations/${editingId}`
        : "/api/reservations";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchReservations();
      } else {
        alert("حدث خطأ أثناء حفظ الحجز");
      }
    } catch (error) {
      console.error("Failed to save reservation", error);
      alert("حدث خطأ أثناء حفظ الحجز");
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}/status`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchReservations();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const deleteReservation = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الحجز؟")) return;
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      if (res.ok) {
        fetchReservations();
      }
    } catch (error) {
      console.error("Failed to delete reservation", error);
    }
  };

  const handleEdit = (reservation: Reservation) => {
    setFormData({
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      guests_count: reservation.guests_count,
      table_number: reservation.table_number?.toString() || "",
      notes: reservation.notes || "",
    });
    setEditingId(reservation.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_phone: "",
      reservation_date: selectedDate,
      reservation_time: "20:00",
      guests_count: 2,
      table_number: "",
      notes: "",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "قيد الانتظار";
      case "confirmed":
        return "مؤكد";
      case "completed":
        return "مكتمل";
      case "cancelled":
        return "ملغي";
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              إدارة الحجوزات
            </h1>
            <p className="text-sm text-slate-500">
              {selectedBranch ? `فرع ${selectedBranch.name}` : "جميع الفروع"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors font-bold"
          >
            <Plus className="w-5 h-5" />
            <span>حجز جديد</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500">جاري التحميل...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CalendarIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">لا توجد حجوزات في هذا اليوم</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reservations.map((reservation) => (
              <motion.div
                key={reservation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <User className="w-5 h-5 text-slate-400" />
                      {reservation.customer_name}
                    </h3>
                    <p className="text-slate-500 flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4" />
                      {reservation.customer_phone}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(reservation.status)}`}
                  >
                    {getStatusText(reservation.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="font-bold">
                      {reservation.reservation_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span className="font-bold">
                      {reservation.guests_count} أشخاص
                    </span>
                  </div>
                  {reservation.table_number && (
                    <div className="col-span-2 flex items-center gap-2 text-slate-700">
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                        T
                      </div>
                      <span className="font-bold">
                        طاولة {reservation.table_number}
                      </span>
                    </div>
                  )}
                </div>

                {reservation.notes && (
                  <div className="mb-4 text-sm text-slate-600 bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p>{reservation.notes}</p>
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    {reservation.status === "pending" && (
                      <button
                        onClick={() =>
                          updateStatus(reservation.id, "confirmed")
                        }
                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="تأكيد الحجز"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                    {(reservation.status === "pending" ||
                      reservation.status === "confirmed") && (
                      <button
                        onClick={() =>
                          updateStatus(reservation.id, "completed")
                        }
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                        title="اكتمل الحجز"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                    {reservation.status !== "cancelled" &&
                      reservation.status !== "completed" && (
                        <button
                          onClick={() =>
                            updateStatus(reservation.id, "cancelled")
                          }
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="إلغاء الحجز"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(reservation)}
                      className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                      title="تعديل"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteReservation(reservation.id)}
                      className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingId ? "تعديل الحجز" : "حجز جديد"}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      اسم العميل *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_name: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="اسم العميل"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      رقم الهاتف *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.customer_phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_phone: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="رقم الهاتف"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      التاريخ *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.reservation_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reservation_date: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الوقت *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.reservation_time}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reservation_time: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      عدد الأشخاص *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.guests_count}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          guests_count: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      رقم الطاولة (اختياري)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.table_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          table_number: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="رقم الطاولة"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      ملاحظات (اختياري)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all resize-none h-24"
                      placeholder="أي ملاحظات إضافية..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors"
                  >
                    {editingId ? "حفظ التعديلات" : "تأكيد الحجز"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

import * as XLSX from "xlsx";

const ReservationsReportView: React.FC<{
  selectedBranch: any | null;
  onBack: () => void;
}> = ({ selectedBranch, onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let endpoint = "/api/reports/branch/reservations";
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);

        if (params.toString()) {
          endpoint += `?${params.toString()}`;
        }

        const res = await api.get(endpoint);
        if (res.ok) {
          const result = await res.json();
          const parsedData = Array.isArray(result) ? result : [];
          setData(parsedData);
          setFilteredData(parsedData);
        }
      } catch (error) {
        console.error("Failed to fetch report", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredData(data);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredData(
        data.filter((row) => {
          return Object.values(row).some((val) =>
            String(val).toLowerCase().includes(lowerQuery),
          );
        }),
      );
    }
  }, [searchQuery, data]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = () => {
    if (filteredData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations_Report");
    XLSX.writeFile(
      workbook,
      `Reservations_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  return (
    <div
      className="flex flex-col h-screen bg-slate-50 p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">تقارير الحجوزات</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-sm tracking-wide font-medium"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل Excel</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 mb-6 print:hidden">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            بحث باسم العميل / التفاصيل
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
            />
          </div>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            من تاريخ
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            إلى تاريخ
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm printable-area">
          <div className="print:block hidden mb-6 text-center">
            <h2 className="text-2xl font-bold mb-2">تقارير الحجوزات</h2>
            {(startDate || endDate) && (
              <p className="text-sm text-gray-500">
                من: {startDate || "-"} إلى: {endDate || "-"}
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  {filteredData.length > 0 &&
                    Object.keys(filteredData[0]).map((key, i) => (
                      <th
                        key={i}
                        className="p-4 border-b border-slate-200 whitespace-nowrap"
                      >
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="p-4 whitespace-nowrap">
                        {typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      لا توجد بيانات تطابق بحثك
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
