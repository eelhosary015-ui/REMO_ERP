import React, { useState } from "react";
import { authHeaders } from "../../../utils/api";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Coins,
  FileText,
  User,
  Calendar,
  Building2,
  Printer,
  Check,
  RotateCcw,
  RefreshCw
} from "lucide-react";
import { TreasuryClosing } from "../../../types";

interface ClosingDetailModalProps {
  closing: TreasuryClosing | null;
  onClose: () => void;
  onPrint: (closing: TreasuryClosing) => void;
  onReviewedSuccess?: () => void;
}

const DENOM_ORDER = [200, 100, 50, 20, 10, 5, 1, 0.5];

export const ClosingDetailModal: React.FC<ClosingDetailModalProps> = ({
  closing,
  onClose,
  onPrint,
  onReviewedSuccess
}) => {
  if (!closing) return null;

  const [reviewNotes, setReviewNotes] = useState("");
  const [postAdjustment, setPostAdjustment] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const varianceVal = Number(closing.variance || 0);

  // Parse denominations safely
  const denominations: Record<string, number> = typeof closing.denominations === "string"
    ? JSON.parse(closing.denominations || "{}")
    : (closing.denominations || {});

  const handleReviewAction = async (action: "approve" | "settle" | "reopen") => {
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/treasury/closings/${closing.id}/review`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action,
          review_notes: reviewNotes,
          post_adjustment: postAdjustment
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "فشل مراجعة الإقفال");

      setReviewSuccess(true);
      if (onReviewedSuccess) onReviewedSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Review action error:", err);
      setReviewError(err.message || "حدث خطأ أثناء تنفيذ إجراء المراجعة");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200 text-right">
        {/* 1. Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  محضر إقفال الخزينة وجرد النقدية #{closing.id}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-indigo-200">
                  {closing.treasury_code || `SAFE-${closing.treasury_id}`}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {closing.treasury_name} {closing.branch_name ? `• ${closing.branch_name}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(closing)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1 text-xs"
              title="طباعة محضر الجرد"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة المحضر</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Summary Comparison Highlights */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-medium">الرصيد الدفتري</div>
              <div className="text-base font-black text-slate-900 mt-0.5">
                {Number(closing.book_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400">من واقع القيود</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
              <div className="text-[11px] text-indigo-700 font-medium">الرصيد الفعلي (المعدود)</div>
              <div className="text-base font-black text-indigo-950 mt-0.5">
                {Number(closing.actual_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-indigo-500">حاصل جرد الفئات</div>
            </div>

            <div className={`p-3.5 rounded-2xl border ${
              varianceVal === 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : varianceVal < 0
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <div className="text-[11px] font-medium">فارق الجرد (Variance)</div>
              <div className="text-base font-black mt-0.5">
                {varianceVal > 0 ? `+${varianceVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : varianceVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] font-semibold">
                {varianceVal === 0 ? "متطابق تماماً" : varianceVal < 0 ? "عجز نقدي" : "زيادة نقدية"}
              </div>
            </div>
          </div>

          {/* Denominations Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              تفصيل الفئات النقدية المعدودة (Denomination Breakdown)
            </h4>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4">الفئة النقدية</th>
                    <th className="py-2.5 px-4 text-center">العدد (الكمية)</th>
                    <th className="py-2.5 px-4 text-center">الإجمالي الجزئي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {DENOM_ORDER.map((val, dIdx) => {
                    const count = denominations[String(val)] || 0;
                    const subtotal = Math.round(val * count * 100) / 100;
                    return (
                      <tr key={`denom-row-${val}-${dIdx}`} className={count > 0 ? "bg-indigo-50/20 font-medium" : "text-slate-400"}>
                        <td className="py-2 px-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span>فئة {val} جنيه</span>
                        </td>
                        <td className="py-2 px-4 text-center font-mono font-bold">
                          {count.toLocaleString("en-US")}
                        </td>
                        <td className="py-2 px-4 text-center font-mono font-bold text-slate-900">
                          {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-indigo-50/80 font-bold border-t-2 border-indigo-200 text-indigo-950">
                    <td className="py-3 px-4">الإجمالي الكلي للنقدية المعدودة</td>
                    <td className="py-3 px-4 text-center font-mono">
                      {Object.values(denominations).reduce((a, b) => a + Number(b || 0), 0)} ورقة/قطعة
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-sm text-indigo-700">
                      {Number(closing.actual_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Metadata and Notes */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs text-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span>المسؤول عن الجرد: <strong>{closing.responsible_user || "-"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>تاريخ وتوقيت الإقفال: <strong>{new Date(closing.closing_date).toLocaleString("ar-EG")}</strong></span>
              </div>
            </div>

            {closing.notes && (
              <div className="pt-2 border-t border-slate-200 flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800">الملاحظات والتبرير: </span>
                  <span className="text-slate-600">{closing.notes}</span>
                </div>
              </div>
            )}

            {closing.reviewed_at && (
              <div className="pt-2 border-t border-slate-200 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>تمت المراجعة والاعتماد بتاريخ {new Date(closing.reviewed_at).toLocaleDateString("ar-EG")} {closing.review_notes ? `— (${closing.review_notes})` : ""}</span>
              </div>
            )}
          </div>

          {/* Supervisor Review Action Panel */}
          {(!closing.reviewed_at || closing.status.includes("Pending")) && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
              <h5 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                إجراءات التدقيق والاعتماد المالي (Financial Supervisor Review)
              </h5>

              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="ملاحظات الاعتماد المالي أو قرار تسوية الفروقات..."
                className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
              />

              {varianceVal !== 0 && (
                <label className="flex items-center gap-2 text-xs text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postAdjustment}
                    onChange={(e) => setPostAdjustment(e.target.checked)}
                    className="rounded border-amber-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>توليد قيد وتسوية نقدية في حساب الخزينة لمطابقة الرصيد الدفتري مع الفعلي</span>
                </label>
              )}

              {reviewError && (
                <div className="p-2.5 bg-rose-100 text-rose-800 rounded-lg text-xs">
                  {reviewError}
                </div>
              )}

              {reviewSuccess && (
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs">
                  تم حفظ المراجعة والاعتماد بنجاح
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleReviewAction("approve")}
                  disabled={isSubmittingReview}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  اعتماد ومطابقة (Approve & Settle)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onPrint(closing)}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            طباعة المحضر الرسمي
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
export default ClosingDetailModal;
