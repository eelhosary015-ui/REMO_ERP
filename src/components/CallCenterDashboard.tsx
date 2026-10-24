import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  PhoneCall,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "../utils/api";
import type { Branch } from "../types";
import type { POSConfiguration } from "../utils/posSettings";

interface CallCenterDashboardProps {
  branch: Branch | null;
  branches: Branch[];
  config: POSConfiguration;
  onBack: () => void;
}

type RangePreset = "today" | "7" | "30" | "month" | "custom";

const toLocalISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const shiftDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

const presetRange = (preset: RangePreset): { start: string; end: string } => {
  const today = toLocalISO(new Date());
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "7":
      return { start: shiftDays(-6), end: today };
    case "30":
      return { start: shiftDays(-29), end: today };
    case "month": {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toLocalISO(first), end: today };
    }
    default:
      return { start: today, end: today };
  }
};

const parseAmount = (value: any): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]+/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export const CallCenterDashboard: React.FC<CallCenterDashboardProps> = ({
  branch,
  branches,
  config,
  onBack,
}) => {
  const currency =
    config?.pricing?.currency || (config?.pricing as any)?.currencySymbol || "ج.م";

  const [preset, setPreset] = useState<RangePreset>("7");
  const [startDate, setStartDate] = useState(() => presetRange("7").start);
  const [endDate, setEndDate] = useState(() => presetRange("7").end);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branch?.id ? String(branch.id) : "all"
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (next: RangePreset) => {
    setPreset(next);
    if (next !== "custom") {
      const range = presetRange(next);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        branchId: selectedBranchId || "all",
        userId: "all",
      });
      const res = await api.get(`/api/reports/branch/call-center?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `تعذر تحميل بيانات الكول سنتر (كود ${res.status})`);
      }
      const data = await res.json().catch(() => []);
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "تعذر تحميل بيانات الكول سنتر");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBranchId, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = rows.reduce(
      (sum, row) => sum + parseAmount(row["الإجمالي (ج.م)"] ?? row["الصافي"]),
      0
    );
    const count = rows.length;
    const customers = new Set(
      rows
        .map((row) => String(row["رقم الهاتف"] || "").trim())
        .filter((phone) => phone.length > 0)
    );

    const byAgent = new Map<string, { count: number; total: number }>();
    const byType = new Map<string, { count: number; total: number }>();
    const byPayment = new Map<string, { count: number; total: number }>();
    const byDay = new Map<string, { count: number; total: number }>();

    rows.forEach((row) => {
      const amount = parseAmount(row["الإجمالي (ج.م)"] ?? row["الصافي"]);
      const agent = String(row["الموظف"] || "غير محدد");
      const type = String(row["نوع الطلب"] || "غير محدد");
      const payment = String(row["طريقة الدفع"] || "غير محدد");
      const day = String(row["التاريخ"] || "");

      const bump = (map: Map<string, { count: number; total: number }>, key: string) => {
        const prev = map.get(key) || { count: 0, total: 0 };
        map.set(key, { count: prev.count + 1, total: prev.total + amount });
      };

      bump(byAgent, agent);
      bump(byType, type);
      bump(byPayment, payment);
      if (day) bump(byDay, day);
    });

    const sortedAgents = [...byAgent.entries()].sort((a, b) => b[1].total - a[1].total);
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
    const maxDayTotal = Math.max(...days.map(([, value]) => value.total), 1);
    const maxTypeTotal = Math.max(...[...byType.values()].map((value) => value.total), 1);
    const maxPaymentTotal = Math.max(...[...byPayment.values()].map((value) => value.total), 1);

    return {
      total,
      count,
      average: count > 0 ? total / count : 0,
      customers: customers.size,
      agents: sortedAgents,
      topAgent: sortedAgents[0] || null,
      types: [...byType.entries()].sort((a, b) => b[1].total - a[1].total),
      payments: [...byPayment.entries()].sort((a, b) => b[1].total - a[1].total),
      days,
      maxDayTotal,
      maxTypeTotal,
      maxPaymentTotal,
      latest: rows
        .slice()
        .sort(
          (a, b) =>
            Number(b["رقم الطلب"] || 0) - Number(a["رقم الطلب"] || 0)
        )
        .slice(0, 8),
    };
  }, [rows]);

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen h-full bg-slate-50 flex flex-col overflow-hidden text-right font-cairo" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">داشبورد نقطة بيع الكول سنتر</h1>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              مؤشرات أوردرات الكول سنتر فقط: المبيعات، متوسط الفاتورة، أنواع الطلب وأداء الموظفين
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg text-[11px] font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
            قناة الكول سنتر فقط
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "today", label: "اليوم" },
              { id: "7", label: "7 أيام" },
              { id: "30", label: "30 يوم" },
              { id: "month", label: "هذا الشهر" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPreset(item.id as RangePreset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  preset === item.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setPreset("custom");
                setStartDate(e.target.value);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs font-bold text-slate-400">إلى</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPreset("custom");
                setEndDate(e.target.value);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {(branches?.length || 0) > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">كل الفروع</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="w-9 h-9 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-500">جاري تحميل مؤشرات الكول سنتر...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 rounded-2xl border border-rose-200 p-10 text-center">
            <p className="text-sm font-black text-rose-700">{error}</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
                <p className="text-[10px] text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <Receipt className="w-3 h-3" /> أوردرات الكول سنتر
                </p>
                <p className="text-2xl font-black">{stats.count.toLocaleString("ar-EG")}</p>
                <p className="text-[9px] text-slate-400 mt-1">عدد الأوردرات في الفترة</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-200">
                <p className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-emerald-600" /> إجمالي المبيعات
                </p>
                <p className="text-2xl font-black text-emerald-600">{formatMoney(stats.total)}</p>
                <p className="text-[9px] text-slate-400 mt-1">{currency} — صافي الفترة</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-blue-600" /> متوسط الأوردر
                </p>
                <p className="text-2xl font-black text-slate-900">{formatMoney(stats.average)}</p>
                <p className="text-[9px] text-slate-400 mt-1">{currency} / أوردر</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-purple-600" /> عملاء مختلفون
                </p>
                <p className="text-2xl font-black text-purple-700">{stats.customers.toLocaleString("ar-EG")}</p>
                <p className="text-[9px] text-slate-400 mt-1">حسب رقم الهاتف</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-200">
                <p className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <PhoneCall className="w-3 h-3 text-amber-600" /> أفضل موظف
                </p>
                <p className="text-lg font-black text-slate-900 truncate">
                  {stats.topAgent ? stats.topAgent[0] : "—"}
                </p>
                <p className="text-[9px] text-slate-400 mt-1">
                  {stats.topAgent
                    ? `${stats.topAgent[1].count} أوردر · ${formatMoney(stats.topAgent[1].total)} ${currency}`
                    : "لا توجد بيانات"}
                </p>
              </div>
            </div>

            {stats.count === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center flex flex-col items-center gap-3">
                <PhoneCall className="w-12 h-12 text-slate-300 stroke-[1.2]" />
                <p className="text-sm font-black text-slate-500">
                  لا توجد أوردرات كول سنتر في الفترة المختارة
                </p>
                <p className="text-xs text-slate-400">
                  أي أوردر جديد يتم من شاشة نقطة البيع الكول سنتر سيظهر هنا تلقائيًا.
                </p>
              </div>
            ) : (
              <>
                {/* Daily chart + mixes */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 xl:col-span-1">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-600" />
                      مبيعات الفترة
                    </h3>
                    <div className="flex items-end justify-between gap-2 h-44">
                      {stats.days.map(([day, value]) => {
                        const height = Math.max(
                          6,
                          Math.round((value.total / stats.maxDayTotal) * 100)
                        );
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-500">
                              {formatMoney(value.total)}
                            </span>
                            <div className="w-full h-32 bg-slate-100 rounded-lg flex items-end overflow-hidden">
                              <div
                                className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-lg"
                                style={{ height: `${height}%` }}
                                title={`${day}: ${formatMoney(value.total)} ${currency}`}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono" dir="ltr">
                              {day.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-purple-600" />
                      توزيع أنواع الطلب
                    </h3>
                    <div className="space-y-3">
                      {stats.types.length === 0 && (
                        <p className="text-sm text-slate-400">لا توجد بيانات</p>
                      )}
                      {stats.types.map(([label, value]) => {
                        const percent = Math.round((value.total / stats.maxTypeTotal) * 100);
                        return (
                          <div key={label}>
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span className="text-slate-700">{label}</span>
                              <span className="text-slate-500">
                                {value.count} أوردر · {formatMoney(value.total)} {currency}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      توزيع طرق الدفع
                    </h3>
                    <div className="space-y-3">
                      {stats.payments.length === 0 && (
                        <p className="text-sm text-slate-400">لا توجد بيانات</p>
                      )}
                      {stats.payments.map(([label, value]) => {
                        const percent = Math.round((value.total / stats.maxPaymentTotal) * 100);
                        return (
                          <div key={label}>
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span className="text-slate-700">{label}</span>
                              <span className="text-slate-500">
                                {value.count} أوردر · {formatMoney(value.total)} {currency}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Agents + latest orders */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-600" />
                      <h3 className="font-black text-slate-800">أداء موظفي الكول سنتر</h3>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-right p-3 font-black">الموظف</th>
                          <th className="text-center p-3 font-black">الأوردرات</th>
                          <th className="text-center p-3 font-black">المبيعات</th>
                          <th className="text-center p-3 font-black">المتوسط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.agents.map(([agent, value], index) => (
                          <tr key={agent} className="border-t border-slate-100">
                            <td className="p-3 font-bold text-slate-800">
                              <span className="text-slate-400 font-mono ml-1">#{index + 1}</span>{" "}
                              {agent}
                            </td>
                            <td className="p-3 text-center font-bold">{value.count}</td>
                            <td className="p-3 text-center font-black text-emerald-600">
                              {formatMoney(value.total)}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-600">
                              {formatMoney(value.count ? value.total / value.count : 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-cyan-600" />
                      <h3 className="font-black text-slate-800">أحدث أوردرات الكول سنتر</h3>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-right p-3 font-black">الأوردر</th>
                          <th className="text-right p-3 font-black">العميل</th>
                          <th className="text-center p-3 font-black">النوع</th>
                          <th className="text-center p-3 font-black">الإجمالي</th>
                          <th className="text-center p-3 font-black">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.latest.map((row, index) => (
                          <tr key={`${row["رقم الطلب"]}-${index}`} className="border-t border-slate-100">
                            <td className="p-3 font-mono font-black text-slate-800" dir="ltr">
                              #{row["رقم الطلب"]}
                            </td>
                            <td className="p-3 font-bold text-slate-700">
                              {row["اسم العميل"] || "عميل نقدي"}
                              <span className="block text-[10px] text-slate-400 font-mono" dir="ltr">
                                {row["رقم الهاتف"] || ""}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-600">
                              {row["نوع الطلب"] || "-"}
                            </td>
                            <td className="p-3 text-center font-black text-emerald-600">
                              {formatMoney(parseAmount(row["الإجمالي (ج.م)"]))}
                            </td>
                            <td className="p-3 text-center text-[10px] text-slate-500 font-bold">
                              {row["التاريخ"] || "-"}
                              <span className="block text-slate-400">{row["الوقت"] || ""}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CallCenterDashboard;
