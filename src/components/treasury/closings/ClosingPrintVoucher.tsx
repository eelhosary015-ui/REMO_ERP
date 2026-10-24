import React from "react";
import { X, Printer, ShieldCheck, Building2, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { TreasuryClosing } from "../../../types";

interface ClosingPrintVoucherProps {
  closing: TreasuryClosing | null;
  onClose: () => void;
}

const DENOM_ORDER = [200, 100, 50, 20, 10, 5, 1, 0.5];

export const ClosingPrintVoucher: React.FC<ClosingPrintVoucherProps> = ({
  closing,
  onClose
}) => {
  if (!closing) return null;

  const handlePrint = () => {
    window.print();
  };

  const varianceVal = Number(closing.variance || 0);
  const denominations: Record<string, number> = typeof closing.denominations === "string"
    ? JSON.parse(closing.denominations || "{}")
    : (closing.denominations || {});

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      {/* Control bar for screen */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          طباعة المحضر (Print)
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          إغلاق
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 text-right print:shadow-none print:border-none print:p-6 print:max-w-full print:rounded-none">
        {/* Header with Enterprise Logo & Info */}
        <div className="border-b-2 border-slate-900 pb-5 mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">
              نظام ريمو برو لإدارة الموارد — REMO PRO ERP
            </h1>
            <h2 className="text-sm font-bold text-indigo-900 mt-1">
              محضر جرد وإقفال الخزينة النقدية (Daily Cash Closing & Verification)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              الإدارة المالية والحسابات العامة • قسم الخزينة والتدقيق
            </p>
          </div>

          <div className="text-left font-mono text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div><strong>رقم المحضر:</strong> CLS-{String(closing.id).padStart(5, '0')}</div>
            <div><strong>التاريخ:</strong> {new Date(closing.closing_date).toLocaleDateString("ar-EG")}</div>
            <div><strong>الوقت:</strong> {new Date(closing.closing_date).toLocaleTimeString("ar-EG")}</div>
          </div>
        </div>

        {/* Treasury Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-5">
          <div>
            <span className="text-slate-500">اسم الخزينة:</span>{" "}
            <strong className="text-slate-900">{closing.treasury_name}</strong>
          </div>
          <div>
            <span className="text-slate-500">كود الخزينة:</span>{" "}
            <strong className="font-mono text-slate-900">{closing.treasury_code || `SAFE-${closing.treasury_id}`}</strong>
          </div>
          <div>
            <span className="text-slate-500">الفرع:</span>{" "}
            <strong className="text-slate-900">{closing.branch_name || "الفرع الرئيسي"}</strong>
          </div>
          <div>
            <span className="text-slate-500">المسؤول عن الجرد:</span>{" "}
            <strong className="text-slate-900">{closing.responsible_user || "-"}</strong>
          </div>
        </div>

        {/* Denomination Breakdown Table */}
        <div className="mb-5">
          <h3 className="text-xs font-bold text-slate-800 mb-2">
            أولاً: بيان فئات النقدية الفعلية الموجودة بالخزينة:
          </h3>
          <table className="w-full text-right text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="py-2 px-3 border-l border-slate-300">الفئة النقدية</th>
                <th className="py-2 px-3 text-center border-l border-slate-300">العدد (الكمية)</th>
                <th className="py-2 px-3 text-center">المبلغ الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {DENOM_ORDER.map((val, dIdx) => {
                const count = denominations[String(val)] || 0;
                const subtotal = Math.round(val * count * 100) / 100;
                return (
                  <tr key={`print-denom-${val}-${dIdx}`}>
                    <td className="py-1.5 px-3 border-l border-slate-300">فئة {val} جنيه مصري</td>
                    <td className="py-1.5 px-3 text-center font-mono font-bold border-l border-slate-300">
                      {count.toLocaleString("en-US")}
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono font-bold">
                      {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <td className="py-2 px-3 border-l border-slate-300">إجمالي النقدية الفعلية المعدودة (Actual Balance)</td>
                <td className="py-2 px-3 text-center font-mono border-l border-slate-300">
                  {Object.values(denominations).reduce((a, b) => a + Number(b || 0), 0)} قطعة/ورقة
                </td>
                <td className="py-2 px-3 text-center font-mono text-sm text-indigo-900">
                  {Number(closing.actual_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Reconciliation Summary */}
        <div className="mb-5">
          <h3 className="text-xs font-bold text-slate-800 mb-2">
            ثانياً: خلاصة المطابقة المالية وحساب الفروقات:
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50">
              <div className="text-slate-500">الرصيد الدفتري المسجل</div>
              <div className="font-black text-sm text-slate-900 mt-1 font-mono">
                {Number(closing.book_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
              </div>
            </div>

            <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50">
              <div className="text-slate-500">الرصيد الفعلي المعدود</div>
              <div className="font-black text-sm text-indigo-900 mt-1 font-mono">
                {Number(closing.actual_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
              </div>
            </div>

            <div className={`border p-2.5 rounded-lg ${
              varianceVal === 0
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : varianceVal < 0
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-blue-50 border-blue-300 text-blue-900"
            }`}>
              <div>الفارق (Variance)</div>
              <div className="font-black text-sm mt-1 font-mono">
                {varianceVal > 0 ? `+${varianceVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : varianceVal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
              </div>
              <div className="text-[10px] font-bold mt-0.5">
                {varianceVal === 0 ? "متطابق تماماً" : varianceVal < 0 ? "عجز نقدي" : "زيادة نقدية"}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {closing.notes && (
          <div className="border border-slate-300 p-3 rounded-lg text-xs mb-6 bg-slate-50">
            <span className="font-bold text-slate-800">ملاحظات الجرد: </span>
            <span className="text-slate-600">{closing.notes}</span>
          </div>
        )}

        {/* 3 Signatures Block */}
        <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="font-bold text-slate-800 mb-8">أمين الخزينة / القائم بالجرد</div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
              الاسم: {closing.responsible_user || "........................"}
            </div>
          </div>

          <div>
            <div className="font-bold text-slate-800 mb-8">المراجع المالي / المدقق</div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
              التوقيع: ........................
            </div>
          </div>

          <div>
            <div className="font-bold text-slate-800 mb-8">اعتماد المدير المالي</div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
              الختم والتوقيع: ........................
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ClosingPrintVoucher;
