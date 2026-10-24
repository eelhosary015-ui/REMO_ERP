import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Search,
  Filter,
  Download,
  Printer,
  X,
  Save,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Clock,
  User,
  Building2,
  CreditCard,
  Banknote,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface Safe {
  id: number;
  name: string;
  balance: number;
  branch_id: number | null;
  warehouse_id: number | null;
}

interface Branch {
  id: number;
  name: string;
}

interface Warehouse {
  id: number;
  name: string;
}

interface SafeTransaction {
  id: number;
  safe_id: number;
  amount: number;
  type: string;
  notes: string;
  date: string;
  user_name?: string;
  payment_method?: "cash" | "bank" | "check" | "electronic" | string;
}

interface SafeShift {
  id: number;
  safe_id: number;
  user_id: number;
  user_name?: string;
  start_date: string;
  end_date: string | null;
  opening_balance: number;
  closing_balance: number | null;
  actual_balance: number | null;
  status: "open" | "closed";
}

interface BankAccount {
  id: number;
  name: string;
  account_number: string;
  balance: number;
}

interface Supplier {
  id: number;
  name: string;
}

interface SafesProps {
  onBack: () => void;
  isManagementMode?: boolean;
  initialTab?: string;
}

export const Safes: React.FC<SafesProps> = ({
  onBack,
  isManagementMode = false,
  initialTab,
}) => {
  const { user } = useAuth();
  const [safes, setSafes] = useState<Safe[]>([]);
  const [selectedSafe, setSelectedSafe] = useState<Safe | null>(null);
  const [transactions, setTransactions] = useState<SafeTransaction[]>([]);
  const [activeShift, setActiveShift] = useState<SafeShift | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [treasuryDashboard, setTreasuryDashboard] = useState<{ totals: { balance: number; open: number }; todayAdjustments: { count: number; amount: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [safeModalType, setSafeModalType] = useState<"add" | "edit">("add");
  const [safeFormData, setSafeFormData] = useState({
    name: "",
    branch_id: "",
    warehouse_id: "",
  });
  const [modalType, setModalType] = useState<string>("in");
  const [formData, setFormData] = useState({
    amount: "",
    notes: "",
    target_safe_id: "",
    reference_id: "",
  });

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [shiftFormData, setShiftFormData] = useState({
    opening_balance: "",
    actual_balance: "",
  });

  useEffect(() => {
    fetchSafes();
    fetchBankAccounts();
    fetchSuppliers();
    fetchBranches();
    fetchWarehouses();
    fetchTreasuryDashboard();
  }, []);

  useEffect(() => {
    if (selectedSafe) {
      fetchTransactions(selectedSafe.id);
      fetchActiveShift(selectedSafe.id);
    }
  }, [selectedSafe]);


  const fetchTreasuryDashboard = async () => {
    try {
      const res = await api.get("/api/safes/dashboard");
      if (res.ok) setTreasuryDashboard(await res.json());
    } catch (error) {
      console.error("Failed to fetch treasury dashboard");
    }
  };
  const fetchSafes = async () => {
    try {
      const res = await api.get("/api/safes");
      const data = await res.json();
      let safeList = Array.isArray(data) ? data : [];

      if (user && user.role !== "admin") {
        safeList = safeList.filter(
          (s: any) => s.branch_id === (user.branch_id || null),
        );
      }

      setSafes(safeList);
      if (safeList.length > 0 && !selectedSafe) {
        let matchedSafe = null;
        if (initialTab === "main") {
          matchedSafe = safeList.find(
            (s: any) =>
              s.name.includes("رئيس") || s.name.toLowerCase().includes("main"),
          );
        } else if (initialTab === "secret" || initialTab === "confidential") {
          matchedSafe = safeList.find(
            (s: any) =>
              s.name.includes("سر") ||
              s.name.toLowerCase().includes("secret") ||
              s.name.toLowerCase().includes("confidential"),
          );
          if (!matchedSafe) {
            // Auto-create secret safe
            try {
              const createRes = await api.post("/api/safes", {
                name: "الخزينة السرية والخاصة",
                branch_id: user?.branch_id || null,
                warehouse_id: null,
              });
              if (createRes.ok) {
                const newS = await createRes.json();
                const freshRes = await api.get("/api/safes");
                const freshData = await freshRes.json();
                let freshList = Array.isArray(freshData) ? freshData : [];
                if (user && user.role !== "admin") {
                  freshList = freshList.filter(
                    (s: any) => s.branch_id === (user.branch_id || null),
                  );
                }
                setSafes(freshList);
                matchedSafe = freshList.find((s: any) => s.id === newS.id);
              }
            } catch (err) {
              console.error("Auto-create secret safe failed", err);
            }
          }
        }
        setSelectedSafe(matchedSafe || safeList[0]);
      }
      return safeList;
    } catch (error) {
      console.error("Failed to fetch safes");
      setSafes([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await api.get("/api/bank-accounts");
      if (res.ok) {
        const data = await res.json();
        setBankAccounts(data);
      }
    } catch (error) {
      console.error("Failed to fetch bank accounts");
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error("Failed to fetch suppliers");
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get("/api/hr/branches-status");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Failed to fetch branches");
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get("/api/inventory/warehouses");
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data);
      }
    } catch (error) {
      console.error("Failed to fetch warehouses");
    }
  };

  const fetchTransactions = async (safeId: number) => {
    try {
      const res = await api.get(`/api/safes/${safeId}/transactions`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch transactions");
      setTransactions([]);
    }
  };

  const fetchActiveShift = async (safeId: number) => {
    try {
      const res = await api.get(`/api/safes/${safeId}/active-shift`);
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data);
        if (data) {
          setShiftFormData((prev) => ({
            ...prev,
            opening_balance: data.opening_balance.toString(),
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch active shift");
    }
  };

  const handleOpenShift = async () => {
    if (!selectedSafe || !user) return;
    try {
      const amount = parseFloat(shiftFormData.opening_balance || "0");
      if (isNaN(amount)) {
        alert("يرجى إدخال مبلغ صحيح");
        return;
      }

      const res = await api.post(`/api/safes/${selectedSafe.id}/open-shift`, {
        opening_balance: amount,
        user_id: user.id,
      });

      if (res.ok) {
        await fetchActiveShift(selectedSafe.id);
        await fetchTransactions(selectedSafe.id);
        const updatedSafes = await fetchSafes();
        if (updatedSafes) {
          const updatedSelected = updatedSafes.find(
            (s: any) => s.id === selectedSafe.id,
          );
          if (updatedSelected) setSelectedSafe(updatedSelected);
        }
        setShowShiftModal(false);
        setShiftFormData({ opening_balance: "", actual_balance: "" });
      } else {
        const errorData = await res.json();
        alert(errorData.error || "فشل فتح الوردية");
      }
    } catch (error) {
      console.error("Open shift error:", error);
      alert("حدث خطأ أثناء فتح الوردية");
    }
  };

  const handleCloseShift = async () => {
    if (!selectedSafe || !activeShift || !user) return;
    try {
      const actualBalance = parseFloat(shiftFormData.actual_balance);
      if (isNaN(actualBalance)) {
        alert("يرجى إدخال الجرد الفعلي بشكل صحيح");
        return;
      }

      const res = await api.post(`/api/safes/${selectedSafe.id}/close-shift`, {
        shift_id: activeShift.id,
        closing_balance: selectedSafe.balance,
        actual_balance: actualBalance,
        user_id: user.id,
      });

      if (res.ok) {
        await fetchActiveShift(selectedSafe.id);
        await fetchTransactions(selectedSafe.id);
        const updatedSafes = await fetchSafes();
        if (updatedSafes) {
          const updatedSelected = updatedSafes.find(
            (s: any) => s.id === selectedSafe.id,
          );
          if (updatedSelected) setSelectedSafe(updatedSelected);
        }
        setShowShiftModal(false);
        setShiftFormData({ opening_balance: "", actual_balance: "" });
        alert("تم إغلاق الوردية بنجاح وتحويل الرصيد الفعلي للخزينة الرئيسية");
      } else {
        const errorData = await res.json();
        alert(errorData.error || "فشل إغلاق الوردية");
      }
    } catch (error) {
      console.error("Close shift error:", error);
      alert("حدث خطأ أثناء إغلاق الوردية");
    }
  };

  const handleSafeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: safeFormData.name,
        branch_id: safeFormData.branch_id
          ? parseInt(safeFormData.branch_id)
          : null,
        warehouse_id: safeFormData.warehouse_id
          ? parseInt(safeFormData.warehouse_id)
          : null,
      };

      let res;
      if (safeModalType === "add") {
        res = await api.post("/api/safes", payload);
      } else {
        res = await api.put(`/api/safes/${selectedSafe?.id}`, payload);
      }

      if (res.ok) {
        setShowSafeModal(false);
        setSafeFormData({ name: "", branch_id: "", warehouse_id: "" });
        fetchSafes();
      } else {
        const data = await res.json();
        alert(data.error || "فشل حفظ الخزينة");
      }
    } catch (error) {
      console.error("Failed to save safe");
      alert("حدث خطأ في الاتصال بالخادم");
    }
  };

  const handleResetSafe = async () => {
    if (!selectedSafe || !user) return;
    if (
      !window.confirm(
        "هل أنت متأكد من تصفير الخزينة؟ سيتم تصفير الرصيد وتسجيل حركة عجز بالرصيد الحالي.",
      )
    )
      return;

    try {
      const res = await api.post(`/api/safes/${selectedSafe.id}/reset`, {
        user_id: user.id,
      });
      if (res.ok) {
        alert("تم تصفير الخزينة بنجاح");
        fetchSafes();
        fetchTransactions(selectedSafe.id);
        fetchTreasuryDashboard();
      } else {
        const data = await res.json();
        alert(data.error || "فشل تصفير الخزينة");
      }
    } catch (error) {
      console.error("Failed to reset safe");
      alert("حدث خطأ في الاتصال بالخادم");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSafe) return;

    try {
      const payload: any = {
        safe_id: selectedSafe.id,
        amount: parseFloat(formData.amount),
        type: modalType,
        notes: formData.notes,
        user_id: user?.id,
      };

      if (modalType === "transfer") {
        payload.target_safe_id = parseInt(formData.target_safe_id);
      }

      if (modalType === "vendor_payment" || modalType === "bank_deposit") {
        payload.reference_id = parseInt(formData.reference_id);
      }

      const res = await api.post("/api/safes/transactions", payload);

      if (res.ok) {
        setShowModal(false);
        setFormData({
          amount: "",
          notes: "",
          target_safe_id: "",
          reference_id: "",
        });
        fetchSafes();
        fetchTransactions(selectedSafe.id);
      } else {
        const data = await res.json();
        alert(data.error || "فشل حفظ الحركة");
      }
    } catch (error) {
      console.error("Failed to save transaction");
      alert("حدث خطأ في الاتصال بالخادم");
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: any = {
      in: "إيداع",
      out: "سحب",
      transfer: "تحويل",
      cash_drop: "استلام توريد",
      petty_cash: "مصروفات نثرية",
      vendor_payment: "دفع للمورد",
      bank_deposit: "إيداع بنكي",
      deficit: "عجز",
      surplus: "زيادة",
      sale: "مبيعات نقطة البيع (POS)",
    };
    return labels[type] || type;
  };

  const getTransactionColor = (type: string) => {
    if (type === "sale") return "text-emerald-700 bg-emerald-100 border border-emerald-300";
    const inflows = ["in", "cash_drop", "surplus", "transfer_in"];
    if (inflows.includes(type)) return "text-emerald-600 bg-emerald-50";
    const outflows = [
      "out",
      "petty_cash",
      "vendor_payment",
      "bank_deposit",
      "deficit",
      "transfer",
    ];
    if (outflows.includes(type)) return "text-red-600 bg-red-50";
    return "text-blue-600 bg-blue-50";
  };

  const displayTransactions = activeShift
    ? transactions.filter(
        (t) => new Date(t.date) >= new Date(activeShift.start_date),
      )
    : transactions;

  const filteredTransactions = displayTransactions.filter((t) => {
    if (txTypeFilter === "sale") return t.type === "sale";
    if (txTypeFilter === "inflow") return ["in", "cash_drop", "surplus", "transfer_in"].includes(t.type);
    if (txTypeFilter === "outflow") return ["out", "petty_cash", "vendor_payment", "bank_deposit", "deficit", "transfer"].includes(t.type);
    if (txTypeFilter === "transfer") return ["transfer", "transfer_in"].includes(t.type);
    return true;
  });

  const shiftCashIn = displayTransactions
    .filter(
      (t) =>
        ["in", "cash_drop", "surplus", "sale"].includes(t.type) &&
        (!t.payment_method || t.payment_method === "cash"),
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const shiftDigitalIn = displayTransactions
    .filter(
      (t) =>
        ["in", "cash_drop", "surplus", "sale"].includes(t.type) &&
        t.payment_method &&
        t.payment_method !== "cash",
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const shiftCashOut = displayTransactions
    .filter(
      (t) =>
        [
          "out",
          "petty_cash",
          "vendor_payment",
          "bank_deposit",
          "deficit",
          "transfer",
        ].includes(t.type) &&
        (!t.payment_method || t.payment_method === "cash"),
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const shiftDigitalOut = displayTransactions
    .filter(
      (t) =>
        [
          "out",
          "petty_cash",
          "vendor_payment",
          "bank_deposit",
          "deficit",
          "transfer",
        ].includes(t.type) &&
        t.payment_method &&
        t.payment_method !== "cash",
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const activeShiftOpening = activeShift
    ? Number(activeShift.opening_balance || 0)
    : 0;
  const expectedCashInDrawer = activeShiftOpening + shiftCashIn - shiftCashOut;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900" dir="rtl">
      {/* Sidebar - Safes List */}
      <div
        className={`w-full md:w-80 bg-white border-l border-slate-200 flex flex-col ${selectedSafe ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-cyan-600" />
              الخزائن
            </h1>
          </div>
          {isManagementMode && user?.role === "admin" && (
            <button
              onClick={() => {
                setSafeModalType("add");
                setSafeFormData({ name: "", branch_id: "", warehouse_id: "" });
                setShowSafeModal(true);
              }}
              className="p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {safes.map((safe) => (
            <button
              key={safe.id}
              onClick={() => setSelectedSafe(safe)}
              className={`w-full p-4 rounded-2xl text-right transition-all border ${
                selectedSafe?.id === safe.id
                  ? "bg-cyan-50 border-cyan-200 shadow-sm"
                  : "bg-white border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`font-bold ${selectedSafe?.id === safe.id ? "text-cyan-700" : "text-slate-700"}`}
                >
                  {safe.name}
                </span>
                <Wallet
                  className={`w-4 h-4 ${selectedSafe?.id === safe.id ? "text-cyan-500" : "text-slate-300"}`}
                />
              </div>
              <div className="text-xl font-black text-slate-900">
                {Number(safe.balance || 0 || 0).toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">ج.م</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Transactions */}
      <div
        className={`flex-1 flex flex-col ${!selectedSafe ? "hidden md:flex" : "flex"}`}
      >
        {selectedSafe ? (
          <>
            <div className="p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedSafe(null)}
                  className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900">
                      {selectedSafe.name}
                    </h2>
                    {isManagementMode && user?.role === "admin" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSafeModalType("edit");
                            setSafeFormData({
                              name: selectedSafe.name,
                              branch_id:
                                selectedSafe.branch_id?.toString() || "",
                              warehouse_id:
                                selectedSafe.warehouse_id?.toString() || "",
                            });
                            setShowSafeModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                          title="تعديل الخزينة"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleResetSafe}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="تصفير الخزينة"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedSafe.branch_id !== null && (
                      <>
                        <span
                          className={`w-2 h-2 rounded-full ${activeShift ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
                        />
                        <p className="text-sm text-slate-500">
                          {activeShift
                            ? `وردية مفتوحة بواسطة ${activeShift.user_name || "مستخدم"}`
                            : "الخزينة مغلقة حالياً"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Shift Management - Only for Branch Safes */}
                {selectedSafe.branch_id !== null && (
                  <>
                    <div className="flex gap-2">
                      {!activeShift ? (
                        <>
                          <button
                            onClick={() => {
                              setShiftFormData({
                                opening_balance:
                                  selectedSafe.balance.toString(),
                                actual_balance: "",
                              });
                              setShowShiftModal(true);
                            }}
                            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20"
                          >
                            <Clock className="w-4 h-4" />
                            فتح وردية
                          </button>
                          <button
                            disabled
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-400 px-4 py-2 rounded-xl font-bold cursor-not-allowed"
                          >
                            <Save className="w-4 h-4" />
                            إنهاء وردية
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            disabled
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-400 px-4 py-2 rounded-xl font-bold cursor-not-allowed"
                          >
                            <Clock className="w-4 h-4" />
                            فتح وردية
                          </button>
                          <button
                            onClick={() => {
                              setShiftFormData({
                                opening_balance:
                                  activeShift.opening_balance.toString(),
                                actual_balance: "",
                              });
                              setShowShiftModal(true);
                            }}
                            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20"
                          >
                            <Save className="w-4 h-4" />
                            إنهاء وردية
                          </button>
                        </>
                      )}
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block" />
                  </>
                )}

                {/* Common feature: Petty Cash (Nathriyat) - Only for Main Safe */}
                {selectedSafe.branch_id === null && (
                  <button
                    onClick={() => {
                      setModalType("petty_cash");
                      setShowModal(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/20"
                  >
                    <Receipt className="w-4 h-4" />
                    نثريات
                  </button>
                )}

                {/* Main Safe Exclusive Features */}
                {selectedSafe.branch_id === null && (
                  <>
                    <button
                      onClick={() => {
                        setModalType("in");
                        setShowModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة رصيد
                    </button>
                    <button
                      onClick={() => {
                        setModalType("cash_drop");
                        setShowModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-cyan-600/20"
                    >
                      <TrendingUp className="w-4 h-4" />
                      توريد
                    </button>
                    <button
                      onClick={() => {
                        setModalType("vendor_payment");
                        setShowModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                    >
                      <User className="w-4 h-4" />
                      موردين
                    </button>
                    <button
                      onClick={() => {
                        setModalType("bank_deposit");
                        setShowModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                      <Building2 className="w-4 h-4" />
                      بنك
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    الرصيد الحالي
                  </p>
                  <h3 className="text-2xl font-black text-slate-900">
                    {Number(selectedSafe.balance || 0 || 0).toLocaleString()}{" "}
                    <span className="text-sm font-normal">ج.م</span>
                  </h3>
                  {selectedSafe.branch_id !== null && activeShift && (
                    <p className="text-xs text-slate-500 mt-2">
                      نقدي بالدرج المتوقع:{" "}
                      <span className="font-bold text-slate-700">
                        {Number(expectedCashInDrawer || 0).toLocaleString()} ج.م
                      </span>
                    </p>
                  )}
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">
                    {selectedSafe.branch_id === null
                      ? "إجمالي الوارد"
                      : "وارد الوردية"}
                  </p>
                  <h3 className="text-2xl font-black text-emerald-600">
                    {Number(shiftCashIn + shiftDigitalIn || 0).toLocaleString()}{" "}
                    <span className="text-sm font-normal">ج.م</span>
                  </h3>
                  {selectedSafe.branch_id !== null && activeShift && (
                    <div className="flex gap-2 text-[10px] text-slate-500 mt-2 font-medium">
                      <span>
                        💵 كاش:{" "}
                        <span className="font-bold text-emerald-600">
                          {Number(shiftCashIn || 0).toLocaleString()}
                        </span>
                      </span>
                      <span>
                        💳 فيزا:{" "}
                        <span className="font-bold text-indigo-600">
                          {Number(shiftDigitalIn || 0).toLocaleString()}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">
                    {selectedSafe.branch_id === null
                      ? "إجمالي المنصرف"
                      : "منصرف الوردية"}
                  </p>
                  <h3 className="text-2xl font-black text-rose-600">
                    {Number(shiftCashOut + shiftDigitalOut || 0).toLocaleString()}{" "}
                    <span className="text-sm font-normal">ج.م</span>
                  </h3>
                  {selectedSafe.branch_id !== null && activeShift && (
                    <div className="flex gap-2 text-[10px] text-slate-500 mt-2 font-medium">
                      <span>
                        💵 كاش:{" "}
                        <span className="font-bold text-rose-600">
                          {Number(shiftCashOut || 0).toLocaleString()}
                        </span>
                      </span>
                      <span>
                        💳 فيزا:{" "}
                        <span className="font-bold text-indigo-600">
                          {Number(shiftDigitalOut || 0).toLocaleString()}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                {selectedSafe.branch_id !== null && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-cyan-500 uppercase tracking-wider mb-1">
                      رصيد الافتتاح
                    </p>
                    <h3 className="text-2xl font-black text-cyan-600">
                      {Number(
                        activeShift?.opening_balance || 0,
                      ).toLocaleString()}{" "}
                      <span className="text-sm font-normal">ج.م</span>
                    </h3>
                  </div>
                )}
              </div>

              {/* Treasury control snapshot */}
              {treasuryDashboard && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400">إجمالي أرصدة الخزائن</p>
                    <p className="text-2xl font-black text-slate-900">{Number(treasuryDashboard.totals.balance || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">الخزائن المفتوحة</p>
                    <p className="text-2xl font-black text-cyan-600">{treasuryDashboard.totals.open}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">عجز/زيادة اليوم</p>
                    <p className="text-2xl font-black text-amber-600">{Number(treasuryDashboard.todayAdjustments.amount || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="text-xs text-slate-500">{treasuryDashboard.todayAdjustments.count} حركة تسوية اليوم</div>
                </div>
              )}

              {/* Transactions Table */}
              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold flex items-center gap-2 text-slate-700">
                      <History className="w-5 h-5 text-slate-400" />
                      سجل الحركات المالية
                    </h3>
                    {/* فلتر نوع الحركة */}
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "all", label: "الكل" },
                        { id: "sale", label: "🛒 مبيعات POS" },
                        { id: "inflow", label: "إيداعات" },
                        { id: "outflow", label: "مصروفات" },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => setTxTypeFilter(btn.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            txTypeFilter === btn.id
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                      <Search className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                      <Printer className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          التاريخ
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          النوع
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          المبلغ
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          المسؤول
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          البيان / الملاحظات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTransactions.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-4 text-sm text-slate-500">
                            {new Date((t.date) || 0).toLocaleString("ar-EG", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-bold ${getTransactionColor(t.type)}`}
                              >
                                {getTransactionLabel(t.type)}
                              </span>
                              {t.payment_method &&
                                t.payment_method !== "cash" && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                      t.payment_method === "wallet"
                                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                                        : t.payment_method === "instapay"
                                          ? "bg-cyan-100 text-cyan-700 border border-cyan-200"
                                          : t.payment_method === "visa"
                                            ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                            : "bg-slate-100 text-slate-700 border border-slate-200"
                                    }`}
                                  >
                                    {t.payment_method === "wallet"
                                      ? "📱 محفظة"
                                      : t.payment_method === "instapay"
                                        ? "⚡ إنستا"
                                        : t.payment_method === "visa"
                                          ? "💳 فيزا"
                                          : ""}
                                  </span>
                                )}
                            </div>
                          </td>
                          <td
                            className={`p-4 font-bold ${["in", "cash_drop", "surplus", "sale"].includes(t.type) ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {["in", "cash_drop", "surplus", "sale"].includes(
                              t.type,
                            )
                              ? "+"
                              : "-"}
                            {Number(t.amount || 0 || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-sm text-slate-600 font-medium">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-slate-400" />
                              {t.user_name || "النظام"}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            {t.notes}
                          </td>
                        </tr>
                      ))}
                      {displayTransactions.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-12 text-center text-slate-400 italic"
                          >
                            لا يوجد حركات مسجلة لهذه الخزينة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Wallet className="w-12 h-12 opacity-20" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              اختر خزينة للمتابعة
            </h3>
            <p className="max-w-xs">
              قم باختيار أحد الخزائن من القائمة الجانبية لعرض رصيدها وسجل
              حركاتها المالية
            </p>
          </div>
        )}
      </div>

      {/* Safe Modal (Add/Edit) */}
      <AnimatePresence>
        {showSafeModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSafeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSafeSubmit}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {safeModalType === "add"
                      ? "إضافة خزينة جديدة"
                      : "تعديل بيانات الخزينة"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowSafeModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      اسم الخزينة
                    </label>
                    <input
                      type="text"
                      required
                      value={safeFormData.name}
                      onChange={(e) =>
                        setSafeFormData({
                          ...safeFormData,
                          name: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500"
                      placeholder="مثلاً: الخزينة الرئيسية، خزينة فرع ..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      ربط بفرع (اختياري)
                    </label>
                    <select
                      value={safeFormData.branch_id}
                      onChange={(e) =>
                        setSafeFormData({
                          ...safeFormData,
                          branch_id: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">غير مرتبط بفرع (خزينة عامة)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      ربط بمخزن (اختياري)
                    </label>
                    <select
                      value={safeFormData.warehouse_id}
                      onChange={(e) =>
                        setSafeFormData({
                          ...safeFormData,
                          warehouse_id: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">غير مرتبط بمخزن</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-cyan-600/20"
                  >
                    حفظ البيانات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shift Modal */}
      <AnimatePresence>
        {showShiftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShiftModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  {activeShift ? "إغلاق الوردية" : "فتح وردية جديدة"}
                </h2>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {activeShift ? (
                  <>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">
                          تنبيه الجرد الفعلي
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          يرجى إدخال المبلغ الموجود فعلياً في الخزينة الآن.
                          سيقوم النظام بحساب العجز أو الزيادة تلقائياً.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        الرصيد الدفتري (المتوقع)
                      </label>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-2xl font-black text-slate-400 text-center">
                        {Number(selectedSafe?.balance || 0).toLocaleString()} ج.م
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        الجرد الفعلي (الموجود حالياً)
                      </label>
                      <input
                        type="number"
                        required
                        value={shiftFormData.actual_balance}
                        onChange={(e) =>
                          setShiftFormData({
                            ...shiftFormData,
                            actual_balance: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-2xl font-black text-slate-900 focus:outline-none focus:border-amber-500 text-center"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      رصيد الافتتاح
                    </label>
                    <input
                      type="number"
                      required
                      value={shiftFormData.opening_balance}
                      onChange={(e) =>
                        setShiftFormData({
                          ...shiftFormData,
                          opening_balance: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-2xl font-black text-slate-900 focus:outline-none focus:border-cyan-500 text-center"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 flex gap-4">
                <button
                  onClick={activeShift ? handleCloseShift : handleOpenShift}
                  className={`flex-1 py-4 rounded-2xl font-bold text-white transition-all shadow-xl ${activeShift ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20" : "bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/20"}`}
                >
                  {activeShift ? "تأكيد الإغلاق والجرد" : "فتح الوردية"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {getTransactionLabel(modalType)}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      تسجيل حركة مالية في {selectedSafe?.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      المبلغ
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-2xl font-black text-slate-900 focus:outline-none focus:border-cyan-500 text-center"
                        placeholder="0.00"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ج.م
                      </span>
                    </div>
                  </div>

                  {modalType === "transfer" && (
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        الخزينة المستهدفة
                      </label>
                      <select
                        required
                        value={formData.target_safe_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            target_safe_id: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">اختر الخزينة...</option>
                        {safes
                          .filter((s) => s.id !== selectedSafe?.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {modalType === "vendor_payment" && (
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        المورد
                      </label>
                      <select
                        required
                        value={formData.reference_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reference_id: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">اختر المورد...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalType === "bank_deposit" && (
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        الحساب البنكي
                      </label>
                      <select
                        required
                        value={formData.reference_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reference_id: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">اختر الحساب...</option>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} - {b.account_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      البيان / ملاحظات
                    </label>
                    <textarea
                      required
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-500 h-24 resize-none"
                      placeholder="اكتب تفاصيل الحركة هنا..."
                    />
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex gap-4">
                  <button
                    type="submit"
                    className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl ${
                      ["in", "cash_drop", "surplus"].includes(modalType)
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                        : [
                              "out",
                              "petty_cash",
                              "vendor_payment",
                              "bank_deposit",
                              "deficit",
                            ].includes(modalType)
                          ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                          : "bg-slate-800 hover:bg-slate-900 shadow-slate-800/20"
                    } text-white`}
                  >
                    <Save className="w-6 h-6" />
                    تأكيد الحركة
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
