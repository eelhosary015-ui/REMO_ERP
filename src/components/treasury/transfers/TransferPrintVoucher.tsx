import React from "react";
import { X, Printer, Download, ArrowRightLeft, Building, Landmark, Wallet } from "lucide-react";
import { TreasuryTransfer } from "../../../types";
import { formatCurrency, formatDate, getTransferTypeLabel, tafqeetArabic } from "./transferUtils";

interface TransferPrintVoucherProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: TreasuryTransfer | null;
}

export const TransferPrintVoucher: React.FC<TransferPrintVoucherProps> = ({
  isOpen,
  onClose,
  transfer
}) => {
  if (!isOpen || !transfer) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:border-none print:shadow-none print:rounded-none print:m-0">
        
        {/* Action Controls (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-800 text-white print:hidden">
          <span className="text-xs font-bold">معاينة سند التحويل المالي للطباعة</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              <Printer className="w-4 h-4" />
              طباعة فورية
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-8 space-y-6 text-right font-sans print:p-6" dir="rtl">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">REMO PRO ERP</h1>
              <p className="text-xs font-bold text-slate-600">نظام الإدارة المالية والخزينة الموحدة</p>
              <p className="text-[11px] text-slate-500">سند تحويل مالي بين الحسابات والخزائن</p>
            </div>
            <div className="text-left font-mono">
              <div className="text-lg font-black text-indigo-900">{transfer.transfer_number}</div>
              <div className="text-xs text-slate-600">التاريخ: {formatDate(transfer.transfer_date)}</div>
              {transfer.journal_entry_number && (
                <div className="text-[11px] font-bold text-emerald-700">القيد: {transfer.journal_entry_number}</div>
              )}
            </div>
          </div>

          {/* Transfer Type & Category Header */}
          <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl text-xs font-bold">
            <div>نوع العملية: <span className="text-indigo-900">{getTransferTypeLabel(transfer.transfer_type)}</span></div>
            <div>التصنيف: <span className="text-slate-800">{transfer.category || "تشغيلي"}</span></div>
            <div>حالة السند: <span className="text-emerald-700 font-extrabold">{transfer.status.toUpperCase()}</span></div>
          </div>

          {/* Amount Box */}
          <div className="p-4 rounded-xl border-2 border-slate-900 bg-slate-50 space-y-2 text-center">
            <div className="text-xs text-slate-600 font-bold">المبلغ المطلوب تحويله</div>
            <div className="text-3xl font-black text-slate-950 font-mono">
              {formatCurrency(transfer.amount, transfer.source_currency || "ج.م")}
            </div>
            <div className="text-xs font-bold text-slate-800 border-t border-slate-300 pt-2">
              {tafqeetArabic(Number(transfer.amount), transfer.source_currency === "EGP" ? "جنيه مصري" : transfer.source_currency)}
            </div>
          </div>

          {/* Source & Destination Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            
            {/* Source */}
            <div className="p-4 rounded-xl border border-slate-300 space-y-2">
              <div className="font-black text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-600" />
                الجهة المصدر (الخصم والصرف)
              </div>
              <div className="space-y-1">
                <div><span className="text-slate-500">الخزينة / الحساب:</span> <span className="font-bold">{transfer.source_account_name}</span></div>
                <div><span className="text-slate-500">الفرع المصدر:</span> <span>{transfer.source_branch_name || "الفرع الرئيسي"}</span></div>
                <div><span className="text-slate-500">أمين الخزينة المصدر:</span> <span className="font-semibold">{transfer.executed_by_name || transfer.created_by_name || "---"}</span></div>
              </div>
            </div>

            {/* Destination */}
            <div className="p-4 rounded-xl border border-slate-300 space-y-2">
              <div className="font-black text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-600" />
                الجهة المستهدفة (الإيداع والاستلام)
              </div>
              <div className="space-y-1">
                <div><span className="text-slate-500">الخزينة / الحساب:</span> <span className="font-bold">{transfer.destination_account_name}</span></div>
                <div><span className="text-slate-500">الفرع المستهدف:</span> <span>{transfer.destination_branch_name || "الفرع الرئيسي"}</span></div>
                <div><span className="text-slate-500">المستلم / الصراف:</span> <span className="font-semibold">{transfer.received_by_name || "---"}</span></div>
              </div>
            </div>

          </div>

          {/* Purpose & Statement */}
          <div className="p-4 rounded-xl border border-slate-300 space-y-1 text-xs">
            <div className="font-bold text-slate-800">البيان والغرض الرسمي:</div>
            <p className="text-slate-700 leading-relaxed font-medium">
              {transfer.purpose || transfer.statement || "تحويل مالي بين الخزائن والحسابات"}
            </p>
            {transfer.notes && (
              <p className="text-slate-500 text-[11px] mt-1 border-t border-slate-200 pt-1">
                ملاحظات: {transfer.notes}
              </p>
            )}
          </div>

          {/* Signatures & Authorizations Matrix */}
          <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-4 gap-3 text-center text-xs">
            <div className="space-y-8">
              <div className="font-bold text-slate-800">منشئ الطلب</div>
              <div className="font-mono text-[11px] text-slate-600">{transfer.created_by_name || "الموظف المسؤول"}</div>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
            </div>

            <div className="space-y-8">
              <div className="font-bold text-slate-800">الاعتماد المالي</div>
              <div className="font-mono text-[11px] text-slate-600">{transfer.approved_by_name || "المدير المالي"}</div>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
            </div>

            <div className="space-y-8">
              <div className="font-bold text-slate-800">أمين الخزينة المصدر</div>
              <div className="font-mono text-[11px] text-slate-600">{transfer.executed_by_name || "صراف المصدر"}</div>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
            </div>

            <div className="space-y-8">
              <div className="font-bold text-slate-800">المستلم / الصراف المستهدف</div>
              <div className="font-mono text-[11px] text-slate-600">{transfer.received_by_name || "صراف المستلم"}</div>
              <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-200">
            تم إصدار هذا المستند إلكترونياً من نظام REMO PRO ERP - يعتبر هذا السند مستنداً مالياً رسمياً بعد التوقيع والختم.
          </div>

        </div>

      </div>
    </div>
  );
};
