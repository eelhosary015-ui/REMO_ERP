import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Building2,
  User,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Upload,
  Send,
  RotateCcw,
  Check,
  ShieldCheck,
  Package,
  Receipt,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";
import { TreasuryCustody, TreasuryCustodyExpense, TreasuryCustodyItem } from "../../../types";
import { api } from "../../../utils/api";

interface DetailModalProps {
  isOpen: boolean;
  custodyId: number | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenSettlement: (custody: TreasuryCustody) => void;
  onPrintVoucher: (custody: TreasuryCustody) => void;
  onExtendDueDate: (custody: TreasuryCustody) => void;
  onSendReminder: (custody: TreasuryCustody) => void;
  accounts: any[];
  costCenters: any[];
}

export const CustodyDetailModal: React.FC<DetailModalProps> = ({
  isOpen,
  custodyId,
  onClose,
  onRefresh,
  onOpenSettlement,
  onPrintVoucher,
  onExtendDueDate,
  onSendReminder,
  accounts,
  costCenters
}) => {
  const [custody, setCustody] = useState<TreasuryCustody | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'items' | 'settlements' | 'attachments' | 'audit'>('expenses');

  // Expense Form State
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    description: "",
    category: "نثريات ومشتريات تشغيل",
    amount: "",
    tax_amount: "0",
    supplier_name: "",
    invoice_number: "",
    cost_center_id: "",
    notes: ""
  });
  const [expenseFile, setExpenseFile] = useState<File | null>(null);

  // Return item state
  const [selectedItemToReturn, setSelectedItemToReturn] = useState<TreasuryCustodyItem | null>(null);
  const [returnCondition, setReturnCondition] = useState("جيدة / صالحة للاستخدام");
  const [returnNotes, setReturnNotes] = useState("");

  const fetchCustodyDetails = async () => {
    if (!custodyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/treasury/custodies/${custodyId}`);
      if (res.ok) {
        const data = await res.json();
        setCustody(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && custodyId) {
      fetchCustodyDetails();
    }
  }, [isOpen, custodyId]);

  if (!isOpen || !custodyId) return null;

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      alert("يرجى إدخال مبلغ المصروف بشكل صحيح");
      return;
    }
    if (!expenseForm.description.trim()) {
      alert("يرجى كتابة بيان الفاتورة والمصروف");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("expense_date", expenseForm.expense_date);
      formData.append("description", expenseForm.description);
      formData.append("category", expenseForm.category);
      formData.append("amount", expenseForm.amount);
      formData.append("tax_amount", expenseForm.tax_amount);
      formData.append("supplier_name", expenseForm.supplier_name);
      formData.append("invoice_number", expenseForm.invoice_number);
      formData.append("cost_center_id", expenseForm.cost_center_id);
      formData.append("notes", expenseForm.notes);
      if (expenseFile) {
        formData.append("receipt", expenseFile);
      }

      const token = localStorage.getItem("token");
      const res = await fetch(`/api/treasury/custodies/${custodyId}/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        alert("تمت إضافة الفاتورة بنجاح وتحديث رصيد العهدة");
        setShowAddExpense(false);
        setExpenseForm({
          expense_date: new Date().toISOString().split('T')[0],
          description: "",
          category: "نثريات ومشتريات تشغيل",
          amount: "",
          tax_amount: "0",
          supplier_name: "",
          invoice_number: "",
          cost_center_id: "",
          notes: ""
        });
        setExpenseFile(null);
        fetchCustodyDetails();
        onRefresh();
      } else {
        const err = await res.json();
        alert(`فشل إضافة المصروف: ${err.error || "خطأ غير متوقع"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة احتساب رصيد العهدة.")) return;
    try {
      const res = await api.delete(`/api/treasury/custodies/${custodyId}/expenses/${expenseId}`);
      if (res.ok) {
        fetchCustodyDetails();
        onRefresh();
      } else {
        const err = await res.json();
        alert(`فشل الحذف: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleReturnItemSubmit = async () => {
    if (!selectedItemToReturn) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${custodyId}/items/${selectedItemToReturn.id}/return`, {
        condition_on_return: returnCondition,
        notes: returnNotes
      });
      if (res.ok) {
        alert("تم إثبات استرجاع الأصل/العهدة العينية بنجاح");
        setSelectedItemToReturn(null);
        setReturnNotes("");
        fetchCustodyDetails();
        onRefresh();
      } else {
        const err = await res.json();
        alert(`فشل الاسترجاع: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleApprove = async () => {
    if (!window.confirm("هل أنت متأكد من اعتماد وموافقة طلب العهدة؟")) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${custodyId}/approve`, {});
      if (res.ok) {
        alert("تم اعتماد العهدة بنجاح، أصبحت جاهزة للصرف من الخزينة");
        fetchCustodyDetails();
        onRefresh();
      }
    } catch (e) {}
  };

  const handleIssue = async () => {
    if (!window.confirm("هل تم صرف وتسليم النقدية فعلياً للموظف؟ سيتم تسجيل سند صرف وخصم المبلغ من الخزينة.")) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${custodyId}/issue`, {});
      if (res.ok) {
        alert("تم صرف وتسليم العهدة للموظف بنجاح");
        fetchCustodyDetails();
        onRefresh();
      }
    } catch (e) {}
  };

  const amount = parseFloat((custody?.amount as any) || 0);
  const spent = parseFloat((custody?.spent_amount as any) || 0);
  const remaining = parseFloat((custody?.remaining_amount as any) || (amount - spent) || 0);
  const returned = parseFloat((custody?.returned_amount as any) || 0);

  // Lifecycle Steps helper
  const getStepStatus = (step: number) => {
    const s = custody?.status;
    if (s === 'closed' || s === 'cleared') return 'completed';
    if (step === 1) return 'completed'; // Requested
    if (step === 2) {
      if (s === 'pending_approval' || s === 'draft') return 'active';
      if (s === 'rejected' || s === 'canceled') return 'rejected';
      return 'completed';
    }
    if (step === 3) {
      if (s === 'approved') return 'active';
      if (['active', 'issued', 'paid', 'pending_settlement', 'partially_settled'].includes(s || '')) return 'completed';
      return 'pending';
    }
    if (step === 4) {
      if (['active', 'issued', 'paid', 'pending_settlement'].includes(s || '')) return 'active';
      return 'pending';
    }
    if (step === 5) {
      if (s === 'pending_settlement' || s === 'partially_settled') return 'active';
      return 'pending';
    }
    return 'pending';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-100 my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20 font-mono">
              {custody?.custody_number ? custody.custody_number.split('-')[0] : "CUS"}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  ملف العهدة الشامل: {custody?.custody_number || `CUS-${custody?.id}`}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {custody?.custody_type_name || custody?.custody_type || "عهدة نقدية"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                الموظف: <strong className="text-slate-800 font-black">{custody?.employee_name}</strong> • الخزينة المانحة: {custody?.account_name || "خزينة عامة"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => custody && onPrintVoucher(custody)}
              className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="طباعة سند وسجل العهدة"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
          {/* Lifecycle Progress Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2 px-1">
              <span className={getStepStatus(1) === 'completed' ? 'text-indigo-600 font-black' : ''}>1. إنشاء الطلب</span>
              <span className={getStepStatus(2) === 'completed' ? 'text-indigo-600 font-black' : getStepStatus(2) === 'active' ? 'text-amber-600 font-black' : ''}>2. الاعتماد</span>
              <span className={getStepStatus(3) === 'completed' ? 'text-indigo-600 font-black' : getStepStatus(3) === 'active' ? 'text-indigo-600 font-black' : ''}>3. تسليم وصرف النقدية</span>
              <span className={getStepStatus(4) === 'completed' ? 'text-indigo-600 font-black' : getStepStatus(4) === 'active' ? 'text-emerald-600 font-black' : ''}>4. الصرف وإثبات الفواتير</span>
              <span className={getStepStatus(5) === 'completed' ? 'text-emerald-600 font-black' : ''}>5. التسوية والإقفال النهائي</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((step) => {
                const status = getStepStatus(step);
                let bg = "bg-slate-200";
                if (status === 'completed') bg = "bg-indigo-600";
                if (status === 'active') bg = "bg-amber-500 animate-pulse";
                if (status === 'rejected') bg = "bg-rose-500";
                return (
                  <div key={step} className={`h-2.5 rounded-full ${bg} transition-all`}></div>
                );
              })}
            </div>
          </div>

          {/* Key Financials Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Original Amount */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 block">قيمة العهدة المنصرفة</span>
              <div className="text-lg font-black text-slate-900 font-mono mt-1">
                {amount.toLocaleString()} <span className="text-xs text-slate-500">ج.م</span>
              </div>
            </div>

            {/* Spent via Invoices */}
            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700 block">المصروف بالفواتير</span>
              <div className="text-lg font-black text-emerald-700 font-mono mt-1">
                {spent.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
            </div>

            {/* Remaining to Return */}
            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
              <span className="text-[11px] font-bold text-indigo-700 block">المتبقي المطلوب رده</span>
              <div className="text-lg font-black text-indigo-700 font-mono mt-1">
                {remaining.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
            </div>

            {/* Due Date & Overdue status */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 block">تاريخ الاستحقاق والتسوية</span>
              <div className="text-xs font-black text-slate-800 mt-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{custody?.due_date ? new Date(custody.due_date).toLocaleDateString("ar-EG") : "غير محدد"}</span>
              </div>
              {custody?.is_overdue && (
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                  متأخرة ({custody.overdue_days} يوم)
                </span>
              )}
            </div>
          </div>

          {/* Quick Status Actions Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50 rounded-2xl border border-indigo-100">
            <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>الغرض: {custody?.purpose || "---"}</span>
            </div>

            <div className="flex items-center gap-2">
              {custody?.status === 'pending_approval' && (
                <button
                  onClick={handleApprove}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>اعتماد العهدة الآن</span>
                </button>
              )}

              {custody?.status === 'approved' && (
                <button
                  onClick={handleIssue}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>صرف النقدية وتسليم الموظف</span>
                </button>
              )}

              {['active', 'issued', 'paid', 'pending_settlement'].includes(custody?.status || '') && (
                <button
                  onClick={() => custody && onOpenSettlement(custody)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>بدء التسوية والإقفال</span>
                </button>
              )}

              {['active', 'issued', 'paid', 'pending_settlement'].includes(custody?.status || '') && (
                <button
                  onClick={() => custody && onExtendDueDate(custody)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>تمديد الاستحقاق</span>
                </button>
              )}

              {['active', 'issued', 'paid', 'pending_settlement'].includes(custody?.status || '') && (
                <button
                  onClick={() => custody && onSendReminder(custody)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال تنبيه للموظف</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub Tabs Navigation */}
          <div className="flex border-b border-slate-200 text-xs font-bold gap-4">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'expenses'
                  ? 'border-indigo-600 text-indigo-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>فواتير ومصروفات العهدة ({custody?.expenses?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('items')}
              className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'items'
                  ? 'border-indigo-600 text-indigo-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>الأصول والعهد العينية ({custody?.items?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('settlements')}
              className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'settlements'
                  ? 'border-indigo-600 text-indigo-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>التسويات والترحيل ({custody?.settlements?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'audit'
                  ? 'border-indigo-600 text-indigo-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>سجل التدقيق والتتبع ({custody?.auditLogs?.length || 0})</span>
            </button>
          </div>

          {/* TAB 1: EXPENSES & INVOICES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800">سجل فواتير ومصروفات العهدة</h4>
                  <p className="text-[11px] text-slate-400">إثبات الفواتير والإيصالات الضريبية لخصمها من رصيد العهدة</p>
                </div>
                {['active', 'issued', 'paid', 'pending_settlement'].includes(custody?.status || '') && (
                  <button
                    onClick={() => setShowAddExpense(!showAddExpense)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة فاتورة / إيصال</span>
                  </button>
                )}
              </div>

              {/* Add Expense Form Modal / Box */}
              {showAddExpense && (
                <form onSubmit={handleAddExpenseSubmit} className="p-4 bg-slate-50 rounded-2xl border border-indigo-100 space-y-4">
                  <h5 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    تسجيل فاتورة / إيصال مصروف جديد
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">تاريخ الفاتورة</label>
                      <input
                        type="date"
                        value={expenseForm.expense_date}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_date: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">المبلغ الإجمالي (ج.م) *</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-indigo-700"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">ضريبة القيمة المضافة (إن وجدت)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={expenseForm.tax_amount}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, tax_amount: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">بيان ووصف المصروف *</label>
                      <input
                        type="text"
                        placeholder="شراء قطع غيار / وقود / صيانة..."
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">اسم المورد / المحل</label>
                      <input
                        type="text"
                        placeholder="شركة السلام للتوريدات..."
                        value={expenseForm.supplier_name}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, supplier_name: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">رقم الفاتورة الورقية</label>
                      <input
                        type="text"
                        placeholder="INV-98765..."
                        value={expenseForm.invoice_number}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">مركز التكلفة المرتبط</label>
                      <select
                        value={expenseForm.cost_center_id}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, cost_center_id: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <option value="">-- مركز التكلفة الافتراضي --</option>
                        {costCenters.map(cc => (
                          <option key={cc.id} value={cc.id}>{cc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">إرفاق صورة الفاتورة / الإيصال</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setExpenseFile(e.target.files ? e.target.files[0] : null)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-700"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddExpense(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-xl"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm"
                    >
                      حفظ الفاتورة وإثبات الصرف
                    </button>
                  </div>
                </form>
              )}

              {/* Expenses Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">رقم السند</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">البيان والتفاصيل</th>
                      <th className="p-3">المورد / الفاتورة</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">الضريبة</th>
                      <th className="p-3">المرفق</th>
                      <th className="p-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(!custody?.expenses || custody.expenses.length === 0) ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                          لم يتم تسجيل أي فواتير مصروفات على هذه العهدة حتى الآن
                        </td>
                      </tr>
                    ) : (
                      custody.expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-700">
                            {exp.expense_number || `EXP-${exp.id}`}
                          </td>
                          <td className="p-3 text-slate-500">
                            {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString("ar-EG") : ""}
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            {exp.description}
                          </td>
                          <td className="p-3 text-slate-600">
                            {exp.supplier_name || "---"} {exp.invoice_number ? `(#${exp.invoice_number})` : ""}
                          </td>
                          <td className="p-3 font-mono font-black text-emerald-600">
                            {parseFloat(exp.amount as any).toLocaleString()} ج.م
                          </td>
                          <td className="p-3 text-slate-500">
                            {parseFloat(exp.tax_amount as any) > 0 ? `${parseFloat(exp.tax_amount as any).toLocaleString()} ج.م` : "-"}
                          </td>
                          <td className="p-3">
                            {exp.receipt_attachment_url ? (
                              <a
                                href={exp.receipt_attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline font-bold text-[11px]"
                              >
                                عرض الفاتورة
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">بدون</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {['active', 'issued', 'paid', 'pending_settlement'].includes(custody?.status || '') && (
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                title="حذف الفاتورة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ITEMS / ASSETS */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800">الأصول والمعدات العينية المسندة للعهد</h4>
                  <p className="text-[11px] text-slate-400">متابعة الأجهزة والمعدات والتأكد من استرجاعها بحالة سليمة</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">اسم الصنف / الأصل</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">الرقم التسلسلي</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">حالة التسليم</th>
                      <th className="p-3">حالة الاسترجاع</th>
                      <th className="p-3">الحالة الحالية</th>
                      <th className="p-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(!custody?.items || custody.items.length === 0) ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                          لا توجد أصول عينية مسندة مع هذه العهدة
                        </td>
                      </tr>
                    ) : (
                      custody.items.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-800">{it.item_name}</td>
                          <td className="p-3 text-slate-500">{it.item_type}</td>
                          <td className="p-3 font-mono text-slate-600">{it.serial_number || "---"}</td>
                          <td className="p-3 font-bold">{it.quantity}</td>
                          <td className="p-3 text-slate-600">{it.condition_on_issue || "ممتازة"}</td>
                          <td className="p-3 text-slate-600">{it.condition_on_return || "لم يسترجع بعد"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              it.status === 'returned' ? 'bg-emerald-50 text-emerald-700' :
                              it.status === 'damaged' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {it.status === 'returned' ? 'تم الاسترجاع' :
                               it.status === 'damaged' ? 'تالف / عيب' : 'مسلم للموظف'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {it.status === 'assigned' && (
                              <button
                                onClick={() => setSelectedItemToReturn(it)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px]"
                              >
                                إثبات استرجاع
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Item Return Sub-Modal */}
              {selectedItemToReturn && (
                <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200 space-y-3">
                  <h5 className="text-xs font-black text-indigo-900">
                    استرجاع الأصل: {selectedItemToReturn.item_name}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">حالة الأصل عند الاسترجاع</label>
                      <select
                        value={returnCondition}
                        onChange={(e) => setReturnCondition(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <option value="ممتازة / بحالتها الأصلية">ممتازة / بحالتها الأصلية</option>
                        <option value="جيدة / صالحة للاستخدام">جيدة / صالحة للاستخدام</option>
                        <option value="بها استهلاك طبيعي">بها استهلاك طبيعي</option>
                        <option value="تالفة / تحتاج صيانة">تالفة / تحتاج صيانة</option>
                        <option value="مفقودة / هالك">مفقودة / هالك</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ملاحظات الفحص والاستلام</label>
                      <input
                        type="text"
                        placeholder="تم الفحص والتأكد من سلامة التشغيل..."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedItemToReturn(null)}
                      className="px-3 py-1 bg-white text-slate-600 text-xs rounded-xl"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleReturnItemSubmit}
                      className="px-4 py-1 bg-indigo-600 text-white font-bold text-xs rounded-xl"
                    >
                      تأكيد استلام الأصل بالمخزن
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800">حركات التسوية والقيود المحاسبية</h4>
                  <p className="text-[11px] text-slate-400">سجل التسويات المالية والقيود اليومية التلقائية</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">رقم التسوية</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">إجمالي المصروفات</th>
                      <th className="p-3">المسترد للخزينة</th>
                      <th className="p-3">المصروف للموظف</th>
                      <th className="p-3">الخزينة المودع بها</th>
                      <th className="p-3">قيد اليومية</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(!custody?.settlements || custody.settlements.length === 0) ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                          لم تتم تسوية العهدة حتى الآن
                        </td>
                      </tr>
                    ) : (
                      custody.settlements.map((set) => (
                        <tr key={set.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-800">{set.settlement_number}</td>
                          <td className="p-3 text-slate-500">
                            {set.settlement_date ? new Date(set.settlement_date).toLocaleDateString("ar-EG") : ""}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-600">
                            {parseFloat(set.total_expenses as any).toLocaleString()} ج.م
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-600">
                            {parseFloat(set.returned_to_treasury as any).toLocaleString()} ج.م
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-600">
                            {parseFloat(set.additional_paid_to_employee as any) > 0 ? `${parseFloat(set.additional_paid_to_employee as any).toLocaleString()} ج.م` : "-"}
                          </td>
                          <td className="p-3 text-slate-600">{set.treasury_account_name || "---"}</td>
                          <td className="p-3">
                            {set.journal_entry_id ? (
                              <span className="font-mono text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                                قيد #{set.journal_entry_id}
                              </span>
                            ) : (
                              <span className="text-slate-400">---</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              معتمدة ومرحلة
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-800">سجل التدقيق والمتابعة الزمني (Audit Timeline)</h4>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {(!custody?.auditLogs || custody.auditLogs.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    لا توجد سجلات تتبع إضافية
                  </div>
                ) : (
                  custody.auditLogs.map((log: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-slate-800">{log.action_type}</span>
                          <span className="text-slate-400 text-[10px]">
                            {log.created_at ? new Date(log.created_at).toLocaleString("ar-EG") : ""}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          بواسطة: <strong>{log.user_name || "مستخدم النظام"}</strong> {log.notes ? `• ${log.notes}` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
