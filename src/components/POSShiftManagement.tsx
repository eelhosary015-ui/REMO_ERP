import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock3, RefreshCw, Search, Wallet } from "lucide-react";
import { api } from "../utils/api";
import type { Branch } from "../types";
import type { POSConfiguration } from "../utils/posSettings";

type ShiftRecord = Record<string, any>;

interface POSShiftManagementProps {
  branch: Branch | null;
  config: POSConfiguration;
  terminalId: string;
  onTerminalIdChange: (terminalId: string) => void;
  onBack: () => void;
}

const money = (value: unknown) => Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString("ar-EG") : "—";

export function POSShiftManagement({ branch, config, terminalId, onTerminalIdChange, onBack }: POSShiftManagementProps) {
  const [options, setOptions] = useState<any>({ cashboxes: [], activeShift: null, summary: {} });
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [terminalInput, setTerminalInput] = useState(terminalId);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const branchId = branch?.id;
    const query = new URLSearchParams({
      branchId: String(branchId || ""),
      terminalId,
    });
    const [optionsRes, shiftsRes] = await Promise.all([
      api.get(`/api/pos/shifts/options?${query}`),
      api.get(`/api/pos/shifts?branchId=${encodeURIComponent(String(branchId || ""))}`),
    ]);
    if (!optionsRes.ok || !shiftsRes.ok) {
      throw new Error("تعذر تحميل بيانات الورديات");
    }
    const [optionData, shiftData] = await Promise.all([optionsRes.json(), shiftsRes.json()]);
    setOptions(optionData);
    setCashboxId((current) => optionData.cashboxes?.some((cashbox: any) => String(cashbox.id) === current)
      ? current
      : String(optionData.cashboxes?.[0]?.id || ""));
    setShifts(shiftData.shifts || []);
  }, [branch?.id, terminalId]);

  useEffect(() => setTerminalInput(terminalId), [terminalId]);

  useEffect(() => {
    load().catch((err) => setError(err.message || "تعذر تحميل بيانات الورديات"));
  }, [load]);

  const openShift = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post("/api/pos/shifts/open", {
        branch_id: branch?.id,
        terminal_id: terminalId,
        cashbox_id: Number(cashboxId),
        ...(config.shiftManagement.openingBalanceMode !== "none" && openingBalance !== ""
          ? { opening_balance: Number(openingBalance) }
          : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر فتح الوردية");
      setMessage(`تم فتح الوردية ${data.shift.shift_number || `#${data.shift.id}`}`);
      setOpeningBalance("");
      await load();
    } catch (err: any) {
      setError(err.message || "تعذر فتح الوردية");
    } finally {
      setBusy(false);
    }
  };

  const closeShift = async (shiftId: number) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/api/pos/shifts/${shiftId}/close`, {
        actual_cash: Number(actualCash),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إغلاق الوردية");
      setMessage(`تم إغلاق الوردية. الفرق: ${money(data.shift.cash_difference)}`);
      setActualCash("");
      setSelected(null);
      setDetails(null);
      await load();
    } catch (err: any) {
      setError(err.message || "تعذر إغلاق الوردية");
    } finally {
      setBusy(false);
    }
  };

  const approveVariance = async (shiftId: number) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/api/pos/shifts/${shiftId}/approve-variance`, {});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر اعتماد فرق الجرد");
      setMessage("تم اعتماد فرق الجرد وتسجيل تسويته في الخزينة.");
      await load();
      const shift = shifts.find((item) => Number(item.id) === shiftId);
      if (shift) await showDetails(shift);
    } catch (err: any) {
      setError(err.message || "تعذر اعتماد فرق الجرد");
    } finally {
      setBusy(false);
    }
  };

  const showDetails = async (shift: ShiftRecord) => {
    setSelected(shift);
    setDetails(null);
    setError("");
    try {
      const response = await api.get(`/api/pos/shifts/${shift.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل تفاصيل الوردية");
      setDetails(data);
    } catch (err: any) {
      setError(err.message || "تعذر تحميل تفاصيل الوردية");
    }
  };

  const visibleShifts = shifts.filter((shift) => {
    const query = search.trim().toLowerCase();
    const textMatch = !query || [
      shift.shift_number, shift.employee_name, shift.user_name, shift.terminal_id, shift.branch_name,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const statusMatch = statusFilter === "all" || shift.status === statusFilter;
    const employeeMatch = employeeFilter === "all" || String(shift.employee_id || "") === employeeFilter;
    const dateMatch = !dateFilter || String(shift.opened_at || "").slice(0, 10) === dateFilter;
    return textMatch && statusMatch && employeeMatch && dateMatch;
  });
  const activeShift = options.activeShift;
  const stats = options.summary || {};

  return (
    <div className="h-full overflow-auto bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-xl border bg-white p-2 text-slate-600 hover:bg-slate-100" aria-label="العودة">
              <ArrowRight className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900">إدارة ورديات نقطة البيع</h1>
              <p className="text-sm text-slate-500">{branch?.name || "الفرع الحالي"} · {terminalId}</p>
            </div>
          </div>
          <button onClick={() => load().catch((err) => setError(err.message))} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold">
            <RefreshCw className="h-4 w-4" /> تحديث
          </button>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["الورديات المفتوحة", stats.open_count || 0],
            ["المغلقة اليوم", stats.closed_today || 0],
            ["مبيعات اليوم", money(stats.sales_today)],
            ["النقد اليوم", money(stats.cash_today)],
            ["العجز", money(stats.shortage_today)],
            ["الزيادة", money(stats.surplus_today)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">{label}</div>
              <div className="mt-2 text-lg font-black text-slate-900">{value}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-semibold text-slate-600">
            معرّف نقطة البيع لهذا الجهاز
            <input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} maxLength={64} className="mt-1 block w-56 rounded-xl border px-3 py-2" />
          </label>
          <button disabled={!!activeShift || !terminalInput.trim() || terminalInput.trim() === terminalId} onClick={() => onTerminalIdChange(terminalInput.trim())} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">حفظ معرّف الطرفية</button>
          <span className="text-xs text-slate-500">يُحفظ على هذا الجهاز ويتيح تشغيل ورديات متزامنة على أجهزة POS مختلفة.</span>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {activeShift ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><Clock3 className="h-5 w-5" /></span>
                <div>
                  <div className="font-black text-slate-900">وردية مفتوحة · {activeShift.shift_number || `#${activeShift.id}`}</div>
                  <div className="text-sm text-slate-500">{activeShift.cashbox_name} · بدأت {dateTime(activeShift.opened_at)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min="0" step="0.01" value={actualCash} onChange={(event) => setActualCash(event.target.value)} placeholder="النقد الفعلي عند الإغلاق" className="w-56 rounded-xl border px-3 py-2 text-sm" />
                <button disabled={busy || actualCash === ""} onClick={() => closeShift(Number(activeShift.id))} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">إغلاق الوردية</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="mr-auto">
                <div className="font-black text-slate-900">لا توجد وردية مفتوحة لك على نقطة البيع</div>
                <div className="text-sm text-slate-500">يجب فتح وردية قبل إجراء عمليات البيع.</div>
              </div>
              {config.shiftManagement.openingBalanceMode !== "none" && (
                <label className="text-sm font-semibold text-slate-600">
                  الرصيد الافتتاحي
                  <input type="number" min="0" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} placeholder={config.shiftManagement.openingBalanceMode === "required" ? "مطلوب" : "اختياري"} className="mt-1 block w-48 rounded-xl border px-3 py-2" />
                </label>
              )}
                      <select value={cashboxId} onChange={(event) => setCashboxId(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm">
                        {(options.cashboxes || []).map((cashbox: any) => <option key={cashbox.id} value={cashbox.id}>{cashbox.name} · {cashbox.type}</option>)}
                      </select>
                      <button disabled={busy || !options.cashboxes?.length || !cashboxId || (config.shiftManagement.openingBalanceMode === "required" && openingBalance === "")} onClick={openShift} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                <Wallet className="h-4 w-4" /> فتح وردية
              </button>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <h2 className="ml-auto font-black text-slate-900">سجل الورديات</h2>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث..." className="w-44 rounded-lg border py-2 pr-9 pl-3 text-sm" />
            </div>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="all">كل الموظفين</option>
              {Array.from(new Map(shifts.map((shift) => [String(shift.employee_id || shift.user_id), {
                id: String(shift.employee_id || shift.user_id),
                name: shift.employee_name || shift.user_name || `#${shift.user_id}`,
              }])).values()).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="all">كل الحالات</option><option value="open">مفتوحة</option><option value="closed">مغلقة</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>{["الوردية", "الموظف", "POS / الخزينة", "الفتح", "الإغلاق", "المبيعات", "النقد", "الفرق", "الحالة", "التفاصيل"].map((title) => <th key={title} className="px-3 py-3 font-bold">{title}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {visibleShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold">{shift.shift_number || `#${shift.id}`}</td>
                    <td className="px-3 py-3">{shift.employee_name || shift.user_name || "—"}</td>
                    <td className="px-3 py-3">{shift.terminal_id} · {shift.cashbox_name}</td>
                    <td className="px-3 py-3">{dateTime(shift.opened_at)}</td>
                    <td className="px-3 py-3">{dateTime(shift.closed_at)}</td>
                    <td className="px-3 py-3">{money(shift.total_sales)}</td>
                    <td className="px-3 py-3">{money(shift.cash_sales)}</td>
                    <td className="px-3 py-3">{shift.cash_difference == null ? "—" : money(shift.cash_difference)}</td>
                    <td className="px-3 py-3">{shift.status === "open" ? "مفتوحة" : "مغلقة"}</td>
                    <td className="px-3 py-3"><button onClick={() => showDetails(shift)} className="rounded-lg border px-3 py-1.5 font-bold text-blue-700">عرض</button></td>
                  </tr>
                ))}
                {!visibleShifts.length && <tr><td colSpan={10} className="p-8 text-center text-slate-400">لا توجد ورديات مطابقة</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-black">تفاصيل {selected.shift_number || `#${selected.id}`}</h2>
              <button onClick={() => { setSelected(null); setDetails(null); }} className="rounded-lg border px-3 py-1.5 text-sm">إغلاق</button>
            </div>
            {!details ? <p className="py-5 text-sm text-slate-500">جارٍ تحميل التفاصيل...</p> : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>الفواتير: <b>{details.orders?.length || 0}</b></div>
                  <div>المبيعات: <b>{money(details.shift.total_sales ?? details.shift.closing_summary?.total_sales)}</b></div>
                  <div>تكلفة المبيعات: <b>{money(details.cogs)}</b></div>
                  <div>مجمل الربح: <b>{money(Number(details.shift.total_sales ?? details.shift.closing_summary?.total_sales ?? 0) - Number(details.cogs || 0))}</b></div>
                  <div>الرصيد الافتتاحي: <b>{money(details.shift.opening_balance)}</b></div>
                  <div>النقد المتوقع: <b>{money(details.shift.expected_cash)}</b></div>
                  <div>النقد الفعلي: <b>{money(details.shift.actual_cash)}</b></div>
                  <div>الفرق: <b>{money(details.shift.cash_difference)}</b></div>
                </div>
                {Number(details.shift.cash_difference || 0) !== 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm">
                    <span>{details.shift.variance_approved_at ? "تم اعتماد وتسوية فرق الجرد." : "فرق الجرد بانتظار الاعتماد؛ لم تُسجل تسوية خزينة بعد."}</span>
                    {details.canApproveVariance && !details.shift.variance_approved_at && (
                      <button disabled={busy} onClick={() => approveVariance(Number(details.shift.id))} className="rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white disabled:opacity-50">
                        اعتماد وتسوية الفرق
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-4 border-t pt-3">
                  <h3 className="mb-2 text-sm font-bold">طرق الدفع</h3>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {Object.entries(details.shift.closing_summary?.payment_breakdown || {}).map(([method, value]) => <span key={method} className="rounded-lg bg-slate-100 px-3 py-1.5">{method}: {money(value)}</span>)}
                  </div>
                </div>
                <div className="mt-4 border-t pt-3">
                  <h3 className="mb-2 text-sm font-bold">الفواتير</h3>
                  <div className="space-y-1 text-sm">{(details.orders || []).map((order: any) => <div key={order.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span>طلب #{order.id} · {order.payment_method || "—"} · {dateTime(order.timestamp)}</span><b>{money(order.total)}</b></div>)}</div>
                </div>
                <div className="mt-4 border-t pt-3">
                  <h3 className="mb-2 text-sm font-bold">القيود المحاسبية</h3>
                  <div className="space-y-1 text-sm">{(details.journalEntries || []).map((entry: any) => <div key={entry.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span>قيد #{entry.id} · {entry.reference || entry.description || "POS"}</span><b>{money(entry.total_debit)}</b></div>)}{!details.journalEntries?.length && <p className="text-slate-500">لا توجد قيود مرتبطة.</p>}</div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
