import React, { useState } from "react";
import { X, Inbox, CheckCircle2, AlertTriangle } from "lucide-react";
import { TreasuryTransfer } from "../../../types";
import { formatCurrency } from "./transferUtils";

interface TransferReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: TreasuryTransfer | null;
  onConfirm: (transferId: number, data: { receipt_notes: string; actual_amount?: number }) => Promise<void>;
  submitting: boolean;
}

export const TransferReceiptModal: React.FC<TransferReceiptModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onConfirm,
  submitting
}) => {
  if (!isOpen || !transfer) return null;

  const [receiptNotes, setReceiptNotes] = useState("");
  const [actualAmount, setActualAmount] = useState(
    transfer.destination_amount ? transfer.destination_amount.toString() : transfer.amount.toString()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(transfer.id, {
      receipt_notes: receiptNotes.trim() || "تم استلام المبلغ والتحقق من سلامة النقدية والإيداع بالخزينة",
      actual_amount: parseFloat(actualAmount) || transfer.destination_amount || transfer.amount
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">تأكيد استلام التحويل المالي</h3>
              <p className="text-xs text-slate-500 font-mono">{transfer.transfer_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">الخزينة المستهدفة المستلمة:</span>
              <span className="font-bold text-slate-900 dark:text-white">{transfer.destination_account_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المرسل من:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{transfer.source_account_name}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600 text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>المبلغ المتوقع استلامه:</span>
              <span className="font-mono">{formatCurrency(transfer.destination_amount || transfer.amount, transfer.destination_currency)}</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              المبلغ الفعلي المستلم بعد العد والفحص <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={actualAmount}
              onChange={e => setActualAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات الاستلام والفحص</label>
            <textarea
              rows={3}
              placeholder="مثلاً: تم استلام المبلغ نقداً ومطابق للمستند المرفق دون أي فروقات..."
              value={receiptNotes}
              onChange={e => setReceiptNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>بتأكيد الاستلام، ستتم إضافة المبلغ لرصيد الخزينة المستهدفة وترحيل القيد المحاسبي النهائي فوراً.</span>
          </div>

          {/* Actions */}
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
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? "جاري التأكيد..." : "تأكيد الاستلام والإيداع"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
