import React from "react";
import { Printer, X, ShieldCheck, Calendar, User, Building2, Wallet } from "lucide-react";
import { TreasuryCustody } from "../../../types";

interface PrintProps {
  isOpen: boolean;
  custody: TreasuryCustody | null;
  onClose: () => void;
}

export const CustodyPrintVoucher: React.FC<PrintProps> = ({ isOpen, custody, onClose }) => {
  if (!isOpen || !custody) return null;

  const handlePrint = () => {
    window.print();
  };

  const amount = parseFloat((custody.amount as any) || 0);
  const spent = parseFloat((custody.spent_amount as any) || (custody.cleared_amount as any) || 0);
  const remaining = parseFloat((custody.remaining_amount as any) || (amount - spent) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col print:shadow-none print:border-none print:w-full print:max-w-none">
        {/* Actions bar - Hidden on print */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند فوراً</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Printable Paper */}
        <div className="p-8 space-y-6 text-right font-sans text-slate-900" dir="rtl">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">نظام REMO PRO ERP المتكامل</h2>
              <p className="text-xs text-slate-500 font-bold">إدارة الخزينة والرقابة المالية • وحدة العهد والأمانات</p>
            </div>
            <div className="text-left font-mono">
              <div className="text-sm font-black text-indigo-700">
                {custody.custody_number || `CUS-${custody.id}`}
              </div>
              <div className="text-xs text-slate-500">
                التاريخ: {custody.created_at ? new Date(custody.created_at).toLocaleDateString("ar-EG") : ""}
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-200">
            <h3 className="text-base font-black text-slate-900">
              سند تسليم وإقرار استلام عهدة مالية / عينية
            </h3>
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <div><strong>اسم الموظف المسند إليه:</strong> {custody.employee_name}</div>
              <div><strong>الرقم الوظيفي / الكود:</strong> {custody.employee_code || "---"}</div>
              <div><strong>الإدارة / القسم:</strong> {custody.employee_department || "---"}</div>
              <div><strong>الفرع:</strong> {custody.branch_name || "الفرع الرئيسي"}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <div><strong>الخزينة المانحة:</strong> {custody.account_name || "خزينة عامة"}</div>
              <div><strong>نوع العهدة:</strong> {custody.custody_type_name || custody.custody_type || "عهدة نقدية"}</div>
              <div><strong>تاريخ الاستحقاق والتسوية:</strong> {custody.due_date ? new Date(custody.due_date).toLocaleDateString("ar-EG") : "غير محدد"}</div>
              <div><strong>مركز التكلفة:</strong> {custody.cost_center_name || "عام"}</div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-right">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5">البيان والغرض من العهدة</th>
                  <th className="p-2.5 text-center">المبلغ المنصرف</th>
                  <th className="p-2.5 text-center">المصروف بالفواتير</th>
                  <th className="p-2.5 text-center">المتبقي المطلوب رده</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 font-bold">{custody.purpose || "عهدة نقدية لتسيير الأعمال"}</td>
                  <td className="p-3 text-center font-mono font-black text-slate-900">{amount.toLocaleString()} ج.م</td>
                  <td className="p-3 text-center font-mono text-emerald-700">{spent.toLocaleString()} ج.م</td>
                  <td className="p-3 text-center font-mono font-black text-indigo-700">{remaining.toLocaleString()} ج.م</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Issued Items if any */}
          {custody.items && custody.items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800">الأصول والأجهزة والمعدات العينية المسلمة:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2">اسم الصنف / الأصل</th>
                      <th className="p-2">الرقم التسلسلي</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2">حالة التسليم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {custody.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold">{it.item_name}</td>
                        <td className="p-2 font-mono">{it.serial_number || "---"}</td>
                        <td className="p-2">{it.quantity}</td>
                        <td className="p-2">{it.condition_on_issue || "ممتازة"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legal Acknowledgement Statement */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 leading-relaxed font-medium">
            <strong>إقرار واستلام:</strong> أقر أنا الموقع أدناه بأنني استلمت العهدة الموضحة أعلاه وأتعهد بالمحافظة عليها وصرفها في الأغراض المحددة لها وتقديم الفواتير المؤيدة والتسوية التامة في الموعد المحدد قانوناً ودفترياً، وإرجاع أي مبالغ أو أصول فائضة لخزينة الشركة فور انتهاء الغرض.
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-4 pt-8 text-center text-xs">
            <div className="space-y-8">
              <span className="font-bold text-slate-700">المستلم / صاحب العهدة</span>
              <div className="border-t border-slate-400 pt-1 font-mono text-[10px] text-slate-500">التوقيع / البصمة</div>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700">أمين الخزينة</span>
              <div className="border-t border-slate-400 pt-1 font-mono text-[10px] text-slate-500">التوقيع والتاريخ</div>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700">المراجع المالي</span>
              <div className="border-t border-slate-400 pt-1 font-mono text-[10px] text-slate-500">التوقيع والتاريخ</div>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700">المدير العام / الاعتماد</span>
              <div className="border-t border-slate-400 pt-1 font-mono text-[10px] text-slate-500">الختم والتوقيع</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
