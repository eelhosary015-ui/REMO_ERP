import React, { useState, useEffect, useMemo } from "react";
import { authHeaders } from "../../../utils/api";
import {
  Calculator,
  Coins,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Save,
  HelpCircle,
  Building2,
  FileText,
  User,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { TreasuryAccount, TreasuryCurrentStatus, CashDenominationBreakdown } from "../../../types";
import { PreClosingLedgerModal } from "./PreClosingLedgerModal";

interface DenominationCalculatorProps {
  treasuries: TreasuryAccount[];
  selectedTreasuryId: number | null;
  onSelectTreasury: (id: number) => void;
  onClosingSuccess: (closingData: any) => void;
  currentUser?: any;
}

interface DenomItem {
  value: number;
  label_ar: string;
  label_en: string;
  badgeColor: string;
  iconBg: string;
}

const STANDARD_DENOMINATIONS: DenomItem[] = [
  { value: 200, label_ar: "200 جنيه", label_en: "200 EGP", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200", iconBg: "bg-emerald-600" },
  { value: 100, label_ar: "100 جنيه", label_en: "100 EGP", badgeColor: "bg-teal-50 text-teal-700 border-teal-200", iconBg: "bg-teal-600" },
  { value: 50, label_ar: "50 جنيه", label_en: "50 EGP", badgeColor: "bg-purple-50 text-purple-700 border-purple-200", iconBg: "bg-purple-600" },
  { value: 20, label_ar: "20 جنيه", label_en: "20 EGP", badgeColor: "bg-blue-50 text-blue-700 border-blue-200", iconBg: "bg-blue-600" },
  { value: 10, label_ar: "10 جنيه", label_en: "10 EGP", badgeColor: "bg-amber-50 text-amber-700 border-amber-200", iconBg: "bg-amber-600" },
  { value: 5, label_ar: "5 جنيه", label_en: "5 EGP", badgeColor: "bg-orange-50 text-orange-700 border-orange-200", iconBg: "bg-orange-600" },
  { value: 1, label_ar: "1 جنيه", label_en: "1 EGP", badgeColor: "bg-slate-100 text-slate-700 border-slate-300", iconBg: "bg-slate-700" },
  { value: 0.5, label_ar: "0.50 قرش", label_en: "0.50 EGP", badgeColor: "bg-zinc-100 text-zinc-700 border-zinc-300", iconBg: "bg-zinc-600" },
];

export const DenominationCalculator: React.FC<DenominationCalculatorProps> = ({
  treasuries,
  selectedTreasuryId,
  onSelectTreasury,
  onClosingSuccess,
  currentUser
}) => {
  // Denomination counts state: { "200": 0, "100": 0, ... }
  const [counts, setCounts] = useState<CashDenominationBreakdown>({
    "200": 0,
    "100": 0,
    "50": 0,
    "20": 0,
    "10": 0,
    "5": 0,
    "1": 0,
    "0.5": 0,
  });

  const [notes, setNotes] = useState("");
  const [responsibleUser, setResponsibleUser] = useState(currentUser?.username || currentUser?.name || "أمين الخزينة");
  const [treasuryStatus, setTreasuryStatus] = useState<TreasuryCurrentStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPreClosingLedgerModal, setShowPreClosingLedgerModal] = useState(false);

  // Fetch current live status when selected treasury changes
  useEffect(() => {
    if (!selectedTreasuryId) {
      setTreasuryStatus(null);
      return;
    }

    const fetchStatus = async () => {
      setIsLoadingStatus(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/treasury/current-status/${selectedTreasuryId}`, {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error("فشل جلب بيانات الرصيد الدفتري الحالي");
        const data = await res.json();
        setTreasuryStatus(data);
      } catch (err: any) {
        console.error("Error fetching treasury status:", err);
        // Fallback to local account calculation
        const localAcc = treasuries.find(t => t.id === selectedTreasuryId);
        if (localAcc) {
          setTreasuryStatus({
            treasury_id: localAcc.id,
            treasury_name: localAcc.name,
            treasury_code: (localAcc as any).code || `SAFE-${localAcc.id}`,
            currency: localAcc.currency || "EGP",
            opening_balance: Number(localAcc.current_balance || 0),
            total_deposits: 0,
            total_withdrawals: 0,
            book_balance: Number(localAcc.current_balance || 0),
          });
        }
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchStatus();
  }, [selectedTreasuryId, treasuries]);

  // Handle count change for a denomination
  const handleCountChange = (denomValue: number, newCount: number) => {
    const validCount = Math.max(0, isNaN(newCount) ? 0 : Math.floor(newCount));
    setCounts(prev => ({
      ...prev,
      [String(denomValue)]: validCount
    }));
  };

  // Add increment shortcut
  const handleAddQuickCount = (denomValue: number, addQty: number) => {
    const key = String(denomValue);
    const current = counts[key] || 0;
    handleCountChange(denomValue, current + addQty);
  };

  // Reset calculator
  const handleReset = () => {
    setCounts({
      "200": 0,
      "100": 0,
      "50": 0,
      "20": 0,
      "10": 0,
      "5": 0,
      "1": 0,
      "0.5": 0,
    });
    setNotes("");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Compute Total Physical Cash Count
  const actualBalance = useMemo(() => {
    let total = 0;
    for (const item of STANDARD_DENOMINATIONS) {
      const count = counts[String(item.value)] || 0;
      total += item.value * count;
    }
    return Math.round(total * 100) / 100;
  }, [counts]);

  // Book Balance from Live Status or fallback
  const bookBalance = useMemo(() => {
    if (treasuryStatus) {
      return Number(treasuryStatus.book_balance || 0);
    }
    const acc = treasuries.find(t => t.id === selectedTreasuryId);
    return acc ? Number(acc.current_balance || 0) : 0;
  }, [treasuryStatus, treasuries, selectedTreasuryId]);

  // Compute Variance = Actual - Book
  const variance = useMemo(() => {
    return Math.round((actualBalance - bookBalance) * 100) / 100;
  }, [actualBalance, bookBalance]);

  // Status computation
  const closingStatus = useMemo<'Matched' | 'Deficit - Pending Review' | 'Surplus - Pending Review'>(() => {
    if (variance === 0) return 'Matched';
    if (variance < 0) return 'Deficit - Pending Review';
    return 'Surplus - Pending Review';
  }, [variance]);

  // Submit Daily Closing Record
  const handleSubmitClosing = async () => {
    if (!selectedTreasuryId) {
      setErrorMessage("يرجى اختيار الخزينة أولاً");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        treasury_id: selectedTreasuryId,
        denominations: counts,
        notes: notes.trim(),
        responsible_user: responsibleUser.trim() || currentUser?.username || "أمين الخزينة"
      };

      const res = await fetch("/api/treasury/close", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "فشل تسجيل إقفال الخزينة والجرد الفعلي");
      }

      setSuccessMessage(data.message || "تم تسجيل إقفال الخزينة والجرد الفعلي بنجاح");
      setShowConfirmModal(false);
      
      // Refresh current treasury status
      if (treasuryStatus) {
        setTreasuryStatus({
          ...treasuryStatus,
          book_balance: actualBalance,
          last_closing_date: new Date().toISOString(),
          last_closing_status: data.closing?.status || closingStatus
        });
      }

      // Notify parent component
      onClosingSuccess(data);

      // Auto clear message after 4s
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4500);

    } catch (err: any) {
      console.error("Submit closing error:", err);
      setErrorMessage(err.message || "حدث خطأ غير متوقع أثناء حفظ الإقفال");
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="denomination-calculator-card" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
      {/* 1. Header & Title */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              حاسبة الجرد الفعلي وإقفال اليومية
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                Cash Verification
              </span>
            </h2>
            <p className="text-xs text-slate-300">
              عد الفئات النقدية ومطابقة الرصيد الفعلي مع الدفتري آلياً
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5"
          title="إعادة تعيين كافة الفئات"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          تصفير الحقول
        </button>
      </div>

      {/* 2. Body Form */}
      <div className="p-5 space-y-5 flex-1 overflow-y-auto">
        {/* Treasury Selection Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              الخزينة النقدية المستهدفة للإقفال
            </span>
            {treasuryStatus?.branch_name && (
              <span className="text-[11px] text-slate-500">
                الفرع: {treasuryStatus.branch_name}
              </span>
            )}
          </label>
          <select
            id="treasury-select-dropdown"
            value={selectedTreasuryId || ""}
            onChange={(e) => onSelectTreasury(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          >
            <option value="">-- اختر الخزينة المراد جردها وإقفالها --</option>
            {treasuries.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({(t as any).code || `SAFE-${t.id}`}) — الرصيد الدفتري: {Number(t.current_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} {t.currency || "EGP"}
              </option>
            ))}
          </select>
        </div>

        {/* Live Treasury Status Bar */}
        {selectedTreasuryId && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                حالة الدفاتر والسيولة اللحظية
              </span>
              {isLoadingStatus ? (
                <span className="text-indigo-600 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> جاري التحديث...
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  العملة: {treasuryStatus?.currency || "EGP"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                <div className="text-[10px] text-slate-500">رصيد أول المدة</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                  {(treasuryStatus?.opening_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                <div className="text-[10px] text-emerald-600 flex items-center justify-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" /> إيداعات اليوم
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-0.5 truncate">
                  +{(treasuryStatus?.total_deposits || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                <div className="text-[10px] text-rose-600 flex items-center justify-center gap-0.5">
                  <TrendingDown className="w-2.5 h-2.5" /> منصرفات اليوم
                </div>
                <div className="text-xs font-bold text-rose-700 mt-0.5 truncate">
                  -{(treasuryStatus?.total_withdrawals || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 shadow-2xs">
                <div className="text-[10px] text-indigo-700 font-semibold">الرصيد الدفتري</div>
                <div className="text-xs font-black text-indigo-900 mt-0.5 truncate">
                  {bookBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPreClosingLedgerModal(true)}
              className="w-full py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              عرض كشف حركات الخزينة قبل الإقفال
            </button>
          </div>
        )}

        {/* 3. Interactive Denomination Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              جرد الفئات النقدية (عدد الورقات / العملات)
            </h3>
            <span className="text-[11px] text-slate-500">
              القيمة الإجمالية تُحسب تلقائياً
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STANDARD_DENOMINATIONS.map((item) => {
              const count = counts[String(item.value)] || 0;
              const subtotal = Math.round(item.value * count * 100) / 100;

              return (
                <div
                  key={item.value}
                  className={`p-3 rounded-xl border transition-all ${
                    count > 0
                      ? "bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200"
                      : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.iconBg}`} />
                      <span className="text-xs font-bold text-slate-800">
                        فئة {item.label_ar}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      = {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                    </div>
                  </div>

                  {/* Input and Quick Steppers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCountChange(item.value, count - 1)}
                      disabled={count <= 0}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition"
                    >
                      -
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={count === 0 ? "" : count}
                      placeholder="0"
                      onChange={(e) => handleCountChange(item.value, parseInt(e.target.value, 10) || 0)}
                      className="flex-1 text-center bg-white border border-slate-300 rounded-lg py-1.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleCountChange(item.value, count + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Pills */}
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <span className="text-[10px] text-slate-400 ml-auto">إضافة سريعة:</span>
                    {[5, 10, 50, 100].map((step, stepIdx) => (
                      <button
                        key={`step-${item.value}-${step}-${stepIdx}`}
                        type="button"
                        onClick={() => handleAddQuickCount(item.value, step)}
                        className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded border border-slate-200 transition"
                      >
                        +{step}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Live Comparison Card (Book vs Actual vs Variance) */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4.5 space-y-4 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              مؤشر المطابقة اللحظي (Reconciliation Summary)
            </span>
            <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full text-slate-200">
              اليومية الحالية
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Book Balance */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-300 font-medium">الرصيد الدفتري</div>
              <div className="text-base font-black text-white mt-1">
                {bookBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">من قيود اليومية</div>
            </div>

            {/* Actual Physical Cash */}
            <div className="bg-white/10 border border-indigo-400/30 rounded-xl p-3">
              <div className="text-[11px] text-indigo-200 font-medium">الرصيد الفعلي (المعدود)</div>
              <div className="text-base font-black text-amber-300 mt-1">
                {actualBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">مجموع الفئات</div>
            </div>

            {/* Variance */}
            <div className={`rounded-xl p-3 border ${
              variance === 0 
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : variance < 0
                ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                : "bg-blue-950/60 border-blue-500/40 text-blue-300"
            }`}>
              <div className="text-[11px] font-medium flex items-center justify-between">
                <span>الفارق (Variance)</span>
                {variance === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {variance < 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                {variance > 0 && <TrendingUp className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <div className="text-base font-black mt-1">
                {variance > 0 ? `+${variance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : variance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] mt-0.5 truncate">
                {variance === 0 ? "متطابق تماماً" : variance < 0 ? "عجز نقدي" : "زيادة نقدية"}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between bg-white/10 rounded-xl p-2.5 text-xs">
            <span className="text-slate-300">حالة الإقفال المتوقعة:</span>
            <span className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 ${
              closingStatus === 'Matched'
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                : closingStatus === 'Deficit - Pending Review'
                ? "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                : "bg-blue-500/20 text-blue-300 border border-blue-400/40"
            }`}>
              {closingStatus === 'Matched' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {closingStatus === 'Deficit - Pending Review' && <AlertTriangle className="w-3.5 h-3.5" />}
              {closingStatus === 'Surplus - Pending Review' && <TrendingUp className="w-3.5 h-3.5" />}
              {closingStatus}
            </span>
          </div>
        </div>

        {/* 5. Responsible User & Notes */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              المسؤول عن الجرد والإقفال
            </label>
            <input
              type="text"
              value={responsibleUser}
              onChange={(e) => setResponsibleUser(e.target.value)}
              placeholder="اسم أمين الخزينة أو المشرف"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              ملاحظات وتبرير الفروقات (إن وجدت)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                variance !== 0
                  ? "يرجى كتابة سبب وتبرير الفارق (عجز/زيادة) لإحالته للتدقيق المالي..."
                  : "ملاحظات إضافية حول جرد الوردية واليومية..."
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Alerts & Messages */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* 6. Footer & Submit Action */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          إجمالي النقدية المعدودة: <strong className="text-slate-900">{actualBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م</strong>
        </div>

        <button
          type="button"
          id="btn-submit-treasury-closing"
          onClick={() => setShowConfirmModal(true)}
          disabled={!selectedTreasuryId || isSubmitting}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              جاري تسجيل الإقفال...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              اعتماد وإقفال اليومية
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-right animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  variance === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تأكيد إقفال الخزينة والجرد</h3>
                  <p className="text-xs text-slate-500">مراجعة أرقام الإقفال قبل الحفظ النهائي</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">الخزينة:</span>
                <span className="font-bold text-slate-900">{treasuryStatus?.treasury_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الرصيد الدفتري:</span>
                <span className="font-bold text-slate-900">{bookBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">النقدية الفعلية (المعدودة):</span>
                <span className="font-bold text-indigo-700">{actualBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-700">الفارق النهائي:</span>
                <span className={`font-bold ${variance === 0 ? "text-emerald-600" : variance < 0 ? "text-rose-600" : "text-blue-600"}`}>
                  {variance > 0 ? `+${variance}` : variance} ج.م ({closingStatus})
                </span>
              </div>
            </div>

            {variance !== 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  تنبيه: يوجد فارق قدره <strong>{Math.abs(variance)} ج.م</strong> سيتم تسجيله بالحالة <strong>({closingStatus})</strong> لإحالته للمراجعة المالية.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSubmitClosing}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                تأكيد وحفظ الإقفال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Closing Ledger Modal */}
      {showPreClosingLedgerModal && selectedTreasuryId && (
        <PreClosingLedgerModal
          treasuryId={selectedTreasuryId}
          treasuryName={treasuryStatus?.treasury_name || "الخزينة"}
          treasuryCode={treasuryStatus?.treasury_code}
          onClose={() => setShowPreClosingLedgerModal(false)}
        />
      )}
    </div>
  );
};
export default DenominationCalculator;
