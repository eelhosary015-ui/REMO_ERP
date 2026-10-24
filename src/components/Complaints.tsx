import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  MessageSquareWarning,
  Search,
  Plus,
  X,
  CheckCircle,
  Clock,
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "../utils/fetcher";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface ComplaintsProps {
  onBack: () => void;
  selectedBranch: any;
  subView?: string;
}

export const Complaints: React.FC<ComplaintsProps> = ({
  onBack,
  selectedBranch,
  subView,
}) => {
  if (subView === "complaints_report") {
    return (
      <ComplaintsReportView selectedBranch={selectedBranch} onBack={onBack} />
    );
  }

  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "resolved"
  >("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);

  const [newComplaint, setNewComplaint] = useState({
    customer_name: "",
    phone: "",
    complaint_text: "",
  });
  const [resolutionText, setResolutionText] = useState("");

  const branchId =
    user?.role === "admin"
      ? selectedBranch?.id || "all"
      : user?.branch_id || "all";

  const { data: complaintsData, mutate } = useSWR(
    `/api/complaints?branchId=${branchId}&status=all`,
    fetcher,
  );
  const complaints = Array.isArray(complaintsData) ? complaintsData : [];

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      (c.customer_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (c.phone || "").includes(searchQuery) ||
      (c.complaint_text || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/complaints", {
        ...newComplaint,
        branch_id: selectedBranch?.id || user?.branch_id,
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewComplaint({ customer_name: "", phone: "", complaint_text: "" });
        mutate();
      }
    } catch (error) {
      console.error("Failed to add complaint", error);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    try {
      const res = await api.put(
        `/api/complaints/${selectedComplaint.id}/resolve`,
        {
          resolution_text: resolutionText,
        },
      );
      if (res.ok) {
        setShowResolveModal(false);
        setSelectedComplaint(null);
        setResolutionText("");
        mutate();
      }
    } catch (error) {
      console.error("Failed to resolve complaint", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquareWarning className="w-6 h-6 text-red-500" />
              الشكاوي
            </h1>
            <p className="text-sm text-slate-500">متابعة وحل شكاوي العملاء</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة شكوى
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="w-full space-y-6">
          {/* Search and Filter */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث باسم العميل، رقم الهاتف، أو نص الشكوى..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  statusFilter === "all"
                    ? "bg-slate-800 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                الكل ({complaints.length})
              </button>
              <button
                onClick={() => setStatusFilter("pending")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === "pending"
                    ? "bg-amber-500 text-white shadow-md"
                    : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                }`}
              >
                <Clock className="w-4 h-4" />
                قيد الانتظار (
                {complaints.filter((c) => c.status === "pending").length})
              </button>
              <button
                onClick={() => setStatusFilter("resolved")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === "resolved"
                    ? "bg-emerald-500 text-white shadow-md"
                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                تم الحل (
                {complaints.filter((c) => c.status === "resolved").length})
              </button>
            </div>
          </div>

          {/* Complaints List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredComplaints.map((complaint) => (
              <div
                key={complaint.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 justify-between"
              >
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-slate-800">
                        {complaint.customer_name}
                      </h3>
                      <span
                        className="text-sm text-slate-500 font-mono"
                        dir="ltr"
                      >
                        {complaint.phone}
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        complaint.status === "resolved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {complaint.status === "resolved" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {complaint.status === "resolved"
                        ? "تم الحل"
                        : "قيد الانتظار"}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-500 mb-1">
                      تفاصيل الشكوى:
                    </p>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {complaint.complaint_text}
                    </p>
                  </div>

                  {complaint.status === "resolved" &&
                    complaint.resolution_text && (
                      <div>
                        <p className="text-sm font-bold text-emerald-600 mb-1">
                          طريقة الحل:
                        </p>
                        <p className="text-slate-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          {complaint.resolution_text}
                        </p>
                      </div>
                    )}

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>الفرع: {complaint.branch_name || "غير محدد"}</span>
                    <span>
                      تاريخ الشكوى:{" "}
                      {new Date((complaint.created_at) || 0).toLocaleString("ar-EG")}
                    </span>
                    {complaint.resolved_at && (
                      <span>
                        تاريخ الحل:{" "}
                        {new Date((complaint.resolved_at) || 0).toLocaleString(
                          "ar-EG",
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {complaint.status === "pending" && (
                  <div className="flex items-center justify-end md:justify-center border-t md:border-t-0 md:border-r border-slate-100 pt-4 md:pt-0 md:pr-6">
                    <button
                      onClick={() => {
                        setSelectedComplaint(complaint);
                        setShowResolveModal(true);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-sm"
                    >
                      حل المشكلة
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredComplaints.length === 0 && (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
                <MessageSquareWarning className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">
                  لا توجد شكاوي مطابقة للبحث
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Complaint Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800">
                  إضافة شكوى جديدة
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    اسم العميل
                  </label>
                  <input
                    type="text"
                    required
                    value={newComplaint.customer_name ?? ""}
                    onChange={(e) =>
                      setNewComplaint({
                        ...newComplaint,
                        customer_name: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    required
                    value={newComplaint.phone ?? ""}
                    onChange={(e) =>
                      setNewComplaint({
                        ...newComplaint,
                        phone: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    تفاصيل الشكوى
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newComplaint.complaint_text ?? ""}
                    onChange={(e) =>
                      setNewComplaint({
                        ...newComplaint,
                        complaint_text: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    حفظ الشكوى
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Resolve Complaint Modal */}
        {showResolveModal && selectedComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResolveModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                <h2 className="text-xl font-bold text-emerald-800">
                  حل المشكلة
                </h2>
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                  <p className="text-sm font-bold text-slate-700 mb-1">
                    شكوى العميل: {selectedComplaint.customer_name}
                  </p>
                  <p className="text-slate-600 text-sm">
                    {selectedComplaint.complaint_text}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    كيف تم حل المشكلة؟
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={resolutionText ?? ""}
                    onChange={(e) => setResolutionText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 resize-none"
                    placeholder="اكتب تفاصيل الإجراء المتخذ لحل المشكلة وإرضاء العميل..."
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    تأكيد الحل
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResolveModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
                  >
                    إلغاء
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

import { Download, Printer } from "lucide-react";
import * as XLSX from "xlsx";

const ComplaintsReportView: React.FC<{
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
        let endpoint = "/api/reports/branch/complaints";
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Complaints_Report");
    XLSX.writeFile(
      workbook,
      `Complaints_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
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
          <h1 className="text-2xl font-bold text-slate-900">تقارير الشكاوي</h1>
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
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm tracking-wide font-medium"
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
              value={searchQuery ?? ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
            />
          </div>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            من تاريخ
          </label>
          <input
            type="date"
            value={startDate ?? ""}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            إلى تاريخ
          </label>
          <input
            type="date"
            value={endDate ?? ""}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm printable-area">
          <div className="print:block hidden mb-6 text-center">
            <h2 className="text-2xl font-bold mb-2">تقارير الشكاوي</h2>
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
