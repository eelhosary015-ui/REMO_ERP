import React, { useState, useEffect } from "react";
import { 
  X, 
  ArrowRightLeft, 
  Wallet, 
  Landmark, 
  Building, 
  AlertTriangle, 
  CheckCircle2, 
  Coins, 
  Send, 
  Save, 
  Paperclip,
  Info,
  Calendar,
  Layers,
  HelpCircle
} from "lucide-react";
import { 
  TreasuryAccount, 
  TreasuryTransfer, 
  TreasuryTransferType,
  TransferCategoryType 
} from "../../../types";
import { formatCurrency } from "./transferUtils";

interface Branch {
  id: number;
  name: string;
}

interface CostCenter {
  id: number;
  name: string;
}

interface TransferFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, submitImmediately: boolean) => Promise<void>;
  editTransfer?: TreasuryTransfer | null;
  accounts: TreasuryAccount[];
  transferTypes: TreasuryTransferType[];
  branches: Branch[];
  costCenters: CostCenter[];
  submitting: boolean;
}

export const TransferFormModal: React.FC<TransferFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editTransfer,
  accounts,
  transferTypes,
  branches,
  costCenters,
  submitting
}) => {
  if (!isOpen) return null;

  // Form State
  const [transferType, setTransferType] = useState<TransferCategoryType>("safe_to_safe");
  const [sourceAccountId, setSourceAccountId] = useState<number | "">("");
  const [destinationAccountId, setDestinationAccountId] = useState<number | "">("");
  const [sourceBranchId, setSourceBranchId] = useState<number | "">("");
  const [destBranchId, setDestBranchId] = useState<number | "">("");
  const [sourceCostCenterId, setSourceCostCenterId] = useState<number | "">("");
  const [destCostCenterId, setDestCostCenterId] = useState<number | "">("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [valueDate, setValueDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Amounts & Currency
  const [amount, setAmount] = useState<string>("");
  const [sourceCurrency, setSourceCurrency] = useState("EGP");
  const [destCurrency, setDestCurrency] = useState("EGP");
  const [exchangeRate, setExchangeRate] = useState<string>("1.0000");
  const [destAmount, setDestAmount] = useState<string>("");
  
  // Fees
  const [transferFee, setTransferFee] = useState<string>("0");
  const [feeCurrency, setFeeCurrency] = useState("EGP");
  const [feeBorneBy, setFeeBorneBy] = useState<"source" | "destination" | "company">("company");

  // Descriptions
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState("operational");
  const [statement, setStatement] = useState("");
  const [notes, setNotes] = useState("");

  // Error tracking
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or populate for edit
  useEffect(() => {
    if (editTransfer) {
      setTransferType((editTransfer.transfer_type as TransferCategoryType) || "safe_to_safe");
      setSourceAccountId(editTransfer.source_account_id || "");
      setDestinationAccountId(editTransfer.destination_account_id || "");
      setSourceBranchId(editTransfer.source_branch_id || "");
      setDestBranchId(editTransfer.destination_branch_id || "");
      setSourceCostCenterId(editTransfer.source_cost_center_id || "");
      setDestCostCenterId(editTransfer.destination_cost_center_id || "");
      setTransferDate(editTransfer.transfer_date ? editTransfer.transfer_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setValueDate(editTransfer.value_date ? editTransfer.value_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setAmount(editTransfer.amount ? editTransfer.amount.toString() : "");
      setSourceCurrency(editTransfer.source_currency || "EGP");
      setDestCurrency(editTransfer.destination_currency || "EGP");
      setExchangeRate(editTransfer.exchange_rate ? editTransfer.exchange_rate.toString() : "1.0000");
      setDestAmount(editTransfer.destination_amount ? editTransfer.destination_amount.toString() : "");
      setTransferFee(editTransfer.transfer_fee ? editTransfer.transfer_fee.toString() : "0");
      setFeeCurrency(editTransfer.fee_currency || "EGP");
      setFeeBorneBy(editTransfer.fee_borne_by || "company");
      setPurpose(editTransfer.purpose || "");
      setCategory(editTransfer.category || "operational");
      setStatement(editTransfer.statement || "");
      setNotes(editTransfer.notes || "");
    } else {
      // Default to first safe and second safe if available
      const safes = accounts.filter(a => a.type === 'cash');
      if (safes.length >= 2) {
        setSourceAccountId(safes[0].id);
        setDestinationAccountId(safes[1].id);
      } else if (accounts.length >= 2) {
        setSourceAccountId(accounts[0].id);
        setDestinationAccountId(accounts[1].id);
      }
    }
  }, [editTransfer, accounts]);

  // Selected Accounts lookup
  const sourceAccount = accounts.find(a => a.id === Number(sourceAccountId));
  const destAccount = accounts.find(a => a.id === Number(destinationAccountId));

  // Sync currencies when accounts change
  useEffect(() => {
    if (sourceAccount?.currency) {
      setSourceCurrency(sourceAccount.currency);
      setFeeCurrency(sourceAccount.currency);
    }
    if (destAccount?.currency) {
      setDestCurrency(destAccount.currency);
    }
  }, [sourceAccountId, destinationAccountId]);

  // Auto-calculate destination amount based on amount and rate
  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    const numRate = parseFloat(exchangeRate) || 1;
    if (numAmount > 0) {
      const calculated = (numAmount * numRate).toFixed(2);
      setDestAmount(calculated);
    } else {
      setDestAmount("");
    }
  }, [amount, exchangeRate]);

  // Live Balance Math
  const numAmount = parseFloat(amount) || 0;
  const numFee = parseFloat(transferFee) || 0;
  const totalSourceDeduction = numAmount + (feeBorneBy === "source" ? numFee : 0);
  
  const sourceBalance = parseFloat(sourceAccount?.current_balance?.toString() || "0");
  const destBalance = parseFloat(destAccount?.current_balance?.toString() || "0");

  const projectedSourceBalance = sourceBalance - totalSourceDeduction;
  const projectedDestBalance = destBalance + (parseFloat(destAmount) || 0) - (feeBorneBy === "destination" ? numFee : 0);

  const isBalanceInsufficient = sourceAccount && (projectedSourceBalance < 0);
  const isSameAccount = sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId;

  const handleSubmit = async (submitImmediately: boolean) => {
    setValidationError(null);

    if (!sourceAccountId || !destinationAccountId) {
      setValidationError("يرجى اختيار الخزينة المصدر والخزينة المستهدفة");
      return;
    }

    if (isSameAccount) {
      setValidationError("لا يمكن التحويل من وإلى نفس الحساب أو الخزينة!");
      return;
    }

    if (!numAmount || numAmount <= 0) {
      setValidationError("يرجى إدخال مبلغ تحويل صحيح أكبر من الصفر");
      return;
    }

    if (isBalanceInsufficient) {
      setValidationError(`رصيد الخزينة المصدر المتاح (${sourceBalance.toLocaleString()} ${sourceCurrency}) لا يكفي لتغطية مبلغ التحويل (${totalSourceDeduction.toLocaleString()} ${sourceCurrency})`);
      return;
    }

    const payload = {
      transfer_type: transferType,
      source_account_id: Number(sourceAccountId),
      destination_account_id: Number(destinationAccountId),
      source_branch_id: sourceBranchId ? Number(sourceBranchId) : null,
      destination_branch_id: destBranchId ? Number(destBranchId) : null,
      source_cost_center_id: sourceCostCenterId ? Number(sourceCostCenterId) : null,
      destination_cost_center_id: destCostCenterId ? Number(destCostCenterId) : null,
      transfer_date: transferDate,
      value_date: valueDate,
      amount: numAmount,
      source_currency: sourceCurrency,
      destination_currency: destCurrency,
      exchange_rate: parseFloat(exchangeRate) || 1,
      destination_amount: parseFloat(destAmount) || numAmount,
      transfer_fee: numFee,
      fee_currency: feeCurrency,
      fee_borne_by: feeBorneBy,
      purpose: purpose.trim() || `تحويل من ${sourceAccount?.name} إلى ${destAccount?.name}`,
      category,
      statement: statement.trim() || purpose.trim() || "تحويل مالي بين الحسابات",
      notes: notes.trim() || null
    };

    await onSave(payload, submitImmediately);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editTransfer ? `تعديل التحويل المالي (${editTransfer.transfer_number})` : "إنشاء طلب تحويل مالي جديد"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تسجيل حركة نقل السيولة بين الخزائن والحسابات مع الفحص التلقائي للأرصدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          
          {/* Validation Banner */}
          {validationError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3 animate-shake">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="font-semibold leading-relaxed">{validationError}</div>
            </div>
          )}

          {/* 1. Transfer Type Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">نوع التحويل المالي</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { type: "safe_to_safe", label: "خزينة ← خزينة", icon: Wallet },
                { type: "safe_to_bank", label: "خزينة ← بنك (إيداع)", icon: Landmark },
                { type: "bank_to_safe", label: "بنك ← خزينة (سحب)", icon: Coins },
                { type: "bank_to_bank", label: "بنك ← بنك (مصرفي)", icon: Landmark },
                { type: "branch_transfer", label: "تحويل بين الفروع", icon: Building },
                { type: "cost_center_transfer", label: "مراكز التكلفة", icon: Layers }
              ].map(t => {
                const Icon = t.icon;
                const active = transferType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setTransferType(t.type as TransferCategoryType)}
                    className={`p-3 rounded-2xl border text-right flex flex-col justify-between gap-2 transition ${
                      active 
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                    <span className="text-xs leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Source & Destination Dual Box with LIVE Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* SOURCE ACCOUNT CARD */}
            <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  الجهة المصدر (الخصم والصرف)
                </span>
                {sourceAccount && (
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400">
                    الرصيد المتاح: {formatCurrency(sourceBalance, sourceAccount.currency)}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  اختر الخزينة / الحساب المصدر <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sourceAccountId}
                  onChange={e => setSourceAccountId(Number(e.target.value) || "")}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">-- حدد الخزينة المصدر --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'bank' ? 'بنكي' : 'خزينة'}) - الرصيد: {Number(acc.current_balance || 0).toLocaleString()} {acc.currency || 'ج.م'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Branch & Cost Center */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">الفرع المصدر</label>
                  <select
                    value={sourceBranchId}
                    onChange={e => setSourceBranchId(Number(e.target.value) || "")}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">افتراضي</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">مركز التكلفة</label>
                  <select
                    value={sourceCostCenterId}
                    onChange={e => setSourceCostCenterId(Number(e.target.value) || "")}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">افتراضي</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Projected Balance Footer */}
              {sourceAccount && numAmount > 0 && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                  isBalanceInsufficient 
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300"
                    : "bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300/60"
                }`}>
                  <span>الرصيد المتوقع بعد الخصم:</span>
                  <span className="font-bold font-mono">
                    {formatCurrency(projectedSourceBalance, sourceCurrency)}
                  </span>
                </div>
              )}
            </div>

            {/* DESTINATION ACCOUNT CARD */}
            <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  الجهة المستهدفة (الإيداع والاستلام)
                </span>
                {destAccount && (
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                    الرصيد الحالي: {formatCurrency(destBalance, destAccount.currency)}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  اختر الخزينة / الحساب المستهدف <span className="text-rose-500">*</span>
                </label>
                <select
                  value={destinationAccountId}
                  onChange={e => setDestinationAccountId(Number(e.target.value) || "")}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- حدد الخزينة المستهدفة --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} disabled={acc.id === Number(sourceAccountId)}>
                      {acc.name} ({acc.type === 'bank' ? 'بنكي' : 'خزينة'}) {acc.id === Number(sourceAccountId) ? '(المصدر - غير متاح)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Branch & Cost Center */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">الفرع المستهدف</label>
                  <select
                    value={destBranchId}
                    onChange={e => setDestBranchId(Number(e.target.value) || "")}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">افتراضي</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">مركز التكلفة</label>
                  <select
                    value={destCostCenterId}
                    onChange={e => setDestCostCenterId(Number(e.target.value) || "")}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">افتراضي</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Projected Balance Footer */}
              {destAccount && numAmount > 0 && (
                <div className="p-2.5 rounded-xl text-xs flex items-center justify-between border bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300/60">
                  <span>الرصيد المتوقع بعد الإيداع:</span>
                  <span className="font-bold font-mono">
                    {formatCurrency(projectedDestBalance, destCurrency)}
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* 3. Amounts, Currencies & Exchange Rate Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-indigo-600" />
                المبالغ والعملات وسعر الصرف
              </span>
              <span className="text-[11px] text-slate-500">يدعم التحويل متعدد العملات</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المبلغ المطلوب تحويله <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-14 pr-3 py-2 rounded-xl text-sm font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    {sourceCurrency}
                  </span>
                </div>
              </div>

              {/* Source Currency */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">عملة المصدر</label>
                <select
                  value={sourceCurrency}
                  onChange={e => setSourceCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                >
                  <option value="EGP">EGP - جنيه مصري</option>
                  <option value="USD">USD - دولار أمريكي</option>
                  <option value="EUR">EUR - يورو أوروبي</option>
                  <option value="SAR">SAR - ريال سعودي</option>
                  <option value="AED">AED - درهم إماراتي</option>
                </select>
              </div>

              {/* Exchange Rate */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">سعر الصرف</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Destination Calculated Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ المستلم المستهدف</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={destAmount}
                    onChange={e => setDestAmount(e.target.value)}
                    className="w-full pl-14 pr-3 py-2 rounded-xl text-sm font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">
                    {destCurrency}
                  </span>
                </div>
              </div>
            </div>

            {/* Transfer Fees Sub-Row */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400 font-semibold">رسوم / عمولة التحويل</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transferFee}
                  onChange={e => setTransferFee(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400 font-semibold">الطرف المتحمل للرسوم</label>
                <select
                  value={feeBorneBy}
                  onChange={e => setFeeBorneBy(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                >
                  <option value="company">مصروف على الشركة (افتراضي)</option>
                  <option value="source">يخصم من الخزينة المصدر</option>
                  <option value="destination">يخصم من المبلغ المستلم</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400 font-semibold">تاريخ التحويل & القيمة</label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs"
                  />
                  <input
                    type="date"
                    value={valueDate}
                    title="تاريخ القيمة Value Date"
                    onChange={e => setValueDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Purpose, Statement & Classifications */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الغرض والبيان من التحويل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: تغذية سيولة فرع الجيزة لصرف فواتير المشتريات اليومية"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">التصنيف المالي</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="operational">تشغيلي (Operational)</option>
                  <option value="liquidity">إدارة السيولة (Liquidity)</option>
                  <option value="branch_replenishment">تغذية فروع (Branch Replenishment)</option>
                  <option value="payroll_funding">تمويل الرواتب (Payroll)</option>
                  <option value="vendor_settlement">سداد موردين (Vendors)</option>
                  <option value="investment">استثماري / ودائع (Investment)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات وتعليمات النقل</label>
              <textarea
                rows={2}
                placeholder="تعليمات خاصة لأمين الخزينة، مندوب النقل، أو مراجع الحسابات..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-500" />
            <span>سيتم إنشاء القيود المحاسبية تلقائياً في شجرة الحسابات فور إتمام التحويل</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
            >
              إلغاء
            </button>

            {/* Save as Draft */}
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting || isBalanceInsufficient}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              حفظ كمسودة
            </button>

            {/* Submit Immediately for Approval */}
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting || isBalanceInsufficient}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md shadow-indigo-500/25 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4 stroke-[2.5]" />
              {submitting ? "جاري الحفظ..." : "إرسال للاعتماد المباشر"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
