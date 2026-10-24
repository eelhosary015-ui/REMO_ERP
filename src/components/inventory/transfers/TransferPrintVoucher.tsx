import React from "react";
import { Printer, X, Building2, Truck, FileText, CheckCircle2 } from "lucide-react";
import { WarehouseTransfer, TransferItem } from "./TransferTypes";

interface TransferPrintVoucherProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: WarehouseTransfer | null;
}

export const TransferPrintVoucher: React.FC<TransferPrintVoucherProps> = ({
  isOpen,
  onClose,
  transfer,
}) => {
  if (!isOpen || !transfer) return null;

  const items: TransferItem[] = (() => {
    try {
      return typeof transfer.items === "string" ? JSON.parse(transfer.items) : (transfer.items || []);
    } catch {
      return [];
    }
  })();

  const totalQty = items.reduce((s, it) => s + Number(it.dispatched_qty || it.approved_qty || it.requested_qty || it.quantity || 0), 0);
  const totalValue = items.reduce((s, it) => s + ((it.dispatched_qty || it.requested_qty || 0) * (it.unit_cost || 0)), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background overflow-y-auto" id="transfer-print-modal">
      <div className="bg-white text-neutral-900 border border-neutral-300 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Action Header (Hidden during Print) */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 bg-neutral-100 print:hidden">
          <span className="text-xs font-bold text-neutral-700">معاينة سند التحويل المخزني وبوليصة الشحن</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-trigger-print"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند الرسمي</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-500 hover:text-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-right print:p-0 print:m-0" dir="rtl" id="printable-transfer-voucher">
          
          {/* Header & Logo */}
          <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-neutral-900">نظام REMO PRO ERP</h1>
              <p className="text-xs text-neutral-600 font-semibold mt-0.5">إدارة المستودعات والتحويلات اللوجستية</p>
              <p className="text-[11px] text-neutral-500 font-mono">سجل تجاري: 1010XXXXXX | الرقم الضريبي: 3000XXXXXXXX0003</p>
            </div>

            <div className="text-left">
              <h2 className="text-lg font-black text-blue-900">سند تحويل مخزني وبوليصة نقل</h2>
              <div className="font-mono text-sm font-bold text-neutral-800 mt-1">
                رقم السند: {transfer.transfer_number || transfer.transfer_no}
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                تاريخ الإصدار: <span className="font-mono font-bold">{transfer.date}</span>
              </div>
            </div>
          </div>

          {/* Transfer & Logistics Meta Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-50 border border-neutral-300 rounded-xl text-xs">
            <div>
              <span className="text-neutral-500 block text-[11px]">المخزن المصدر (الصرف)</span>
              <strong className="text-neutral-900 block font-bold mt-0.5">{transfer.from_warehouse_name}</strong>
              <span className="text-[10px] text-neutral-500 font-mono">كود: {transfer.from_warehouse_code}</span>
            </div>

            <div>
              <span className="text-neutral-500 block text-[11px]">المخزن المستهدف (الاستلام)</span>
              <strong className="text-neutral-900 block font-bold mt-0.5">{transfer.to_warehouse_name}</strong>
              <span className="text-[10px] text-neutral-500 font-mono">كود: {transfer.to_warehouse_code}</span>
            </div>

            <div>
              <span className="text-neutral-500 block text-[11px]">بيانات السائق / الناقل</span>
              <strong className="text-neutral-900 block font-bold mt-0.5">{transfer.driver_name || "—"}</strong>
              {transfer.vehicle_no && <span className="text-[10px] text-neutral-600 block">شاحنة: {transfer.vehicle_no}</span>}
            </div>

            <div>
              <span className="text-neutral-500 block text-[11px]">رقم بوليصة الشحن (Waybill)</span>
              <strong className="text-neutral-900 block font-mono font-bold mt-0.5">{transfer.waybill_no || "—"}</strong>
              <span className="text-[10px] text-neutral-600 block">نوع التحويل: {transfer.type}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-neutral-300 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700 border-b border-neutral-300 font-bold">
                  <th className="py-2 px-3 w-10 text-center">#</th>
                  <th className="py-2 px-3">اسم الصنف والتوصيف</th>
                  <th className="py-2 px-3 w-24 text-center">كود الصنف</th>
                  <th className="py-2 px-3 w-20 text-center">الكمية</th>
                  <th className="py-2 px-3 w-20 text-center">الوحدة</th>
                  <th className="py-2 px-3 w-28 text-center">رقم الباتش</th>
                  <th className="py-2 px-3 w-24 text-center">تاريخ الصلاحية</th>
                  <th className="py-2 px-3 min-w-[120px]">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {items.map((item, idx) => {
                  const qty = item.dispatched_qty || item.approved_qty || item.requested_qty || item.quantity || 0;
                  return (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 text-center text-neutral-500 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-neutral-900">{item.name}</td>
                      <td className="py-2 px-3 text-center font-mono text-neutral-600">{item.code}</td>
                      <td className="py-2 px-3 text-center font-mono font-black text-neutral-900">{qty}</td>
                      <td className="py-2 px-3 text-center text-neutral-600">{item.unit}</td>
                      <td className="py-2 px-3 text-center font-mono text-neutral-700">{item.batch_number || "—"}</td>
                      <td className="py-2 px-3 text-center font-mono text-neutral-700">{item.expiry_date || "—"}</td>
                      <td className="py-2 px-3 text-neutral-600">{item.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="flex items-start justify-between text-xs pt-2">
            <div className="space-y-1">
              <span className="text-neutral-600 font-bold block">ملاحظات التحويل والتسليم:</span>
              <p className="text-neutral-700 bg-neutral-50 p-2.5 rounded border border-neutral-200 w-80 text-[11px]">
                {transfer.notes || "تم صرف وتحميل الأصناف المذكورة أعلاه بحالة سليمة ومطابقة للمواصفات القياسية."}
              </p>
            </div>

            <div className="p-3 bg-neutral-100 rounded-lg border border-neutral-300 text-left min-w-[200px] space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-600">إجمالي عدد البنود:</span>
                <strong className="font-mono">{items.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">إجمالي الكميات:</span>
                <strong className="font-mono">{totalQty}</strong>
              </div>
              <div className="flex justify-between border-t border-neutral-300 pt-1">
                <span className="text-neutral-600">حالة السند:</span>
                <strong className="font-semibold text-blue-800">{transfer.status}</strong>
              </div>
            </div>
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-4 gap-4 pt-10 border-t border-neutral-300 text-center text-xs">
            <div className="space-y-8">
              <span className="font-bold text-neutral-700 block">أمين المخزن المصدر (الصرف)</span>
              <div className="border-b border-dashed border-neutral-400 w-32 mx-auto"></div>
              <span className="text-[10px] text-neutral-500 block font-mono">التوقيع والختم</span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-neutral-700 block">السائق / الناقل</span>
              <div className="border-b border-dashed border-neutral-400 w-32 mx-auto"></div>
              <span className="text-[10px] text-neutral-500 block font-mono">استلمت بحالة سليمة</span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-neutral-700 block">مسؤول فحص الجودة (QC)</span>
              <div className="border-b border-dashed border-neutral-400 w-32 mx-auto"></div>
              <span className="text-[10px] text-neutral-500 block font-mono">مطابق للمواصفات</span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-neutral-700 block">أمين المخزن المستلم (الإيداع)</span>
              <div className="border-b border-dashed border-neutral-400 w-32 mx-auto"></div>
              <span className="text-[10px] text-neutral-500 block font-mono">تم الإيداع بالرفوف</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
