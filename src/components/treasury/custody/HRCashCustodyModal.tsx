import React, { useEffect, useState } from "react";
import { CalendarClock, CircleDollarSign, LoaderCircle, X } from "lucide-react";
import type { TreasuryAccount, TreasuryCustodyType } from "../../../types";
import { api } from "../../../utils/api";
import { EmployeeSearchSelect } from "../../EmployeeSearchSelect";

interface HRCashCustodyModalProps {
  employees: any[];
  onClose: () => void;
  onCreated: () => void;
}

export function HRCashCustodyModal({ employees, onClose, onCreated }: HRCashCustodyModalProps) {
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [cashTypes, setCashTypes] = useState<TreasuryCustodyType[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [custodyTypeId, setCustodyTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/api/treasury/accounts"),
      api.get("/api/treasury/custody-types"),
    ]).then(async ([accountsResponse, typesResponse]) => {
      if (!accountsResponse.ok || !typesResponse.ok) {
        throw new Error("تعذر تحميل الخزائن وأنواع العهد النقدية");
      }
      const [accountData, typeData] = await Promise.all([accountsResponse.json(), typesResponse.json()]);
      if (cancelled) return;
      const availableAccounts = Array.isArray(accountData) ? accountData : accountData.accounts || [];
      const availableTypes = Array.isArray(typeData) ? typeData : [];
      const validCashTypes = availableTypes.filter((type: TreasuryCustodyType) =>
        type.is_active &&
        type.requires_treasury &&
        !type.requires_asset &&
        !type.requires_inventory &&
        ["cash", "temporary", "permanent"].includes(type.category)
      );
      setAccounts(availableAccounts);
      setCashTypes(validCashTypes);
      setAccountId(String(availableAccounts[0]?.id || ""));
      setCustodyTypeId(String(validCashTypes.find((type: TreasuryCustodyType) => type.category === "cash")?.id || validCashTypes[0]?.id || ""));
      if (!validCashTypes.length) setError("لا يوجد نوع عهدة نقدية مفعّل؛ راجع إعدادات أنواع العهد في الخزينة.");
    }).catch((loadError: any) => {
      if (!cancelled) setError(loadError.message || "تعذر تحميل بيانات إنشاء العهدة.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const employee = employees.find((item) => String(item.id) === employeeId);
    const numericAmount = Number(amount);
    if (!employeeId || !Number.isInteger(Number(employeeId))) {
      setError("اختر الموظف المستلم للعهدة.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("أدخل مبلغًا نقديًا أكبر من صفر.");
      return;
    }
    if (!purpose.trim()) {
      setError("اكتب الغرض من العهدة.");
      return;
    }
    if (!custodyTypeId) {
      setError("لا يوجد نوع عهدة نقدية صالح للاختيار.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await api.post("/api/treasury/custodies", {
        employee_id: Number(employeeId),
        custody_type_id: Number(custodyTypeId),
        custody_type: cashTypes.find((type) => String(type.id) === custodyTypeId)?.category || "cash",
        account_id: accountId ? Number(accountId) : null,
        amount: numericAmount,
        currency: "EGP",
        branch_id: employee?.branch_id ? Number(employee.branch_id) : null,
        due_date: dueDate || null,
        duration_days: Number(durationDays) || 30,
        purpose: purpose.trim(),
        notes: notes.trim(),
        is_draft: false,
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || "تعذر تسجيل العهدة النقدية");
      onCreated();
    } catch (submitError: any) {
      setError(submitError.message || "تعذر تسجيل العهدة النقدية");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b bg-emerald-50/70 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-600 p-2.5 text-white"><CircleDollarSign className="h-5 w-5" /></span>
            <div>
              <h2 className="font-black text-slate-900">إضافة عهدة نقدية لموظف</h2>
              <p className="mt-1 text-xs text-slate-500">ستُسجّل في سجل الخزينة نفسه وتظهر في صفحتي العهد.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-5">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />تحميل الخزائن وأنواع العهد...</div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">الموظف المستلم *</label>
                <EmployeeSearchSelect required employees={employees} value={employeeId} onChange={setEmployeeId} placeholder="ابحث باسم الموظف أو الكود..." />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-slate-600">
                  نوع العهدة النقدية *
                  <select required value={custodyTypeId} onChange={(event) => setCustodyTypeId(event.target.value)} className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm">
                    {cashTypes.map((type) => <option key={type.id} value={type.id}>{type.name_ar}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  خزينة الصرف (اختياري عند الطلب)
                  <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm">
                    <option value="">تحديد الخزينة عند الصرف</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {Number(account.current_balance || 0).toLocaleString("ar-EG")} ج.م</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs font-bold text-slate-600">
                  مبلغ العهدة *
                  <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm font-bold" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  مدة العهدة (يوم)
                  <input type="number" min="1" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  تاريخ التسوية المتوقع
                  <span className="relative mt-1 block">
                    <CalendarClock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-xl border bg-slate-50 py-2.5 pl-3 pr-9 text-sm" />
                  </span>
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-600">
                الغرض من العهدة *
                <input required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="مثال: مصروفات تشغيل أو مشتريات عاجلة" className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                ملاحظات
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm" />
              </label>
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t bg-slate-50 p-4">
          <button type="button" onClick={onClose} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-600">إلغاء</button>
          <button type="submit" disabled={loading || saving || !cashTypes.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50">
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} تسجيل العهدة وإرسالها للاعتماد
          </button>
        </footer>
      </form>
    </div>
  );
}
