import React, { useState, useEffect } from "react";
import { authHeaders } from "../../../utils/api";
import {
  FileText,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Printer,
  Calendar,
  Building2,
  User,
  ShieldCheck
} from "lucide-react";

interface PreClosingLedgerModalProps {
  treasuryId: number;
  treasuryName: string;
  treasuryCode?: string;
  onClose: () => void;
}

export const PreClosingLedgerModal: React.FC<PreClosingLedgerModalProps> = ({
  treasuryId,
  treasuryName,
  treasuryCode,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchLedger = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/treasury/pre-closing-ledger/${treasuryId}`, {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error("فشل جلب حركة الخزينة قبل الإقفال");
        const data = await res.json();
        setTransactions(data.transactions || []);
      } catch (err: any) {
        console.error("Fetch pre-closing ledger error:", err);
        setErrorMessage(err.message || "فشل تحميل حركات الخزينة");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLedger();
  }, [treasuryId]);

  // Compute summary totals
  const totalDeposits = transactions
    .filter(t => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalWithdrawals = transactions
    .filter(t => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                كشف حركة الخزينة قبل الإقفال
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {treasuryCode || `SAFE-${treasuryId}`}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {treasuryName} — تفاصيل مقبوضات ومدفوعات اليوم حتى لحظة الجرد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Bar */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> إجمالي المقبوضات/الإيداعات
            </div>
            <div className="text-sm font-black text-emerald-700 mt-1">
              +{totalDeposits.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] text-rose-600 font-bold flex items-center justify-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> إجمالي المدفوعات/المنصرفات
            </div>
            <div className="text-sm font-black text-rose-700 mt-1">
              -{totalWithdrawals.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
            </div>
          </div>

          <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
            <div className="text-[11px] text-indigo-800 font-bold flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> صافي حركة اليوم
            </div>
            <div className="text-sm font-black text-indigo-950 mt-1">
              {(totalDeposits - totalWithdrawals).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500">جاري تحميل كشف حركة الخزينة...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              {errorMessage}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">لا توجد حركات مالية مسجلة اليوم لهذه الخزينة</p>
              <p className="text-xs">يمكنك البدء بالجرد الفعلي للنقدية مباشرة</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3"># السند</th>
                    <th className="p-3">الوقت</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">البيان / السبب</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الرصيد بعدها</th>
                    <th className="p-3">المستخدم</th>
                    <th className="p-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.map((t) => {
                    const amt = Number(t.amount || 0);
                    const isCredit = amt > 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-900">{t.voucher_number || `#${t.id}`}</td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          {new Date(t.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isCredit ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {isCredit ? "قبض / إيداع" : "صرف / سداد"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium max-w-[200px] truncate" title={t.notes}>
                          {t.notes || "حركة مالية اعتيادية"}
                        </td>
                        <td className={`p-3 font-black ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
                          {isCredit ? "+" : ""}{amt.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                        </td>
                        <td className="p-3 text-slate-800 font-bold">
                          {Number(t.balance_after || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                        </td>
                        <td className="p-3 text-slate-500">{t.created_by_name || "النظام"}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {t.status === "approved" ? "معتمد" : "معلق"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            عدد حركات اليومية: <strong>{transactions.length} حركة</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition"
          >
            إغلاق الكشف
          </button>
        </div>
      </div>
    </div>
  );
};
export default PreClosingLedgerModal;
