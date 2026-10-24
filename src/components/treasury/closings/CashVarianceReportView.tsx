import React, { useState, useEffect, useCallback } from "react";
import { authHeaders } from "../../../utils/api";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Calendar,
  Building2,
  User,
  ShieldAlert,
  Search,
  Filter,
  ArrowUpRight,
  CheckCircle2
} from "lucide-react";
import { TreasuryAccount } from "../../../types";

interface CashVarianceReportViewProps {
  treasuries: TreasuryAccount[];
}

export const CashVarianceReportView: React.FC<CashVarianceReportViewProps> = ({ treasuries }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reportData, setReportData] = useState<any>({
    summary: { total_records: 0, total_deficit: 0, total_surplus: 0, net_variance: 0 },
    user_breakdown: [],
    records: []
  });

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTreasuryId !== "all") params.set("treasury_id", selectedTreasuryId);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const res = await fetch(`/api/treasury/variance-report?${params.toString()}`, {
        headers: authHeaders()
      });

      if (!res.ok) throw new Error("فشل جلب تقرير فروقات الخزائن");
      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      console.error("Error fetching variance report:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTreasuryId, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const { summary, user_breakdown, records } = reportData;

  return (
    <div id="cash-variance-report-container" className="space-y-6 text-right">
      {/* 1. Header & Filters Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">
                تقرير تحليل فروقات الجرد النقدي (العجز والزيادة)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                رصد وتحليل فروقات الخزائن والتسويات المالية بحسب المسئولين والخزائن والفروع
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchReport()}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-rose-600" : ""}`} />
              تحديث البيانات
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة التقرير
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">تصفية حسب الخزينة</label>
            <select
              value={selectedTreasuryId}
              onChange={(e) => setSelectedTreasuryId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
            >
              <option value="all">جميع الخزائن</option>
              {treasuries.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ البداية</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ النهاية</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>عدد الإقفالات ذات الفروقات</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary.total_records} <span className="text-xs font-normal text-slate-400">حالة</span>
          </div>
        </div>

        <div className="bg-rose-50/80 p-5 rounded-2xl border border-rose-200 shadow-2xs space-y-2">
          <div className="text-xs font-bold text-rose-700 flex items-center justify-between">
            <span>إجمالي العجز النقدي</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">
            {Number(summary.total_deficit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
          </div>
        </div>

        <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-200 shadow-2xs space-y-2">
          <div className="text-xs font-bold text-blue-700 flex items-center justify-between">
            <span>إجمالي الزيادة النقدية</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">
            {Number(summary.total_surplus || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
          </div>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-2xs space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>صافي الفارق الكلي</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">
            {Number(summary.net_variance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
          </div>
        </div>
      </div>

      {/* 3. User Breakdown & Detailed Table Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* User Aggregation Side Column */}
        <div className="xl:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            توزيع الفروقات بحسب أمين الخزينة
          </h3>

          <div className="space-y-2.5">
            {user_breakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">لا توجد بيانات متاحة للمسئولين</p>
            ) : (
              user_breakdown.map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.user}</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded text-slate-500 border border-slate-200">
                      {item.count} إقفال
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                    <span className="text-rose-600 font-bold">عجز: -{item.deficit.toLocaleString()} ج.م</span>
                    <span className="text-blue-600 font-bold">زيادة: +{item.surplus.toLocaleString()} ج.م</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="xl:col-span-8 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-rose-600" />
            جدول سجلات الفروقات والجرد
          </h3>

          {isLoading ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-600 mx-auto" />
              <p className="text-xs text-slate-500 mt-2">جاري استخراج بيانات التقرير...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">جميع الإقفالات سليمة ومطابقة تماماً!</p>
              <p className="text-xs">لم يتم تسجيل أي حالة عجز أو زيادة في الفترة المحددة</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الخزينة</th>
                    <th className="p-3">أمين الخزينة</th>
                    <th className="p-3">الدفتري</th>
                    <th className="p-3">الفعلي</th>
                    <th className="p-3">الفارق</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {records.map((r: any) => {
                    const v = Number(r.variance || 0);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-slate-500 text-[11px]">
                          {new Date(r.closing_date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{r.treasury_name}</td>
                        <td className="p-3 text-slate-700">{r.responsible_user}</td>
                        <td className="p-3 text-slate-600">{Number(r.book_balance).toLocaleString()}</td>
                        <td className="p-3 text-slate-900 font-bold">{Number(r.actual_balance).toLocaleString()}</td>
                        <td className={`p-3 font-black ${v < 0 ? "text-rose-600" : "text-blue-600"}`}>
                          {v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()} ج.م
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v < 0 ? "bg-rose-100 text-rose-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default CashVarianceReportView;
