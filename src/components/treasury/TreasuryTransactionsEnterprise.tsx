import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Printer,
  Eye,
  Ban,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  SlidersHorizontal,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  DollarSign,
  Briefcase,
  Layers,
  Check,
  Wallet,
  ChevronDown,
  CalendarDays,
  Clock,
  Hash,
  Users,
  Banknote,
  Landmark,
  FileCheck2,
  Save,
  Loader2
} from "lucide-react";
import { TreasuryAccount, TreasuryTransaction } from "../../types";
import { api, authHeaders } from "../../utils/api";

interface Branch {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
}

interface TreasuryTransactionsEnterpriseProps {
  accounts: TreasuryAccount[];
  selectedAccount?: TreasuryAccount | null;
  onSelectAccount?: (account: TreasuryAccount) => void;
  onRefreshData?: () => void;
  currentUser?: any;
}

// Clean initial transactions array
const MOCK_TRANSACTIONS: TreasuryTransaction[] = [];

export const TreasuryTransactionsEnterprise: React.FC<TreasuryTransactionsEnterpriseProps> = ({
  accounts = [],
  selectedAccount = null,
  onSelectAccount,
  onRefreshData,
  currentUser
}) => {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccountId, setFilterAccountId] = useState<string>(selectedAccount ? String(selectedAccount.id) : "all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Metadata arrays for filter options and voucher entity linking
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Modals
  const [selectedVoucherForView, setSelectedVoucherForView] = useState<TreasuryTransaction | null>(null);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<TreasuryTransaction | null>(null);
  // كشف مرتبات المسير لسند صرف المرتبات (اسم كل موظف ومستحقه)
  const [payrollBreakdown, setPayrollBreakdown] = useState<any | null>(null);
  const [payrollBreakdownStatus, setPayrollBreakdownStatus] = useState<"idle" | "loading" | "error">("idle");
  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
  const [newVoucherType, setNewVoucherType] = useState<'cash_in' | 'cash_out'>('cash_in');

  // Party Selection State for Voucher Modal
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [partySearchQuery, setPartySearchQuery] = useState("");
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [allocationMode, setAllocationMode] = useState<'general' | 'invoice'>('general');
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  // Remembers the amount we auto-filled when an invoice was selected, so switching
  // invoices can refresh it without ever overwriting an amount the user typed by hand.
  const autoFilledAmountRef = useRef<string>("");

  // New Voucher Form
  const [voucherForm, setVoucherForm] = useState({
    account_id: selectedAccount ? String(selectedAccount.id) : (accounts[0] ? String(accounts[0].id) : ""),
    amount: "",
    payment_method: "cash",
    client_type: "supplier",
    client_name: "",
    notes: "",
    tax_amount: "0",
    discount_amount: "0"
  });
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const isSubmittingVoucherRef = useRef(false);

  // ── Voucher issuance modal: presentation helpers + local draft ──────
  const isReceiptVoucher = newVoucherType === "cash_in";
  const voucherNow = new Date();
  const voucherDateLabel = voucherNow.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const voucherTimeLabel = voucherNow.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  const formatVoucherMoney = (value: number) =>
    Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // اسمان مختصران مستخدمان داخل وسم النافذة
  const isReceipt = isReceiptVoucher;
  const fmtMoney = formatVoucherMoney;

  // رقم مبدئي للعرض فقط — الرقم النهائي يُولَّد على الخادم عند الحفظ.
  const voucherPreviewNo = (() => {
    const year = voucherNow.getFullYear();
    const prefix = isReceiptVoucher ? "RC" : "PV";
    const used = transactions
      .map((tx) => String((tx as any).voucher_number || ""))
      .filter((value) => value.startsWith(`${prefix}-${year}-`))
      .map((value) => Number(value.split("-").pop()))
      .filter((value) => Number.isFinite(value) && value > 0);
    const next = (used.length ? Math.max(...used) : 0) + 1;
    return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
  })();

  const selectedVoucherAccount = accounts.find((acc) => String(acc.id) === String(voucherForm.account_id));
  const selectedAccountBalance = Number((selectedVoucherAccount as any)?.current_balance || 0);
  const selectedPartyBalance = Number(
    (voucherForm.client_type === "supplier" ? selectedSupplier?.balance : undefined) ??
      (voucherForm.client_type === "customer" ? selectedCustomer?.balance : undefined) ??
      0,
  );

  const voucherAccent = isReceiptVoucher
    ? {
        ring: "focus:border-emerald-500 focus:ring-emerald-500/15",
        solid: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25",
        icon: "bg-emerald-600 shadow-emerald-600/25",
        chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
        toggleActive: "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200",
      }
    : {
        ring: "focus:border-rose-500 focus:ring-rose-500/15",
        solid: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25",
        icon: "bg-rose-600 shadow-rose-600/25",
        chip: "bg-rose-100 text-rose-800 border-rose-200",
        toggleActive: "bg-white text-rose-700 shadow-sm ring-1 ring-rose-200",
      };

  const VOUCHER_DRAFT_KEY = "remo:treasury:voucher-draft";
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(false);

  useEffect(() => {
    if (!showNewVoucherModal) return;
    try {
      setDraftAvailable(!!localStorage.getItem(VOUCHER_DRAFT_KEY));
    } catch {
      setDraftAvailable(false);
    }
  }, [showNewVoucherModal]);

  const saveVoucherDraft = () => {
    try {
      localStorage.setItem(VOUCHER_DRAFT_KEY, JSON.stringify({
        type: newVoucherType,
        form: voucherForm,
        supplier: selectedSupplier,
        customer: selectedCustomer,
        employee: selectedEmployee,
      }));
      setDraftAvailable(true);
      setDraftNotice("حُفظت المسودة على هذا الجهاز — لم يُنشأ سند مالي");
      window.setTimeout(() => setDraftNotice(null), 4000);
    } catch {
      setDraftNotice("تعذّر حفظ المسودة على هذا الجهاز");
    }
  };

  const restoreVoucherDraft = () => {
    try {
      const raw = localStorage.getItem(VOUCHER_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.form) setVoucherForm((prev) => ({ ...prev, ...draft.form }));
      if (draft?.type) setNewVoucherType(draft.type);
      setSelectedSupplier(draft.supplier ?? null);
      setSelectedCustomer(draft.customer ?? null);
      setSelectedEmployee(draft.employee ?? null);
      setDraftNotice("تم استعادة المسودة");
      window.setTimeout(() => setDraftNotice(null), 3000);
    } catch {
      /* مسودة تالفة */
    }
  };

  // Sync prop selectedAccount changes to filterAccountId
  useEffect(() => {
    if (selectedAccount) {
      setFilterAccountId(String(selectedAccount.id));
    }
  }, [selectedAccount]);

  // Fetch Metadata (Branches, Employees, Suppliers, Customers)
  const fetchAllEntities = useCallback(async () => {
    setLoadingEntities(true);
    try {
      const [bRes, eRes, sRes, cRes] = await Promise.all([
        api.get("/api/hr/branches-status").catch(() => null),
        api.get("/api/hr/employees").catch(() => null),
        api.get("/api/suppliers").catch(() => null),
        api.get("/api/customers").catch(() => null)
      ]);
      if (bRes && bRes.ok) setBranches(await bRes.json());
      if (eRes && eRes.ok) setEmployees(await eRes.json());
      if (sRes && sRes.ok) setSuppliersList(await sRes.json());
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        setCustomersList(Array.isArray(cData) ? cData : (cData.customers || []));
      }
    } catch (e) {
      console.error("Error fetching voucher entities:", e);
    } finally {
      setLoadingEntities(false);
    }
  }, []);

  useEffect(() => {
    fetchAllEntities();
  }, [fetchAllEntities]);

  // Fetch Supplier Invoices when a supplier is chosen in payment mode
  useEffect(() => {
    if (selectedSupplier && (newVoucherType === 'cash_out' || voucherForm.client_type === 'supplier')) {
      setLoadingInvoices(true);
      fetch(`/api/purchases?supplier_id=${selectedSupplier.id}`, {
        headers: authHeaders()
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Filter invoices with remaining unpaid amount
            const unpaid = data.filter((p: any) => {
              const total = Number(p.total_amount || 0);
              const paid = Number(p.paid_amount || 0);
              return total - paid > 0.01;
            });
            setSupplierInvoices(unpaid);
          } else {
            setSupplierInvoices([]);
          }
        })
        .catch(err => {
          console.error("Error fetching supplier invoices:", err);
          setSupplierInvoices([]);
        })
        .finally(() => setLoadingInvoices(false));
    } else {
      setSupplierInvoices([]);
      setSelectedInvoiceId("");
      autoFilledAmountRef.current = "";
    }
  }, [selectedSupplier, newVoucherType, voucherForm.client_type]);

  useEffect(() => {
    if (selectedCustomer && newVoucherType === "cash_in" && voucherForm.client_type === "customer") {
      setLoadingInvoices(true);
      api.get("/api/v2/sales/invoices")
        .then(async (res) => {
          if (!res.ok) throw new Error(`تعذر تحميل فواتير العميل (HTTP ${res.status})`);
          const response = await res.json();
          const invoices = Array.isArray(response) ? response : response.data;
          if (!Array.isArray(invoices)) {
            throw new Error("استجابة فواتير المبيعات غير صالحة");
          }
          setCustomerInvoices(invoices.filter((invoice: any) =>
            Number(invoice.customerId) === Number(selectedCustomer.id) &&
            invoice.isPosted &&
            Number(invoice.netAmount) - Number(invoice.paidAmount) > 0.01
          ));
        })
        .catch((error) => {
          console.error("Error fetching customer's unpaid invoices:", error);
          setCustomerInvoices([]);
        })
        .finally(() => setLoadingInvoices(false));
    } else {
      setCustomerInvoices([]);
    }
  }, [selectedCustomer, newVoucherType, voucherForm.client_type]);

  // Fetch Transactions Function
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (filterAccountId !== "all") params.set("accountId", filterAccountId);
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterBranchId !== "all") params.set("branchId", filterBranchId);
      if (filterUserId !== "all") params.set("userId", filterUserId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const url = `/api/treasury/transactions/${filterAccountId}?${params.toString()}`;
      const res = await api.get(url);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          setTransactions(MOCK_TRANSACTIONS);
        }
      } else {
        // Fallback to mock transactions if API returns error
        setTransactions(MOCK_TRANSACTIONS);
      }
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      // Fallback gracefully without crashing the UI
      setTransactions(MOCK_TRANSACTIONS);
    } finally {
      setIsLoading(false);
    }
  }, [filterAccountId, filterType, filterStatus, filterBranchId, filterUserId, startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAccountId, filterType, filterStatus, filterBranchId, filterUserId, startDate, endDate, searchQuery]);

  // سند صرف المرتبات يأتي من مسير مرتبات (reference_type = 'payroll')، فيُعرض
  // معه كشف الموظفين والمستحق لكل موظف بدل أن يبقى مبلغًا إجماليًا فقط.
  const payrollVoucher =
    selectedVoucherForView?.reference_type === "payroll"
      ? selectedVoucherForView
      : selectedVoucherForPrint?.reference_type === "payroll"
        ? selectedVoucherForPrint
        : null;
  const payrollRunId = Number(payrollVoucher?.reference_id || 0) || null;

  useEffect(() => {
    if (!payrollRunId) {
      setPayrollBreakdown(null);
      setPayrollBreakdownStatus("idle");
      return;
    }
    let cancelled = false;
    setPayrollBreakdown(null);
    setPayrollBreakdownStatus("loading");
    api
      .get(`/api/payroll/runs/${payrollRunId}`)
      .then(async (res) => {
        const payload = res.ok ? await res.json().catch(() => null) : null;
        if (cancelled) return;
        const data = payload?.data ?? payload;
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setPayrollBreakdown(data);
          setPayrollBreakdownStatus("idle");
        } else {
          setPayrollBreakdown(null);
          setPayrollBreakdownStatus("error");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error fetching payroll run breakdown:", error);
        setPayrollBreakdown(null);
        setPayrollBreakdownStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [payrollRunId]);

  // Helper formatting dates safely
  const formatDate = (dateVal: any): string => {
    if (!dateVal) return "---";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "---";
    return d.toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Safe transactions array check
  const safeList = Array.isArray(transactions) ? transactions : [];
  const totalPages = Math.max(1, Math.ceil(safeList.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageTransactions = safeList.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);
  const firstVisibleRow = safeList.length ? (currentPageSafe - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(currentPageSafe * pageSize, safeList.length);

  // Calculation of Summary Metrics — بنفس نطاق الرصيد المعروض
  // كان الخلل: الإجماليات تُحسب من كل الخزائن ومن كل أنواع الحركة (بما فيها التحويلات
  // والتسويات)، بينما الرصيد المعروض يخص الخزينة النشطة فقط → فرق دائم.
  const scopedList = selectedAccount
    ? safeList.filter((t: any) => Number(t.account_id) === Number(selectedAccount.id))
    : safeList;

  const isOperating = (t: any) => t && t.status !== "canceled";
  const totalReceipts = scopedList
    .filter((t: any) => isOperating(t) && t.transaction_type === "cash_in" && Number(t.amount || 0) > 0)
    .reduce((sum, t: any) => sum + Number(t.amount || 0), 0);

  const totalPayments = scopedList
    .filter((t: any) => isOperating(t) && t.transaction_type === "cash_out" && Number(t.amount || 0) < 0)
    .reduce((sum, t: any) => sum + Math.abs(Number(t.amount || 0)), 0);

  // الحركة الصافية = مجموع كل الحركات المؤثرة على الرصيد (مقبوضات − مدفوعات + تحويلات + تسويات)
  const adjustmentsTotal = scopedList
    .filter((t: any) => isOperating(t) && t.transaction_type === "adjustment")
    .reduce((sum, t: any) => sum + Number(t.amount || 0), 0);
  const transfersTotal = scopedList
    .filter((t: any) => isOperating(t) && t.transaction_type === "transfer")
    .reduce((sum, t: any) => sum + Number(t.amount || 0), 0);

  const netCashFlow = totalReceipts - totalPayments + adjustmentsTotal + transfersTotal;
  const openingBalance = Number((selectedAccount as any)?.opening_balance || 0);
  const expectedClosing = openingBalance + netCashFlow;
  const approvedCount = scopedList.filter((t: any) => t && t.status === "approved").length;
  const canceledCount = scopedList.filter((t: any) => t && t.status === "canceled").length;

  // Transaction Style Resolver
  const getStyle = (type?: string, amount?: number) => {
    const amt = Number(amount || 0);
    if (type === "cash_in" || amt > 0) {
      return {
        label: "سند قبض / إيداع",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        text: "text-emerald-700",
        sign: "+"
      };
    }
    if (type === "cash_out" || amt < 0) {
      return {
        label: "سند صرف / دفع",
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        text: "text-rose-700",
        sign: ""
      };
    }
    if (type === "transfer") {
      return {
        label: "تحويل بين الخزائن",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        text: "text-blue-700",
        sign: ""
      };
    }
    return {
      label: "تسوية رصيد",
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      text: "text-amber-800",
      sign: ""
    };
  };

  // Handle Cancel / Reverse Transaction
  const handleCancelTx = async (id: number) => {
    if (!window.confirm("هل أنت أكتأكد من رغبتك في إلغاء هذا السند وعكس تأثيره المالي؟")) return;
    try {
      const res = await api.post(`/api/treasury/transactions/${id}/cancel`, {});
      if (res.ok) {
        fetchTransactions();
        if (onRefreshData) onRefreshData();
      } else {
        alert("فشل إلغاء السند");
      }
    } catch (e: any) {
      alert("حدث خطأ أثناء إلغاء السند: " + e.message);
    }
  };

  // Submit New Voucher
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingVoucherRef.current) return;
    if (!voucherForm.amount || Number(voucherForm.amount) <= 0) {
      alert("يرجى إدخال مبلغ صحيح للسند");
      return;
    }

    let finalClientName = voucherForm.client_name;
    if (voucherForm.client_type === 'supplier' && selectedSupplier) {
      finalClientName = selectedSupplier.name;
    } else if (voucherForm.client_type === 'customer' && selectedCustomer) {
      finalClientName = selectedCustomer.name;
    } else if (voucherForm.client_type === 'employee' && selectedEmployee) {
      finalClientName = selectedEmployee.name;
    }

    if (!finalClientName.trim()) {
      alert("يرجى تحديد أو إدخال اسم الطرف المعني بالسند");
      return;
    }

    isSubmittingVoucherRef.current = true;
    setIsSavingVoucher(true);

    try {
      const rawAmt = Number(voucherForm.amount);
      const finalAmt = newVoucherType === "cash_out" ? -Math.abs(rawAmt) : Math.abs(rawAmt);

      const payload = {
        account_id: Number(voucherForm.account_id || (accounts[0]?.id || 1)),
        amount: finalAmt,
        transaction_type: newVoucherType,
        voucher_type: newVoucherType === "cash_in" ? "receipt" : "payment",
        payment_method: voucherForm.payment_method,
        client_type: voucherForm.client_type,
        client_name: finalClientName,
        supplier_id: voucherForm.client_type === 'supplier' ? (selectedSupplier?.id || null) : null,
        customer_id: voucherForm.client_type === 'customer' ? (selectedCustomer?.id || null) : null,
        employee_id: voucherForm.client_type === 'employee' ? (selectedEmployee?.id || null) : null,
        invoice_id: selectedInvoiceId && allocationMode === "invoice" &&
          ((voucherForm.client_type === "supplier" && newVoucherType === "cash_out") ||
           (voucherForm.client_type === "customer" && newVoucherType === "cash_in"))
          ? Number(selectedInvoiceId)
          : null,
        notes: voucherForm.notes,
        tax_amount: Number(voucherForm.tax_amount || 0),
        discount_amount: Number(voucherForm.discount_amount || 0),
        idempotency_key: crypto.randomUUID()
      };

      const res = await fetch("/api/treasury/transactions", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowNewVoucherModal(false);
        setSelectedSupplier(null);
        setSelectedCustomer(null);
        setSelectedEmployee(null);
        setSelectedInvoiceId("");
        autoFilledAmountRef.current = "";
        setPartySearchQuery("");
        setVoucherForm({
          account_id: accounts[0] ? String(accounts[0].id) : "",
          amount: "",
          payment_method: "cash",
          client_type: "supplier",
          client_name: "",
          notes: "",
          tax_amount: "0",
          discount_amount: "0"
        });
        fetchTransactions();
        fetchAllEntities();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json();
        alert(err.message || err.error || "فشل تسجيل السند المالي");
      }
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء تسجيل السند");
    } finally {
      isSubmittingVoucherRef.current = false;
      setIsSavingVoucher(false);
    }
  };

  // كشف الموظفين داخل سند صرف المرتبات — يُستخدم في نافذة التفاصيل وفي الطباعة.
  const renderPayrollBreakdown = (compact = false) => {
    if (!payrollVoucher) return null;
    if (payrollBreakdownStatus === "loading") {
      return (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> جاري تحميل كشف الموظفين...
        </div>
      );
    }
    if (payrollBreakdownStatus === "error" || !payrollBreakdown) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
          تعذر تحميل كشف الموظفين لهذا المسير. المبلغ المصروف صحيح، لكن تفاصيل الموظفين غير متاحة الآن.
        </div>
      );
    }

    const items: any[] = Array.isArray(payrollBreakdown.items) ? payrollBreakdown.items : [];
    const totalNet = Number(
      payrollBreakdown.total_net ?? items.reduce((sum, item) => sum + Number(item.net_salary || 0), 0),
    );
    const totalPaid = Number(payrollBreakdown.total_paid || 0);
    const remaining = Number(payrollBreakdown.remaining ?? Math.max(0, totalNet - totalPaid));
    const runLabel = payrollBreakdown.run_number || `#${payrollBreakdown.id}`;

    return (
      <div className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-black text-indigo-900">
            كشف مرتبات المسير {runLabel} — {payrollBreakdown.period || ""}
          </span>
          <span className="font-bold text-slate-600">
            {items.length} موظف · مستحق {totalNet.toLocaleString("en-US", { minimumFractionDigits: 2 })} · مصروف{" "}
            {totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })} · متبقي{" "}
            {remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-indigo-100 bg-white">
          <table className="w-full text-right border-collapse text-[11px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">الموظف</th>
                <th className="p-2">الكود</th>
                {!compact && <th className="p-2">الأساسي</th>}
                {!compact && <th className="p-2">إضافات / بدلات</th>}
                {!compact && <th className="p-2">استقطاعات</th>}
                <th className="p-2">المستحق (صافي)</th>
                <th className="p-2">المصروف له</th>
                {!compact && <th className="p-2">المتبقي له</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {items.map((item: any, index: number) => (
                <tr key={`${item.employee_id}-${index}`} className="hover:bg-slate-50">
                  <td className="p-2 text-slate-400">{index + 1}</td>
                  <td className="p-2 font-bold text-slate-900">{item.employee_name || `موظف #${item.employee_id}`}</td>
                  <td className="p-2 font-mono text-slate-500">{item.employee_code || "—"}</td>
                  {!compact && (
                    <td className="p-2 text-slate-700">
                      {Number(item.basic_salary || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {!compact && (
                    <td className="p-2 text-emerald-700">
                      {Number(item.additions || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {!compact && (
                    <td className="p-2 text-rose-600">
                      {Number(item.deductions || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="p-2 font-black text-indigo-900">
                    {Number(item.net_salary || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                  </td>
                  <td className="p-2 font-black text-emerald-700">
                    {Number(item.paid_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                  </td>
                  {!compact && (
                    <td className="p-2 font-bold text-rose-600">
                      {Number(
                        item.remaining_amount ??
                          Math.max(0, Number(item.net_salary || 0) - Number(item.paid_amount || 0)),
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                      ج.م
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-black text-slate-800">
              <tr>
                <td className="p-2" colSpan={compact ? 3 : 6}>
                  إجمالي المستحق لكل الموظفين
                </td>
                <td className="p-2 text-indigo-900">
                  {totalNet.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                </td>
                <td className="p-2 text-emerald-700">
                  {totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                </td>
                {!compact && (
                  <td className="p-2 text-rose-600">
                    {remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[10px] font-bold text-slate-500">
          المصروف للمسير {totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
          {remaining > 0.004 ? " — المسير مصروف جزئيًا ولم تُسدد باقي المستحقات بعد" : " — المسير مصروف بالكامل"}
        </p>
      </div>
    );
  };

  return (
    <div id="treasury-transactions-module" className="space-y-6 text-right font-sans">
      {/* 1. Header & Primary Action Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                حركات الخزينة / السندات والحركات المالية
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                  {safeList.length} حركة مسجلة
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                عرض وإدارة كافة سندات القبض والدفع والتحويلات والتسويات المالية مع التتبع التراكمي للأرصدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => fetchTransactions()}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
              تحديث البيانات
            </button>

            <button
              type="button"
              onClick={() => {
                setNewVoucherType("cash_in");
                setShowNewVoucherModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <ArrowDownLeft className="w-4 h-4" />
              سند قبض / إيداع جديد
            </button>

            <button
              type="button"
              onClick={() => {
                setNewVoucherType("cash_out");
                setShowNewVoucherModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-rose-600/20"
            >
              <ArrowUpRight className="w-4 h-4" />
              سند صرف / دفع جديد
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Statistical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receipts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>إجمالي المقبوضات (إيداعات)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">
            +{totalReceipts.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-400">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            سندات قبض معتمدة {selectedAccount ? `— ${selectedAccount.name}` : "— كل الخزائن"}
          </p>
        </div>

        {/* Total Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>إجمالي المدفوعات (مصروفات)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700">
            -{totalPayments.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-400">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            سندات صرف معتمدة {selectedAccount ? `— ${selectedAccount.name}` : "— كل الخزائن"}
          </p>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>صافي الحركة للفترة</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className={`text-2xl font-black ${netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {netCashFlow >= 0 ? "+" : ""}{netCashFlow.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-400">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {`رصيد أول الفترة ${openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} + الحركة = ${expectedClosing.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            {(adjustmentsTotal !== 0 || transfersTotal !== 0)
              ? ` · تحويلات ${transfersTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} / تسويات ${adjustmentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : ""}
          </p>
        </div>

        {/* Vouchers Status Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>حالات السندات المئوية</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <div className="text-center">
              <div className="text-lg font-black text-emerald-700">{approvedCount}</div>
              <div className="text-[10px] text-slate-400 font-bold">معتمدة</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <div className="text-lg font-black text-rose-600">{canceledCount}</div>
              <div className="text-[10px] text-slate-400 font-bold">ملغاة</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <div className="text-lg font-black text-slate-700">{scopedList.length}</div>
              <div className="text-[10px] text-slate-400 font-bold">إجمالي السجلات</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Advanced Filter Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            شريط البحث والفلترة المتقدمة
          </h3>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterAccountId("all");
              setFilterType("all");
              setFilterStatus("all");
              setFilterBranchId("all");
              setFilterUserId("all");
              setStartDate("");
              setEndDate("");
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition"
          >
            إعادة ضبط الفلاتر
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Search Text */}
          <div className="xl:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث برقم السند / بيان / طرف</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث هنا..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Treasury Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">الخزينة / الحساب</label>
            <select
              value={filterAccountId}
              onChange={(e) => {
                setFilterAccountId(e.target.value);
                if (onSelectAccount && e.target.value !== "all") {
                  const matched = accounts.find(a => String(a.id) === e.target.value);
                  if (matched) onSelectAccount(matched);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="all">كافة الخزائن والحسابات</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency || "EGP"})
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع الحركة</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="all">كافة أنواع الحركات</option>
              <option value="cash_in">سندات القبض والإيداع</option>
              <option value="cash_out">سندات الصرف والدفع</option>
              <option value="transfer">التحويلات البينية</option>
              <option value="adjustment">التسويات النقدية</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">حالة السند</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="all">كافة الحالات</option>
              <option value="approved">معتمدة فقط</option>
              <option value="canceled">ملغاة فقط</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 4. Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-600">جاري تحميل حركات السندات والبيانات المالية...</p>
          </div>
        ) : safeList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">لا توجد حركات مالية مسجلة تتطابق مع شروط البحث</p>
            <p className="text-xs">جرّب تغيير خيارات الفلترة أو قم بتسجيل سند جديد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-3.5">رقم السند</th>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">نوع الحركة</th>
                  <th className="p-3.5">الخزينة / الحساب</th>
                  <th className="p-3.5">الطرف الآخر (العميل/المستفيد)</th>
                  <th className="p-3.5 max-w-[200px]">البيان / الوصف</th>
                  <th className="p-3.5">المبلغ والعملة</th>
                  <th className="p-3.5">الرصيد بعدها</th>
                  <th className="p-3.5">المستخدم</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {pageTransactions.map((tx) => {
                  const style = getStyle(tx.transaction_type, tx.amount);
                  const isCanceled = tx.status === "canceled";
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50 transition ${isCanceled ? "opacity-60 bg-slate-50/50" : ""}`}
                    >
                      {/* Voucher Number */}
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-slate-900">
                          {tx.voucher_number || `TX-${tx.id}`}
                        </div>
                        {tx.reference_type === "payroll" && (
                          <span className="mt-0.5 inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                            صرف مرتبات
                          </span>
                        )}
                        {isCanceled && (
                          <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            ملغى
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {formatDate(tx.created_at)}
                      </td>

                      {/* Type Badge */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${style.badge}`}>
                          {style.label}
                        </span>
                      </td>

                      {/* Account Name */}
                      <td className="p-3.5 font-bold text-slate-800">
                        {tx.account_name || `خزينة #${tx.account_id}`}
                      </td>

                      {/* Beneficiary / Client Name */}
                      <td className="p-3.5">
                        {tx.client_name ? (
                          <div>
                            <div className="font-bold text-slate-900">{tx.client_name}</div>
                            {tx.client_type && (
                              <div className="text-[10px] text-slate-400">
                                {tx.client_type === "customer"
                                  ? "عميل"
                                  : tx.client_type === "supplier"
                                  ? "مورد"
                                  : tx.client_type === "employee"
                                  ? "موظف"
                                  : "جهة خارجية"}
                              </div>
                            )}
                            {(tx.sales_invoice_number || tx.purchase_invoice_number) && (
                              <div className="text-[10px] text-indigo-600 font-semibold">
                                فاتورة #{tx.sales_invoice_number || tx.purchase_invoice_number}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">---</span>
                        )}
                      </td>

                      {/* Notes / Description */}
                      <td className="p-3.5 text-slate-700 max-w-[200px] truncate" title={tx.notes || ""}>
                        {tx.notes || "حركة مالية اعتيادية"}
                      </td>

                      {/* Amount */}
                      <td className={`p-3.5 font-black text-sm ${style.text}`}>
                        {style.sign}{Number(tx.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                      </td>

                      {/* Running Balance */}
                      <td className="p-3.5 font-bold text-indigo-950">
                        {Number(tx.balance_after || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
                      </td>

                      {/* User */}
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {tx.user_name || "النظام"}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedVoucherForView(tx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="عرض تفاصيل السند"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedVoucherForPrint(tx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="طباعة السند"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {!isCanceled && (
                            <button
                              type="button"
                              onClick={() => handleCancelTx(tx.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="إلغاء السند وعكس القيد"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && safeList.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <label htmlFor="treasury-page-size">عدد الحركات في الصفحة</label>
              <select
                id="treasury-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-500">
                عرض {firstVisibleRow}–{lastVisibleRow} من {safeList.length} حركة
              </span>
            </div>
            <div className="flex items-center gap-1" aria-label="صفحات الحركات">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPageSafe === 1}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="الصفحة الأولى"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPageSafe === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                السابقة
              </button>
              <span className="min-w-24 px-2 text-center text-xs font-bold text-slate-700">
                صفحة {currentPageSafe} من {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPageSafe === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                التالية
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPageSafe === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="الصفحة الأخيرة"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. View Details Modal */}
      {selectedVoucherForView && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in duration-200 text-right ${selectedVoucherForView.reference_type === "payroll" ? "max-w-4xl" : "max-w-lg"}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تفاصيل السند المالي</h3>
                  <p className="text-xs text-slate-400">{selectedVoucherForView.voucher_number || `#${selectedVoucherForView.id}`}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForView(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs divide-y divide-slate-100">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">نوع الحركة:</span>
                <span className="font-bold text-slate-800">{getStyle(selectedVoucherForView.transaction_type, selectedVoucherForView.amount).label}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">الخزينة:</span>
                <span className="font-bold text-slate-900">{selectedVoucherForView.account_name || selectedVoucherForView.account_id}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">المبلغ:</span>
                <span className="font-black text-sm text-indigo-700">{Math.abs(selectedVoucherForView.amount).toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">الطرف المستفيد:</span>
                <span className="font-bold text-slate-800">{selectedVoucherForView.client_name || "---"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">طريقة الدفع:</span>
                <span className="font-bold text-slate-800">{selectedVoucherForView.payment_method}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">الرصيد بعد الحركة:</span>
                <span className="font-bold text-slate-900">{Number(selectedVoucherForView.balance_after || 0).toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">تاريخ التسجيل:</span>
                <span className="font-bold text-slate-700">{formatDate(selectedVoucherForView.created_at)}</span>
              </div>
              <div className="py-2 space-y-1">
                <span className="text-slate-500 block">البيان والملحوظات:</span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-800 font-medium">{selectedVoucherForView.notes || "لا توجد ملحوظات إضافية"}</p>
              </div>
            </div>

            {selectedVoucherForView.reference_type === "payroll" && renderPayrollBreakdown()}

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const v = selectedVoucherForView;
                  setSelectedVoucherForView(null);
                  setSelectedVoucherForPrint(v);
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800"
              >
                <Printer className="w-3.5 h-3.5" /> طباعة السند
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Printable Voucher Modal */}
      {selectedVoucherForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl w-full p-8 space-y-6 border border-slate-200 shadow-2xl text-right animate-in zoom-in-95 duration-150 ${selectedVoucherForPrint.reference_type === "payroll" ? "max-w-5xl" : "max-w-2xl"}`}>
            {/* Printable Voucher Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">نظام إدارة الخزائن والمصروفات</h2>
                <p className="text-xs text-slate-500">شركة السويس للتجارة والتوزيع — REMO PRO ERP</p>
              </div>
              <div className="text-left">
                <div className="text-base font-black text-indigo-700">
                  {getStyle(selectedVoucherForPrint.transaction_type, selectedVoucherForPrint.amount).label}
                </div>
                <div className="text-xs font-mono font-bold text-slate-500">
                  {selectedVoucherForPrint.voucher_number || `VOUCH-${selectedVoucherForPrint.id}`}
                </div>
              </div>
            </div>

            {/* Voucher Body Details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-bold">التاريخ:</span>
                <span className="font-bold text-slate-900">{formatDate(selectedVoucherForPrint.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">الخزينة / الحساب:</span>
                <span className="font-bold text-slate-900">{selectedVoucherForPrint.account_name || `خزينة #${selectedVoucherForPrint.account_id}`}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">استلمنا من / صرفنا إلى:</span>
                <span className="font-bold text-slate-900 text-sm">{selectedVoucherForPrint.client_name || "---"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">طريقة الدفع:</span>
                <span className="font-bold text-slate-900">{selectedVoucherForPrint.payment_method === "cash" ? "نقداً" : "بنكي / إلكتروني"}</span>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-center space-y-1">
              <span className="text-xs font-bold text-indigo-900">المبلغ الإجمالي المقيد:</span>
              <div className="text-3xl font-black text-indigo-950">
                {Math.abs(selectedVoucherForPrint.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} جنيه مصري
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-500">البيان / السبب:</span>
              <p className="p-3 bg-slate-100 rounded-xl font-semibold text-slate-800">{selectedVoucherForPrint.notes || "---"}</p>
            </div>

            {selectedVoucherForPrint.reference_type === "payroll" && renderPayrollBreakdown(true)}

            {/* Signatures Footer */}
            <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs font-bold text-slate-600 border-t border-slate-200">
              <div className="space-y-6">
                <p>أمين الخزينة</p>
                <div className="h-0.5 bg-slate-300 w-24 mx-auto" />
              </div>
              <div className="space-y-6">
                <p>المستلم / المستفيد</p>
                <div className="h-0.5 bg-slate-300 w-24 mx-auto" />
              </div>
              <div className="space-y-6">
                <p>المراجع المالي</p>
                <div className="h-0.5 bg-slate-300 w-24 mx-auto" />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedVoucherForPrint(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إغلاق النافذة
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Printer className="w-4 h-4" /> طباعة هذا السند الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. New Voucher Modal with Supplier / Customer / Employee Integration */}
      {showNewVoucherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVoucher}
            dir="rtl"
            className="bg-white rounded-3xl w-full max-w-4xl border border-slate-200 shadow-2xl shadow-slate-900/10 text-right flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* ── Header: type accent + voucher identity ── */}
            <div className={`relative px-6 pt-5 pb-4 border-b bg-gradient-to-l via-white to-white ${isReceipt ? "from-emerald-50 border-emerald-100" : "from-rose-50 border-rose-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${voucherAccent.icon}`}>
                    {isReceipt ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900 leading-tight">
                        {isReceipt ? "إصدار سند قبض / تحصيل نقدي" : "إصدار سند صرف / دفع"}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${voucherAccent.chip}`}>
                        {isReceipt ? "قبض" : "صرف"}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">
                      {isReceipt
                        ? "تحصيل نقدي أو بنكي من عميل أو جهة، مع ربط مباشر بالخزينة والحسابات."
                        : "صرف نقدي لمورد أو مستحق أو مصروف، مع ربط مباشر بالخزينة والحسابات."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewVoucherModal(false)}
                  disabled={isSavingVoucher}
                  className="w-9 h-9 rounded-xl bg-white/80 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-white hover:text-slate-800 transition-colors disabled:opacity-50"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono tabular-nums">{voucherPreviewNo}</span>
                  <span className="text-[9px] font-bold text-slate-400">مبدئي</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  {voucherDateLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {voucherTimeLabel}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
              {draftAvailable && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                  <span className="text-[11px] font-bold text-amber-800">لديك مسودة سند محفوظة على هذا الجهاز</span>
                  <button
                    type="button"
                    onClick={restoreVoucherDraft}
                    className="shrink-0 rounded-lg bg-white border border-amber-300 px-2.5 py-1 text-[10.5px] font-black text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    استعادة المسودة
                  </button>
                </div>
              )}

              {/* ── Row 1: account + amount ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                    <Wallet className="w-3.5 h-3.5" />
                    الخزينة / الحساب المعني <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={voucherForm.account_id}
                      onChange={(e) => setVoucherForm(prev => ({ ...prev, account_id: e.target.value }))}
                      className={`w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-900 outline-none transition-all hover:border-slate-300 focus:bg-white focus:ring-4 ${voucherAccent.ring}`}
                      required
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                    <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedAccountBalance >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                      الرصيد المتوفر
                    </span>
                    <span className={`text-sm font-black tabular-nums ${selectedAccountBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {fmtMoney(selectedAccountBalance)} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                    <DollarSign className="w-3.5 h-3.5" />
                    المبلغ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      value={voucherForm.amount}
                      onChange={(e) => setVoucherForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-14 pr-4 py-3 text-2xl font-black tabular-nums tracking-tight text-slate-900 outline-none transition-all placeholder:text-slate-300 hover:border-slate-300 focus:bg-white focus:ring-4 ${voucherAccent.ring}`}
                      required
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400">ج.م</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      selectedPartyBalance > 0 ? { label: `كامل المستحق ${fmtMoney(selectedPartyBalance)}`, value: selectedPartyBalance } : null,
                      selectedAccountBalance > 0 ? { label: `كامل الرصيد ${fmtMoney(selectedAccountBalance)}`, value: selectedAccountBalance } : null,
                      selectedAccountBalance > 0 ? { label: "النصف", value: Math.round(selectedAccountBalance / 2) } : null,
                    ]
                      .filter((quick): quick is { label: string; value: number } => quick !== null)
                      .map((quick) => (
                        <button
                          key={quick.label}
                          type="button"
                          onClick={() => setVoucherForm(prev => ({ ...prev, amount: String(quick.value) }))}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                          {quick.label}
                        </button>
                      ))}
                    {Number(voucherForm.amount) > 0 && (
                      <button
                        type="button"
                        onClick={() => setVoucherForm(prev => ({ ...prev, amount: "" }))}
                        className="rounded-lg px-2 py-1 text-[10px] font-black text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        تفريغ
                      </button>
                    )}
                  </div>
                  <p className="text-[10.5px] font-bold text-slate-400 tabular-nums">
                    {Number(voucherForm.amount) > 0
                      ? `المبلغ المسجّل: ${fmtMoney(Number(voucherForm.amount))} ج.م`
                      : "أدخل المبلغ يدويًا أو اختر أحد المقترحات"}
                  </p>
                </div>
              </div>
              {/* ── Row 2: party type ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    نوع الطرف المرتبط <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">اختر النوع ثم حدّد الجهة بالبحث</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl bg-slate-100/90 p-1.5">
                  {([
                    { key: "supplier", label: "مورد", icon: Building2 },
                    { key: "customer", label: "عميل", icon: User },
                    { key: "employee", label: "موظف", icon: Briefcase },
                    { key: "other", label: "جهة أخرى", icon: Layers },
                  ] as const).map((party) => {
                    const PartyIcon = party.icon;
                    const active = voucherForm.client_type === party.key;
                    return (
                      <button
                        key={party.key}
                        type="button"
                        onClick={() => {
                          setVoucherForm(prev => ({ ...prev, client_type: party.key, client_name: "" }));
                          setSelectedSupplier(null);
                          setSelectedCustomer(null);
                          setSelectedEmployee(null);
                          setPartySearchQuery("");
                          setIsPartyDropdownOpen(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition-all ${
                          active ? voucherAccent.toggleActive : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <PartyIcon className="w-4 h-4" />
                        {party.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Entity Selection & Autocomplete */}
              {voucherForm.client_type === "supplier" && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    اختر المورد المعني *
                  </label>
                  {!selectedSupplier ? (
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={partySearchQuery}
                          onChange={(e) => {
                            setPartySearchQuery(e.target.value);
                            setIsPartyDropdownOpen(true);
                          }}
                          onFocus={() => setIsPartyDropdownOpen(true)}
                          placeholder="ابحث بالاسم، كود المورد أو الهاتف..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      </div>

                      {isPartyDropdownOpen && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {suppliersList
                            .filter(s => {
                              if (!partySearchQuery.trim()) return true;
                              const q = partySearchQuery.toLowerCase();
                              return (
                                s.name?.toLowerCase().includes(q) ||
                                s.supplier_code?.toLowerCase().includes(q) ||
                                s.phone?.includes(q)
                              );
                            })
                            .slice(0, 15)
                            .map(sup => (
                              <button
                                key={sup.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSupplier(sup);
                                  setVoucherForm(prev => ({ ...prev, client_name: sup.name }));
                                  setIsPartyDropdownOpen(false);
                                  setPartySearchQuery("");
                                }}
                                className="w-full text-right p-3 hover:bg-slate-100 flex items-center justify-between transition-colors"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                    {sup.name}
                                    {sup.supplier_code && (
                                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                        {sup.supplier_code}
                                      </span>
                                    )}
                                  </div>
                                  {sup.phone && <div className="text-[10px] text-slate-400 mt-0.5">{sup.phone}</div>}
                                </div>
                                <div className="text-left">
                                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                                    Number(sup.balance || 0) > 0 
                                      ? "bg-rose-50 text-rose-700 border border-rose-200" 
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}>
                                    {Number(sup.balance || 0).toLocaleString()} ج.م
                                  </span>
                                  <div className="text-[9px] text-slate-400 mt-0.5">الرصيد المستحق</div>
                                </div>
                              </button>
                            ))}
                          {suppliersList.length === 0 && (
                            <div className="p-4 text-center text-slate-400 text-xs">لا يوجد موردين مسجلين</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-black text-slate-900 text-xs flex items-center gap-2">
                            {selectedSupplier.name}
                            {selectedSupplier.supplier_code && (
                              <span className="bg-white border border-slate-200 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">
                                {selectedSupplier.supplier_code}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>الرصيد المستحق:</span>
                            <span className={`font-black ${Number(selectedSupplier.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {Number(selectedSupplier.balance || 0).toLocaleString()} ج.م
                            </span>
                            {selectedSupplier.phone && <span className="text-slate-400">| {selectedSupplier.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplier(null);
                          setSelectedInvoiceId("");
                          autoFilledAmountRef.current = "";
                          setVoucherForm(prev => ({ ...prev, client_name: "" }));
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold bg-white px-2.5 py-1.5 rounded-xl border border-rose-200 shadow-2xs"
                      >
                        تغيير
                      </button>
                    </div>
                  )}

                  {/* Supplier Invoices Linking in Payment Mode */}
                  {selectedSupplier && newVoucherType === "cash_out" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px]">تخصيص الدفعة للمورد:</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                            <input
                              type="radio"
                              name="allocMode"
                              checked={allocationMode === 'general'}
                              onChange={() => {
                                setAllocationMode('general');
                                setSelectedInvoiceId("");
                                autoFilledAmountRef.current = "";
                              }}
                            />
                            دفعة عامة على الحساب
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                            <input
                              type="radio"
                              name="allocMode"
                              checked={allocationMode === 'invoice'}
                              onChange={() => setAllocationMode('invoice')}
                            />
                            سداد فاتورة مشتريات محددة
                          </label>
                        </div>
                      </div>

                      {allocationMode === 'invoice' && (
                        <div>
                          {loadingInvoices ? (
                            <div className="text-xs text-slate-400 py-1">جاري تحميل فواتير المشتريات المستحقة...</div>
                          ) : supplierInvoices.length > 0 ? (
                            <select
                              value={selectedInvoiceId}
                              onChange={(e) => {
                                const invId = e.target.value;
                                setSelectedInvoiceId(invId);
                                const inv = supplierInvoices.find((i: any) => String(i.id) === invId);
                                setVoucherForm(prev => {
                                  const next = { ...prev };
                                  if (inv) {
                                    const remaining = Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));
                                    const typed = String(prev.amount || "").trim();
                                    // Pre-fill the full remaining only when the field is empty or still
                                    // holds our previous auto-fill. A partial amount the user typed is kept.
                                    if (!typed || Number(typed) <= 0 || typed === autoFilledAmountRef.current) {
                                      next.amount = String(remaining);
                                      autoFilledAmountRef.current = String(remaining);
                                    }
                                    next.notes = `سداد فاتورة مشتريات #${inv.invoice_number || inv.id} للمورد ${selectedSupplier?.name || ""}`.trim();
                                  }
                                  return next;
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                            >
                              <option value="">-- اختر فاتورة المشتريات المراد سدادها --</option>
                              {supplierInvoices.map((inv: any) => {
                                const remaining = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
                                return (
                                  <option key={inv.id} value={inv.id}>
                                    فاتورة #{inv.invoice_number || inv.id} | الإجمالي: {Number(inv.total_amount).toLocaleString()} ج.م | المتبقي: {remaining.toLocaleString()} ج.م ({new Date(inv.date || inv.created_at).toLocaleDateString('ar-EG')})
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                              لا توجد فواتير مشتريات آجلة غير مسددة مسجلة لهذا المورد. سيتم تسجيل السند كدفعة عامة على الحساب.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Customer Autocomplete */}
              {voucherForm.client_type === "customer" && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">اختر العميل المعني *</label>
                  {!selectedCustomer ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={partySearchQuery}
                        onChange={(e) => {
                          setPartySearchQuery(e.target.value);
                          setIsPartyDropdownOpen(true);
                        }}
                        onFocus={() => setIsPartyDropdownOpen(true)}
                        placeholder="ابحث باسم العميل أو رقم الهاتف..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                      />
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />

                      {isPartyDropdownOpen && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {customersList
                            .filter(c => {
                              if (!partySearchQuery.trim()) return true;
                              const q = partySearchQuery.toLowerCase();
                              return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
                            })
                            .slice(0, 15)
                            .map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setVoucherForm(prev => ({ ...prev, client_name: c.name }));
                                  setSelectedInvoiceId("");
                                  setAllocationMode("general");
                                  autoFilledAmountRef.current = "";
                                  setIsPartyDropdownOpen(false);
                                  setPartySearchQuery("");
                                }}
                                className="w-full text-right p-3 hover:bg-slate-100 flex items-center justify-between transition-colors"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{c.name}</div>
                                  {c.phone && <div className="text-[10px] text-slate-400">{c.phone}</div>}
                                </div>
                                {c.total_spent !== undefined && (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                      إجمالي المبيعات: {Number(c.sales_total_spent ?? c.total_spent ?? 0).toLocaleString()} ج.م
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                      المتبقي على الحساب: {Number(c.balance || 0).toLocaleString()} ج.م
                                    </span>
                                  </div>
                                )}
                              </button>
                            ))}
                          {customersList.length === 0 && (
                            <div className="p-4 text-center text-slate-400 text-xs">لا يوجد عملاء مسجلين</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-black text-slate-900 text-xs">{selectedCustomer.name}</div>
                          {selectedCustomer.phone && (
                            <div className="text-[10px] text-slate-500">{selectedCustomer.phone}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setSelectedInvoiceId("");
                          setAllocationMode("general");
                          autoFilledAmountRef.current = "";
                          setVoucherForm(prev => ({ ...prev, client_name: "" }));
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold bg-white px-2.5 py-1.5 rounded-xl border border-rose-200 shadow-2xs"
                      >
                        تغيير
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer && voucherForm.client_type === "customer" && newVoucherType === "cash_in" && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-800 text-[11px]">تخصيص التحصيل:</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                        <input
                          type="radio"
                          name="customerReceiptAllocation"
                          checked={allocationMode === "general"}
                          onChange={() => {
                            setAllocationMode("general");
                            setSelectedInvoiceId("");
                            autoFilledAmountRef.current = "";
                          }}
                        />
                        تحصيل عام على الحساب
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                        <input
                          type="radio"
                          name="customerReceiptAllocation"
                          checked={allocationMode === "invoice"}
                          onChange={() => setAllocationMode("invoice")}
                        />
                        سداد فاتورة مبيعات محددة
                      </label>
                    </div>
                  </div>

                  {allocationMode === "invoice" && (
                    loadingInvoices ? (
                      <div className="text-xs text-slate-400 py-1">جاري تحميل فواتير العميل المستحقة...</div>
                    ) : customerInvoices.length > 0 ? (
                      <select
                        value={selectedInvoiceId}
                        onChange={(event) => {
                          const invoiceId = event.target.value;
                          setSelectedInvoiceId(invoiceId);
                          const invoice = customerInvoices.find((item: any) => String(item.id) === invoiceId);
                          setVoucherForm((previous) => {
                            const next = { ...previous };
                            if (invoice) {
                              const remaining = Math.max(
                                0,
                                Number(invoice.netAmount || 0) - Number(invoice.paidAmount || 0),
                              );
                              const typedAmount = String(previous.amount || "").trim();
                              if (!typedAmount || Number(typedAmount) <= 0 || typedAmount === autoFilledAmountRef.current) {
                                next.amount = String(remaining);
                                autoFilledAmountRef.current = String(remaining);
                              }
                              next.notes = `تحصيل فاتورة مبيعات #${invoice.invoiceNo || invoice.id} من العميل ${selectedCustomer.name}`;
                            }
                            return next;
                          });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="">-- اختر فاتورة المبيعات المراد تحصيلها --</option>
                        {customerInvoices.map((invoice: any) => {
                          const remaining = Number(invoice.netAmount || 0) - Number(invoice.paidAmount || 0);
                          return (
                            <option key={invoice.id} value={invoice.id}>
                              فاتورة #{invoice.invoiceNo || invoice.id} | الإجمالي: {Number(invoice.netAmount || 0).toLocaleString()} ج.م | المدفوع: {Number(invoice.paidAmount || 0).toLocaleString()} ج.م | المتبقي: {remaining.toLocaleString()} ج.م
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                        لا توجد فواتير مبيعات آجلة مستحقة لهذا العميل.
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Employee Autocomplete */}
              {voucherForm.client_type === "employee" && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">اختر الموظف المعني *</label>
                  {!selectedEmployee ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={partySearchQuery}
                        onChange={(e) => {
                          setPartySearchQuery(e.target.value);
                          setIsPartyDropdownOpen(true);
                        }}
                        onFocus={() => setIsPartyDropdownOpen(true)}
                        placeholder="ابحث باسم الموظف أو الوظيفة..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                      />
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />

                      {isPartyDropdownOpen && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {employees
                            .filter(emp => {
                              if (!partySearchQuery.trim()) return true;
                              const q = partySearchQuery.toLowerCase();
                              return emp.name?.toLowerCase().includes(q);
                            })
                            .slice(0, 15)
                            .map(emp => (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setVoucherForm(prev => ({ ...prev, client_name: emp.name }));
                                  setIsPartyDropdownOpen(false);
                                  setPartySearchQuery("");
                                }}
                                className="w-full text-right p-3 hover:bg-slate-100 flex items-center justify-between transition-colors"
                              >
                                <div className="font-bold text-slate-900 text-xs">{emp.name}</div>
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  كود #{emp.id}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-black text-slate-900 text-xs">{selectedEmployee.name}</div>
                          <div className="text-[10px] text-slate-500">كود الموظف #{selectedEmployee.id}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(null);
                          setVoucherForm(prev => ({ ...prev, client_name: "" }));
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold bg-white px-2.5 py-1.5 rounded-xl border border-rose-200 shadow-2xs"
                      >
                        تغيير
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Other / Custom Payee */}
              {voucherForm.client_type === "other" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الطرف / بند المصروف أو الجهة المستفيدة *</label>
                  <input
                    type="text"
                    value={voucherForm.client_name}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="مثال: مصاريف صيانة، إيجار، فواتير كهرباء..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                    required
                  />
                </div>
              )}

              {/* ── Row 3: payment method + adjustments ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                    <CreditCard className="w-3.5 h-3.5" />
                    طريقة الدفع / التحصيل
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: "cash", label: "نقداً كاش", icon: Banknote },
                      { key: "bank", label: "تحويل بنكي", icon: Landmark },
                      { key: "check", label: "شيك", icon: FileCheck2 },
                      { key: "electronic", label: "شبكة / مدى", icon: CreditCard },
                    ] as const).map((method) => {
                      const MethodIcon = method.icon;
                      const active = voucherForm.payment_method === method.key;
                      return (
                        <button
                          key={method.key}
                          type="button"
                          onClick={() => setVoucherForm(prev => ({ ...prev, payment_method: method.key }))}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-black transition-all ${
                            active
                              ? `${voucherAccent.chip} border`
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
                          }`}
                        >
                          <MethodIcon className="w-4 h-4" />
                          {method.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-slate-500">ضريبة مضافة</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={voucherForm.tax_amount}
                        onChange={(e) => setVoucherForm(prev => ({ ...prev, tax_amount: e.target.value }))}
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-3 py-3 text-sm font-black tabular-nums text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 ${voucherAccent.ring}`}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">ج.م</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-slate-500">خصم</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={voucherForm.discount_amount}
                        onChange={(e) => setVoucherForm(prev => ({ ...prev, discount_amount: e.target.value }))}
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-3 py-3 text-sm font-black tabular-nums text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 ${voucherAccent.ring}`}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">ج.م</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Row 4: description ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                    <FileText className="w-3.5 h-3.5" />
                    البيان / الوصف التفصيلي <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold tabular-nums text-slate-400">{voucherForm.notes.length}/250</span>
                </div>
                <textarea
                  value={voucherForm.notes}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="اكتب بيان السند المالي — مثال: سداد دفعة من مستحقات المورد عن فاتورة مشتريات رقم ..."
                  rows={3}
                  maxLength={250}
                  className={`w-full resize-y bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium leading-6 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-4 ${voucherAccent.ring}`}
                  required
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "تحصيل دفعة", text: "تحصيل دفعة نقدية من العميل" },
                    { label: "سداد مورد", text: "سداد مستحقات المورد" },
                    { label: "مصروف تشغيلي", text: "مصروف تشغيلي" },
                    { label: "عهدة", text: "صرف عهدة نقدية" },
                  ].map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => setVoucherForm(prev => ({ ...prev, notes: template.text }))}
                      className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewVoucherModal(false)}
                  disabled={isSavingVoucher}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled
                  title="الطباعة متاحة بعد حفظ السند وظهوره في السجل"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black text-slate-400 opacity-60 cursor-not-allowed"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة السند
                </button>
                <button
                  type="button"
                  onClick={saveVoucherDraft}
                  disabled={isSavingVoucher}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ كمسودة
                </button>
              </div>

              <div className="flex items-center gap-3 justify-end">
                {draftNotice && (
                  <span className="text-[10px] font-bold text-emerald-700">{draftNotice}</span>
                )}
                <button
                  type="submit"
                  disabled={isSavingVoucher}
                  className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${voucherAccent.solid}`}
                >
                  {isSavingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isSavingVoucher ? "جارٍ حفظ وإصدار السند..." : "حفظ وإصدار السند الآن"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TreasuryTransactionsEnterprise;
