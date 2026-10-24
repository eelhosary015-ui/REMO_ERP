import React, { useState, useEffect } from "react";
import { authHeaders } from "../utils/api";
import {
  ChevronLeft,
  UserPlus,
  Search,
  RefreshCw,
  Phone,
  DollarSign,
  History,
  PlusCircle,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  FileText,
  X,
  Save,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CustomerAccount {
  id: number;
  name: string;
  phone: string;
  balance: number;
  last_transaction_date: string;
}

interface Transaction {
  id: number;
  customer_id: number;
  type: "payment" | "disbursement" | "invoice" | "adjustment";
  amount: number;
  date: string;
  transaction_date?: string;
  notes: string;
  order_id?: number;
}

interface CustomerAccountsProps {
  onBack: () => void;
}

export const CustomerAccounts: React.FC<CustomerAccountsProps> = ({
  onBack,
}) => {
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState<{
    type: "payment" | "adjustment";
    amount: string;
    notes: string;
  }>({
    type: "payment",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/customers/accounts", {
        cache: "no-store",
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const updatedAccounts = Array.isArray(data) ? data : [];
        setAccounts(updatedAccounts);
        setSelectedCustomer((current) =>
          current
            ? updatedAccounts.find((account) => account.id === current.id) || current
            : current
        );
      } else {
        console.error(`Failed to fetch customer accounts: HTTP ${res.status}`);
      }
    } catch (error) {
      console.error("Failed to fetch customer accounts:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchTransactions = async (customerId: number) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/transactions`, {
        cache: "no-store",
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch transactions");
    }
  };

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchAccounts();
        if (selectedCustomer) void fetchTransactions(selectedCustomer.id);
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [selectedCustomer?.id]);

  const handleCustomerClick = (customer: CustomerAccount) => {
    setSelectedCustomer(customer);
    fetchTransactions(customer.id);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const res = await fetch("/api/customers/transactions", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          ...newTransaction,
          amount: parseFloat(newTransaction.amount),
        }),
      });

      if (res.ok) {
        setShowTransactionModal(false);
        setNewTransaction({ type: "payment", amount: "", notes: "" });
        fetchAccounts();
        fetchTransactions(selectedCustomer.id);
      }
    } catch (error) {
      console.error("Failed to save transaction");
    }
  };

  const printStatement = () => {
    window.print();
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      (acc.name || "")
        .toLowerCase()
        .includes((searchQuery || "").toLowerCase()) ||
      (acc.phone || "").includes(searchQuery),
  );

  const totalDebit = accounts.reduce(
    (acc, curr) => (curr.balance > 0 ? acc + curr.balance : acc),
    0,
  );
  const totalCredit = accounts.reduce(
    (acc, curr) => (curr.balance < 0 ? acc + Math.abs(curr.balance) : acc),
    0,
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={
              selectedCustomer ? () => setSelectedCustomer(null) : onBack
            }
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-600" />
              {selectedCustomer
                ? `حساب: ${selectedCustomer.name}`
                : "حسابات العملاء"}
            </h1>
            <p className="text-sm text-slate-500">
              {selectedCustomer
                ? `إدارة المدفوعات والديون للعميل`
                : "إدارة أرصدة العملاء والمدفوعات الآجلة"}
            </p>
          </div>
        </div>

        {!selectedCustomer && (
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => void fetchAccounts()}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
              title="تحديث أرصدة العملاء"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              تحديث الأرصدة
            </button>
            <div className="flex items-center gap-8 ml-8">
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  إجمالي المديونيات
                </p>
                <p className="text-lg font-bold text-red-600">
                  {Number(totalDebit || 0 || 0).toLocaleString()} ج.م
                </p>
              </div>
              <div className="text-left border-r border-slate-200 pr-8">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  إجمالي الأرصدة
                </p>
                <p className="text-lg font-bold text-emerald-600">
                  {Number(totalCredit || 0 || 0).toLocaleString()} ج.م
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-xl py-2 pr-10 pl-4 w-80 focus:outline-none focus:border-blue-500 transition-colors text-slate-900"
              />
            </div>
          </div>
        )}

        {selectedCustomer && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void fetchAccounts();
                void fetchTransactions(selectedCustomer.id);
              }}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
              title="تحديث رصيد العميل وكشف الحركات"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              تحديث الحساب
            </button>
            <button
              onClick={printStatement}
              className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all"
              title="طباعة كشف حساب"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              <PlusCircle className="w-5 h-5" />
              إضافة حركة مالية
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar: Account List */}
        <div
          className={`w-full md:w-96 border-l border-slate-200 bg-white overflow-y-auto print:hidden ${selectedCustomer ? "hidden md:block" : "block"}`}
        >
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleCustomerClick(acc)}
                  className={`w-full p-6 text-right hover:bg-slate-50 transition-colors flex items-center justify-between ${selectedCustomer?.id === acc.id ? "bg-blue-50 border-r-4 border-blue-600" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${acc.balance > 0 ? "bg-red-50 text-red-600" : acc.balance < 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}
                    >
                      {(acc.name || "ح").charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {acc.name || "حساب بدون اسم"}
                      </p>
                      <p className="text-xs text-slate-500">{acc.phone}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-bold ${acc.balance > 0 ? "text-red-600" : acc.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      {Number(Math.abs(acc.balance || 0)).toLocaleString()} ج.م
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">
                      {acc.balance > 0
                        ? "مدين"
                        : acc.balance < 0
                          ? "دائن"
                          : "متزن"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content: Transaction History */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 print:bg-white print:p-0">
          {selectedCustomer ? (
            <div className="w-full space-y-6 print:max-w-none">
              {/* Customer Summary Card */}
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between print:border-none print:shadow-none print:rounded-none print:p-4">
                <div className="flex items-center gap-6">
                  <div
                    className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-bold print:hidden ${selectedCustomer.balance > 0 ? "bg-red-50 text-red-600" : selectedCustomer.balance < 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}
                  >
                    {(selectedCustomer.name || "ح").charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">
                      {selectedCustomer.name || "حساب بدون اسم"}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-slate-500">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          آخر حركة:{" "}
                          {selectedCustomer.last_transaction_date
                            ? new Date(
                                selectedCustomer.last_transaction_date,
                              ).toLocaleDateString("ar-EG")
                            : "لا يوجد"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm text-slate-500 font-bold mb-1">
                    الرصيد الحالي
                  </p>
                  <p
                    className={`text-4xl font-black ${selectedCustomer.balance > 0 ? "text-red-600" : selectedCustomer.balance < 0 ? "text-emerald-600" : "text-slate-900"}`}
                  >
                    {Number(Math.abs(selectedCustomer.balance || 0)).toLocaleString()}{" "}
                    ج.م
                  </p>
                  <p className="text-xs font-bold uppercase tracking-widest mt-1 opacity-50">
                    {selectedCustomer.balance > 0
                      ? "مدين (مستحق علينا)"
                      : selectedCustomer.balance < 0
                        ? "دائن (رصيد للعميل)"
                        : "حساب متزن"}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between print:bg-white print:p-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400 print:hidden" />
                    كشف حساب تفصيلي
                  </h3>
                  <div className="text-xs text-slate-400 font-bold">
                    تاريخ الطباعة: {new Date().toLocaleString("ar-EG")}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <div className="p-20 text-center text-slate-400">
                      <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
                      <p className="text-lg font-bold">
                        لا توجد حركات مالية مسجلة
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-right min-w-[800px]">
                      <thead className="bg-slate-50 print:bg-slate-100">
                        <tr>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            التاريخ
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            البيان
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500 text-center">
                            مدين (+)
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500 text-center">
                            دائن (-)
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500 text-center">
                            الرصيد
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          let runningBalance = 0;
                          // Sort by date ASC to calculate running balance correctly
                          const sortedTr = [...transactions].sort(
                            (a, b) =>
                              new Date(a.transaction_date || a.date || 0).getTime() -
                              new Date(b.transaction_date || b.date || 0).getTime(),
                          );

                          return sortedTr.reverse().map((tr, idx) => {
                            // For display, we show newest first, but running balance needs old to new
                            // Let's just calculate it once and store it or map it
                            return null; // Placeholder for logic below
                          });
                        })()}
                        {/* Re-implementing with proper balance calculation */}
                        {(() => {
                          let currentBal = 0;
                          const trWithBal = [...transactions]
                            .sort(
                              (a, b) =>
                                new Date(a.transaction_date || a.date || 0).getTime() -
                                new Date(b.transaction_date || b.date || 0).getTime(),
                            )
                            .map((tr) => {
                              if (tr.type === "invoice" || tr.type === "disbursement")
                                currentBal += tr.amount;
                              else if (tr.type === "payment")
                                currentBal -= tr.amount;
                              else if (tr.type === "adjustment")
                                currentBal += tr.amount;
                              return { ...tr, runningBalance: currentBal };
                            });

                          return trWithBal.reverse().map((tr) => (
                            <tr
                              key={tr.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="p-4 text-xs text-slate-500">
                                {new Date(tr.transaction_date || tr.date || 0).toLocaleString("ar-EG")}
                              </td>
                              <td className="p-4">
                                <p className="font-bold text-sm text-slate-900">
                                  {tr.type === "payment"
                                    ? "دفعة نقدية"
                                    : tr.type === "disbursement"
                                      ? "صرف للعميل"
                                    : tr.type === "invoice"
                                      ? "فاتورة مبيعات"
                                      : "تعديل رصيد"}
                                  {tr.order_id && (
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded mr-2">
                                      #طلب {tr.order_id}
                                    </span>
                                  )}
                                </p>
                                {tr.notes && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    {tr.notes}
                                  </p>
                                )}
                              </td>
                              <td className="p-4 text-center font-bold text-red-600">
                                {tr.type === "invoice" ||
                                tr.type === "disbursement" ||
                                (tr.type === "adjustment" && tr.amount > 0)
                                  ? `${Number(tr.amount || 0 || 0).toLocaleString()} ج.م`
                                  : "-"}
                              </td>
                              <td className="p-4 text-center font-bold text-emerald-600">
                                {tr.type === "payment" ||
                                (tr.type === "adjustment" && tr.amount < 0)
                                  ? `${Number(Math.abs(tr.amount || 0)).toLocaleString()} ج.م`
                                  : "-"}
                              </td>
                              <td className="p-4 text-center font-bold text-slate-900">
                                {Number(tr.runningBalance || 0 || 0).toLocaleString()} ج.م
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Wallet className="w-24 h-24 mb-6 opacity-10" />
              <h2 className="text-2xl font-bold">
                اختر عميلاً لعرض كشف الحساب
              </h2>
              <p className="mt-2">يمكنك إدارة المديونيات والتحصيلات من هنا</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTransactionModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveTransaction}>
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      إضافة حركة مالية
                    </h2>
                    <p className="text-sm text-slate-500">
                      للعميل: {selectedCustomer?.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTransactionModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setNewTransaction({
                          ...newTransaction,
                          type: "payment",
                        })
                      }
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${newTransaction.type === "payment" ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"}`}
                    >
                      <ArrowDownLeft className="w-6 h-6" />
                      <span className="font-bold">تحصيل (قبض)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTransaction({
                          ...newTransaction,
                          type: "adjustment",
                        })
                      }
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${newTransaction.type === "adjustment" ? "bg-blue-50 border-blue-500 text-blue-600" : "bg-slate-50 border-slate-100 text-slate-400"}`}
                    >
                      <DollarSign className="w-6 h-6" />
                      <span className="font-bold">تعديل رصيد</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">
                      المبلغ
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newTransaction.amount ?? ""}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            amount: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 text-2xl font-bold text-slate-900 pr-12"
                        placeholder="0.00"
                      />
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ج.م
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">
                      ملاحظات
                    </label>
                    <textarea
                      value={newTransaction.notes ?? ""}
                      onChange={(e) =>
                        setNewTransaction({
                          ...newTransaction,
                          notes: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 h-32 text-slate-900"
                      placeholder="اكتب تفاصيل الحركة هنا..."
                    />
                  </div>
                </div>

                <div className="p-8 bg-slate-50 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/20"
                  >
                    <Save className="w-6 h-6" />
                    حفظ الحركة
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTransactionModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
