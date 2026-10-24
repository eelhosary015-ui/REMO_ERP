import React, { useState } from "react";
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ArrowRightLeft, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Edit3, 
  Send, 
  Inbox, 
  Check, 
  X, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Layers, 
  Building, 
  Wallet, 
  Landmark, 
  AlertTriangle,
  Copy,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Ban
} from "lucide-react";
import { 
  TreasuryTransfer, 
  TreasuryAccount, 
  TreasuryTransferType,
  TreasuryTransferStatus 
} from "../../../types";
import { formatCurrency, formatDate, getStatusConfig, getTransferTypeLabel } from "./transferUtils";

interface Branch {
  id: number;
  name: string;
}

interface CostCenter {
  id: number;
  name: string;
}

interface TransferListViewProps {
  transfers: TreasuryTransfer[];
  accounts: TreasuryAccount[];
  transferTypes: TreasuryTransferType[];
  branches: Branch[];
  costCenters: CostCenter[];
  loading: boolean;
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  // Filters
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  sourceAccountFilter: string;
  setSourceAccountFilter: (v: string) => void;
  destAccountFilter: string;
  setDestAccountFilter: (v: string) => void;
  branchFilter: string;
  setBranchFilter: (v: string) => void;
  startDateFilter: string;
  setStartDateFilter: (v: string) => void;
  endDateFilter: string;
  setEndDateFilter: (v: string) => void;
  onResetFilters: () => void;
  // Actions
  onViewDetails: (transfer: TreasuryTransfer) => void;
  onEdit: (transfer: TreasuryTransfer) => void;
  onSubmitForApproval: (transfer: TreasuryTransfer) => void;
  onApprove: (transfer: TreasuryTransfer) => void;
  onReject: (transfer: TreasuryTransfer) => void;
  onExecute: (transfer: TreasuryTransfer) => void;
  onReceive: (transfer: TreasuryTransfer) => void;
  onReverse: (transfer: TreasuryTransfer) => void;
  onCancel: (transfer: TreasuryTransfer) => void;
  onPrint: (transfer: TreasuryTransfer) => void;
  onNewTransfer: () => void;
}

