import React, { useState, useEffect } from "react";
import { ChevronLeft, FileText, Layout, Printer, Sparkles, Calendar, Search, RefreshCw, Filter } from "lucide-react";
import { api } from "../utils/api";
import { ReportTemplateDesigner } from "./ReportTemplateDesigner";
import { GlobalReportPrint } from "./GlobalReportPrint";

export const ModificationsReport: React.FC<{ onBack: () => void }> = ({
  onBack,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"report" | "designer">("report");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const fetchData = async (fromVal = startDate, toVal = endDate) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromVal) params.append("startDate", fromVal);
      if (toVal) params.append("endDate", toVal);

      const res = await api.get(`/api/reports/orders/modifications?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error("Failed to fetch report", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilter = () => {
    fetchData(startDate, endDate);
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    fetchData("", "");
  };

  const handleQuickPreset = (preset: "today" | "week" | "month") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    let fromStr = todayStr;

    if (preset === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      fromStr = weekAgo.toISOString().split("T")[0];
    } else if (preset === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(today.getMonth() - 1);
      fromStr = monthAgo.toISOString().split("T")[0];
    }

    setStartDate(fromStr);
    setEndDate(todayStr);
    fetchData(fromStr, todayStr);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCellValue = (val: any) => {
    if (val === null || val === undefined || val === "") return "-";
    if (typeof val === "string" && val.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(val);
        if (parsed.action === "pos_void_cancel") {
          const itemsStr = Array.isArray(parsed.items)
            ? parsed.items.map((it: any) => `${it.product_name || it.name || it.product_id} (×${it.quantity})`).join("، ")
            : "";
          return `استرجاع / إلغاء (Void) بواسطة ${parsed.user || "مستخدم"} — الأصناف: ${itemsStr || "-"}`;
        }
        if (parsed.action === "pos_void_edit") {
          const oldStr = Array.isArray(parsed.old_items)
            ? parsed.old_items.map((it: any) => `${it.product_name || it.name || it.product_id} (×${it.quantity})`).join("، ")
            : "";
          const newStr = Array.isArray(parsed.new_items)
            ? parsed.new_items.map((it: any) => `${it.product_name || it.name || it.product_id} (×${it.quantity})`).join("، ")
            : "";
          return `تعديل (Void) بواسطة ${parsed.user || "مستخدم"} | قبل: [${oldStr}] ← بعد: [${newStr}]`;
        }
      } catch {
        // Fallback to string
      }
    }
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  };

  const filteredData = data.filter((row) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return Object.values(row).some((val) =>
      String(val || "").toLowerCase().includes(s)
    );
  });

  return (
    <div
      className="flex flex-col h-screen bg-slate-50 p-6 overflow-hidden"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              تقرير تعديلات وإلغاءات النظام والسرية
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              مراقبة كافة التغييرات الحساسة على مستوى فروع المؤسسة
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 flex gap-1 shadow-sm">
          <button
            onClick={() => setActiveTab("designer")}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === "designer" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Layout className="w-4 h-4" />
            تنسيق شيت الوورد للتقارير
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === "report" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <FileText className="w-4 h-4" />
            بيانات التقرير
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar no-print space-y-4">
        {activeTab === "designer" ? (
          <ReportTemplateDesigner />
        ) : (
          <>
            {/* Filter Bar with Date Range */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap flex-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    من تاريخ:
                  </label>
                  <input
                    type="date"
                    value={startDate ?? ""}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    إلى تاريخ:
                  </label>
                  <input
                    type="date"
                    value={endDate ?? ""}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <button
                  onClick={handleApplyFilter}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  تطبيق الفلترة
                </button>

                <button
                  onClick={handleResetFilter}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  إعادة ضبط
                </button>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 border-r border-slate-200 pr-3 mr-1">
                  <span className="text-[11px] font-bold text-slate-400 ml-1">اختصار:</span>
                  <button
                    onClick={() => handleQuickPreset("today")}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all"
                  >
                    اليوم
                  </button>
                  <button
                    onClick={() => handleQuickPreset("week")}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all"
                  >
                    أسبوع
                  </button>
                  <button
                    onClick={() => handleQuickPreset("month")}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all"
                  >
                    شهر
                  </button>
                </div>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="بحث سريع..."
                  value={searchTerm ?? ""}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500 font-bold">
                  جاري تحميل مخرجات النظام...
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-700">
                      سجل الأحداث والتعديلات ({filteredData.length} سجل)
                      {(startDate || endDate) && (
                        <span className="text-xs text-blue-600 font-semibold mr-2">
                          [النطاق: {startDate || "من البداية"} إلى {endDate || "الآن"}]
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={handlePrint}
                    className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    تحميل وطباعة التقرير (ثيم الوورد)
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        {filteredData.length > 0 &&
                          Object.keys(filteredData[0]).map((key, i) => (
                            <th key={i} className="p-4 whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic font-medium">
                      {filteredData.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          {Object.values(row).map((val: any, j) => (
                            <td
                              key={j}
                              className="p-4 text-slate-600 text-xs font-bold leading-relaxed"
                            >
                              {formatCellValue(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {filteredData.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
                            className="p-20 text-center text-slate-300 font-bold"
                          >
                            لا يوجد تعديلات مسجلة في هذا النطاق الزمني
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PRINT SECTION (HIDDEN ON SCREEN) */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 0; }
          .print-template {
            display: block !important;
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            margin: 0 auto;
            background: white;
            position: relative;
          }
        }
        .print-template { display: none; }
      `}</style>

      <GlobalReportPrint title="تقرير تعديلات النظام">
        <table className="w-full border-collapse border border-slate-300 text-xs text-right">
          <thead>
            <tr className="bg-slate-100">
              {data.length > 0 &&
                Object.keys(data[0]).map((key, i) => (
                  <th
                    key={i}
                    className="border border-slate-300 p-2 text-right"
                  >
                    {key}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((val: any, j) => (
                  <td key={j} className="border border-slate-300 p-2">
                    {formatCellValue(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GlobalReportPrint>
    </div>
  );
};
