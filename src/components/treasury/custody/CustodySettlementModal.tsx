import React, { useState, useEffect } from "react";
import {
  X,
  Receipt,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRightLeft,
  DollarSign
} from "lucide-react";
import { TreasuryCustody, TreasuryAccount } from "../../../types";

interface SettlementModalProps {
  isOpen: boolean;
  custody: TreasuryCustody | null;
  accounts: TreasuryAccount[];
  onClose: () => void;
  onSubmit: (settlementData: any) => Promise<void>;
}

export const CustodySettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  custody,
  accounts,
  onClose,
  onSubmit
}) => {
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [treasuryAccountId, setTreasuryAccountId] = useState("");
  const [settlementType, setSettlementType] = useState<'full' | 'partial' | 'replenish'>('full');
  const [totalExpenses, setTotalExpenses] = useState("0");
  const [returnedToTreasury, setReturnedToTreasury] = useState("0");
  const [additionalToEmployee, setAdditionalToEmployee] = useState("0");
  const [notes, setNotes] = useState("");
  const [clearanceCert, setClearanceCert] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (custody) {
      const origAmount = parseFloat((custody.amount as any) || 0);
      const spent = parseFloat((custody.spent_amount as any) || 0);
      setTotalExpenses(spent.toString());

      if (spent < origAmount) {
        setReturnedToTreasury((origAmount - spent).toString());
        setAdditionalToEmployee("0");
      } else if (spent > origAmount) {
        setReturnedToTreasury("0");
        setAdditionalToEmployee((spent - origAmount).toString());
      } else {
        setReturnedToTreasury("0");
        setAdditionalToEmployee("0");
      }

      // Default safe to original safe
      if (custody.account_id) {
        setTreasuryAccountId(custody.account_id.toString());
      }
    }
  }, [custody]);

  if (!isOpen || !custody) return null;

  const originalAmount = parseFloat((custody.amount as any) || 0);
  const spentAmount = parseFloat(totalExpenses) || 0;
  const returnedAmount = parseFloat(returnedToTreasury) || 0;
  const reimbursementAmount = parseFloat(additionalToEmployee) || 0;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treasuryAccountId && (returnedAmount > 0 || reimbursementAmount > 0)) {
      alert("يرجى تحديد الخزينة لتسجيل حركة الرد أو الاستعاضة المالية");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        custody_id: custody.id,
        settlement_date: settlementDate,
        treasury_account_id: treasuryAccountId ? parseInt(treasuryAccountId) : null,
        settlement_type: settlementType,
        total_expenses: spentAmount,
        returned_to_treasury: returnedAmount,
        additional_paid_to_employee: reimbursementAmount,
        notes,
        clearance_certificate: clearanceCert
      });
    } catch (e: any) {
      console.error(e);
      alert(`فشل إتمام التسوية: ${e.message || "خطأ غير متوقع"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 my-6 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-base font-black text-slate-900">
                تسوية وتصفية العهدة ({custody.custody_number || `CUS-${custody.id}`})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                الموظف: <strong className="text-slate-800">{custody.employee_name}</strong> • القيمة الأصلية: {originalAmount.toLocaleString()} ج.م
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 text-right overflow-y-auto">
          {/* Financial Calculation Balance Box */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400">قيمة العهدة المنصرفة</span>
              <div className="text-base font-black text-slate-900 font-mono">
                {originalAmount.toLocaleString()} ج.م
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-700">إجمالي الفواتير المعتمدة</span>
              <div className="text-base font-black text-emerald-700 font-mono">
                {spentAmount.toLocaleString()} ج.م
              </div>
            </div>

            <div className="space-y-1">
              {spentAmount < originalAmount ? (
                <>
                  <span className="text-[11px] font-bold text-blue-700">المتبقي المطلوب رده للخزينة</span>
                  <div className="text-base font-black text-blue-700 font-mono">
                    +{returnedAmount.toLocaleString()} ج.م
                  </div>
                </>
              ) : spentAmount > originalAmount ? (
                <>
                  <span className="text-[11px] font-bold text-rose-700">مستحق صرفه للموظف (زيادة)</span>
                  <div className="text-base font-black text-rose-700 font-mono">
                    -{reimbursementAmount.toLocaleString()} ج.م
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-bold text-emerald-700">الحالة المحاسبية</span>
                  <div className="text-base font-black text-emerald-700">
                    مطابقة تامة (0.00)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Settlement Date */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">تاريخ التسوية والترحيل</label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:bg-white outline-none"
                required
              />
            </div>

            {/* Treasury Safe */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">الخزينة (لتسجيل الرد أو الاستعاضة)</label>
              <select
                value={treasuryAccountId}
                onChange={(e) => setTreasuryAccountId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:bg-white outline-none"
              >
                <option value="">-- اختر الخزينة --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (رصيد: {Number(acc.current_balance || 0).toLocaleString()} ج.م)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Settlement Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">نوع التسوية</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSettlementType('full')}
                className={`p-3 rounded-xl border text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  settlementType === 'full'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span>تسوية نهائية وإغلاق</span>
                <span className="text-[10px] text-slate-400 font-normal">إخلاء طرف الموظف بالكامل</span>
              </button>

              <button
                type="button"
                onClick={() => setSettlementType('partial')}
                className={`p-3 rounded-xl border text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  settlementType === 'partial'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span>تسوية جزئية</span>
                <span className="text-[10px] text-slate-400 font-normal">إبقاء العهدة مفتوحة بمبلغ متبقي</span>
              </button>

              <button
                type="button"
                onClick={() => setSettlementType('replenish')}
                className={`p-3 rounded-xl border text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  settlementType === 'replenish'
                    ? 'bg-amber-50 border-amber-500 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span>استعاضة عهدة مستديمة</span>
                <span className="text-[10px] text-slate-400 font-normal">إعادة تعويض المصروفات المنفقة</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">ملاحظات وقرار لجنة التسوية</label>
            <textarea
              placeholder="اكتب تفاصيل التصفية، وأي أرقام سندات قبض أو صرف مرافقة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-medium focus:border-emerald-500 focus:bg-white outline-none min-h-[70px]"
            ></textarea>
          </div>

          {/* Clearance Certificate Checkbox */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center gap-2">
            <input
              type="checkbox"
              id="clearanceCert"
              checked={clearanceCert}
              onChange={(e) => setClearanceCert(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <label htmlFor="clearanceCert" className="text-xs font-bold text-emerald-900 cursor-pointer">
              إصدار شهادة إبراء ذمة وإخلاء طرف مالي للموظف من هذه العهدة
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl text-xs font-bold transition-all"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد التسوية وترحيل القيد المحاسبي</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
