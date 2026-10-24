import React, { useState, useEffect } from "react";
import { 
  X, 
  ArrowRightLeft, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Inbox, 
  RotateCcw, 
  Printer, 
  Layers, 
  FileText, 
  ShieldCheck, 
  Coins, 
  Wallet, 
  Landmark, 
  Building, 
  User, 
  History, 
  Paperclip,
  Check,
  Ban,
  Download,
  AlertTriangle
} from "lucide-react";
import { TreasuryTransfer, TreasuryTransferAuditLog } from "../../../types";
import { formatCurrency, formatDate, getStatusConfig, getTransferTypeLabel, tafqeetArabic } from "./transferUtils";

interface TransferDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferId: number | null;
  onApprove: (transfer: TreasuryTransfer) => void;
  onReject: (transfer: TreasuryTransfer) => void;
  onExecute: (transfer: TreasuryTransfer) => void;
  onReceive: (transfer: TreasuryTransfer) => void;
  onReverse: (transfer: TreasuryTransfer) => void;
  onCancel: (transfer: TreasuryTransfer) => void;
  onPrint: (transfer: TreasuryTransfer) => void;
  onSubmitForApproval: (transfer: TreasuryTransfer) => void;
}

export const TransferDetailModal: React.FC<TransferDetailModalProps> = ({
  isOpen,
  onClose,
  transferId,
  onApprove,
  onReject,
  onExecute,
  onReceive,
  onReverse,
  onCancel,
  onPrint,
  onSubmitForApproval
}) => {
  if (!isOpen || !transferId) return null;

  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "gl" | "audit" | "attachments">("overview");
  const [transfer, setTransfer] = useState<TreasuryTransfer | null>(null);
  const [auditLogs, setAuditLogs] = useState<TreasuryTransferAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch full details
  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/treasury/transfers/${transferId}`);
      if (res.ok) {
        const data = await res.json();
        setTransfer(data.transfer);
        setAuditLogs(data.audit_logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch transfer details", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [transferId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">جاري تحميل بيانات التحويل...</span>
        </div>
      </div>
    );
  }

  if (!transfer) return null;

  const statusConf = getStatusConfig(transfer.status);
  const isMultiCurrency = transfer.source_currency !== transfer.destination_currency && (transfer.exchange_rate || 1) !== 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 flex flex-col max-h-[88vh]">
        
        {/* Header with Badges & Primary Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {transfer.transfer_number}
                </h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConf.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConf.badgeDot}`} />
                  {statusConf.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                نوع التحويل: {getTransferTypeLabel(transfer.transfer_type)} | التاريخ: {formatDate(transfer.transfer_date)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => onPrint(transfer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة السند
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-xs font-bold overflow-x-auto">
          {[
            { id: "overview", label: "نظرة عامة والبيانات المالية", icon: FileText },
            { id: "timeline", label: "دورة الاعتماد والتنفيذ", icon: Clock },
            { id: "gl", label: "القيد المحاسبي المرتبط (GL)", icon: Layers },
            { id: "audit", label: "سجل الرقابة والتعديلات", icon: History },
            { id: "attachments", label: "المرفقات والإيصالات", icon: Paperclip }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 whitespace-nowrap transition ${
                  active
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Financial Highlight Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/40 dark:from-slate-800/80 dark:via-slate-800/40 dark:to-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 shadow-sm space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold">المبلغ الإجمالي المحول</span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(transfer.amount, transfer.source_currency || "ج.م")}
                    </div>
                  </div>
                  {isMultiCurrency && (
                    <div className="text-right sm:text-left">
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">المبلغ المستلم بالعملة الأخرى</span>
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(transfer.destination_amount, transfer.destination_currency)}
                      </div>
                      <div className="text-[10px] text-slate-400">سعر الصرف: 1 {transfer.source_currency} = {transfer.exchange_rate} {transfer.destination_currency}</div>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-indigo-100/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {tafqeetArabic(Number(transfer.amount), transfer.source_currency === "EGP" ? "جنيه مصري" : transfer.source_currency)}
                </div>
              </div>

              {/* Source vs Destination Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Source Box */}
                <div className="p-4 rounded-2xl bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    الجهة المصدر (الخصم)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">اسم الخزينة/الحساب:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{transfer.source_account_name || `#${transfer.source_account_id}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الفرع المصدر:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{transfer.source_branch_name || "الفرع الرئيسي"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الرصيد قبل التحويل:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{formatCurrency(transfer.source_balance_before, transfer.source_currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-900 dark:text-amber-300">
                      <span>الرصيد بعد التحويل:</span>
                      <span className="font-mono">{formatCurrency(transfer.source_balance_after, transfer.source_currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Destination Box */}
                <div className="p-4 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    الجهة المستهدفة (الإيداع)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">اسم الخزينة/الحساب:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{transfer.destination_account_name || `#${transfer.destination_account_id}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الفرع المستهدف:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{transfer.destination_branch_name || "الفرع الرئيسي"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الرصيد قبل التحويل:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{formatCurrency(transfer.destination_balance_before, transfer.destination_currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-300">
                      <span>الرصيد بعد التحويل:</span>
                      <span className="font-mono">{formatCurrency(transfer.destination_balance_after, transfer.destination_currency)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Purpose & Statement */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">البيان والغرض من التحويل</span>
                  <span className="text-slate-400">التصنيف: {transfer.category || "تشغيلي"}</span>
                </div>
                <div className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  {transfer.purpose || transfer.statement || "لا يوجد بيان مسجل"}
                </div>
                {transfer.notes && (
                  <div className="text-slate-500 text-[11px] mt-1">
                    <span className="font-semibold">ملاحظات إضافية:</span> {transfer.notes}
                  </div>
                )}
              </div>

              {/* Fees Summary */}
              {transfer.transfer_fee > 0 && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between text-xs text-purple-900 dark:text-purple-300">
                  <span>رسوم التحويل المصرفية/الإدارية:</span>
                  <span className="font-bold font-mono">
                    {formatCurrency(transfer.transfer_fee, transfer.fee_currency)} (متحملة بواسطة: {
                      transfer.fee_borne_by === 'source' ? 'الخزينة المصدر' : transfer.fee_borne_by === 'destination' ? 'الخزينة المستلمة' : 'الشركة (مصروف)'
                    })
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TIMELINE & WORKFLOW */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="relative border-r-2 border-slate-200 dark:border-slate-700 mr-4 space-y-6 pr-6 py-2">
                
                {/* 1. Created */}
                <div className="relative">
                  <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900" />
                  <div className="text-xs font-bold text-slate-800 dark:text-white">تم إنشاء المسودة</div>
                  <div className="text-[11px] text-slate-500">
                    بواسطة: {transfer.created_by_name || "النظام"} | بتاريخ: {formatDate(transfer.created_at, true)}
                  </div>
                </div>

                {/* 2. Submitted for Approval */}
                {transfer.submitted_at && (
                  <div className="relative">
                    <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400">تم الإرسال للاعتماد المالي</div>
                    <div className="text-[11px] text-slate-500">
                      بواسطة: {transfer.submitted_by_name || "المسؤول"} | بتاريخ: {formatDate(transfer.submitted_at, true)}
                    </div>
                  </div>
                )}

                {/* 3. Approved */}
                {transfer.approved_at && (
                  <div className="relative">
                    <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                    <div className="text-xs font-bold text-blue-700 dark:text-blue-400">تم الاعتماد والموافقة المالية</div>
                    <div className="text-[11px] text-slate-500">
                      المعتمد: {transfer.approved_by_name || "المدير المالي"} | بتاريخ: {formatDate(transfer.approved_at, true)}
                    </div>
                    {transfer.approval_notes && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic">
                        "{transfer.approval_notes}"
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Executed / Dispatched */}
                {transfer.executed_at && (
                  <div className="relative">
                    <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                    <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400">تم الصرف من الخزينة المصدر (قيد النقل)</div>
                    <div className="text-[11px] text-slate-500">
                      الصراف المصدر: {transfer.executed_by_name || "أمين الخزينة"} | بتاريخ: {formatDate(transfer.executed_at, true)}
                    </div>
                  </div>
                )}

                {/* 5. Received & Completed */}
                {transfer.received_at && (
                  <div className="relative">
                    <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">تم تأكيد الاستلام والإيداع بنجاح</div>
                    <div className="text-[11px] text-slate-500">
                      المستلم: {transfer.received_by_name || "أمين الخزينة المستهدفة"} | بتاريخ: {formatDate(transfer.received_at, true)}
                    </div>
                    {transfer.receipt_notes && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic">
                        "{transfer.receipt_notes}"
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Rejected if applicable */}
                {transfer.rejected_at && (
                  <div className="relative">
                    <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900" />
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-400">تم رفض طلب التحويل</div>
                    <div className="text-[11px] text-slate-500">
                      بواسطة: {transfer.rejected_by_name} | بتاريخ: {formatDate(transfer.rejected_at, true)}
                    </div>
                    <div className="text-xs text-rose-600 font-semibold mt-1">
                      سبب الرفض: {transfer.rejection_reason || "لم يذكر سبب"}
                    </div>
                  </div>
                )}

                {/* 7. Reversed if applicable */}
                {transfer.reversed_at && (
                  <div className="relative">
                    <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-amber-600 border-2 border-white dark:border-slate-900" />
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300">تم عكس وإلغاء أثر التحويل المالي</div>
                    <div className="text-[11px] text-slate-500">
                      بواسطة: {transfer.reversed_by_name} | بتاريخ: {formatDate(transfer.reversed_at, true)}
                    </div>
                    <div className="text-xs text-amber-700 font-semibold mt-1">
                      سبب العكس: {transfer.reversal_reason || "تعديل محاسبي"}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 3: LINKED GL JOURNAL ENTRY */}
          {activeTab === "gl" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-800 dark:text-white">سند القيد المحاسبي اليومي</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {transfer.journal_entry_number || (transfer.journal_entry_id ? `JE-#${transfer.journal_entry_id}` : "غير مرحل بعد")}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">دفتر اليومية العامة General Ledger</span>
                </div>

                {/* Entry Breakdown Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3">رقم الحساب</th>
                        <th className="py-2.5 px-3">اسم الحساب في شجرة الحسابات</th>
                        <th className="py-2.5 px-3">البيان</th>
                        <th className="py-2.5 px-3 text-left">مدين (Debit)</th>
                        <th className="py-2.5 px-3 text-left">دائن (Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {/* Debit Line (Destination) */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">101020</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                          {transfer.destination_account_name || "الخزينة المستهدفة"}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">
                          استلام تحويل مالي سند {transfer.transfer_number}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600 text-left">
                          {formatCurrency(transfer.destination_amount || transfer.amount, transfer.destination_currency)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-left">0.00</td>
                      </tr>

                      {/* Transfer Fee if applicable */}
                      {transfer.transfer_fee > 0 && (
                        <tr>
                          <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">502010</td>
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                            مصروفات وعمولات تحويل بنكي
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">
                            عمولة تحويل لسند {transfer.transfer_number}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-purple-600 text-left">
                            {formatCurrency(transfer.transfer_fee, transfer.fee_currency)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-left">0.00</td>
                        </tr>
                      )}

                      {/* Credit Line (Source) */}
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">101010</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                          {transfer.source_account_name || "الخزينة المصدر"}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">
                          صرف تحويل مالي سند {transfer.transfer_number}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-left">0.00</td>
                        <td className="py-2.5 px-3 font-bold text-rose-600 text-left">
                          {formatCurrency(Number(transfer.amount) + (transfer.fee_borne_by === 'source' ? Number(transfer.transfer_fee) : 0), transfer.source_currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                سجل المراجعة والرقابة الصارم (Audit Trail)
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">لا توجد سجلات رقابة إضافية</div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{log.action_type || log.action || "عملية"}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{log.ip_address || "internal"}</span>
                        </div>
                        {log.notes && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">{log.notes}</div>
                        )}
                      </div>
                      <div className="text-left text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <div>{log.performed_by_name || log.user_name || "مستخدم"}</div>
                        <div className="text-[10px]">{formatDate(log.created_at, true)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ATTACHMENTS */}
          {activeTab === "attachments" && (
            <div className="space-y-4">
              <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                <Paperclip className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">مرفقات سند التحويل</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  يمكن إرفاق إيصالات الإيداع البنكي، أو صور الشيكات، أو تفويض النقل.
                </p>
                <button
                  type="button"
                  className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:bg-indigo-100 transition"
                >
                  إضافة مستند / إيصال
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer with Context-Aware Workflow Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="text-xs text-slate-500">
            حالة السند الحالية: <span className="font-bold text-slate-800 dark:text-slate-200">{statusConf.label}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Draft: Submit */}
            {transfer.status === "draft" && (
              <button
                onClick={() => {
                  onSubmitForApproval(transfer);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition"
              >
                <Send className="w-4 h-4" />
                إرسال للاعتماد المالي
              </button>
            )}

            {/* Pending Approval: Approve & Reject */}
            {transfer.status === "pending_approval" && (
              <>
                <button
                  onClick={() => {
                    onApprove(transfer);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                >
                  <Check className="w-4 h-4" />
                  اعتماد وموافقة
                </button>
                <button
                  onClick={() => {
                    onReject(transfer);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition"
                >
                  <Ban className="w-4 h-4" />
                  رفض
                </button>
              </>
            )}

            {/* Approved: Execute */}
            {transfer.status === "approved" && (
              <button
                onClick={() => {
                  onExecute(transfer);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-md shadow-indigo-500/25"
              >
                <Send className="w-4 h-4" />
                تنفيذ وصرف النقدية
              </button>
            )}

            {/* In Transit / Pending Receipt: Confirm Receipt */}
            {(transfer.status === "pending_receipt" || transfer.status === "executed" || transfer.status === "in_transit") && (
              <button
                onClick={() => {
                  onReceive(transfer);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-md shadow-emerald-500/25"
              >
                <Inbox className="w-4 h-4" />
                تأكيد الاستلام والإيداع
              </button>
            )}

            {/* Completed: Reverse Transfer */}
            {["completed", "posted", "received"].includes(transfer.status) && (
              <button
                onClick={() => {
                  onReverse(transfer);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition"
              >
                <RotateCcw className="w-4 h-4" />
                عكس التحويل المالي
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
