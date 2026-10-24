import React, { useState } from "react";
import { X, RotateCcw, AlertTriangle, ShieldAlert } from "lucide-react";
import { TreasuryTransfer } from "../../../types";
import { formatCurrency } from "./transferUtils";

interface TransferReverseModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: TreasuryTransfer | null;
  onConfirm: (transferId: number, reason: string) => Promise<void>;
  submitting: boolean;
}

export const TransferReverseModal: React.FC<TransferReverseModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onConfirm,
  submitting
}) => {
  if (!isOpen || !transfer) return null;

  const [reversalReason, setReversalReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      setError("يرجى توضيح سبب عكس وإلغاء التحويل المالي بالتفصيل");
      return;
    }
    await onConfirm(transfer.id, reversalReason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-600/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">عكس التحويل المالي واسترداد الأرصدة</h3>
              <p className="text-xs text-slate-500 font-mono">{transfer.transfer_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>الأثر المالي لعملية العكس:</span>
            </div>
            <div className="text-slate-700 dark:text-slate-300 space-y-1">
              <div>• سيتم استقطاع <span className="font-bold text-rose-600">{formatCurrency(transfer.destination_amount || transfer.amount, transfer.destination_currency)}</span> من ({transfer.destination_account_name}).</div>
              <div>• سيتم إعادة إيداع <span className="font-bold text-emerald-600">{formatCurrency(transfer.amount, transfer.source_currency)}</span> إلى ({transfer.source_account_name}).</div>
              <div>• سيتم إنشاء قيد عكسي وتغيير حالة السند إلى <span className="font-bold text-amber-700">معكوس (Reversed)</span>.</div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              سبب العكس والإلغاء المعتمد <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="مثلاً: خطأ في إدخال الحساب المستهدف / تكرار عملية التحويل بناءً على طلب المدير المالي..."
              value={reversalReason}
              onChange={e => {
                setReversalReason(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              تراجع
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/25 transition"
            >
              <RotateCcw className="w-4 h-4" />
              {submitting ? "جاري المعالجة..." : "تأكيد العكس المالي"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
