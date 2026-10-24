import React, { useState } from "react";
import { X, Ban, AlertCircle } from "lucide-react";
import { TreasuryTransfer } from "../../../types";

interface TransferRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: TreasuryTransfer | null;
  onConfirm: (transferId: number, reason: string) => Promise<void>;
  submitting: boolean;
}

export const TransferRejectModal: React.FC<TransferRejectModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onConfirm,
  submitting
}) => {
  if (!isOpen || !transfer) return null;

  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("يرجى كتابة سبب رفض طلب التحويل المالي");
      return;
    }
    await onConfirm(transfer.id, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">رفض طلب التحويل المالي</h3>
              <p className="text-xs text-slate-500 font-mono">{transfer.transfer_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              سبب الرفض والملاحظات للمنشئ <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="مثلاً: عدم كفاية المستندات المؤيدة / طلب غير مطابق للموازنة المعتمدة..."
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25 transition"
            >
              <Ban className="w-4 h-4" />
              {submitting ? "جاري الرفض..." : "تأكيد الرفض"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