export const TransferListView: React.FC<TransferListViewProps> = ({
  transfers,
  accounts,
  transferTypes,
  branches,
  costCenters,
  loading,
  total,
  page,
  limit,
  onPageChange,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  sourceAccountFilter,
  setSourceAccountFilter,
  destAccountFilter,
  setDestAccountFilter,
  branchFilter,
  setBranchFilter,
  startDateFilter,
  setStartDateFilter,
  endDateFilter,
  setEndDateFilter,
  onResetFilters,
  onViewDetails,
  onEdit,
  onSubmitForApproval,
  onApprove,
  onReject,
  onExecute,
  onReceive,
  onReverse,
  onCancel,
  onPrint,
  onNewTransfer
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "رقم التحويل",
      "التاريخ",
      "النوع",
      "الخزينة المصدر",
      "الفرع المصدر",
      "الخزينة المستهدفة",
      "الفرع المستهدف",
      "المبلغ",
      "العملة",
      "سعر الصرف",
      "المبلغ المستلم",
      "الرسوم",
      "الحالة",
      "البيان",
      "القيد المحاسبي"
    ];

    const rows = transfers.map(t => [
      t.transfer_number,
      t.transfer_date ? t.transfer_date.slice(0, 10) : "",
      getTransferTypeLabel(t.transfer_type),
      t.source_account_name || "",
      t.source_branch_name || "",
      t.destination_account_name || "",
      t.destination_branch_name || "",
      t.amount,
      t.source_currency || "EGP",
      t.exchange_rate || 1,
      t.destination_amount || t.amount,
      t.transfer_fee || 0,
      t.status,
      `"${(t.statement || t.purpose || "").replace(/"/g, '""')}"`,
      t.journal_entry_number || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transfers_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث برقم التحويل، البيان، الملاحظات، أو الخزينة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Status Quick Filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">جميع الحالات</option>
              <option value="draft">مسودة (Draft)</option>
              <option value="pending_approval">قيد الاعتماد</option>
              <option value="approved">معتمد (جاهز للصرف)</option>
              <option value="executed">قيد النقل والتنفيذ</option>
              <option value="pending_receipt">في انتظار الاستلام</option>
              <option value="completed">مكتمل ومرحل</option>
              <option value="rejected">مرفوض</option>
              <option value="cancelled">ملغي</option>
              <option value="reversed">معكوس</option>
            </select>
          </div>

          {/* Transfer Type Quick Filter */}
          <div className="w-full md:w-48">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">جميع أنواع التحويل</option>
              <option value="safe_to_safe">خزينة ← خزينة</option>
              <option value="safe_to_bank">خزينة ← بنك (إيداع)</option>
              <option value="bank_to_safe">بنك ← خزينة (سحب)</option>
              <option value="bank_to_bank">بنك ← بنك (تحويل مصرفي)</option>
              <option value="branch_transfer">تحويل بين الفروع</option>
              <option value="cost_center_transfer">تحويل بين مراكز التكلفة</option>
            </select>
          </div>

          {/* Toggle Advanced Filters Button */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              showAdvancedFilters
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300"
                : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            تصفية متقدمة
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            title="تصدير جدول التحويلات إلى ملف Excel / CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            تصدير
          </button>
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block mb-1 font-semibold text-slate-600 dark:text-slate-400">الخزينة / الحساب المصدر</label>
              <select
                value={sourceAccountFilter}
                onChange={e => setSourceAccountFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">جميع الحسابات المصدر</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'bank' ? 'بنك' : 'خزينة'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600 dark:text-slate-400">الخزينة / الحساب المستهدف</label>
              <select
                value={destAccountFilter}
                onChange={e => setDestAccountFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">جميع الحسابات المستهدفة</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'bank' ? 'بنك' : 'خزينة'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600 dark:text-slate-400">الفرع</label>
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="all">جميع الفروع</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block mb-1 font-semibold text-slate-600 dark:text-slate-400">من تاريخ</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1 font-semibold text-slate-600 dark:text-slate-400">إلى تاريخ</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs"
                />
              </div>
              <button
                onClick={onResetFilters}
                title="إعادة تعيين الفلاتر"
                className="mt-4 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Transfers Data Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3.5 px-4">رقم التحويل</th>
                <th className="py-3.5 px-4">التاريخ</th>
                <th className="py-3.5 px-4">نوع التحويل</th>
                <th className="py-3.5 px-4">الجهة المصدر (من)</th>
                <th className="py-3.5 px-4">الجهة المستهدفة (إلى)</th>
                <th className="py-3.5 px-4">المبلغ المنقول</th>
                <th className="py-3.5 px-4 text-center">الحالة</th>
                <th className="py-3.5 px-4">القيد المحاسبي</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>جاري تحميل بيانات التحويلات المالية...</span>
                    </div>
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <ArrowRightLeft className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">لا توجد تحويلات مالية مطابقة</p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          لم يتم العثور على أي تحويلات وفقاً لخيارات البحث والتصفية المحددة، أو لم يتم إنشاء تحويلات بعد.
                        </p>
                      </div>
                      <button
                        onClick={onNewTransfer}
                        className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition"
                      >
                        إنشاء أول تحويل مالي
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.map(trf => {
                  const statusConf = getStatusConfig(trf.status);
                  const isMultiCurrency = trf.source_currency !== trf.destination_currency && (trf.exchange_rate || 1) !== 1;

                  return (
                    <tr 
                      key={trf.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Transfer Number */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onViewDetails(trf)}
                            className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-xs"
                          >
                            {trf.transfer_number}
                          </button>
                          <button
                            onClick={() => handleCopyNumber(trf.transfer_number)}
                            title="نسخ رقم التحويل"
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                          >
                            {copiedId === trf.transfer_number ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                        </div>
                        {trf.category && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{trf.category}</div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        <div>{formatDate(trf.transfer_date)}</div>
                        {trf.value_date && trf.value_date !== trf.transfer_date && (
                          <div className="text-[10px] text-slate-400">قيمة: {formatDate(trf.value_date)}</div>
                        )}
                      </td>

                      {/* Transfer Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {getTransferTypeLabel(trf.transfer_type)}
                        </span>
                      </td>

                      {/* Source Account */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {trf.source_account_type === 'bank' ? (
                            <Landmark className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span>{trf.source_account_name || `حساب #${trf.source_account_id}`}</span>
                        </div>
                        {trf.source_branch_name && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building className="w-2.5 h-2.5" />
                            {trf.source_branch_name}
                          </div>
                        )}
                      </td>

                      {/* Destination Account */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {trf.destination_account_type === 'bank' ? (
                            <Landmark className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span>{trf.destination_account_name || `حساب #${trf.destination_account_id}`}</span>
                        </div>
                        {trf.destination_branch_name && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building className="w-2.5 h-2.5" />
                            {trf.destination_branch_name}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                          {formatCurrency(trf.amount, trf.source_currency || "ج.م")}
                        </div>
                        {isMultiCurrency && (
                          <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            = {formatCurrency(trf.destination_amount, trf.destination_currency)} (سعر: {trf.exchange_rate})
                          </div>
                        )}
                        {trf.transfer_fee > 0 && (
                          <div className="text-[10px] text-rose-500">
                            رسوم: {formatCurrency(trf.transfer_fee, trf.fee_currency)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConf.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.badgeDot}`} />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Journal Entry */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {trf.journal_entry_number || (trf.journal_entry_id ? `JE-#${trf.journal_entry_id}` : null) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <Layers className="w-2.5 h-2.5" />
                            {trf.journal_entry_number || `JE-#${trf.journal_entry_id}`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">غير مرحل</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Details */}
                          <button
                            onClick={() => onViewDetails(trf)}
                            title="عرض التفاصيل وسجل الاعتمادات"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Voucher */}
                          <button
                            onClick={() => onPrint(trf)}
                            title="طباعة سند التحويل المالي"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Draft State: Edit & Submit */}
                          {trf.status === "draft" && (
                            <>
                              <button
                                onClick={() => onEdit(trf)}
                                title="تعديل المسودة"
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onSubmitForApproval(trf)}
                                title="إرسال للاعتماد"
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 transition"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Pending Approval: Approve & Reject */}
                          {trf.status === "pending_approval" && (
                            <>
                              <button
                                onClick={() => onApprove(trf)}
                                title="اعتماد التحويل"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onReject(trf)}
                                title="رفض التحويل"
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Approved: Execute / Dispatch */}
                          {trf.status === "approved" && (
                            <button
                              onClick={() => onExecute(trf)}
                              title="تنفيذ وصرف النقدية من الخزينة المصدر"
                              className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition flex items-center gap-1 shadow-sm"
                            >
                              <Send className="w-3 h-3" />
                              تنفيذ الصرف
                            </button>
                          )}

                          {/* Pending Receipt / Executed / In Transit: Confirm Receipt */}
                          {(trf.status === "pending_receipt" || trf.status === "executed" || trf.status === "in_transit") && (
                            <button
                              onClick={() => onReceive(trf)}
                              title="تأكيد استلام النقدية في الخزينة المستهدفة"
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition flex items-center gap-1 shadow-sm"
                            >
                              <Inbox className="w-3 h-3" />
                              تأكيد الاستلام
                            </button>
                          )}

                          {/* Completed: Reverse Transfer */}
                          {["completed", "posted", "received"].includes(trf.status) && (
                            <button
                              onClick={() => onReverse(trf)}
                              title="عكس التحويل المالي واسترداد النقدية"
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancelable States */}
                          {["draft", "rejected"].includes(trf.status) && (
                            <button
                              onClick={() => onCancel(trf)}
                              title="إلغاء التحويل"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
          <div>
            عرض <span className="font-bold text-slate-700 dark:text-slate-200">{transfers.length}</span> من إجمالي <span className="font-bold text-slate-700 dark:text-slate-200">{total}</span> تحويل مالي
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-bold text-slate-700 dark:text-slate-200">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
