import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  Table2,
  Coffee,
  X,
  Plus,
  Printer,
  CheckCircle2,
  Edit,
  QrCode,
  RefreshCw,
  Globe,
} from "lucide-react";
import { Branch, TableSession, POSMode } from "../types";
import { OrderEditorModal } from "./OrderEditorModal";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import QRCode from "qrcode";

const LocalQRCode = ({
  value,
  size = 150,
}: {
  value: string;
  size?: number;
}) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then(setSrc)
      .catch(console.error);
  }, [value, size]);

  if (!src)
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-slate-100 flex items-center justify-center animate-pulse rounded-lg"
      />
    );
  return <img src={src} width={size} height={size} alt="QR Code" />;
};

interface TablesProps {
  selectedBranch: Branch | null;
  onBack: () => void;
  onOpenPOS: (mode: POSMode) => void;
  subView?: string;
}

export const Tables: React.FC<TablesProps> = ({
  selectedBranch,
  onBack,
  onOpenPOS,
  subView,
}) => {
  if (subView === "tables_report") {
    return <TablesReportView selectedBranch={selectedBranch} onBack={onBack} />;
  }

  const { user } = useAuth();
  const [openTables, setOpenTables] = useState<TableSession[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedBranch) {
      fetchTablesStatus();
    }
  }, [selectedBranch]);

  const fetchTablesStatus = async () => {
    if (!selectedBranch) return;
    try {
      const res = await api.get(
        `/api/branches/${selectedBranch.id}/tables-status`,
      );
      const data = await res.json();
      setOpenTables(Array.isArray(data) ? data : []);
    } catch (error) {
      setOpenTables([]);
    }
  };

  const handleOpenTable = async (tableNumber: number) => {
    if (!selectedBranch) return;

    try {
      const shiftRes = await api.get(
        `/api/safes/branch/${selectedBranch.id}/active-shift`,
      );
      if (shiftRes.ok) {
        const shift = await shiftRes.json();
        if (!shift) {
          alert("الخزينة مغلقة. الرجاء فتح وردية أولاً من شاشة الخزائن.");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to check active shift", error);
    }

    const response = await api.post("/api/pos/order", {
      items: [],
      total: 0,
      branch_id: selectedBranch.id,
      table_number: tableNumber,
      is_paid: 0,
      user_id: user?.id,
    });
    if (response.ok) {
      const data = await response.json();
      onOpenPOS({ type: "table", tableNumber, orderId: data.orderId });
      setSelectedTable(null);
    }
  };

  const handleTableCheckout = async (orderId: number) => {
    try {
      if (!selectedBranch) return;
      const shiftRes = await api.get(
        `/api/safes/branch/${selectedBranch.id}/active-shift`,
      );
      if (shiftRes.ok) {
        const shift = await shiftRes.json();
        if (!shift) {
          alert("الخزينة مغلقة. الرجاء فتح وردية أولاً من شاشة الخزائن.");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to check active shift", error);
    }

    const response = await api.post(`/api/orders/${orderId}/checkout`, {
      user_id: user?.id,
    });
    if (response.ok) {
      fetchTablesStatus();
      setSelectedTable(null);
      alert("تم إتمام الحساب وطباعة الفاتورة");
    }
  };

  const [showQrCode, setShowQrCode] = useState(false);
  const [printAllMode, setPrintAllMode] = useState(false);
  const getMenuUrl = (tableNum: number) => {
    return `${window.location.origin}/menu/${selectedBranch?.id}/${tableNum}`;
  };

  const menuUrl =
    selectedTable && selectedBranch ? getMenuUrl(selectedTable) : "";

  if (printAllMode && selectedBranch) {
    return (
      <div className="min-h-screen bg-white p-8" dir="rtl">
        <div className="flex justify-between items-center mb-8 no-print">
          <h1 className="text-2xl font-bold font-cairo">
            طباعة باركودات الطاولات - {selectedBranch.name}
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              طباعة الآن
            </button>
            <button
              onClick={() => setPrintAllMode(false)}
              className="bg-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
          {Array.from({ length: selectedBranch.tables_count || 0 }).map(
            (_, i) => {
              const tableNum = i + 1;
              const url = getMenuUrl(tableNum);
              return (
                <div
                  key={tableNum}
                  className="border-2 border-slate-100 p-8 rounded-3xl flex flex-col items-center gap-4 page-break-inside-avoid"
                >
                  <h3 className="text-2xl font-black text-slate-800">
                    طاولة {tableNum}
                  </h3>
                  <div className="bg-white p-2 border-4 border-slate-50 inline-block shadow-sm w-[166px] h-[166px] flex items-center justify-center">
                    <LocalQRCode value={url} size={150} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate w-full">
                    {url}
                  </p>
                  <div className="text-xs font-bold text-slate-600 mt-2">
                    {selectedBranch.name}
                  </div>
                </div>
              );
            },
          )}
        </div>

        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            .page-break-inside-avoid { page-break-inside: avoid; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 p-8">
      <div className="w-full w-full">
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-lg font-bold">العودة</span>
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-3 text-slate-900">
              <Table2 className="w-6 h-6 text-emerald-600" />
              إدارة الطاولات
            </h1>
            <p className="text-emerald-600 font-bold mt-1">
              {selectedBranch?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPrintAllMode(true)}
              className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50"
            >
              <QrCode className="w-4 h-4" />
              طباعة الباركودات
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {Array.from({ length: selectedBranch?.tables_count || 0 }).map(
            (_, i) => {
              const tableNum = i + 1;
              const session = Array.isArray(openTables)
                ? openTables.find((t) => t.table_number === tableNum)
                : null;
              return (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  key={tableNum}
                  onClick={() => {
                    setSelectedTable(tableNum);
                    setShowQrCode(false);
                  }}
                  className={`bg-white p-6 rounded-3xl flex flex-col items-center gap-4 border-2 transition-all shadow-sm ${session ? "border-orange-500 bg-orange-50/30" : "border-slate-100 hover:border-emerald-500/30"}`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center ${session ? "bg-orange-100" : "bg-slate-50"}`}
                  >
                    <Coffee
                      className={`w-6 h-6 ${session ? "text-orange-600" : "text-slate-400"}`}
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-xl text-slate-900">
                      طاولة {tableNum}
                    </h3>
                    <p
                      className={`text-xs font-bold mt-1 ${session ? "text-orange-600" : "text-slate-500"}`}
                    >
                      {session ? `مفتوحة (${session.total} ج.م)` : "مغلقة"}
                    </p>
                  </div>
                </motion.button>
              );
            },
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedTable !== null && !showQrCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md p-8 rounded-3xl relative shadow-2xl border border-slate-200"
            >
              <button
                onClick={() => setSelectedTable(null)}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center gap-6">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center ${Array.isArray(openTables) && openTables.find((t) => t.table_number === selectedTable) ? "bg-orange-50" : "bg-emerald-50"}`}
                >
                  <Table2
                    className={`w-8 h-8 ${Array.isArray(openTables) && openTables.find((t) => t.table_number === selectedTable) ? "text-orange-600" : "text-emerald-600"}`}
                  />
                </div>

                <div className="flex flex-col items-center">
                  <h2 className="text-2xl font-bold mb-1 text-slate-900">
                    طاولة {selectedTable}
                  </h2>
                  <p className="text-slate-500 text-sm">
                    {Array.isArray(openTables) &&
                    openTables.find((t) => t.table_number === selectedTable)
                      ? "الطاولة مشغولة حالياً"
                      : "الطاولة متاحة للفتح"}
                  </p>
                </div>

                <div className="grid grid-cols-1 w-full gap-3">
                  {Array.isArray(openTables) &&
                  openTables.find((t) => t.table_number === selectedTable) ? (
                    <>
                      <button
                        onClick={() => {
                          const session = Array.isArray(openTables)
                            ? openTables.find(
                                (t) => t.table_number === selectedTable,
                              )
                            : null;
                          onOpenPOS({
                            type: "table",
                            tableNumber: selectedTable,
                            orderId: session?.order_id,
                          });
                          setSelectedTable(null);
                        }}
                        className="flex items-center justify-center gap-3 bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-2xl transition-all font-bold shadow-lg shadow-orange-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        إضافة طلبات
                      </button>

                      <button
                        onClick={() => {
                          const session = Array.isArray(openTables)
                            ? openTables.find(
                                (t) => t.table_number === selectedTable,
                              )
                            : null;
                          if (session) {
                            setEditingOrderId(session.order_id);
                            setSelectedTable(null);
                          }
                        }}
                        className="flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-2xl transition-all font-bold shadow-lg shadow-purple-600/20"
                      >
                        <Edit className="w-4 h-4" />
                        تعديل الطلب
                      </button>

                      <button
                        onClick={() => {
                          const session = Array.isArray(openTables)
                            ? openTables.find(
                                (t) => t.table_number === selectedTable,
                              )
                            : null;
                          if (session) handleTableCheckout(session.order_id);
                        }}
                        className="flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-2xl transition-all font-bold text-slate-700"
                      >
                        <Printer className="w-4 h-4 text-blue-600" />
                        حساب الطاولة وطباعة
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenTable(selectedTable)}
                      className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl transition-all font-bold shadow-lg shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      فتح الطاولة
                    </button>
                  )}

                  <div className="h-px bg-slate-100 my-1"></div>

                  <button
                    onClick={() => setShowQrCode(true)}
                    className="flex items-center justify-center gap-3 bg-blue-50 text-blue-600 hover:bg-blue-100 p-4 rounded-2xl transition-all font-bold"
                  >
                    <QrCode className="w-5 h-5" />
                    عرض باركود المنيو للعميل
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showQrCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md p-8 rounded-3xl relative shadow-2xl border border-slate-200 text-center"
            >
              <button
                onClick={() => setShowQrCode(false)}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-slate-800 font-cairo">
                باركود الطاولة {selectedTable}
              </h2>

              <div className="bg-white p-4 rounded-2xl border-4 border-slate-50 inline-block mb-6 shadow-sm w-[240px] h-[240px] flex items-center justify-center">
                <LocalQRCode value={menuUrl} size={200} />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl mb-6 truncate text-xs text-slate-500 font-mono">
                {menuUrl}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  طباعة الباركود
                </button>
                <button
                  onClick={() => setShowQrCode(false)}
                  className="bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {editingOrderId && (
        <OrderEditorModal
          orderId={editingOrderId}
          onClose={() => setEditingOrderId(null)}
          onSave={() => {
            fetchTablesStatus();
            setEditingOrderId(null);
          }}
        />
      )}
    </div>
  );
};

const TablesReportView: React.FC<{
  selectedBranch: any | null;
  onBack: () => void;
}> = ({ selectedBranch, onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tableNumber, setTableNumber] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let endpoint = "/api/reports/branch/tables";
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (tableNumber) params.append("tableNumber", tableNumber);

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
  }, [selectedBranch, startDate, endDate, tableNumber]);

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

  const handleDownloadExcel = async () => {
    if (filteredData.length === 0) return;
    try {
      // Need dynamic import or have it global so we don't break if not cleanly imported.
      // Assuming XLSX is available or we use dynamic import
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(filteredData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tables_Report");
      XLSX.writeFile(
        workbook,
        `Tables_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch (e) {
      console.error(e);
      alert("فشل في تنزيل التقرير");
    }
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
          <h1 className="text-2xl font-bold text-slate-900">تقارير الطاولات</h1>
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
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm tracking-wide font-medium"
          >
            <Printer className="w-4 h-4" />{" "}
            {/* Use general icon since download not directly imported if not there */}
            <span>تنزيل Excel</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 mb-6 print:hidden">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            بحث بالتفاصيل
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>
        <div className="w-full md:w-32">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            رقم الطاولة
          </label>
          <input
            type="text"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="مثال: 5"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            من تاريخ
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
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
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm printable-area">
          <div className="print:block hidden mb-6 text-center">
            <h2 className="text-2xl font-bold mb-2">تقارير الطاولات</h2>
            {(startDate || endDate) && (
              <p className="text-sm text-gray-500">
                من: {startDate || "-"} إلى: {endDate || "-"}
              </p>
            )}
            {tableNumber && (
              <p className="text-sm text-gray-500">
                رقم الطاولة: {tableNumber}
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
