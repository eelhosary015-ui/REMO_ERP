import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  Wallet,
  Plus,
  Download,
  Printer,
  X,
  Save,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowRight,
  History,
  Search,
  Building2,
  User,
  Landmark,
  Coins,
  FileText,
  Repeat,
  Calendar,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  Settings,
  FileSpreadsheet,
  Eye,
  Ban,
  ShieldCheck,
  ClipboardList,
  Check,
  TrendingUp,
  Sliders,
  Users,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { TreasuryAccount, TreasuryTransaction, TreasuryDailyClosing, TreasuryCustody, TreasuryCustodyType, TreasuryAuditLog, TreasurySetting } from "../types";
import { CustodyManagementEnterprise } from "./treasury/CustodyManagementEnterprise";
import { CustodyTypesView } from "./treasury/custody/CustodyTypesView";
import { TransferManagementEnterprise } from "./treasury/TransferManagementEnterprise";
import { DailyClosingEnterprise } from "./treasury/DailyClosingEnterprise";
import { CentralFinancialIntegrationView } from "./accounting/CentralFinancialIntegrationView";
import { TreasuryTransactionsEnterprise } from "./treasury/TreasuryTransactionsEnterprise";

interface CostCenter {
  id: number;
  name: string;
}

interface Branch {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
}

interface TreasuryProps {
  onBack: () => void;
  onOpenReports?: () => void;
  initialTab?: 'dashboard' | 'accounts' | 'transactions' | 'transfers' | 'closings' | 'custodies' | 'settings' | 'audit';
}

