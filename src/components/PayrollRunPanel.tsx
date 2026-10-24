import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "../utils/fetcher";
import { api } from "../utils/api";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Landmark,
  Lock,
  RefreshCw,
  RotateCcw,
  Wallet,
} from "lucide-react";

/**
 * مسير المرتبات — الإقفال والصرف
 * ─────────────────────────────
 * كل الأرقام المعروضة حقيقية من قاعدة البيانات عبر الـ APIs:
 *  - GET /api/payroll/runs/period-status  → حالة المسير والإجماليات والمتبقي
 *  - POST /api/payroll/runs/draft         → حساب/تحديث المسودة
 *  - POST /api/payroll/runs/:id/close     → قيد الاستحقاق (بلا أي صرف)
 *  - POST /api/payroll/runs/:id/pay       → صرف من الخزينة/البنك + سند صرف + قيد
 *  - POST /api/payroll/runs/:id/payments/:paymentId/reverse → عكس سند صرف
 */

interface PayrollRunPanelProps {
  year: number;
  month: number;
  branch?: string;
  department?: string;
}

const money = (value: any) =>
  Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PayrollRunPanel: React.FC<PayrollRunPanelProps> = ({ year, month, branch, department }) => {
  const [busy, setBusy] = useState<"" | "draft" | "close" | "pay" | "reverse">("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [treasuryAccountId, setTreasuryAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (branch && branch !== "all") params.set("branch", branch);
    if (department && department !== "all") params.set("department", department);
    return params.toString();
  }, [year, month, branch, department]);

  const statusKey = `/api/payroll/runs/period-status?${query}`;
  const { data: statusPayload, mutate, isLoading } = useSWR<any>(statusKey, fetcher, { revalidateOnFocus: false });
  const { data: treasuryPayload } = useSWR<any>("/api/treasury/accounts", fetcher, { revalidateOnFocus: false });
  // قفل الشهر المالي — نفس المصدر الذي تستخدمه شاشة «قفل وإغلاق الشهور المالي».
  // وجوده هنا يجعل أثر الإقفال مرئيًا قبل الضغط، بدل أن يفشل الطلب برسالة فقط.
  const { data: lockedMonthsPayload } = useSWR<any>(
    `/api/security/locked-months?year=${year}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const lockedMonthsList: any[] = Array.isArray(lockedMonthsPayload)
    ? lockedMonthsPayload
    : Array.isArray(lockedMonthsPayload?.data)
      ? lockedMonthsPayload.data
      : [];
  const isMonthLocked = lockedMonthsList.some(
    (row: any) =>
      row?.month === `${year}-${String(month).padStart(2, "0")}` &&
      (row?.is_locked === true || row?.is_locked === "true"),
  );

  const run = statusPayload?.data ?? statusPayload;
  const runId: number | null = run?.exists === false ? null : run?.id ?? null;

  // إعدادات الحسابات: لكشف ربط حساب مصروف المرتبات بحساب تاني (مثل «تكلفة البضاعة
  // المباعة»)، وهي حالة تخلّي قيد الاستحقاق يسجّل المرتبات داخل التكلفة.
  const { data: accountConfigPayload } = useSWR<any>(
    "/api/v2/erp-gl/account-config",
    fetcher,
    { revalidateOnFocus: false },
  );
  const accountConfigRows: any[] = Array.isArray(accountConfigPayload)
    ? accountConfigPayload
    : Array.isArray(accountConfigPayload?.data)
      ? accountConfigPayload.data
      : [];
  const accountConfigByKey = useMemo(() => {
    const map: Record<string, any> = {};
    for (const row of accountConfigRows) {
      if (row?.key) map[String(row.key)] = row;
    }
    return map;
  }, [accountConfigPayload]);
  const payrollExpenseAccount =
    accountConfigByKey["payroll_expense"] || accountConfigByKey["salary_expense"];
  const cogsAccount = accountConfigByKey["cost_of_goods_sold"];
  const payrollExpenseCollidesWithCogs =
    Boolean(payrollExpenseAccount?.account_id) &&
    String(payrollExpenseAccount?.account_id) === String(cogsAccount?.account_id);
  const accrualDate: string | null = run?.accrual_date
    ? String(run.accrual_date).slice(0, 10)
    : null;
  const paymentBeforeAccrual = Boolean(accrualDate && paymentDate && paymentDate < accrualDate);

  // مسودة صافيها صفر: سبب شائع لتوقّف المستخدم — الزر معطّل بلا تفسير.
  // الصافي = الاستحقاقات − الاستقطاعات، والاستحقاقات تُحسب من أيام الحضور
  // المسجّلة للشهر (attendance). لو مفيش بصمات للشهر تبقى الاستحقاقات صفر.
  const isDraftLike = ["draft", "open"].includes(String(run?.status));
  const totalNetValue = Number(run?.total_net || 0);
  const zeroNetDraft = Boolean(runId) && isDraftLike && totalNetValue <= 0;
  const zeroAdditionItems = Array.isArray(run?.items)
    ? run.items.filter((item: any) => Number(item?.additions || 0) <= 0)
    : [];

  const treasuryAccounts: any[] = useMemo(() => {
    const list = treasuryPayload?.data ?? treasuryPayload?.accounts ?? treasuryPayload;
    const rows = Array.isArray(list) ? list : [];
    return rows.filter((row: any) => !row.status || String(row.status).toLowerCase() === "active");
  }, [treasuryPayload]);

  useEffect(() => {
    if (run && run.remaining > 0) setAmount(String(run.remaining));
  }, [run?.remaining, run?.id]);

  useEffect(() => {
    if (!treasuryAccountId && treasuryAccounts.length > 0) {
      setTreasuryAccountId(String(treasuryAccounts[0].id));
    }
  }, [treasuryAccounts, treasuryAccountId]);

  const runAction = async (label: "" | "draft" | "close" | "pay" | "reverse", work: () => Promise<Response>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const response = await work();
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        setError(payload?.error || `فشل تنفيذ العملية (${response.status})`);
        return null;
      }
      await mutate();
      return payload?.data ?? payload;
    } catch (requestError: any) {
      setError(requestError?.message || "تعذر الاتصال بالسيرفر");
      return null;
    } finally {
      setBusy("");
    }
  };

  const buildDraft = () =>
    runAction("draft", () =>
      api.post("/api/payroll/runs/draft", {
        year,
        month,
        branch: branch && branch !== "all" ? branch : null,
        department: department && department !== "all" ? department : null,
      }),
    );

  const closeRun = async () => {
    let id = runId;
    if (!id) {
      const created = await buildDraft();
      id = created?.id ?? null;
    }
    if (!id) return;
    const closed = await runAction("close", () => api.post(`/api/payroll/runs/${id}/close`, {}));
    if (closed) {
      setNotice(
        `تم إقفال المسير وتسجيل قيد استحقاق (${closed.accrual_reference || "—"}) بمبلغ ${money(closed.total_net)} ج.م بدون أي صرف من الخزينة`,
      );
    }
  };

  const payRun = async () => {
    if (!runId) {
      setError("احسب مسودة المسير أولًا ثم أقفله قبل الصرف");
      return;
    }
    const paid = await runAction("pay", () =>
      api.post(`/api/payroll/runs/${runId}/pay`, {
        amount: amount === "" ? undefined : Number(amount),
        treasury_account_id: treasuryAccountId ? Number(treasuryAccountId) : undefined,
        payment_date: paymentDate,
        reference_number: reference || undefined,
        notes: notes || undefined,
      }),
    );
    if (paid) {
      const alignment = paid.accrual_alignment;
      const alignmentNote =
        alignment?.applied && alignment?.from && alignment?.from !== alignment?.to
          ? ` · تم توحيد تاريخ قيد الاستحقاق مع تاريخ الصرف (${alignment.from} ← ${alignment.to})`
          : alignment && alignment.applied === false
            ? ` · لم يُوحَّد تاريخ قيد الاستحقاق مع تاريخ الصرف (${alignment.reason || "سبب غير معروف"})`
            : "";
      setNotice(
        `تم صرف ${money(paid.payment?.amount)} ج.م من ${paid.payment?.treasury_account_name || "الخزينة"} — سند صرف ${paid.payment?.voucher_number || "—"} وقيد ${paid.payment?.journal_entry_reference || "—"}${alignmentNote}`,
      );
    }
  };

  const reversePayment = (paymentId: number) =>
    runAction("reverse", () => api.post(`/api/payroll/runs/${runId}/payments/${paymentId}/reverse`, {}));

  const reverseAccrual = () => runAction("reverse", () => api.post(`/api/payroll/runs/${runId}/reverse`, {}));

  const statusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "partially_paid":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "accrued":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div dir="rtl" className="bg-white rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-rose-600" />
            مسير المرتبات والصرف — {String(month).padStart(2, "0")}/{year}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            الإقفال يسجّل مصروف المرتبات والالتزام فقط. الصرف يخصم من الخزينة/البنك ويسدّد الالتزام دون تسجيل مصروف جديد.
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {zeroNetDraft && (
        <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold">
              المسودة صافية {money(totalNetValue)} ج.م — لذلك زر «إقفال المسير» معطّل ولن يُرحَّل أي قيد
              استحقاق.
            </div>
            <div>
              الصافي = الاستحقاقات − الاستقطاعات، والاستحقاقات تُحسب من <strong>أيام الحضور المسجّلة
              للشهر</strong>. لو الشهر بلا بصمات/حضور تبقى الاستحقاقات صفر.
            </div>
            {zeroAdditionItems.length > 0 && (
              <div>
                موظفون استحقاقاتهم صفر: {zeroAdditionItems.length}
                {zeroAdditionItems.length <= 5
                  ? ` (${zeroAdditionItems.map((item: any) => `${item.employee_code || item.employee_id}: ${item.employee_name || "—"}`).join("، ")})`
                  : ""}
              </div>
            )}
            <div>
              راجع بصمات الشهر (الحضور والانصراف) أو استيراد البصمات، ثم اضغط «إعادة حساب المسودة».
            </div>
          </div>
        </div>
      )}
      {payrollExpenseCollidesWithCogs && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold">
              حساب مصروف المرتبات مربوط بنفس حساب «{payrollExpenseAccount?.account_name || "تكلفة البضاعة المباعة"}»
              ({payrollExpenseAccount?.account_code})
            </div>
            <div>
              معنى كده أن قيد الاستحقاق هيحمّل المرتبات على هذا الحساب، فتظهر داخل التكلفة
              بدل مصروف المرتبات والأجور. اضبط مفتاح <strong>payroll_expense</strong> على حساب
              مصروف مرتبات مستقل من شاشة إعدادات الحسابات قبل الإقفال.
            </div>
          </div>
        </div>
      )}
      {isMonthLocked && (
        <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-sm">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            الفترة المالية {String(month).padStart(2, "0")}/{year} مقفلة من إعدادات «قفل وإغلاق الشهور
            المالي» — لن يُرحَّل قيد استحقاق ولن يُصرف أي مبلغ حتى فتح الشهر.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">حالة المسير</div>
          <div className={`inline-block px-3 py-1 rounded-lg border text-sm font-bold ${statusColor(String(run?.status))}`}>
            {run?.status_label || "مسودة"}
          </div>
          <div className="text-xs text-slate-500 mt-2">رقم المسير: {run?.run_number || "—"}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">إجمالي المستحق (صافي)</div>
          <div className="text-lg font-bold text-slate-800">{money(run?.total_net)} ج.م</div>
          <div className="text-xs text-slate-500 mt-2">عدد الموظفين: {run?.employees_count ?? 0}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">إجمالي ما تم صرفه</div>
          <div className="text-lg font-bold text-emerald-700">{money(run?.total_paid)} ج.م</div>
          <div className="text-xs text-slate-500 mt-2">المتبقي للصرف: {money(run?.remaining)} ج.م</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">قيد الاستحقاق</div>
          <div className="text-sm font-bold text-slate-800">{run?.accrual_reference || "لم يُرحَّل بعد"}</div>
          <div className="text-xs text-slate-500 mt-2">
            رقم القيد: {run?.accrual_journal_entry_id ?? "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            تاريخ القيد: {accrualDate || "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            حساب المصروف:{" "}
            {payrollExpenseAccount
              ? `${payrollExpenseAccount.account_code || ""} ${payrollExpenseAccount.account_name || ""}`.trim()
              : "—"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={buildDraft}
          disabled={busy !== "" || run?.status === "paid" || run?.status === "partially_paid"}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${busy === "draft" ? "animate-spin" : ""}`} />
          {runId ? "إعادة حساب المسودة" : "حساب كشف الشهر"}
        </button>
        <button
          onClick={closeRun}
          disabled={busy !== "" || !run?.can_close || isMonthLocked}
          title={
            isMonthLocked
              ? "الشهر مقفل ماليًا — افتح الشهر من شاشة قفل الشهور لتتمكن من الإقفال"
              : !run?.can_close && isDraftLike && totalNetValue <= 0
                ? "الصافي صفر (لا توجد استحقاقات/حضور لهذا الشهر) — لا يوجد ما يُرحَّل"
                : !run?.can_close
                  ? "المسير ليس في حالة تسمح بالإقفال"
                  : "تسجيل قيد استحقاق المرتبات بدون صرف"
          }
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
        >
          <Lock className="w-4 h-4" />
          إقفال المسير (قيد استحقاق)
        </button>
        {run?.can_reverse_accrual && (
          <button
            onClick={reverseAccrual}
            disabled={busy !== ""}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            عكس قيد الاستحقاق
          </button>
        )}
      </div>

      {run?.can_pay && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-4">
          <div className="font-bold text-emerald-900 flex items-center gap-2">
            <Banknote className="w-5 h-5" />
            صرف المرتبات من الخزينة / البنك
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">الخزينة أو البنك</span>
              <select
                value={treasuryAccountId}
                onChange={(event) => setTreasuryAccountId(event.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">اختر الحساب</option>
                {treasuryAccounts.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type === "bank" ? "بنك" : "نقدي"}) — رصيد {money(account.current_balance)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">مبلغ الصرف (المتبقي {money(run?.remaining)})</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">تاريخ الصرف</span>
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">رقم المرجع (اختياري)</span>
              <input
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </label>
            <label className="text-sm lg:col-span-4">
              <span className="block text-slate-600 mb-1">ملاحظات (اختياري)</span>
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </label>
          </div>
          {paymentBeforeAccrual && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
              <strong>توحيد التواريخ:</strong> تاريخ الصرف {paymentDate} يسبق تاريخ قيد الاستحقاق الحالي
              {" "}
              {accrualDate}، وعند تأكيد الصرف سيُوحَّد تاريخ قيد الاستحقاق مع تاريخ الصرف
              ({paymentDate}) ليصبح القيدان في يوم واحد، فلا يظهر صرف قبل استحقاق.
            </div>
          )}
          <button
            onClick={payRun}
            disabled={busy !== "" || !treasuryAccountId || isMonthLocked}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
          >
            <Banknote className={`w-4 h-4 ${busy === "pay" ? "animate-pulse" : ""}`} />
            تأكيد الصرف من الخزينة
          </button>
        </div>
      )}

      {run?.payments && run.payments.length > 0 && (
        <div className="overflow-x-auto">
          <div className="font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            سندات الصرف المرتبطة بالمسير
          </div>
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-3 font-bold text-slate-700">سند الصرف</th>
                <th className="p-3 font-bold text-slate-700">المبلغ</th>
                <th className="p-3 font-bold text-slate-700">الخزينة / البنك</th>
                <th className="p-3 font-bold text-slate-700">قيد السداد</th>
                <th className="p-3 font-bold text-slate-700">التاريخ</th>
                <th className="p-3 font-bold text-slate-700">الحالة</th>
                <th className="p-3 font-bold text-slate-700 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {run.payments.map((payment: any) => (
                <tr key={payment.id} className="border-b border-slate-100">
                  <td className="p-3 font-bold">{payment.voucher_number || `#${payment.id}`}</td>
                  <td className="p-3">{money(payment.amount)} ج.م</td>
                  <td className="p-3">{payment.treasury_account_name || "—"}</td>
                  <td className="p-3">{payment.journal_entry_id || "—"}</td>
                  <td className="p-3">{payment.payment_date ? String(payment.payment_date).slice(0, 10) : "—"}</td>
                  <td className="p-3">
                    {payment.status === "reversed" ? (
                      <span className="text-amber-700 font-bold">معكوس</span>
                    ) : (
                      <span className="text-emerald-700 font-bold">مرحّل</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {payment.status !== "reversed" && (
                      <button
                        onClick={() => reversePayment(payment.id)}
                        disabled={busy !== ""}
                        className="px-3 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold"
                      >
                        عكس الصرف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {run?.items && run.items.length > 0 && (
        <details className="rounded-xl border border-slate-200">
          <summary className="p-4 cursor-pointer font-bold text-slate-700">
            تفاصيل الموظفين في المسير ({run.items.length})
          </summary>
          <div className="overflow-x-auto p-4 pt-0">
            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold text-slate-700">الكود</th>
                  <th className="p-2 font-bold text-slate-700">الموظف</th>
                  <th className="p-2 font-bold text-slate-700">الأساسي</th>
                  <th className="p-2 font-bold text-slate-700">الإضافات</th>
                  <th className="p-2 font-bold text-slate-700">الاستقطاعات</th>
                  <th className="p-2 font-bold text-slate-700">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {run.items.map((item: any) => (
                  <tr key={`${item.employee_id}-${item.employee_code}`} className="border-b border-slate-100">
                    <td className="p-2">{item.employee_code || "—"}</td>
                    <td className="p-2">{item.employee_name}</td>
                    <td className="p-2">{money(item.basic_salary)}</td>
                    <td className="p-2">{money(item.additions)}</td>
                    <td className="p-2">{money(item.deductions)}</td>
                    <td className="p-2 font-bold">{money(item.net_salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
};

export default PayrollRunPanel;