export const TreasurySystem: React.FC<TreasuryProps> = ({ onBack, onOpenReports, initialTab }) => {
  const formatDate = (dateVal: any, includeTime: boolean = false): string => {
    if (!dateVal) return "---";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "---";
    return includeTime 
      ? d.toLocaleString("ar-EG", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) 
      : d.toLocaleDateString("ar-EG", { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const { user, hasPermission } = useAuth();
  
  // Tabs: 'dashboard' | 'accounts' | 'transactions' | 'transfers' | 'closings' | 'custodies' | 'settings' | 'audit' | 'central_financial'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'transactions' | 'transfers' | 'closings' | 'custodies' | 'settings' | 'audit' | 'central_financial'>('dashboard');

  useEffect(() => {
    if (initialTab) {
      if ((initialTab as string) === "safes") {
        setActiveTab("settings");
      } else if (['dashboard', 'accounts', 'transactions', 'transfers', 'closings', 'custodies', 'settings', 'audit', 'central_financial'].includes(initialTab)) {
        setActiveTab(initialTab as any);
      }
    }
  }, [initialTab]);

  // Core Data
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [closings, setClosings] = useState<TreasuryDailyClosing[]>([]);
  const [custodies, setCustodies] = useState<TreasuryCustody[]>([]);
  const [custodyTypes, setCustodyTypes] = useState<TreasuryCustodyType[]>([]);
  const [auditLogs, setAuditLogs] = useState<TreasuryAuditLog[]>([]);
  const [settings, setSettings] = useState<TreasurySetting[]>([]);
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'custody_types'>('general');
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Selection states
  const [selectedAccount, setSelectedAccount] = useState<TreasuryAccount | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<TreasuryTransaction | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");

  // Dashboard Stats State
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Modals / Form states
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    id: 0,
    name: "",
    type: "cash" as 'cash' | 'bank' | 'petty_cash' | 'intermediate',
    currency: "EGP",
    opening_balance: "0",
    min_balance_limit: "0",
    max_balance_limit: "0",
    responsible_user_id: "",
    is_main: false,
    parent_id: "",
    branch_id: "",
    status: "active" as 'active' | 'suspended'
  });

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'cash_in' | 'cash_out' | 'transfer' | 'adjustment'>('cash_in');
  const [transactionFormData, setTransactionFormData] = useState({
    amount: "",
    notes: "",
    target_account_id: "",
    cost_center_id: "",
    voucher_type: "receipt" as 'receipt' | 'payment',
    tax_amount: "0",
    discount_amount: "0",
    payment_method: "cash" as 'cash' | 'bank' | 'check' | 'electronic',
    client_type: "customer" as 'customer' | 'supplier' | 'employee' | 'other',
    client_name: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Closing forms
  const [closingFormData, setClosingFormData] = useState({
    account_id: "",
    actual_balance: "",
    notes: ""
  });

  // Custody forms
  const [custodyFormData, setCustodyFormData] = useState({
    employee_id: "",
    account_id: "",
    amount: "",
    purpose: ""
  });

  // Custody Clearance modal
  const [selectedCustodyToClear, setSelectedCustodyToClear] = useState<TreasuryCustody | null>(null);
  const [clearanceFormData, setClearanceFormData] = useState({
    cleared_amount: "",
    returned_amount: "",
    clearance_notes: ""
  });

  // Settings modification
  const [settingsFormData, setSettingsFormData] = useState<Record<string, string>>({
    allow_negative_balance: "true",
    require_transaction_reason: "true",
    default_currency: "EGP",
    decimal_places: "2"
  });

  useEffect(() => {
    fetchDashboardStats();
    fetchAccounts();
    fetchBranches();
    fetchCostCenters();
    fetchEmployees();
    fetchClosings();
    fetchCustodies();
    fetchCustodyTypes();
    fetchSettings();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchTransactions(selectedAccount.id);
    }
  }, [selectedAccount, filterStatus, filterType, searchQuery]);

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get("/api/treasury/dashboard");
      if (res.ok) {
        setDashboardData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/api/treasury/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        if (data.length > 0 && !selectedAccount) {
          setSelectedAccount(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransactions = async (accountId: number) => {
    try {
      const url = `/api/treasury/transactions/${accountId}?status=${filterStatus}&type=${filterType}&search=${encodeURIComponent(searchQuery)}`;
      const res = await api.get(url);
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get("/api/hr/branches-status");
      if (res.ok) setBranches(await res.json());
    } catch (e) {}
  };

  const fetchCostCenters = async () => {
    try {
      const res = await api.get("/api/cost-centers");
      if (res.ok) setCostCenters(await res.json());
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/api/hr/employees");
      if (res.ok) setEmployees(await res.json());
    } catch (e) {}
  };

  const fetchClosings = async () => {
    try {
      const res = await api.get("/api/treasury/closings");
      if (res.ok) setClosings(await res.json());
    } catch (e) {}
  };

  const fetchCustodies = async () => {
    try {
      const res = await api.get("/api/treasury/custodies");
      if (res.ok) setCustodies(await res.json());
    } catch (e) {}
  };

  const fetchCustodyTypes = async () => {
    try {
      const res = await api.get("/api/treasury/custody-types");
      if (res.ok) setCustodyTypes(await res.json());
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/api/treasury/settings");
      if (res.ok) {
        const data: TreasurySetting[] = await res.json();
        setSettings(data);
        const mapped: Record<string, string> = {};
        data.forEach(s => mapped[s.key] = s.value);
        setSettingsFormData(prev => ({ ...prev, ...mapped }));
      }
    } catch (e) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get("/api/treasury/audit-logs");
      if (res.ok) setAuditLogs(await res.json());
    } catch (e) {}
  };

  // Form Submissions
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: accountFormData.name,
        type: accountFormData.type,
        currency: accountFormData.currency,
        opening_balance: accountFormData.opening_balance,
        min_balance_limit: accountFormData.min_balance_limit,
        max_balance_limit: accountFormData.max_balance_limit,
        responsible_user_id: accountFormData.responsible_user_id || null,
        is_main: accountFormData.is_main,
        parent_id: accountFormData.parent_id || null,
        branch_id: accountFormData.branch_id || null,
        status: accountFormData.status
      };

      const res = accountFormData.id
        ? await api.put(`/api/treasury/accounts/${accountFormData.id}`, payload)
        : await api.post("/api/treasury/accounts", payload);

      if (res.ok) {
        setShowAccountModal(false);
        fetchAccounts();
        fetchDashboardStats();
        fetchAuditLogs();
        alert("تم حفظ بيانات الخزينة / الحساب البنكي بنجاح");
      } else {
        const err = await res.json();
        alert(`فشل الحفظ: ${err.error || "خطأ غير معروف"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    try {
      const formData = new FormData();
      formData.append("account_id", selectedAccount.id.toString());
      formData.append("amount", transactionFormData.amount);
      formData.append("transaction_type", transactionType);
      formData.append("notes", transactionFormData.notes);
      formData.append("cost_center_id", transactionFormData.cost_center_id);
      formData.append("target_account_id", transactionFormData.target_account_id);
      formData.append("voucher_type", transactionFormData.voucher_type);
      formData.append("tax_amount", transactionFormData.tax_amount);
      formData.append("discount_amount", transactionFormData.discount_amount);
      formData.append("payment_method", transactionFormData.payment_method);
      formData.append("client_type", transactionFormData.client_type);
      formData.append("client_name", transactionFormData.client_name);
      
      if (selectedFile) {
        formData.append("attachment", selectedFile);
      }

      const token = localStorage.getItem('token');
      const res = await fetch("/api/treasury/transactions", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (res.ok) {
        setShowTransactionModal(false);
        setTransactionFormData({
          amount: "",
          notes: "",
          target_account_id: "",
          cost_center_id: "",
          voucher_type: "receipt",
          tax_amount: "0",
          discount_amount: "0",
          payment_method: "cash",
          client_type: "customer",
          client_name: ""
        });
        setSelectedFile(null);
        fetchAccounts();
        if (selectedAccount) fetchTransactions(selectedAccount.id);
        fetchDashboardStats();
        fetchAuditLogs();
        alert("تم تسجيل الحركة المالية وإصدار السند بنجاح");
      } else {
        const err = await res.json();
        alert(`فشل إتمام العملية: ${err.error || "تأكد من كفاية الأرصدة والحدود النقدية للعملية"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelTransaction = async (txId: number) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في إلغاء هذا السند بالكامل؟ سيتم عكس تأثير السند على رصيد الخزينة فوراً.")) return;
    try {
      const res = await api.post(`/api/treasury/transactions/${txId}/cancel`, {});
      if (res.ok) {
        alert("تم إلغاء السند وعكس الرصيد بنجاح");
        fetchAccounts();
        if (selectedAccount) fetchTransactions(selectedAccount.id);
        fetchDashboardStats();
        fetchAuditLogs();
      } else {
        const err = await res.json();
        alert(`فشل الإلغاء: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleClosingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingFormData.account_id || !closingFormData.actual_balance) {
      alert("الرجاء تحديد الخزينة وكتابة الرصيد الفعلي للجرد");
      return;
    }
    try {
      const res = await api.post("/api/treasury/closings", {
        account_id: parseInt(closingFormData.account_id),
        actual_balance: parseFloat(closingFormData.actual_balance),
        notes: closingFormData.notes
      });
      if (res.ok) {
        alert("تم إقفال اليومية ومطابقة الجرد بنجاح");
        setClosingFormData({ account_id: "", actual_balance: "", notes: "" });
        fetchAccounts();
        fetchClosings();
        fetchDashboardStats();
        fetchAuditLogs();
      } else {
        const err = await res.json();
        alert(`فشل الإقفال: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleReopenClosing = async (closingId: number) => {
    if (!window.confirm("هل تمتلك صلاحية المسؤول لإعادة فتح إغلاق اليومية؟ سيتم تسجيل هذا الإجراء بالكامل في سجل المتابعة.")) return;
    try {
      const res = await api.post(`/api/treasury/closings/${closingId}/reopen`, {});
      if (res.ok) {
        alert("تمت إعادة فتح اليومية بنجاح");
        fetchClosings();
        fetchAuditLogs();
      } else {
        const err = await res.json();
        alert(`فشل فتح اليومية: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/treasury/custodies", custodyFormData);
      if (res.ok) {
        alert("تم تسجيل طلب العهدة بنجاح، يرجى تسليمها الآن لتفعيل صرفها");
        setCustodyFormData({ employee_id: "", account_id: "", amount: "", purpose: "" });
        fetchCustodies();
      } else {
        alert("فشل تسجيل العهدة");
      }
    } catch (e) {}
  };

  const handlePayCustody = async (id: number) => {
    if (!window.confirm("هل تم صرف النقدية فعلياً للموظف؟ سيتم خصم هذا المبلغ من رصيد الخزينة المحددة.")) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${id}/pay`, {});
      if (res.ok) {
        alert("تم صرف العهدة النقدية بنجاح وتسجيل سند الصرف");
        fetchCustodies();
        fetchAccounts();
        fetchDashboardStats();
      } else {
        const err = await res.json();
        alert(`فشل الصرف: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleClearCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustodyToClear) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${selectedCustodyToClear.id}/clear`, {
        cleared_amount: parseFloat(clearanceFormData.cleared_amount),
        returned_amount: parseFloat(clearanceFormData.returned_amount),
        clearance_notes: clearanceFormData.clearance_notes
      });
      if (res.ok) {
        alert("تمت تصفية العهدة وإغلاقها، واسترداد المتبقي للخزينة بنجاح");
        setSelectedCustodyToClear(null);
        setClearanceFormData({ cleared_amount: "", returned_amount: "", clearance_notes: "" });
        fetchCustodies();
        fetchAccounts();
        fetchDashboardStats();
      } else {
        const err = await res.json();
        alert(`فشل تصفية العهدة: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = Object.entries(settingsFormData).map(([key, value]) => ({
        key,
        value,
        description: ""
      }));
      const res = await api.post("/api/treasury/settings", { settings: payload });
      if (res.ok) {
        alert("تم حفظ إعدادات الرقابة المالية بنجاح");
        fetchSettings();
      } else {
        alert("فشل حفظ الإعدادات");
      }
    } catch (e) {}
  };

  // Utilities
  const getTypeStyle = (type: string) => {
    switch (type) {
      case "cash":
        return { label: "خزينة نقدية", icon: Coins, color: "text-amber-600 bg-amber-50 border-amber-100" };
      case "bank":
        return { label: "حساب بنكي", icon: Landmark, color: "text-blue-600 bg-blue-50 border-blue-100" };
      case "petty_cash":
        return { label: "عهدة نثريات", icon: Wallet, color: "text-purple-600 bg-purple-50 border-purple-100" };
      default:
        return { label: "حساب وسيط", icon: Repeat, color: "text-slate-600 bg-slate-50 border-slate-100" };
    }
  };

  const getTransactionStyle = (type: string, amount: number) => {
    if (amount > 0)
      return { label: type === "transfer" ? "تحويل وارد" : "إيداع / قبض", color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
    if (amount < 0)
      return { label: type === "transfer" ? "تحويل صادر" : "سحب / صرف", color: "text-rose-600 bg-rose-50 border-rose-100" };
    return { label: "تسوية جرد", color: "text-slate-600 bg-slate-50 border-slate-100" };
  };

  const exportCSV = (data: any[], fileName: string, headers: string[]) => {
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...data].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportVouchers = () => {
    if (transactions.length === 0) return;
    const rows = transactions.map(t => {
      const style = getTransactionStyle(t.transaction_type, Number(t.amount));
      return [
        t.voucher_number || "-",
        formatDate(t.created_at),
        style.label,
        Math.abs(Number(t.amount)),
        t.payment_method,
        t.client_name || "-",
        t.notes || "-"
      ];
    });
    exportCSV(rows, "كشف_سندات_الخزينة", ["رقم السند", "التاريخ", "النوع", "المبلغ", "طريقة الدفع", "المستفيد/العميل", "البيان"]);
  };

  const triggerResetBalance = async (accId: number) => {
    if (!window.confirm("تنبيه حرج: هل تريد تصفير وإعادة ضبط رصيد هذه الخزينة؟ سيقوم النظام بإنشاء حركة تسوية ومعالجة القيود تلقائياً.")) return;
    try {
      const res = await api.post(`/api/treasury/accounts/${accId}/reset`, {});
      if (res.ok) {
        alert("تم إعادة ضبط وتصفير رصيد الخزينة");
        fetchAccounts();
        fetchDashboardStats();
      }
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col" dir="rtl">
      
      {/* Top Professional Control Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between print:hidden shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          {activeTab !== 'dashboard' ? (
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition-all text-sm"
            >
              <ArrowRight className="w-4 h-4" />
              الرجوع للوحة التحكم الرئيسية
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-black text-slate-900">نظام إدارة الرقابة المالية والخزائن</h1>
            </div>
          )}
          
          {activeTab !== 'dashboard' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-300">/</span>
              <span className="text-sm font-black text-slate-600">
                {activeTab === 'central_financial' && "التكامل المالي المركزي"}
                {activeTab === 'accounts' && "حسابات الخزائن والبنوك"}
                {activeTab === 'transactions' && "السندات والحركات المالية"}
                {activeTab === 'transfers' && "التحويل المالي البيني"}
                {activeTab === 'closings' && "إقفال اليومية والمطابقة"}
                {activeTab === 'custodies' && "إدارة العهد والأمانات"}
                {activeTab === 'audit' && "سجل المتابعة والتعديلات"}
                {activeTab === 'settings' && "إعدادات الرقابة والنظام"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Active Account Tag */}
          {selectedAccount && activeTab !== 'dashboard' && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700">
              <Landmark className="w-3.5 h-3.5" />
              <span>الخزينة النشطة: {selectedAccount.name} Number({Number(selectedAccount.current_balance || 0).toLocaleString()} {selectedAccount.currency})</span>
            </div>
          )}
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-all text-sm"
          >
            <X className="w-4 h-4" />
            خروج من الخزينة
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Dynamic Alerts Banner */}
        {dashboardData?.alerts?.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 space-y-2 print:hidden">
            {dashboardData.alerts.map((alert: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-amber-800 text-sm font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-900">لوحة مؤشرات الخزائن والتدفق النقدي</h2>
            
            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-400 font-bold">إجمالي أرصدة الخزائن</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Wallet className="w-5 h-5" /></div>
                </div>
                <div className="text-2xl font-black text-slate-800">
                  {(dashboardData.summary?.total_balance ?? 0).toLocaleString()} <span className="text-xs text-slate-400">EGP</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">شامل النقدية والحسابات البنكية</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-400 font-bold">إجمالي المقبوضات (اليوم)</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><ArrowDownLeft className="w-5 h-5" /></div>
                </div>
                <div className="text-2xl font-black text-emerald-600">
                  {(dashboardData.daily?.daily_receipts ?? 0).toLocaleString()} <span className="text-xs text-slate-400">EGP</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">عمليات السحب والقبض الواردة اليوم</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-400 font-bold">إجمالي المدفوعات (اليوم)</span>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><ArrowUpRight className="w-5 h-5" /></div>
                </div>
                <div className="text-2xl font-black text-rose-600">
                  {(dashboardData.daily?.daily_payments ?? 0).toLocaleString()} <span className="text-xs text-slate-400">EGP</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">المصروفات وسندات الصرف الصادرة</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-400 font-bold">تحويلات مالية بينية</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><ArrowRightLeft className="w-5 h-5" /></div>
                </div>
                <div className="text-2xl font-black text-blue-600">
                  {(dashboardData.daily?.daily_transfers ?? 0).toLocaleString()} <span className="text-xs text-slate-400">EGP</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">عدد الحركات اليوم: {dashboardData.daily?.daily_count ?? 0}</p>
              </div>
            </div>

            {/* Bento Navigation Grid */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-500" />
                أقسام ووظائف نظام الخزينة والرقابة المالية
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('central_financial')}
                  className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-700/80 shadow-md hover:border-indigo-400 hover:shadow-xl transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-0.5">التكامل المالي المركزي</h4>
                    <p className="text-[10px] text-indigo-200 font-bold">المحرك الموحد لكافة موديولات ERP</p>
                  </div>
                </button>

                {hasPermission('safes.accounts') !== false && (
                <button
                  onClick={() => setActiveTab('accounts')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">حسابات الخزائن والبنوك</h4>
                    <p className="text-[10px] text-slate-400 font-bold">إدارة وتعديل وأرصدة الخزائن والبنوك</p>
                  </div>
                </button>
                )}

                {hasPermission('safes.transactions') !== false && (
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">السندات والحركات المالية</h4>
                    <p className="text-[10px] text-slate-400 font-bold">تسجيل حركات القبض، الصرف، والإيداع</p>
                  </div>
                </button>
                )}

                {hasPermission('safes.transfers') !== false && (
                <button
                  onClick={() => setActiveTab('transfers')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">التحويل المالي البيني</h4>
                    <p className="text-[10px] text-slate-400 font-bold">تحويل المبالغ بين الخزائن والحسابات</p>
                  </div>
                </button>
                )}

                {hasPermission('safes.closings') !== false && (
                <button
                  onClick={() => setActiveTab('closings')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">إقفال اليومية والمطابقة</h4>
                    <p className="text-[10px] text-slate-400 font-bold">تسوية وإغلاق الحسابات ومطابقة العجز والزيادة</p>
                  </div>
                </button>
                )}

                {hasPermission('safes.custodies') !== false && (
                <button
                  onClick={() => setActiveTab('custodies')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">إدارة العهد والأمانات</h4>
                    <p className="text-[10px] text-slate-400 font-bold">صرف وتسوية العهد المالية للموظفين</p>
                  </div>
                </button>
                )}

                {hasPermission('safes.audit') !== false && (
                <button
                  onClick={() => setActiveTab('audit')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">سجل المتابعة والتعديلات</h4>
                    <p className="text-[10px] text-slate-400 font-bold">مراقبة العمليات وسجل التغييرات الكامل للرقابة</p>
                  </div>
                </button>
                )}

                {hasPermission('safes.settings') !== false && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all w-fit">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5">إعدادات الرقابة والنظام</h4>
                    <p className="text-[10px] text-slate-400 font-bold">تحديد قيود وسلوكيات حركة النقدية والمطابقة</p>
                  </div>
                </button>
                )}

                <button
                  onClick={() => onOpenReports?.()}
                  className="bg-indigo-600 p-5 rounded-2xl border border-indigo-600 shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all text-right flex flex-col justify-between h-36 group"
                >
                  <div className="p-2.5 bg-white/20 text-white rounded-xl w-fit">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-0.5">التقارير وتحليلات الخزينة</h4>
                    <p className="text-[10px] text-indigo-200 font-bold">كشوف الحسابات التفصيلية وتقارير التقفيلات والعهد</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Sub Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Cash distribution breakdown */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-700">توزيع السيولة المالية</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1 font-bold text-slate-600">
                      <span>الخزائن النقدية</span>
                      <span>{(dashboardData.summary?.cash_balance ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((dashboardData.summary?.cash_balance ?? 0) / (dashboardData.summary?.total_balance || 1)) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1 font-bold text-slate-600">
                      <span>الأرصدة البنكية</span>
                      <span>{(dashboardData.summary?.bank_balance ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((dashboardData.summary?.bank_balance ?? 0) / (dashboardData.summary?.total_balance || 1)) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1 font-bold text-slate-600">
                      <span>نثريات وعهدة نقدية</span>
                      <span>{(dashboardData.summary?.petty_cash_balance ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((dashboardData.summary?.petty_cash_balance ?? 0) / (dashboardData.summary?.total_balance || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* High / Low Safes */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-700">مستويات الأرصدة المتطرفة</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-center">
                    <span className="text-xs text-emerald-700 font-bold block mb-1">أعلى خزينة رصيداً</span>
                    <span className="text-sm font-black text-slate-800 block truncate">{dashboardData.highestSafe?.name ?? "-"}</span>
                    <span className="text-lg font-black text-emerald-600">{(dashboardData.highestSafe?.balance ?? 0).toLocaleString()} ج.م</span>
                  </div>

                  <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 text-center">
                    <span className="text-xs text-rose-700 font-bold block mb-1">أقل خزينة رصيداً</span>
                    <span className="text-sm font-black text-slate-800 block truncate">{dashboardData.lowestSafe?.name ?? "-"}</span>
                    <span className="text-lg font-black text-rose-600">{(dashboardData.lowestSafe?.balance ?? 0).toLocaleString()} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Dynamic SVG bar chart for flows */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-700">التدفقات المالية لآخر 7 أيام</h3>
                <div className="h-32 flex items-end justify-between gap-2 pt-4">
                  {dashboardData.chartData?.map((day: any, i: number) => {
                    const maxFlow = Math.max(...(dashboardData.chartData || []).map((d: any) => Math.max(d.inflows || 0, d.outflows || 0)), 1);
                    const inflowHeight = ((day.inflows || 0) / maxFlow) * 100;
                    const outflowHeight = ((day.outflows || 0) / maxFlow) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="w-full flex justify-center items-end gap-0.5 h-24">
                          <div className="w-2 bg-emerald-500 rounded-t" style={{ height: `${inflowHeight}%` }} title={`وارد: ${day.inflows}`}></div>
                          <div className="w-2 bg-rose-500 rounded-t" style={{ height: `${outflowHeight}%` }} title={`صادر: ${day.outflows}`}></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">{day.date_label ? day.date_label.substring(8,10) : ""}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 text-xs font-bold pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span> واردات</span>
                  <span className="flex items-center gap-1 text-rose-600"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span> صادر / مصروفات</span>
                </div>
              </div>
            </div>

            {/* Recent Vouchers List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  آخر العمليات والاعتمادات النقدية
                </h3>
                <button onClick={() => setActiveTab('transactions')} className="text-xs font-bold text-indigo-600 hover:underline">عرض كافة السندات</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase border-b border-slate-100">
                      <th className="p-4">المرجع / الكود</th>
                      <th className="p-4">الخزينة</th>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">البيان</th>
                      <th className="p-4">المبلغ</th>
                      <th className="p-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {dashboardData.latestTransactions?.map((tx: any) => {
                      const style = getTransactionStyle(tx.transaction_type, Number(tx.amount));
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-4 font-mono font-bold text-slate-700">{tx.voucher_number || `TX-${tx.id}`}</td>
                          <td className="p-4 font-bold text-slate-800">{tx.account_name}</td>
                          <td className="p-4 text-slate-400">{new Date(tx.created_at).toLocaleDateString("ar-EG")}</td>
                          <td className="p-4 text-slate-600">{tx.notes}</td>
                          <td className={`p-4 font-black ${tx.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {Number(tx.amount || 0).toLocaleString()} ج.م
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tx.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : tx.status === 'canceled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                              {tx.status === 'approved' ? 'معتمد' : tx.status === 'canceled' ? 'ملغي' : 'معلق'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. ACCOUNTS & BANKS TAB */}
        {activeTab === 'accounts' && hasPermission('safes.accounts') !== false && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">حسابات الخزائن والبنوك والعهدة</h2>
                <p className="text-sm text-slate-400 mt-1">تتبع مستويات النقدية وصلاحيات الخزائن المتنوعة</p>
              </div>
              <button
                onClick={() => {
                  setAccountFormData({
                    id: 0,
                    name: "",
                    type: "cash",
                    currency: "EGP",
                    opening_balance: "0",
                    min_balance_limit: "0",
                    max_balance_limit: "0",
                    responsible_user_id: "",
                    is_main: false,
                    parent_id: "",
                    branch_id: "",
                    status: "active"
                  });
                  setShowAccountModal(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
              >
                <Plus className="w-5 h-5" />
                إنشاء خزينة / حساب بنكي
              </button>
            </div>

            {/* Grid display */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((acc) => {
                const style = getTypeStyle(acc.type);
                const Icon = style.icon;
                return (
                  <div key={acc.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${style.color}`}>
                          {style.label}
                        </span>
                        <span className={`w-3.5 h-3.5 rounded-full inline-block border-2 border-white shadow-sm ${acc.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} title={acc.status === 'active' ? 'نشطة' : 'موقوفة'}></span>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-slate-800">{acc.name}</h3>
                        <p className="text-xs text-slate-400 font-bold flex items-center gap-1 mt-1">
                          <Building2 className="w-3.5 h-3.5" />
                          الفرع: {acc.branch_name || "المركز الرئيسي"}
                        </p>
                      </div>

                      {/* Responsible User */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-bold bg-slate-50 p-2.5 rounded-xl">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>المسؤول: {acc.responsible_user_name || "غير محدد"}</span>
                      </div>

                      {/* Balance Display */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-400 block font-bold mb-1">الرصيد الحالي المتوفر</span>
                        <div className="text-2xl font-black text-indigo-600">
                          {Number(acc.current_balance || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">{acc.currency}</span>
                        </div>
                      </div>

                      {/* Limit details */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 font-bold pt-2">
                        <div>
                          <span>الحد الأدنى:</span>
                          <span className="block text-slate-700">{Number(acc.min_balance_limit || 0).toLocaleString()} ج.م</span>
                        </div>
                        <div>
                          <span>الحد الأقصى:</span>
                          <span className="block text-slate-700">{Number(acc.max_balance_limit || 0).toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex justify-between items-center gap-2">
                      <button
                        onClick={() => {
                          setAccountFormData({
                            id: acc.id,
                            name: acc.name,
                            type: acc.type,
                            currency: acc.currency,
                            opening_balance: acc.opening_balance.toString(),
                            min_balance_limit: acc.min_balance_limit.toString(),
                            max_balance_limit: acc.max_balance_limit.toString(),
                            responsible_user_id: acc.responsible_user_id?.toString() || "",
                            is_main: acc.is_main,
                            parent_id: acc.parent_id?.toString() || "",
                            branch_id: acc.branch_id?.toString() || "",
                            status: acc.status
                          });
                          setShowAccountModal(true);
                        }}
                        className="text-xs font-bold text-slate-600 hover:text-indigo-600"
                      >
                        تعديل البيانات
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => triggerResetBalance(acc.id)}
                          className="text-xs font-bold text-rose-500 hover:underline"
                        >
                          تصفير الرصيد
                        </button>
                        
                        <button
                          onClick={() => setSelectedAccount(acc)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                        >
                          عرض الحركات
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. VOUCHERS / TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <TreasuryTransactionsEnterprise
              accounts={accounts}
              selectedAccount={selectedAccount}
              onSelectAccount={(acc) => {
                setSelectedAccount(acc);
              }}
              onRefreshData={() => {
                fetchAccounts();
                if (selectedAccount) fetchTransactions(selectedAccount.id);
              }}
              currentUser={user}
            />
          </div>
        )}

        {/* 4. SAFE TRANSFERS TAB */}
        {activeTab === 'transfers' && hasPermission('safes.transfers') !== false && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <TransferManagementEnterprise />
          </div>
        )}

        {/* 5. DAILY CLOSINGS TAB */}
        {activeTab === 'closings' && hasPermission('safes.closings') !== false && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <DailyClosingEnterprise
              treasuries={accounts}
              currentUser={user}
              onRefreshTreasuries={fetchAccounts}
            />
          </div>
        )}

        {/* 6. CUSTODIES TAB */}
        {activeTab === 'custodies' && hasPermission('safes.custodies') !== false && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <CustodyManagementEnterprise
              accounts={accounts}
              employees={employees}
              branches={branches}
              costCenters={costCenters}
              onRefreshTreasury={() => {
                fetchAccounts();
                fetchDashboardStats();
                fetchAuditLogs();
              }}
            />
          </div>
        )}

        {/* 7. AUDIT TRAIL TAB */}
        {activeTab === 'audit' && hasPermission('safes.audit') !== false && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-900">سجل عمليات التغيير والمتابعة بالخزينة (Audit Trail)</h2>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-bold border-b border-slate-100">
                      <th className="p-4">رقم السجل</th>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">المستخدم الفاعل</th>
                      <th className="p-4">نوع الإجراء</th>
                      <th className="p-4">الخزينة المعنية</th>
                      <th className="p-4">الحالة قبل</th>
                      <th className="p-4">الحالة بعد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-mono font-bold text-slate-500">#{log.id}</td>
                        <td className="p-4 text-slate-400">{new Date((log.created_at) || 0).toLocaleString("ar-EG")}</td>
                        <td className="p-4 font-black text-slate-700">{log.user_name || "مستخدم مجهول"}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold">
                            {log.action_type}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{log.account_name || "-"}</td>
                        <td className="p-4 max-w-[150px] truncate font-mono text-slate-400" title={JSON.stringify(log.old_values)}>{JSON.stringify(log.old_values) || "-"}</td>
                        <td className="p-4 max-w-[150px] truncate font-mono text-slate-400" title={JSON.stringify(log.new_values)}>{JSON.stringify(log.new_values) || "-"}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">لا توجد سجلات متابعة حالية</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 8. SETTINGS TAB */}
        {activeTab === 'settings' && hasPermission('safes.settings') !== false && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">إعدادات وسياسات موديول الخزينة</h2>
                <p className="text-xs text-slate-500 font-bold mt-1">تحديد معايير الرقابة المالية وسياسات وأنواع العهد والأمانات</p>
              </div>

              {/* Sub-tab navigation */}
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('general')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    settingsSubTab === 'general'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ضوابط الرقابة المالية
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('custody_types')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    settingsSubTab === 'custody_types'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  أنواع وسياسات العهد ({custodyTypes.length})
                </button>
              </div>
            </div>

            {settingsSubTab === 'general' ? (
              <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 max-w-2xl">
                <div className="space-y-4 divide-y divide-slate-100">
                  
                  {/* Rule 1 */}
                  <div className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <label className="text-sm font-black text-slate-800">السماح بالسحب بالسالب (عجز الرصيد)</label>
                      <p className="text-xs text-slate-400">يتيح سحب الأموال من الصناديق لتجاوز الرصيد الحالي</p>
                    </div>
                    <select
                      value={settingsFormData.allow_negative_balance}
                      onChange={(e) => setSettingsFormData(prev => ({ ...prev, allow_negative_balance: e.target.value }))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="false">ممنوع (حماية صارمة)</option>
                      <option value="true">مسموح به</option>
                    </select>
                  </div>

                  {/* Rule 2 */}
                  <div className="flex items-center justify-between py-3 pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-black text-slate-800">إلزام كتابة سبب الحركات المالية</label>
                      <p className="text-xs text-slate-400">يمنع حفظ السندات دون تدوين الملاحظات وبيان العملية</p>
                    </div>
                    <select
                      value={settingsFormData.require_transaction_reason}
                      onChange={(e) => setSettingsFormData(prev => ({ ...prev, require_transaction_reason: e.target.value }))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="true">نعم (إلزامي)</option>
                      <option value="false">اختياري</option>
                    </select>
                  </div>

                  {/* Rule 3 */}
                  <div className="flex items-center justify-between py-3 pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-black text-slate-800">العملة الافتراضية للتقارير المجمعة</label>
                      <p className="text-xs text-slate-400">عملة النظام لإحصاء الرصيد الإجمالي</p>
                    </div>
                    <input
                      type="text"
                      value={settingsFormData.default_currency}
                      onChange={(e) => setSettingsFormData(prev => ({ ...prev, default_currency: e.target.value }))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none w-24 text-center"
                    />
                  </div>

                  {/* Rule 4 */}
                  <div className="flex items-center justify-between py-3 pt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-black text-slate-800">عدد الخانات العشرية للأرقام</label>
                      <p className="text-xs text-slate-400">تنسيق عرض العملات بالهللات</p>
                    </div>
                    <input
                      type="number"
                      value={settingsFormData.decimal_places}
                      onChange={(e) => setSettingsFormData(prev => ({ ...prev, decimal_places: e.target.value }))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none w-24 text-center"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md"
                >
                  حفظ تعديلات إعدادات الرقابة
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <CustodyTypesView types={custodyTypes} onRefresh={fetchCustodyTypes} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- MODALS & POPUPS ----------------- */}

      {/* Account / Safe CRUD Modal */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden max-w-lg w-full flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800">
                  {accountFormData.id ? "تعديل حساب الخزينة / البنك" : "إضافة خزينة / حساب بنكي جديد"}
                </h3>
                <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAccountSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">اسم الخزينة / الحساب (بالعربية)</label>
                  <input
                    type="text"
                    value={accountFormData.name}
                    onChange={(e) => setAccountFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                    placeholder="مثال: الخزينة الرئيسية لفرع المعادي"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">نوع الحساب النقدية</label>
                    <select
                      value={accountFormData.type}
                      onChange={(e: any) => setAccountFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="cash">خزينة نقدية (Cash)</option>
                      <option value="bank">حساب بنكي (Bank Account)</option>
                      <option value="petty_cash">أمانة نثريات (Petty Cash)</option>
                      <option value="intermediate">حساب وسيط تسويات</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">العملة</label>
                    <input
                      type="text"
                      value={accountFormData.currency}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none text-center font-bold"
                      placeholder="EGP"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">الرصيد الافتتاحي المالي</label>
                    <input
                      type="number"
                      value={accountFormData.opening_balance}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, opening_balance: e.target.value }))}
                      disabled={!!accountFormData.id}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none disabled:opacity-50"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">حالة الخزينة</label>
                    <select
                      value={accountFormData.status}
                      onChange={(e: any) => setAccountFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="active">نشطة ومتاحة للصرف</option>
                      <option value="suspended">موقوفة مؤقتاً (مغلقة)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">الحد الأدنى للنقدية</label>
                    <input
                      type="number"
                      value={accountFormData.min_balance_limit}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, min_balance_limit: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">الحد الأقصى للنقدية</label>
                    <input
                      type="number"
                      value={accountFormData.max_balance_limit}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, max_balance_limit: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">الفرع المرتبط بها</label>
                    <select
                      value={accountFormData.branch_id}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, branch_id: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="">كافة الفروع / المركز الرئيسي</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">المستخدم المسؤول عنها</label>
                    <select
                      value={accountFormData.responsible_user_id}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, responsible_user_id: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="">لا يوجد مسؤول مخصص</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="is_main_check"
                    checked={accountFormData.is_main}
                    onChange={(e) => setAccountFormData(prev => ({ ...prev, is_main: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <label htmlFor="is_main_check" className="text-sm font-bold text-slate-700">اعتبار هذه الخزينة كخزينة رئيسية للفروع</label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md mt-4"
                >
                  حفظ البيانات المعتمدة للدفتر
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transactions & Vouchers Posting Modal */}
      <AnimatePresence>
        {showTransactionModal && selectedAccount && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden max-w-lg w-full flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800">
                  {transactionType === 'cash_in' ? "إصدار سند قبض / إيداع نقدي" : "إصدار سند صرف / دفع مصروف"}
                </h3>
                <button onClick={() => setShowTransactionModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransactionSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-slate-400 font-bold">الخزينة المحددة</label>
                    <div className="p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-700 border border-slate-100">
                      {selectedAccount.name} Number(المتوفر: {Number(selectedAccount.current_balance || 0).toLocaleString()} ج.م)
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">قيمة الحركة المالية</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00 ج.م"
                      value={transactionFormData.amount}
                      onChange={(e) => setTransactionFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">طريقة التحصيل / الدفع</label>
                    <select
                      value={transactionFormData.payment_method}
                      onChange={(e: any) => setTransactionFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="cash">نقداً كاش</option>
                      <option value="bank">تحويل بنكي</option>
                      <option value="check">شيك ورقي</option>
                      <option value="electronic">دفع إلكتروني ومحافظ</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">نوع المستفيد / العميل</label>
                    <select
                      value={transactionFormData.client_type}
                      onChange={(e: any) => setTransactionFormData(prev => ({ ...prev, client_type: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="customer">عميل مبيعات (Customer)</option>
                      <option value="supplier">مورد خامات (Supplier)</option>
                      <option value="employee">موظف / مرتبات</option>
                      <option value="other">جهات أخرى وتعديلات</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">اسم العميل / المستفيد</label>
                    <input
                      type="text"
                      placeholder="اكتب الاسم الرباعي بوضوح..."
                      value={transactionFormData.client_name}
                      onChange={(e) => setTransactionFormData(prev => ({ ...prev, client_name: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">مركز التكلفة المنسوب له</label>
                    <select
                      value={transactionFormData.cost_center_id}
                      onChange={(e) => setTransactionFormData(prev => ({ ...prev, cost_center_id: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none font-bold"
                    >
                      <option value="">اختر مركز التكلفة...</option>
                      {costCenters.map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">إرفاق مستند أو صورة فاتورة</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-2.5 text-xs text-slate-600 font-bold block text-center"
                    >
                      {selectedFile ? `تم التحديد: ${selectedFile.name.substring(0, 15)}...` : "اضغط لرفع مستند مرفق"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">مبلغ ضريبة القيمة المضافة (إن وجد)</label>
                    <input
                      type="number"
                      value={transactionFormData.tax_amount}
                      onChange={(e) => setTransactionFormData(prev => ({ ...prev, tax_amount: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">الخصم الممنوح أو المكتسب</label>
                    <input
                      type="number"
                      value={transactionFormData.discount_amount}
                      onChange={(e) => setTransactionFormData(prev => ({ ...prev, discount_amount: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">البيان والسبب التفصيلي للمستند</label>
                  <textarea
                    placeholder="بيان تفصيلي معتمد لأغراض التدقيق المحاسبي السليم..."
                    value={transactionFormData.notes}
                    onChange={(e) => setTransactionFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none min-h-[90px] focus:border-indigo-500"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md mt-4"
                >
                  إصدار السند وإعتماده رسمياً
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custody Clearance modal popup */}
      <AnimatePresence>
        {selectedCustodyToClear && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden max-w-md w-full"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800">تصفية وإغلاق العهدة المالية</h3>
                <button onClick={() => setSelectedCustodyToClear(null)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleClearCustodySubmit} className="p-6 space-y-4">
                <p className="text-xs text-slate-400 font-bold">العهدة الممنوحة للموظف: {selectedCustodyToClear.employee_name}</p>
                <p className="text-xs text-slate-500 font-black">القيمة الكلية للعهدة: {Number(selectedCustodyToClear.amount || 0).toLocaleString()} ج.م</p>
                
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">المبلغ الفعلي الذي تم صرفه (بموجب فواتير)</label>
                  <input
                    type="number"
                    value={clearanceFormData.cleared_amount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setClearanceFormData(prev => ({
                        ...prev,
                        cleared_amount: e.target.value,
                        returned_amount: (Number(selectedCustodyToClear.amount) - val).toString()
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">المبلغ المتبقي المسترد للخزينة</label>
                  <input
                    type="number"
                    value={clearanceFormData.returned_amount}
                    onChange={(e) => setClearanceFormData(prev => ({ ...prev, returned_amount: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none disabled:opacity-75"
                    disabled
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold">ملاحظات التصفية وتفاصيل الفواتير</label>
                  <textarea
                    placeholder="سجل أرقام وتواريخ فواتير الصرف المرفقة..."
                    value={clearanceFormData.clearance_notes}
                    onChange={(e) => setClearanceFormData(prev => ({ ...prev, clearance_notes: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none min-h-[80px]"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-md"
                >
                  تأكيد التصفية وإيداع المسترد
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beautiful PDF/Printable Voucher View (Receipt/Payment Layout) */}
      <AnimatePresence>
        {selectedVoucher && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden max-w-xl w-full flex flex-col"
            >
              {/* Header with quick printable action */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between print:hidden">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  تفاصيل السند المحاسبي المعتمد
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                    title="طباعة السند"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button onClick={() => setSelectedVoucher(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="p-8 space-y-6 text-right font-sans print:p-0">
                
                {/* Visual Voucher Frame */}
                <div className="border-4 border-double border-slate-200 p-6 rounded-2xl space-y-6">
                  
                  {/* Voucher Header Title */}
                  <div className="text-center pb-4 border-b-2 border-slate-100 space-y-2">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">شركة مطاعم ريستوماستر ومطابخها الموحدة</h1>
                    <span className="px-6 py-1.5 bg-slate-100 text-slate-800 rounded-full font-black text-sm tracking-wide inline-block">
                      {selectedVoucher.voucher_type === 'receipt' ? "سَنَد قَبْض مَالِي" : "سَنَد صَرْف مَالِي"}
                    </span>
                  </div>

                  {/* Metadata block */}
                  <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-600">
                    <div>
                      <span>رقم السند:</span>
                      <span className="block font-mono text-slate-900 text-sm mt-1">{selectedVoucher.voucher_number || `TX-${selectedVoucher.id}`}</span>
                    </div>
                    <div>
                      <span>تاريخ الإصدار:</span>
                      <span className="block text-slate-900 text-sm mt-1">{new Date((selectedVoucher.created_at) || 0).toLocaleString("ar-EG")}</span>
                    </div>
                  </div>

                  {/* Core details fields */}
                  <div className="space-y-3 pt-2 text-sm text-slate-700">
                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center font-bold">
                      <span>دفعنا إلى السيد (ة) / استلمنا من السيد (ة):</span>
                      <span className="text-slate-900 font-black">{selectedVoucher.client_name || "-"}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center font-bold">
                      <span>البيان والسبب المحاسبي:</span>
                      <span className="text-slate-800 font-medium">{selectedVoucher.notes || "-"}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center font-bold">
                      <span>طريقة الدفع أو السداد:</span>
                      <span className="text-indigo-600">{selectedVoucher.payment_method === 'cash' ? 'نقداً كاش' : selectedVoucher.payment_method === 'bank' ? 'حساب بنكي' : 'أخرى'}</span>
                    </div>
                  </div>

                  {/* Total Value blocks */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-xs font-bold text-slate-400">
                      <span>الحالة الإدارية للسند</span>
                      <span className="block text-emerald-600 text-sm font-black mt-1">مُعْتَمَد ومُرَحَّل دَفْتَرِيّاً</span>
                    </div>
                    <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-center">
                      <span className="text-xs block font-bold">القيمة والعملة</span>
                      <span className="text-2xl font-black">{Math.abs(Number(selectedVoucher.amount)).toLocaleString()} ج.م</span>
                    </div>
                  </div>

                  {/* Signatures block */}
                  <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs font-bold text-slate-400">
                    <div>
                      <span className="block border-b border-slate-200 pb-8">توقيع المسؤول المستلم</span>
                    </div>
                    <div>
                      <span className="block border-b border-slate-200 pb-8">توقيع إدارة الخزينة المعتمدة</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
