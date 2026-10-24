import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  ChevronLeft,
  Calculator,
  Plus,
  Search,
  FileText,
  History,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Download,
  Printer,
  X,
  Save,
  AlertCircle,
  FolderTree,
  BookOpen,
  Trash2,
  Copy,
  Paperclip,
  Check,
  ChevronDown,
  RotateCcw,
  Users,
  Scale,
  Percent,
  Receipt,
  MoreVertical,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  Upload,
  Eye,
  Workflow,
  FileSpreadsheet,
  Link2,
  Zap,
  RefreshCw,
  Sparkles,
  Activity,
  TrendingUp,
  Clock,
  Database,
  Settings,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  GitBranch,
  BadgeDollarSign,
  FileSearch,
  Lock,
  Unlock,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import { toDateOnly } from "../utils/dateOnly";
import { downloadElementAsWord, downloadDataAsWord } from "../utils/wordExport";
import { CustomersSuppliersView } from "./CustomersSuppliersView";
import { VouchersView } from "./VouchersView";
import { BankReconciliationView } from "./BankReconciliationView";
import { FixedAssetsView } from "./FixedAssetsView";
import { TaxesView } from "./TaxesView";
import { AccountingFlowView } from "./AccountingFlowView";
import { AccountingReportsView } from "./AccountingReportsView";
import { InvoiceOCRModal } from "./InvoiceOCRModal";
import { VoiceInputButton } from "./VoiceInputButton";
import { GeneralAccountsSettingsNav } from "./GeneralAccountsSettingsNav";
import { BudgetsManagementView } from "./BudgetsManagementView";
import { GLAuditTrailView } from "./GLAuditTrailView";
import { ERPIntegrationHubView } from "./ERPIntegrationHubView";
import { DailyJournalEntries } from "./accounting/DailyJournalEntries";
import { CentralFinancialIntegrationView } from "./accounting/CentralFinancialIntegrationView";

interface Account {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_id: number | null;
  balance: number;
  name_ar?: string;
  name_en?: string;
  account_type?: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  account_nature?: "DEBIT" | "CREDIT";
  level?: number;
  is_leaf?: boolean;
  allow_posting?: boolean;
  status?: boolean;
}

interface JournalItem {
  account_id: number;
  account_name?: string;
  account_code?: string;
  debit: number;
  credit: number;
  notes: string;
}

interface JournalEntry {
  id: number;
  date: string;
  description: string;
  reference: string;
  items: JournalItem[];
}

interface GeneralAccountsProps {
  onBack: () => void;
  initialTab?:
    | "accounts"
    | "journal"
    | "trial_balance"
    | "income_statement"
    | "balance_sheet"
    | "cost_centers"
    | "ledger"
    | "customers_suppliers"
    | "vouchers"
    | "bank_reconciliation"
    | "fixed_assets"
    | "taxes"
    | "accounting_flow"
    | "accounting_reports"
    | "gl_dashboard"
    | "fiscal_years"
    | "account_config"
    | "budgets"
    | "audit_logs"
    | "erp_fiscal_years"
    | "erp_account_config"
    | "erp_budgets"
    | "erp_audit_logs"
    | string;
  onNavigateModule?: (moduleName: string) => void;
}

function normalizeGeneralAccountsTab(tab?: string): string {
  if (!tab) return "accounting_flow";
  if (tab === "erp_fiscal_years") return "fiscal_years";
  if (tab === "erp_account_config") return "account_config";
  if (tab === "erp_budgets") return "budgets";
  if (tab === "erp_audit_logs") return "audit_logs";
  return tab;
}

export const GeneralAccounts: React.FC<GeneralAccountsProps> = ({
  onBack,
  initialTab,
  onNavigateModule,
}) => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialTab) return normalizeGeneralAccountsTab(initialTab);
    const saved = localStorage.getItem("last_general_accounts_tab");
    return normalizeGeneralAccountsTab(saved || "accounting_flow");
  });

  useEffect(() => {
    if (activeTab) {
      try {
        localStorage.setItem("last_general_accounts_tab", activeTab);
      } catch (_) {}
    }
  }, [activeTab]);

  const tabNames: Record<string, string> = {
    central_financial_integration: "التكامل المالي المركزي",
    accounting_flow: "خريطة التدفق المالي",
    erp_hub: "مركز الربط المحاسبي (ERP Hub)",
    accounting_reports: "التقارير المحاسبية",
    accounts: "شجرة الحسابات",
    journal: "القيود اليومية",
    ledger: "الأستاذ العام",
    trial_balance: "ميزان المراجعة",
    cost_centers: "مراكز التكلفة",
    customers_suppliers: "العملاء والموردين",
    vouchers: "سندات القبض والصرف",
    bank_reconciliation: "البنك والتسوية البنكية",
    fixed_assets: "الأصول الثابتة",
    taxes: "الضرائب",
    income_statement: "قائمة الدخل",
    balance_sheet: "الميزانية العمومية",
    auto_posting: "الترحيل التلقائي (ERP)",
    gl_dashboard: "لوحة التحكم",
    fiscal_years: "السنوات المالية والفترات",
    erp_fiscal_years: "السنوات المالية والفترات",
    account_config: "ربط الحسابات التلقائي",
    erp_account_config: "ربط الحسابات التلقائي",
    budgets: "إدارة الموازنات والاعتمادات",
    erp_budgets: "إدارة الموازنات والاعتمادات",
    audit_logs: "سجل المراجعة والتدقيق المالي",
    erp_audit_logs: "سجل المراجعة والتدقيق المالي",
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(normalizeGeneralAccountsTab(initialTab));
    }
  }, [initialTab]);
  const [startDate, setStartDate] = useState(
    toDateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [endDate, setEndDate] = useState(
    toDateOnly(new Date()),
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  // Custom Account Management States
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterNature, setFilterNature] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountFormData, setAccountFormData] = useState({
    code: "",
    name_ar: "",
    name_en: "",
    parent_id: "",
    account_type: "ASSET",
    account_nature: "DEBIT",
    level: 1,
    is_leaf: true,
    allow_posting: true,
    status: true,
  });

  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [costCenterSubList, setCostCenterSubList] = useState<any[]>([]); // holds user additions
  const [costCenterSearchQuery, setCostCenterSearchQuery] = useState("");
  const [costCenterLevelFilter, setCostCenterLevelFilter] = useState("all");
  const [selectedTreeNodeCode, setSelectedTreeNodeCode] = useState<
    string | null
  >(null);
  const [showCostCenterModal, setShowCostCenterModal] = useState(false);
  const [costCenterExpandedNodes, setCostCenterExpandedNodes] = useState<
    Record<string, boolean>
  >({
    "CC-001": true,
    "CC-001-02": true,
    "CC-001-03": true,
  });
  const [newCostCenterFormData, setNewCostCenterFormData] = useState({
    code: "",
    name: "",
    level: 2,
    parent_code: "CC-001",
    manager: "",
    expenses: "",
    revenues: "",
    status: "نشط",
  });

  const [costCenterCurrentPage, setCostCenterCurrentPage] = useState(1);
  const [costCenterPageSize, setCostCenterPageSize] = useState(10);

  const [selectedCostCenter, setSelectedCostCenter] = useState<number | null>(
    null,
  );
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  // ترقيم صفحات الأستاذ العام: 25 / 50 / 100 صف في الصفحة
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(25);
  const ledgerTotal = ledgerData.length;
  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize));
  const ledgerSafePage = Math.min(Math.max(1, ledgerPage), ledgerTotalPages);
  const ledgerStart = (ledgerSafePage - 1) * ledgerPageSize;
  const ledgerRows = ledgerData.slice(ledgerStart, ledgerStart + ledgerPageSize);
  const ledgerPageNumbers = (() => {
    const pages: number[] = [];
    const from = Math.max(1, ledgerSafePage - 2);
    const to = Math.min(ledgerTotalPages, from + 4);
    for (let p = from; p <= to; p += 1) pages.push(p);
    return pages;
  })();
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [journalFormState, setJournalFormState] = useState<any | null>(null);
  const [newEntry, setNewEntry] = useState({
    id: undefined as number | undefined,
    date: toDateOnly(new Date()),
    description: "",
    reference: "",
    items: [
      { account_id: 0, debit: 0, credit: 0, notes: "", cost_center_id: 0 },
    ],
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedAccount]);

  // أي تغيير في الحساب أو الفترة أو مركز التكلفة يبدأ من الصفحة الأولى
  useEffect(() => {
    setLedgerPage(1);
  }, [selectedAccount, selectedCostCenter, startDate, endDate, ledgerPageSize]);

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportToWord = (elementId: string, fileName: string) => {
    downloadElementAsWord(elementId, fileName, fileName.replace(/_/g, ' '));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "ledger" && selectedAccount) {
        let url = `/api/accounts/${selectedAccount}/ledger?startDate=${startDate}&endDate=${endDate}`;
        if (selectedCostCenter) url += `&costCenterId=${selectedCostCenter}`;
        const res = await api.get(url);
        const data = await res.json();
        setLedgerData(Array.isArray(data) ? data : []);
      } else if (activeTab === "accounts") {
        const res = await api.get("/api/accounts");
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      } else if (activeTab === "journal") {
        const res = await api.get("/api/journal-entries");
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : data?.data || []);
      } else if (activeTab === "cost_centers") {
        const res = await api.get("/api/cost-centers");
        const data = await res.json();
        setCostCenters(Array.isArray(data) ? data : []);
      }

      // Fetch accounts and cost centers for the modal if not already fetched
      if (activeTab !== "accounts") {
        const accRes = await api.get("/api/accounts");
        const accData = await accRes.json();
        if (Array.isArray(accData)) setAccounts(accData);
      }
      if (activeTab !== "cost_centers") {
        const ccRes = await api.get("/api/cost-centers");
        const ccData = await ccRes.json();
        if (Array.isArray(ccData)) setCostCenters(ccData);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate child code safely based on parent
  const generateNextChildCode = (parent: Account) => {
    const children = accounts.filter((acc) => acc.parent_id === parent.id);
    if (children.length === 0) {
      return `${parent.code}1`;
    }
    const childCodes = children
      .map((c) => c.code)
      .filter((c) => c.startsWith(parent.code));
    let nextNum = childCodes.length + 1;
    let proposedCode = `${parent.code}${nextNum}`;
    while (accounts.some((acc) => acc.code === proposedCode)) {
      nextNum++;
      proposedCode = `${parent.code}${nextNum}`;
    }
    return proposedCode;
  };

  // Handlers for Accounts CRUD
  const handleNewAccount = (parentAccount?: Account) => {
    setEditingAccount(null);
    setAccountFormData({
      code: parentAccount ? generateNextChildCode(parentAccount) : "",
      name_ar: "",
      name_en: "",
      parent_id: parentAccount ? String(parentAccount.id) : "",
      account_type: parentAccount
        ? parentAccount.account_type || "ASSET"
        : "ASSET",
      account_nature: parentAccount
        ? parentAccount.account_nature || "DEBIT"
        : "DEBIT",
      level: parentAccount ? (parentAccount.level || 1) + 1 : 1,
      is_leaf: true,
      allow_posting: true,
      status: true,
    });
    setShowAccountModal(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setAccountFormData({
      code: account.code || "",
      name_ar: account.name_ar || account.name || "",
      name_en: account.name_en || "",
      parent_id: account.parent_id ? String(account.parent_id) : "",
      account_type: account.account_type || "ASSET",
      account_nature: account.account_nature || "DEBIT",
      level: account.level || 1,
      is_leaf: account.is_leaf !== false,
      allow_posting: account.allow_posting !== false,
      status: account.status !== false,
    });
    setShowAccountModal(true);
  };

  const handleDeleteAccount = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الحساب نهائياً؟")) {
      return;
    }
    try {
      const res = await api.delete(`/api/accounts/${id}`);
      if (res.ok) {
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || "فشل حذف الحساب");
      }
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء محاولة حذف الحساب");
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.code || !accountFormData.name_ar) {
      alert("يرجى إدخال كود الحساب والاسم بالعربي");
      return;
    }

    const payload = {
      ...accountFormData,
      parent_id: accountFormData.parent_id
        ? parseInt(accountFormData.parent_id)
        : null,
      level: parseInt(String(accountFormData.level)) || 1,
    };

    try {
      let res;
      if (editingAccount) {
        res = await api.put(`/api/accounts/${editingAccount.id}`, payload);
      } else {
        res = await api.post("/api/accounts", payload);
      }

      if (res.ok) {
        setShowAccountModal(false);
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || "فشل حفظ الحساب");
      }
    } catch (error) {
      console.error(error);
      alert("خطأ في الاتصال بالخادم");
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[];
        if (rawRows.length < 2) {
          alert("الملف فارغ أو غير صالح");
          return;
        }

        const headers = rawRows[0].map((h: any) =>
          String(h).trim().toLowerCase(),
        );
        const rows = rawRows.slice(1);

        const accountsToImport = rows
          .map((r) => {
            const item: any = {};
            headers.forEach((h: any, idx: any) => {
              if (r[idx] !== undefined) {
                item[h] = r[idx];
              }
            });
            return item;
          })
          .filter((item) => item.code || item["كود"] || item["كود الحساب"]);

        if (accountsToImport.length === 0) {
          alert("تأكد من وجود بيانات صالحة في ملف الإكسل");
          return;
        }

        const normalized = accountsToImport.map((item) => {
          const code = String(
            item.code ||
              item["الكود"] ||
              item["كود الحساب"] ||
              item["كود الحساب (code)"] ||
              "",
          ).trim();
          const name_ar = String(
            item.name_ar ||
              item["الاسم بالكامل"] ||
              item["الاسم بالعربي"] ||
              item["الاسم بالعربي (name_ar)"] ||
              item["الاسم"] ||
              "",
          ).trim();
          const name_en = String(
            item.name_en ||
              item["الاسم بالإنجليزي"] ||
              item["الاسم بالانجليزي"] ||
              item["الاسم بالإنجليزي (name_en)"] ||
              "",
          ).trim();

          let account_type = String(
            item.account_type ||
              item.type ||
              item["النوع"] ||
              item["نوع الحساب"] ||
              item["نوع الحساب (type)"] ||
              "ASSET",
          )
            .trim()
            .toUpperCase();
          if (
            account_type.includes("أصل") ||
            account_type.includes("أصول") ||
            account_type.includes("ASSET")
          )
            account_type = "ASSET";
          else if (
            account_type.includes("خصم") ||
            account_type.includes("خصوم") ||
            account_type.includes("LIABILITY") ||
            account_type.includes("التزامات")
          )
            account_type = "LIABILITY";
          else if (
            account_type.includes("EQUITY") ||
            account_type.includes("حقوق") ||
            account_type.includes("ملك")
          )
            account_type = "EQUITY";
          else if (
            account_type.includes("REVENUE") ||
            account_type.includes("إيراد") ||
            account_type.includes("ايراد")
          )
            account_type = "REVENUE";
          else if (
            account_type.includes("EXPENSE") ||
            account_type.includes("مصروف")
          )
            account_type = "EXPENSE";

          let account_nature = String(
            item.account_nature ||
              item.nature ||
              item["الطبيعة"] ||
              item["طبيعة الحساب"] ||
              item["طبيعة الحساب (nature)"] ||
              "",
          )
            .trim()
            .toUpperCase();
          if (
            account_nature.includes("مدين") ||
            account_nature.includes("DEBIT")
          )
            account_nature = "DEBIT";
          else if (
            account_nature.includes("دائن") ||
            account_nature.includes("CREDIT")
          )
            account_nature = "CREDIT";
          else {
            account_nature = ["ASSET", "EXPENSE"].includes(account_type)
              ? "DEBIT"
              : "CREDIT";
          }

          const parent_code = String(
            item.parent_code || item["الكود الرئيسي"] || item["كود الأب"] || "",
          ).trim();

          const is_leaf =
            item.is_leaf !== undefined
              ? String(item.is_leaf).toLowerCase() === "true" ||
                item.is_leaf === true ||
                String(item.is_leaf).includes("نعم")
              : true;
          const allow_posting =
            item.allow_posting !== undefined
              ? String(item.allow_posting).toLowerCase() === "true" ||
                item.allow_posting === true ||
                String(item.allow_posting).includes("نعم")
              : true;
          const status =
            item.status !== undefined
              ? String(item.status).toLowerCase() === "true" ||
                item.status === true ||
                String(item.status).includes("نشط") ||
                String(item.status).includes("نعم")
              : true;

          return {
            code,
            name_ar,
            name_en,
            account_type,
            account_nature,
            parent_code: parent_code || null,
            is_leaf,
            allow_posting,
            status,
          };
        });

        const res = await api.post("/api/accounts/bulk", {
          accounts: normalized,
        });
        if (res.ok) {
          alert(`تم استيراد ${normalized.length} حساب بنجاح!`);
          fetchData();
        } else {
          const errData = await res.json();
          alert(errData.error || "فشل استيراد الحسابات");
        }
      } catch (err: any) {
        console.error(err);
        alert("فشل قراءة ملف الإكسل: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredAccounts = accounts.filter((acc) => {
    const nameAr = acc.name_ar || acc.name || "";
    const nameEn = acc.name_en || "";
    const code = acc.code || "";

    const matchQuery =
      code.includes(searchQuery) ||
      nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameEn.toLowerCase().includes(searchQuery.toLowerCase());

    const accType = acc.account_type || acc.type?.toUpperCase() || "ASSET";
    const matchType = !filterType || accType === filterType;

    const accNature =
      acc.account_nature ||
      (["ASSET", "EXPENSE"].includes(accType) ? "DEBIT" : "CREDIT");
    const matchNature = !filterNature || accNature === filterNature;

    const matchLevel = !filterLevel || String(acc.level || 1) === filterLevel;

    return matchQuery && matchType && matchNature && matchLevel;
  });

  const handleExportFilteredAccounts = () => {
    const mapping = filteredAccounts.map((acc) => ({
      "كود الحساب (code)": acc.code,
      "الاسم بالعربي (name_ar)": acc.name_ar || acc.name,
      "الاسم بالإنجليزي (name_en)": acc.name_en || "",
      "نوع الحساب (type)": getAccountTypeName(
        (acc.account_type || acc.type || "").toLowerCase(),
      ),
      "طبيعة الحساب (nature)":
        (acc.account_nature || "").toUpperCase() === "CREDIT" ? "دائن" : "مدين",
      "المستوى (level)": acc.level || 1,
      "حساب نهائي (is_leaf)": acc.is_leaf !== false ? "نعم" : "لا",
      "يسمح بالترحيل (allow_posting)":
        acc.allow_posting !== false ? "نعم" : "لا",
      "الحالة (status)": acc.status !== false ? "نشط" : "غير نشط",
      الرصيد: acc.balance || 0,
    }));
    exportToExcel(mapping, "دليل_الحسابات_المفروز");
  };

  const handleAddEntryItem = () => {
    setNewEntry({
      ...newEntry,
      items: [
        ...newEntry.items,
        { account_id: 0, debit: 0, credit: 0, notes: "", cost_center_id: 0 },
      ],
    });
  };

  const handleRemoveEntryItem = (index: number) => {
    setNewEntry({
      ...newEntry,
      items: newEntry.items.filter((_, i) => i !== index),
    });
  };

  const handleEntryItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...newEntry.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setNewEntry({ ...newEntry, items: updatedItems });
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebit = newEntry.items.reduce(
      (sum, item) => sum + (Number(item.debit) || 0),
      0,
    );
    const totalCredit = newEntry.items.reduce(
      (sum, item) => sum + (Number(item.credit) || 0),
      0,
    );

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      alert("القيد غير متزن! يجب أن يتساوى مجموع المدين مع مجموع الدائن.");
      return;
    }

    if (
      newEntry.items.some((item) => !item.account_id || item.account_id === 0)
    ) {
      alert("الرجاء اختيار حساب لجميع بنود القيد.");
      return;
    }

    try {
      let res;
      if (newEntry.id) {
        res = await api.put(`/api/journal-entries/${newEntry.id}`, newEntry);
      } else {
        res = await api.post("/api/journal-entries", newEntry);
      }
      if (res.ok) {
        setShowEntryModal(false);
        setNewEntry({
          id: undefined,
          date: toDateOnly(new Date()),
          description: "",
          reference: "",
          items: [
            {
              account_id: 0,
              debit: 0,
              credit: 0,
              notes: "",
              cost_center_id: 0,
            },
          ],
        });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "حدث خطأ أثناء حفظ القيد");
      }
    } catch (error) {
      console.error("Failed to save entry");
      alert("حدث خطأ في الاتصال بالخادم");
    }
  };

  const handleCreateNewJournal = () => {
    try {
      const nextCode = `JE-2024-${String((entries?.length || 0) + 100123).padStart(6, "0")}`;
      const stockAcc =
        Array.isArray(accounts)
          ? accounts.find((a) => a.code?.startsWith("11401")) ||
            accounts.find((a) => a.is_leaf !== false)
          : null;
      const suppliersAcc =
        Array.isArray(accounts)
          ? accounts.find((a) => a.code?.startsWith("21101")) ||
            accounts.find((a) => a.is_leaf !== false)
          : null;
      const vatAcc =
        Array.isArray(accounts)
          ? accounts.find((a) => a.code?.startsWith("24201")) ||
            accounts.find((a) => a.is_leaf !== false)
          : null;

      const ccId = Array.isArray(costCenters) && costCenters.length > 0 ? costCenters[0]?.id : 0;

      setJournalFormState({
        code: nextCode,
        date: toDateOnly(new Date()),
        due_date: toDateOnly(new Date()),
        entry_type: "قيد يومية عادي",
        currency: "جنيه مصري",
        exchange_rate: 1.0,
        description: "شراء مواد خام من المورد شركة الأمل",
        cost_center_id: ccId || 0,
        document_number: "INV-2024-0567",
        source: "فاتورة شراء",
        reference: "PO-2024-0567",
        notes: "تم الشراء نقداً",
        status: "draft",
        items: [
          {
            account_id: stockAcc ? stockAcc.id : 0,
            debit: 15000,
            credit: 0,
            notes: "شراء مواد خام من المورد",
            cost_center_id: ccId || 0,
          },
          {
            account_id: suppliersAcc ? suppliersAcc.id : 0,
            debit: 0,
            credit: 15000,
            notes: "شراء مواد خام من المورد",
            cost_center_id: ccId || 0,
          },
          {
            account_id: vatAcc ? vatAcc.id : 0,
            debit: 2250,
            credit: 0,
            notes: "ضريبة على شراء المواد الخام",
            cost_center_id: ccId || 0,
          },
        ],
      });
    } catch (error: any) {
      console.error("Error creating new journal:", error);
      alert("حدث خطأ أثناء فتح منشئ قيد اليومية: " + error.message);
    }
  };

  const handleOpenEditJournal = (entry: any) => {
    let parsedRef = {
      reference: entry.reference || "",
      doc_num: "",
      source: "",
      due_date: "",
      currency: "جنيه مصري",
      exchange_rate: 1.0,
      entry_type: "قيد يومية عادي",
      status: "approved",
      notes: "",
    };
    if (entry.reference && entry.reference.startsWith("{")) {
      try {
        parsedRef = JSON.parse(entry.reference);
      } catch (e) {}
    }

    setJournalFormState({
      id: entry.id,
      code: `JE-2024-${String(entry.id).padStart(6, "0")}`,
      date: toDateOnly(entry.date) || toDateOnly(new Date()),
      due_date:
        toDateOnly(parsedRef.due_date) ||
        toDateOnly(entry.date) ||
        toDateOnly(new Date()),
      entry_type: parsedRef.entry_type || "قيد يومية عادي",
      currency: parsedRef.currency || "جنيه مصري",
      exchange_rate: parsedRef.exchange_rate || 1.0,
      description: entry.description || "",
      cost_center_id: entry.items[0]?.cost_center_id || 0,
      document_number: parsedRef.doc_num || "",
      source: parsedRef.source || "",
      reference:
        parsedRef.reference ||
        (parsedRef.reference === ""
          ? parsedRef.reference
          : entry.reference || ""),
      notes: parsedRef.notes || "",
      status: parsedRef.status || "approved",
      items: entry.items.map((item: any) => ({
        account_id: item.account_id,
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0,
        notes: item.notes || "",
        cost_center_id: item.cost_center_id || 0,
      })),
    });
  };

  const handleSavePremiumJournal = async (saveAsDraft: boolean = false) => {
    const totalDebit = journalFormState.items.reduce(
      (sum: number, item: any) => sum + (Number(item.debit) || 0),
      0,
    );
    const totalCredit = journalFormState.items.reduce(
      (sum: number, item: any) => sum + (Number(item.credit) || 0),
      0,
    );

    if (Math.abs(totalDebit - totalCredit) > 0.01 && !saveAsDraft) {
      alert(
        "القيد غير متزن! يجب أن يتساوى مجموع المدين مع مجموع الدائن في القيد المعتمد.",
      );
      return;
    }

    if (
      journalFormState.items.some(
        (item: any) => !item.account_id || item.account_id === 0,
      )
    ) {
      alert("الرجاء اختيار حساب لجميع البنود.");
      return;
    }

    const payloadRefObj = {
      reference: journalFormState.reference,
      doc_num: journalFormState.document_number,
      source: journalFormState.source,
      due_date: journalFormState.due_date,
      currency: journalFormState.currency,
      exchange_rate: journalFormState.exchange_rate,
      entry_type: journalFormState.entry_type,
      status: saveAsDraft ? "draft" : "approved",
      notes: journalFormState.notes,
    };

    const payload = {
      date: journalFormState.date,
      description: journalFormState.description,
      reference: JSON.stringify(payloadRefObj),
      items: journalFormState.items.map((item: any) => ({
        account_id: item.account_id,
        debit: item.debit || 0,
        credit: item.credit || 0,
        notes: item.notes || "",
        cost_center_id: item.cost_center_id || null,
      })),
    };

    try {
      let res;
      if (journalFormState.id) {
        res = await api.put(`/api/journal-entries/${journalFormState.id}`, payload);
      } else {
        res = await api.post("/api/journal-entries", payload);
      }
      if (res.ok) {
        setJournalFormState(null);
        fetchData();
        alert(
          saveAsDraft
            ? "تم حفظ القيد كمسودة بنجاح"
            : "تم اعتماد وترحيل القيد اليومي بنجاح",
        );
      } else {
        const err = await res.json();
        alert(err.error || "فشل حفظ القيد");
      }
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ القيد");
    }
  };

  const handleDeleteJournalEntry = async (id: number) => {
    if (
      !window.confirm(
        "هل أنت متأكد من رغبتك في حذف هذا القيد؟ سيتم إلغاء تأثيره في الأرصدة فورياً.",
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(`/api/journal-entries/${id}`);
      if (res.ok) {
        fetchData();
        alert("تم حذف القيد وإلغاء أرصدة الحسابات والبنود بنجاح");
      } else {
        const err = await res.json();
        alert(err.error || "فشل حذف القيد");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case "asset":
        return "أصول";
      case "liability":
        return "خصوم";
      case "equity":
        return "حقوق ملكية";
      case "revenue":
        return "إيرادات";
      case "expense":
        return "مصروفات";
      default:
        return type;
    }
  };

  const buildAccountTree = (
    items: Account[],
    parentId: number | null = null,
  ): any[] => {
    return items
      .filter((item) => item.parent_id === parentId)
      .map((item) => ({
        ...item,
        children: buildAccountTree(items, item.id),
      }));
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900"
      dir="rtl"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-amber-600" />
              {initialTab
                ? tabNames[activeTab] || "الحسابات العامة"
                : "الحسابات العامة"}
            </h1>
            <p className="text-sm text-slate-500">
              {initialTab
                ? `القسم الفرعي: ${tabNames[activeTab] || ""}`
                : "إدارة القيود اليومية، شجرة الحسابات، والتقارير المالية"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!initialTab && (
        <div className="px-6 bg-white border-b border-slate-200 overflow-x-auto">
          <div className="flex gap-8 min-w-max">
            {[
              {
                id: "central_financial_integration",
                label: "التكامل المالي المركزي",
                icon: Layers,
              },
              {
                id: "erp_hub",
                label: "مركز الربط المالي (ERP Hub)",
                icon: Layers,
              },
              {
                id: "accounting_flow",
                label: "خريطة التدفق المالي",
                icon: Workflow,
              },
              {
                id: "accounting_reports",
                label: "التقارير المحاسبية",
                icon: FileSpreadsheet,
              },
              { id: "accounts", label: "شجرة الحسابات", icon: FolderTree },
              { id: "journal", label: "القيود اليومية", icon: BookOpen },
              { id: "ledger", label: "الأستاذ العام", icon: History },
              { id: "cost_centers", label: "مراكز التكلفة", icon: Filter },
              {
                id: "customers_suppliers",
                label: "العملاء والموردين",
                icon: Users,
              },
              { id: "vouchers", label: "سندات القبض والصرف", icon: FileText },
              {
                id: "bank_reconciliation",
                label: "البنك والتسوية البنكية",
                icon: Scale,
              },
              { id: "fixed_assets", label: "الأصول الثابتة", icon: Percent },
              { id: "taxes", label: "الضرائب", icon: Receipt },
              { id: "trial_balance", label: "ميزان المراجعة", icon: BarChart3 },
              { id: "income_statement", label: "قائمة الدخل", icon: PieChart },
              {
                id: "balance_sheet",
                label: "الميزانية العمومية",
                icon: FileText,
              },
              {
                id: "auto_posting",
                label: "الترحيل التلقائي",
                icon: Link2,
              },
              {
                id: "gl_dashboard",
                label: "لوحة التحكم",
                icon: Activity,
              },
              {
                id: "fiscal_years",
                label: "السنوات المالية",
                icon: CalendarDays,
              },
              {
                id: "account_config",
                label: "ربط الحسابات",
                icon: GitBranch,
              },
              {
                id: "budgets",
                label: "الموازنات التقديرية",
                icon: BadgeDollarSign,
              },
              {
                id: "audit_logs",
                label: "سجل المراجعة",
                icon: FileSearch,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 font-bold border-b-2 transition-all ${activeTab === tab.id ? "border-amber-600 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-full px-2 lg:px-4 mx-auto"
          >
            {activeTab === "accounts" && (
              <div className="space-y-6">
                {/* Search, Filters, and Actions */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 flex-grow max-w-md">
                      <div className="relative w-full">
                        <Search className="absolute right-4 top-3 text-slate-400 w-5 h-5" />
                        <input
                          type="text"
                          value={searchQuery ?? ""}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ابحث بكود الحساب أو الاسم (عربي/إنجليزي)..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-12 pl-4 py-2.5 focus:outline-none focus:border-amber-500 font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => handleNewAccount()}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-amber-600/10 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        حساب جديد
                      </button>

                      <label className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-100 transition-colors cursor-pointer text-sm">
                        <Download className="w-4 h-4 rotate-180" />
                        <span>استيراد من Excel</span>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleImportExcel}
                          className="hidden"
                        />
                      </label>

                      <button
                        onClick={handleExportFilteredAccounts}
                        className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        تصدير Excel
                      </button>

                      <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                        <button
                          onClick={() => setViewMode("tree")}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${viewMode === "tree" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          عرض شجري (متشعب)
                        </button>
                        <button
                          onClick={() => setViewMode("table")}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          عرض جدولي (تفصيلي)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        نوع الحساب
                      </label>
                      <select
                        value={filterType ?? ""}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="">كل الأنواع</option>
                        <option value="ASSET">أصول (ASSET)</option>
                        <option value="LIABILITY">خصوم (LIABILITY)</option>
                        <option value="EQUITY">حقوق ملكية (EQUITY)</option>
                        <option value="REVENUE">إيرادات (REVENUE)</option>
                        <option value="EXPENSE">مصروفات (EXPENSE)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        طبيعة الحساب
                      </label>
                      <select
                        value={filterNature ?? ""}
                        onChange={(e) => setFilterNature(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="">كل الطبيعات</option>
                        <option value="DEBIT">مدين (DEBIT)</option>
                        <option value="CREDIT">دائن (CREDIT)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        المستوى شجرة الحسابات
                      </label>
                      <select
                        value={filterLevel ?? ""}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="">كل المستويات</option>
                        <option value="1">المستوى 1</option>
                        <option value="2">المستوى 2</option>
                        <option value="3">المستوى 3</option>
                        <option value="4">المستوى 4</option>
                        <option value="5">المستوى 5</option>
                      </select>
                    </div>

                    <div className="flex items-end justify-end">
                      {(searchQuery ||
                        filterType ||
                        filterNature ||
                        filterLevel) && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setFilterType("");
                            setFilterNature("");
                            setFilterLevel("");
                          }}
                          className="text-xs text-red-500 font-bold hover:underline mb-2 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          تصفية الفلاتر
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Display Area */}
                {viewMode === "tree" ? (
                  <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm p-6">
                    <div className="mb-4 text-xs font-bold text-slate-400">
                      * تصفح الحسابات بشكل هرمي متداخل، للبحث السريع أو الفلترة
                      استخدم خيار (العرض الجدولي).
                    </div>
                    <div className="space-y-2">
                      {buildAccountTree(filteredAccounts).map((node) => (
                        <AccountTreeNode
                          key={node.id}
                          node={node}
                          onViewLedger={(id: number) => {
                            setSelectedAccount(id);
                            setActiveTab("ledger");
                          }}
                          getAccountTypeName={getAccountTypeName}
                          onEdit={handleEditAccount}
                          onDelete={handleDeleteAccount}
                          onAddChild={handleNewAccount}
                        />
                      ))}
                      {filteredAccounts.length === 0 && (
                        <div className="text-center py-12 text-slate-400 font-bold">
                          لا توجد حسابات تطابق خيارات الفلترة الحالية.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="p-4 font-bold text-xs">
                              كود الحساب
                            </th>
                            <th className="p-4 font-bold text-xs">
                              الاسم بالعربي
                            </th>
                            <th className="p-4 font-bold text-xs">
                              الاسم بالإنجليزي
                            </th>
                            <th className="p-4 font-bold text-xs">
                              نوع الحساب
                            </th>
                            <th className="p-4 font-bold text-xs">
                              طبيعة الحساب
                            </th>
                            <th className="p-4 font-bold text-xs text-center">
                              المستوى
                            </th>
                            <th className="p-4 font-bold text-xs text-center">
                              حساب نهائي
                            </th>
                            <th className="p-4 font-bold text-xs text-center">
                              يسمح بالترحيل
                            </th>
                            <th className="p-4 font-bold text-xs text-center">
                              الحالة
                            </th>
                            <th className="p-4 font-bold text-xs text-center">
                              الرصيد
                            </th>
                            <th className="p-4 font-bold text-xs text-center">
                              الإجراءات
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAccounts.map((acc) => {
                            const accType =
                              acc.account_type ||
                              acc.type?.toUpperCase() ||
                              "ASSET";
                            const accNature =
                              acc.account_nature ||
                              (["ASSET", "EXPENSE"].includes(accType)
                                ? "DEBIT"
                                : "CREDIT");

                            return (
                              <tr
                                key={acc.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="p-4 font-mono font-bold text-slate-600">
                                  {acc.code}
                                </td>
                                <td className="p-4 font-bold text-slate-900">
                                  {acc.name_ar || acc.name}
                                </td>
                                <td className="p-4 text-slate-500 font-medium">
                                  {acc.name_en || "-"}
                                </td>
                                <td className="p-4">
                                  <span
                                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                                      accType === "ASSET"
                                        ? "bg-blue-50 text-blue-600"
                                        : accType === "LIABILITY"
                                          ? "bg-red-50 text-red-600"
                                          : accType === "EQUITY"
                                            ? "bg-purple-50 text-purple-600"
                                            : accType === "REVENUE"
                                              ? "bg-emerald-50 text-emerald-600"
                                              : "bg-orange-50 text-orange-600"
                                    }`}
                                  >
                                    {getAccountTypeName(accType.toLowerCase())}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span
                                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                                      accNature === "DEBIT"
                                        ? "bg-indigo-50 text-indigo-600"
                                        : "bg-amber-50 text-amber-600"
                                    }`}
                                  >
                                    {accNature === "DEBIT" ? "مدين" : "دائن"}
                                  </span>
                                </td>
                                <td className="p-4 text-center font-bold text-slate-500">
                                  {acc.level || 1}
                                </td>
                                <td className="p-4 text-center">
                                  <span
                                    className={`inline-block w-2.5 h-2.5 rounded-full ${acc.is_leaf !== false ? "bg-emerald-500" : "bg-slate-300"}`}
                                    title={acc.is_leaf !== false ? "نعم" : "لا"}
                                  />
                                </td>
                                <td className="p-4 text-center font-bold text-xs text-slate-600">
                                  {acc.allow_posting !== false ? "نعم" : "لا"}
                                </td>
                                <td className="p-4 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${acc.status !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}
                                  >
                                    {acc.status !== false ? "نشط" : "غير نشط"}
                                  </span>
                                </td>
                                <td className="p-4 text-center font-mono font-bold text-slate-950">
                                  {Number(acc.balance || 0 || 0).toLocaleString()} ج.م
                                </td>
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditAccount(acc)}
                                      className="p-1.5 hover:bg-slate-100 text-blue-600 rounded-lg transition-colors"
                                      title="تعديل الحساب"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleNewAccount(acc)}
                                      className="p-1.5 hover:bg-slate-100 text-emerald-600 rounded-lg transition-colors"
                                      title="إضافة حساب فرعي"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedAccount(acc.id);
                                        setActiveTab("ledger");
                                      }}
                                      className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                                      title="كشف الحساب"
                                    >
                                      <History className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteAccount(acc.id)
                                      }
                                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                      title="حذف الحساب"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredAccounts.length === 0 && (
                            <tr>
                              <td
                                colSpan={11}
                                className="p-8 text-center text-slate-400 font-bold"
                              >
                                لا توجد حسابات تطابق فلاتر البحث الحالية.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "ledger" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <select
                      value={selectedAccount || ""}
                      onChange={(e) =>
                        setSelectedAccount(parseInt(e.target.value))
                      }
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-amber-500"
                    >
                      <option value="">اختر حساباً...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedCostCenter || ""}
                      onChange={(e) =>
                        setSelectedCostCenter(
                          e.target.value ? parseInt(e.target.value) : null,
                        )
                      }
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-amber-500"
                    >
                      <option value="">كل مراكز التكلفة</option>
                      {costCenters.map((cc, cIdx) => (
                        <option key={`cc-opt-flt-${cc.id ?? cc.code}-${cIdx}`} value={cc.id}>
                          {cc.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={startDate ?? ""}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                      />
                      <span className="text-slate-400">إلى</span>
                      <input
                        type="date"
                        value={endDate ?? ""}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={fetchData}
                      className="bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition-colors"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        exportToExcel(ledgerData, `كشف_حساب_${selectedAccount}`)
                      }
                      className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={() =>
                        // تصدير كل صفوف الأستاذ لا الصفحة المعروضة فقط
                        downloadDataAsWord(
                          ["التاريخ", "البيان", "مدين", "دائن", "مركز التكلفة"],
                          ledgerData.map((row: any) => [
                            new Date(row.date).toLocaleDateString("ar-EG"),
                            `${row.description || ""}${row.reference ? ` — ${row.reference}` : ""}`,
                            Number(row.debit) > 0 ? Number(row.debit).toLocaleString() : "-",
                            Number(row.credit) > 0 ? Number(row.credit).toLocaleString() : "-",
                            row.cost_center_name || "-",
                          ]),
                          `كشف_حساب_${selectedAccount}`,
                          "كشف حساب الأستاذ العام",
                        )
                      }
                      className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Word
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div
                  id="ledger-table"
                  className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm"
                >
                  <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          التاريخ
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          البيان
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 text-center">
                          مدين
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 text-center">
                          دائن
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500">
                          مركز التكلفة
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-4 text-sm text-slate-500">
                            {new Date(row.date).toLocaleDateString("ar-EG")}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-900">
                              {row.description}
                            </p>
                            <p className="text-xs text-slate-400">
                              {row.reference}
                            </p>
                          </td>
                          <td className="p-4 text-center font-bold text-emerald-600">
                            {row.debit > 0
                              ? Number(row.debit || 0 || 0).toLocaleString()
                              : "-"}
                          </td>
                          <td className="p-4 text-center font-bold text-red-600">
                            {row.credit > 0
                              ? Number(row.credit || 0 || 0).toLocaleString()
                              : "-"}
                          </td>
                          <td className="p-4 text-sm text-slate-500">
                            {row.cost_center_name || "-"}
                          </td>
                        </tr>
                      ))}
                      {ledgerData.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-12 text-center text-slate-400 italic"
                          >
                            لا يوجد حركات مسجلة لهذا الحساب
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {ledgerTotal > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/70">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span>عرض</span>
                        <select
                          value={ledgerPageSize}
                          onChange={(e) => setLedgerPageSize(Number(e.target.value))}
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
                          aria-label="عدد الصفوف في الصفحة"
                        >
                          {[25, 50, 100].map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <span>صف</span>
                        <span className="text-slate-400">•</span>
                        <span className="tabular-nums">
                          {ledgerStart + 1}–{Math.min(ledgerStart + ledgerPageSize, ledgerTotal)} من {ledgerTotal}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLedgerPage(1)}
                          disabled={ledgerSafePage === 1}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="الصفحة الأولى"
                          aria-label="الصفحة الأولى"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLedgerPage(ledgerSafePage - 1)}
                          disabled={ledgerSafePage === 1}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          السابق
                        </button>

                        {ledgerPageNumbers.map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => setLedgerPage(pageNumber)}
                            aria-current={pageNumber === ledgerSafePage ? "page" : undefined}
                            className={
                              pageNumber === ledgerSafePage
                                ? "min-w-[32px] px-2 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-black shadow-sm"
                                : "min-w-[32px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                            }
                          >
                            {pageNumber}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setLedgerPage(ledgerSafePage + 1)}
                          disabled={ledgerSafePage === ledgerTotalPages}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          التالي
                        </button>
                        <button
                          type="button"
                          onClick={() => setLedgerPage(ledgerTotalPages)}
                          disabled={ledgerSafePage === ledgerTotalPages}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="الصفحة الأخيرة"
                          aria-label="الصفحة الأخيرة"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "cost_centers" &&
              (() => {
                interface CostCenterItem {
                  id: number | string;
                  code: string;
                  name: string;
                  level: number;
                  parent_code: string;
                  manager: string;
                  expenses: number | null;
                  revenues: number | null;
                  profit: number | null;
                  status: string;
                  is_parent: boolean;
                  notes?: string;
                }

                // Cost centers derived strictly from DB and user created records
                const mergedList: CostCenterItem[] = [];
                costCenters.forEach((dbCc, dbIdx) => {
                  if (!mergedList.some((bc) => bc.code === dbCc.code)) {
                    const hyphens = (dbCc.code?.match(/-/g) || []).length;
                    const level = Number(dbCc.level) || (hyphens === 0 ? 1 : hyphens + 1);
                    const lastHyphen = dbCc.code?.lastIndexOf("-") ?? -1;
                    const parentCode =
                      dbCc.parent_code ||
                      (lastHyphen !== -1
                        ? dbCc.code.substring(0, lastHyphen)
                        : "-");

                    mergedList.push({
                      id: dbCc.id || `db-${dbCc.code}-${dbIdx}`,
                      code: dbCc.code,
                      name: dbCc.name,
                      level,
                      parent_code: parentCode,
                      manager: dbCc.manager || "-",
                      expenses: Number(dbCc.expenses || 0),
                      revenues: dbCc.revenues !== null && dbCc.revenues !== undefined ? Number(dbCc.revenues) : null,
                      profit: dbCc.profit !== null && dbCc.profit !== undefined ? Number(dbCc.profit) : null,
                      status: dbCc.status || "نشط",
                      is_parent: Boolean(dbCc.is_parent),
                      notes: dbCc.notes || "",
                    });
                  }
                });

                costCenterSubList.forEach((sessionCc) => {
                  if (!mergedList.some((bc) => bc.code === sessionCc.code)) {
                    mergedList.push(sessionCc);
                  }
                });

                // Dynamic Pagination variables mapping top-level states
                const currentPage = costCenterCurrentPage;
                const setCurrentPage = setCostCenterCurrentPage;
                const pageSize = costCenterPageSize;
                const setPageSize = setCostCenterPageSize;

                // Filtering Logic
                const filteredList = mergedList.filter((item) => {
                  // Search query filter (by code, name, manager)
                  const query = costCenterSearchQuery.trim().toLowerCase();
                  if (query) {
                    const matchCode = item.code.toLowerCase().includes(query);
                    const matchName = item.name.toLowerCase().includes(query);
                    const matchManager = item.manager
                      .toLowerCase()
                      .includes(query);
                    if (!matchCode && !matchName && !matchManager) return false;
                  }

                  // Level Filter
                  if (costCenterLevelFilter !== "all") {
                    if (item.level !== Number(costCenterLevelFilter))
                      return false;
                  }

                  // Tree Node filter (only show current node or its descendants)
                  if (selectedTreeNodeCode) {
                    if (
                      item.code !== selectedTreeNodeCode &&
                      !item.code.startsWith(selectedTreeNodeCode + "-")
                    ) {
                      return false;
                    }
                  }

                  return true;
                });

                // Dynamic KPI Calculations based on currently matched / all
                const totalCostCentersCount = mergedList.length;

                // Sum up total expenses, revenues, profits from all items
                let totalExpensesSum = 0;
                let totalRevenuesSum = 0;

                mergedList.forEach((cc) => {
                  totalExpensesSum += Number(cc.expenses || 0);
                  totalRevenuesSum += Number(cc.revenues || 0);
                });
                const totalNetProfitSum = totalRevenuesSum - totalExpensesSum;

                // Slice list for pagination
                const totalEntries = filteredList.length;
                const indexStart = (currentPage - 1) * pageSize;
                const indexEnd = Math.min(indexStart + pageSize, totalEntries);
                const paginatedList = filteredList.slice(indexStart, indexEnd);
                const totalPages = Math.ceil(totalEntries / pageSize) || 1;

                // Build hierarchical Tree structure (returns root nodes)
                const buildTreeView = () => {
                  const map: Record<string, any> = {};
                  mergedList.forEach((item) => {
                    map[item.code] = { ...item, children: [] };
                  });
                  const roots: any[] = [];
                  mergedList.forEach((item) => {
                    const node = map[item.code];
                    if (item.parent_code === "-" || !map[item.parent_code]) {
                      roots.push(node);
                    } else {
                      map[item.parent_code].children.push(node);
                    }
                  });
                  return roots;
                };

                const treeRoots = buildTreeView();

                // Helper function to render a single tree node recursively
                const renderTreeNode = (node: any) => {
                  const hasChildren = node.children && node.children.length > 0;
                  const isExpanded = !!costCenterExpandedNodes[node.code];
                  const isSelected = selectedTreeNodeCode === node.code;

                  return (
                    <div key={node.code} className="mr-3">
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-all ${
                          isSelected
                            ? "bg-indigo-50 border-r-4 border-indigo-500 text-indigo-900 font-bold shadow-sm"
                            : "text-slate-700"
                        }`}
                        onClick={() => {
                          if (selectedTreeNodeCode === node.code) {
                            setSelectedTreeNodeCode(null); // Deselect
                          } else {
                            setSelectedTreeNodeCode(node.code);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {hasChildren ? (
                            <button
                              className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCostCenterExpandedNodes((prev) => ({
                                  ...prev,
                                  [node.code]: !prev[node.code],
                                }));
                              }}
                            >
                              <ChevronDown
                                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "" : "rotate-90"}`}
                              />
                            </button>
                          ) : (
                            <span className="w-5" />
                          )}
                          <Folder
                            className={`w-4 h-4 ${isSelected ? "text-indigo-500" : "text-amber-500"} fill-current`}
                          />
                          <span className="text-sm font-semibold tracking-wide">
                            {node.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {node.code}
                        </span>
                      </div>

                      {hasChildren && isExpanded && (
                        <div className="mr-2 border-r border-slate-150 py-1 space-y-1">
                          {node.children.map((child: any) =>
                            renderTreeNode(child),
                          )}
                        </div>
                      )}
                    </div>
                  );
                };

                // Import handle trigger
                const triggerExcelUpload = () => {
                  const input = document.getElementById(
                    "excel-cc-upload-input",
                  );
                  if (input) input.click();
                };

                const handleExcelCCImport = (
                  e: React.ChangeEvent<HTMLInputElement>,
                ) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (evt) => {
                    try {
                      const bstr = evt.target?.result;
                      const wb = XLSX.read(bstr, { type: "binary" });
                      const wsname = wb.SheetNames[0];
                      const ws = wb.Sheets[wsname];
                      const data = XLSX.utils.sheet_to_json(ws);

                      const imported: any[] = [];
                      data.forEach((row: any, idx: number) => {
                        const code =
                          row["الكود"] ||
                          row["كود"] ||
                          row["Code"] ||
                          `CC-IMP-${idx + 1}`;
                        const name =
                          row["الاسم"] ||
                          row["اسم المركز"] ||
                          row["Name"] ||
                          "مركز مستورد";
                        const manager =
                          row["المدير"] ||
                          row["مدير المركز"] ||
                          row["Manager"] ||
                          "-";
                        const pCode =
                          row["المركز الأب"] || row["Parent"] || "CC-001";
                        const expenses = Number(
                          row["المصروفات"] || row["Expenses"] || 0,
                        );
                        const revenues = Number(
                          row["الإيرادات"] || row["Revenues"] || 0,
                        );
                        const level = Number(
                          row["المستوى"] || row["Level"] || 2,
                        );

                        imported.push({
                          id: Date.now() + idx,
                          code,
                          name,
                          level,
                          parent_code: pCode,
                          manager,
                          expenses,
                          revenues,
                          profit: revenues - expenses,
                          status: "نشط",
                          is_parent: false,
                        });
                      });

                      if (imported.length > 0) {
                        setCostCenterSubList((prev) => [...imported, ...prev]);
                        for (const item of imported) {
                          try {
                            await api.post("/api/cost-centers", {
                              code: item.code,
                              name: item.name,
                              notes: `تم الاستيراد - المدير: ${item.manager || "-"}`,
                            });
                          } catch (err) {
                            console.error("DB Import Sync failed:", err);
                          }
                        }
                        alert(
                          `تم استيراد ${imported.length} مركز تكلفة من ملف Excel بنجاح!`,
                        );
                      }
                    } catch (err) {
                      alert("عذراً، فشل في قراءة ملف Excel");
                      console.error(err);
                    }
                  };
                  reader.readAsBinaryString(file);
                };

                const handleCreateCostCenter = async (e: React.FormEvent) => {
                  e.preventDefault();
                  if (
                    !newCostCenterFormData.code ||
                    !newCostCenterFormData.name
                  ) {
                    alert("يرجى ملء الكود والاسم بالكامل");
                    return;
                  }

                  try {
                    // POST database
                    await api.post("/api/cost-centers", {
                      code: newCostCenterFormData.code,
                      name: newCostCenterFormData.name,
                      notes: `المدير: ${newCostCenterFormData.manager || "-"}`,
                    });

                    // Add to sub list state with full rich properties
                    const exp = Number(newCostCenterFormData.expenses) || 0;
                    const rev = Number(newCostCenterFormData.revenues) || 0;

                    const newItem = {
                      id: Date.now(),
                      code: newCostCenterFormData.code,
                      name: newCostCenterFormData.name,
                      level: Number(newCostCenterFormData.level) || 2,
                      parent_code: newCostCenterFormData.parent_code,
                      manager: newCostCenterFormData.manager || "-",
                      expenses: exp,
                      revenues: rev > 0 ? rev : null,
                      profit: rev > 0 ? rev - exp : exp > 0 ? -exp : null,
                      status: newCostCenterFormData.status,
                      is_parent: false,
                    };

                    setCostCenterSubList((prev) => [newItem, ...prev]);
                    setShowCostCenterModal(false);

                    // Reset form
                    setNewCostCenterFormData({
                      code: "",
                      name: "",
                      level: 2,
                      parent_code: "CC-001",
                      manager: "",
                      expenses: "",
                      revenues: "",
                      status: "نشط",
                    });

                    alert("تم حفظ مركز التكلفة الجديد بنجاح!");
                  } catch (error: any) {
                    console.error(error);
                    alert(
                      error.response?.data?.message ||
                        "فشل في حفظ مركز التكلفة لقاعدة البيانات",
                    );
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* ---------- DYNAMIC EXCEL FILE INPUT ---------- */}
                    <input
                      type="file"
                      id="excel-cc-upload-input"
                      className="hidden"
                      accept=".xls,.xlsx"
                      onChange={handleExcelCCImport}
                    />

                    {/* --------------------- KPI CARDS ROW (IMAGE 1 SPEC) --------------------- */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Card 1: Net Profit */}
                      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-400 mb-1">
                            صافي الربح
                          </p>
                          <h3 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                            {Number(totalNetProfitSum || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 font-semibold">
                            جنيه مصري
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-50/80 flex items-center justify-center text-blue-600">
                          <PieChart className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Card 2: Total Revenues */}
                      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-400 mb-1">
                            إجمالي الإيرادات
                          </p>
                          <h3 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                            {Number(totalRevenuesSum || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 font-semibold">
                            جنيه مصري
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-orange-50/80 flex items-center justify-center text-orange-600">
                          <ArrowUpRight className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Card 3: Total Expenses */}
                      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-400 mb-1">
                            إجمالي المصروفات
                          </p>
                          <h3 className="text-2xl font-bold font-mono text-[#FA5F5F] tracking-tight">
                            {Number(totalExpensesSum || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 font-semibold">
                            جنيه مصري
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-[#FA5F5F]/10 flex items-center justify-center text-[#FA5F5F]">
                          <ArrowDownLeft className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Card 4: Total Cost Centers */}
                      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-400 mb-1">
                            إجمالي مراكز التكلفة
                          </p>
                          <h3 className="text-3xl font-bold font-mono text-slate-900 leading-none">
                            {totalCostCentersCount}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1.5 font-semibold">
                            مركز تكلفة
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <FolderTree className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    {/* --------------------- ACTION & FILTER BAR --------------------- */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/60 p-4 border border-slate-200/70 rounded-[1.8rem]">
                      {/* Right side: filters */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Search box */}
                        <div className="relative w-80">
                          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="بحث برقم أو اسم مركز التكلفة..."
                            value={costCenterSearchQuery ?? ""}
                            onChange={(e) => {
                              setCostCenterSearchQuery(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="w-full pl-4 pr-11 py-2.5 bg-white border border-slate-200 rounded-[1.2rem] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                          {costCenterSearchQuery && (
                            <button
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 underline"
                              onClick={() => {
                                setCostCenterSearchQuery("");
                                setCurrentPage(1);
                              }}
                            >
                              تصفير
                            </button>
                          )}
                        </div>

                        {/* Levels Filter */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">
                            المستوى:
                          </span>
                          <select
                            value={costCenterLevelFilter ?? ""}
                            onChange={(e) => {
                              setCostCenterLevelFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-[1.25rem] text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          >
                            <option value="all">كل المستويات</option>
                            <option value="1">المستوى 1</option>
                            <option value="2">المستوى 2</option>
                            <option value="3">المستوى 3</option>
                          </select>
                        </div>

                        {/* Tree filter reset button */}
                        {selectedTreeNodeCode && (
                          <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-100 gap-1.5">
                            تصفية الشجرة: {selectedTreeNodeCode}
                            <button
                              onClick={() => setSelectedTreeNodeCode(null)}
                              className="hover:text-red-500 text-slate-400"
                            >
                              &times;
                            </button>
                          </span>
                        )}
                      </div>

                      {/* Left side: Buttons */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowCostCenterModal(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-2.5 rounded-[1.2rem] shadow-sm hover:shadow transition-all flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          مركز تكلفة جديد
                        </button>

                        <button
                          onClick={triggerExcelUpload}
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-bold text-sm px-4 py-2.5 rounded-[1.2rem] transition-all flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-emerald-600" />
                          استيراد من Excel
                        </button>

                        <button
                          onClick={() =>
                            exportToExcel(
                              mergedList,
                              "تقرير_هيكل_مراكز_التكلفة",
                            )
                          }
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-bold text-sm px-4 py-2.5 rounded-[1.2rem] transition-all flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-indigo-500" />
                          تقرير
                        </button>
                      </div>
                    </div>

                    {/* --------------------- TWO-COLUMN GRID --------------------- */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* RIGHT COLUMN: هيكل مراكز التكلفة TREE VIEW */}
                      <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-[2.2rem] p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2 text-indigo-600">
                            <FolderTree className="w-5 h-5" />
                            <h4 className="font-bold text-slate-900 text-[1.05rem]">
                              هيكل مراكز التكلفة
                            </h4>
                          </div>
                          {selectedTreeNodeCode && (
                            <button
                              className="text-xs font-semibold text-slate-400 hover:text-indigo-600 underline"
                              onClick={() => setSelectedTreeNodeCode(null)}
                            >
                              عرض الكل
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                          {treeRoots.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">لا توجد مراكز تكلفة مسجلة</p>
                          ) : (
                            treeRoots.map((root) => renderTreeNode(root))
                          )}
                        </div>
                      </div>

                      {/* LEFT COLUMN: THE DATA TABLE */}
                      <div className="lg:col-span-9 space-y-4">
                        <div className="bg-white border border-slate-200/95 rounded-[2.2rem] overflow-hidden shadow-sm">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-slate-50/90 border-b border-slate-150">
                                <th className="p-4 text-xs font-bold text-slate-500 w-10 text-center">
                                  #
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-center">
                                  كود مركز التكلفة
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-center">
                                  اسم مركز التكلفة
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-center">
                                  المستوى
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-center">
                                  المركز الأب
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-center">
                                  مدير المركز
                                </th>
                                <th className="p-4 text-xs font-bold text-[#FA5F5F] text-center">
                                  إجمالي المصروفات
                                </th>
                                <th className="p-4 text-xs font-bold text-[#3B82F6] text-center">
                                  إجمالي الإيرادات
                                </th>
                                <th className="p-4 text-xs font-bold text-[#10B981] text-center">
                                  صافي الربح
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-center">
                                  الحالة
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 w-12 text-center">
                                  الإجراءات
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedList.map((cc, index) => {
                                const globalIndex = indexStart + index + 1;
                                const isNegativeProfit =
                                  cc.profit !== null && cc.profit < 0;

                                return (
                                  <tr
                                    key={`cc-row-${cc.code || cc.id}-${index}`}
                                    className="hover:bg-slate-50/70 transition-all font-semibold text-slate-800 text-[0.88rem]"
                                  >
                                    <td className="p-4 text-center text-slate-400 font-mono font-medium">
                                      {globalIndex}
                                    </td>
                                    <td className="p-4 text-center font-mono font-medium text-slate-600">
                                      {cc.code}
                                    </td>
                                    <td className="p-4 text-center text-slate-900 font-bold">
                                      {cc.name}
                                    </td>
                                    <td className="p-4 text-center">
                                      <span
                                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                          cc.level === 1
                                            ? "bg-indigo-50 text-indigo-600"
                                            : cc.level === 2
                                              ? "bg-amber-50 text-amber-600"
                                              : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {cc.level}
                                      </span>
                                    </td>
                                    <td className="p-4 text-center font-mono text-slate-500 text-xs">
                                      {cc.parent_code}
                                    </td>
                                    <td className="p-4 text-center text-slate-600 text-xs">
                                      {cc.manager}
                                    </td>

                                    {/* Expenses */}
                                    <td className="p-4 text-center font-mono text-slate-700">
                                      {cc.expenses !== null &&
                                      cc.expenses !== undefined
                                        ? Number(cc.expenses || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })
                                        : "-"}
                                    </td>

                                    {/* Revenues */}
                                    <td className="p-4 text-center font-mono text-slate-700">
                                      {cc.revenues !== null &&
                                      cc.revenues !== undefined
                                        ? Number(cc.revenues || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })
                                        : "-"}
                                    </td>

                                    {/* Net Profit */}
                                    <td
                                      className={`p-4 text-center font-mono font-bold ${isNegativeProfit ? "text-[#FA5F5F]" : "text-emerald-600"}`}
                                    >
                                      {cc.profit !== null &&
                                      cc.profit !== undefined ? (
                                        <>
                                          {isNegativeProfit ? "-" : ""}
                                          {Number(Math.abs(cc.profit || 0)).toLocaleString(
                                            "en-US",
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            },
                                          )}
                                        </>
                                      ) : (
                                        "-"
                                      )}
                                    </td>

                                    {/* Status */}
                                    <td className="p-4 text-center">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        {cc.status || "نشط"}
                                      </span>
                                    </td>

                                    {/* Operations */}
                                    <td className="p-4 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => {
                                            setSelectedCostCenter(Number(cc.id));
                                            setSelectedTreeNodeCode(cc.code);
                                          }}
                                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                          title="عرض الفلترة"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                          <MoreVertical className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {totalEntries === 0 && (
                                <tr>
                                  <td
                                    colSpan={11}
                                    className="p-16 text-center text-slate-400 font-semibold italic"
                                  >
                                    لا يوجد مراكز تكلفة مطابقة لمعايير البحث
                                    حلياً
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* PAGINATION FOOTER */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/50 p-4 border border-slate-200/50 rounded-[1.8rem] px-6">
                          {/* Right: entries selection */}
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>عرض</span>
                            <select
                              value={pageSize ?? ""}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-bold focus:outline-none"
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                            <span>سجلات</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="font-semibold text-slate-600">
                              عرض {indexStart + 1} إلى {indexEnd} من أصل{" "}
                              {totalEntries} سجلات
                            </span>
                          </div>

                          {/* Left: pagination buttons */}
                          <div className="flex items-center gap-1.5 direction-ltr">
                            <button
                              onClick={() =>
                                setCurrentPage((prev) => Math.max(prev - 1, 1))
                              }
                              disabled={currentPage === 1}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </button>

                            {Array.from({ length: totalPages }).map(
                              (_, idx) => {
                                const page = idx + 1;
                                const isCurrent = currentPage === page;
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-1 font-mono text-sm leading-none font-bold rounded-lg transition-all ${
                                      isCurrent
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "border border-slate-200 bg-white hover:bg-slate-50/50 text-slate-600"
                                    }`}
                                  >
                                    {page}
                                  </button>
                                );
                              },
                            )}

                            <button
                              onClick={() =>
                                setCurrentPage((prev) =>
                                  Math.min(prev + 1, totalPages),
                                )
                              }
                              disabled={currentPage === totalPages}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* --------------------- MODAL: CREATE COST CENTER --------------------- */}
                    <AnimatePresence>
                      {showCostCenterModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl space-y-6 p-8 relative text-right"
                            dir="rtl"
                          >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                              <h3 className="text-xl font-bold text-slate-950">
                                إضافة مركز تكلفة جديد
                              </h3>
                              <button
                                onClick={() => setShowCostCenterModal(false)}
                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <form
                              onSubmit={handleCreateCostCenter}
                              className="space-y-4"
                            >
                              {/* Code and Name */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                    كود مركز التكلفة *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="مثال: CC-001-08"
                                    value={newCostCenterFormData.code ?? ""}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        code: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-[1.1rem] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    required
                                    dir="ltr"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                    اسم مركز التكلفة *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="اسم المركز"
                                    value={newCostCenterFormData.name ?? ""}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-[1.1rem] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    required
                                  />
                                </div>
                              </div>

                              {/* Level and Parent Code selection */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                    المستوى
                                  </label>
                                  <select
                                    value={newCostCenterFormData.level ?? ""}
                                    onChange={(e) => {
                                      const l = Number(e.target.value);
                                      let p = "CC-001";
                                      if (l === 1) p = "-";
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        level: l,
                                        parent_code: p,
                                      }));
                                    }}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-[1.1rem] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                  >
                                    <option value={1}>المستوى 1 (رئيسي)</option>
                                    <option value={2}>المستوى 2</option>
                                    <option value={3}>المستوى 3</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                    المركز الأب
                                  </label>
                                  <select
                                    value={newCostCenterFormData.parent_code ?? ""}
                                    disabled={newCostCenterFormData.level === 1}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        parent_code: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-[1.1rem] text-sm text-slate-800 bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                  >
                                    {newCostCenterFormData.level === 1 ? (
                                      <option value="-">-</option>
                                    ) : (
                                      mergedList
                                        .filter(
                                          (cc) =>
                                            cc.level <
                                            newCostCenterFormData.level,
                                        )
                                        .map((cc, cIdx) => (
                                          <option key={`cc-parent-opt-${cc.code}-${cIdx}`} value={cc.code}>
                                            {cc.name} ({cc.code})
                                          </option>
                                        ))
                                    )}
                                  </select>
                                </div>
                              </div>

                              {/* Manager and Status */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                    مدير المركز
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="اسم المدير المسؤول"
                                    value={newCostCenterFormData.manager ?? ""}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        manager: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-[1.1rem] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                    الحالة
                                  </label>
                                  <select
                                    value={newCostCenterFormData.status ?? ""}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        status: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-[1.1rem] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                  >
                                    <option value="نشط">نشط</option>
                                    <option value="غير نشط">غير نشط</option>
                                  </select>
                                </div>
                              </div>

                              {/* Initialization values */}
                              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                  <label className="block text-xs font-bold text-[#FA5F5F] mb-1.5">
                                    رصيد أول مصروفات
                                  </label>
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    value={newCostCenterFormData.expenses ?? ""}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        expenses: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 bg-white rounded-[1.1rem] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FA5F5F]/20 focus:border-[#FA5F5F]"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-blue-600 mb-1.5">
                                    رصيد أول إيرادات
                                  </label>
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    value={newCostCenterFormData.revenues ?? ""}
                                    onChange={(e) =>
                                      setNewCostCenterFormData((prev) => ({
                                        ...prev,
                                        revenues: e.target.value,
                                      }))
                                    }
                                    className="w-full px-4 py-2.5 border border-slate-200 bg-white rounded-[1.1rem] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                </div>
                              </div>

                              <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                  type="submit"
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-[1.2rem] shadow-sm tracking-wide transition-all"
                                >
                                  حفظ مركز التكلفة
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowCostCenterModal(false)}
                                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-3 px-6 rounded-[1.2rem] border border-slate-205 transition-all"
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
              })()}

            {activeTab === "journal" && (
              <DailyJournalEntries
                embedded={true}
                onBack={onBack}
                onNavigateModule={onNavigateModule}
              />
            )}

            {activeTab === "trial_balance" && (
              <TrialBalanceReport
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                onRefresh={fetchData}
                exportToExcel={exportToExcel}
                exportToWord={exportToWord}
              />
            )}

            {activeTab === "income_statement" && (
              <IncomeStatementReport
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                onRefresh={fetchData}
                exportToExcel={exportToExcel}
                exportToWord={exportToWord}
              />
            )}

            {activeTab === "balance_sheet" && (
              <BalanceSheetReport
                date={endDate}
                setDate={setEndDate}
                onRefresh={fetchData}
                exportToExcel={exportToExcel}
                exportToWord={exportToWord}
              />
            )}

            {activeTab === "customers_suppliers" && (
              <CustomersSuppliersView onNavigateModule={onNavigateModule} />
            )}

            {activeTab === "vouchers" && <VouchersView />}

            {activeTab === "bank_reconciliation" && <BankReconciliationView />}

            {activeTab === "fixed_assets" && <FixedAssetsView />}

            {activeTab === "taxes" && <TaxesView />}

            {activeTab === "central_financial_integration" && (
              <CentralFinancialIntegrationView />
            )}

            {activeTab === "erp_hub" && (
              <ERPIntegrationHubView
                onNavigateModule={onNavigateModule}
                onNavigateTab={(tabId) => setActiveTab(tabId)}
              />
            )}

            {activeTab === "accounting_flow" && (
              <AccountingFlowView onNavigate={(tabId) => setActiveTab(tabId)} />
            )}

            {activeTab === "accounting_reports" && (
              <AccountingReportsView
                onNavigate={(tabId) => setActiveTab(tabId)}
              />
            )}

            {activeTab === "auto_posting" && <AutoPostingDashboard />}

            {activeTab === "gl_dashboard" && <GLDashboard />}

            {(activeTab === "fiscal_years" || activeTab === "erp_fiscal_years") && (
              <FiscalYearsView
                activeSettingsTab="fiscal_years"
                onSettingsTabChange={(t) => setActiveTab(t)}
              />
            )}

            {(activeTab === "account_config" || activeTab === "erp_account_config") && (
              <AccountConfigView
                activeSettingsTab="account_config"
                onSettingsTabChange={(t) => setActiveTab(t)}
              />
            )}

            {(activeTab === "budgets" || activeTab === "erp_budgets") && (
              <BudgetsManagementView
                activeSettingsTab="budgets"
                onSettingsTabChange={(t) => setActiveTab(t)}
              />
            )}

            {(activeTab === "audit_logs" || activeTab === "erp_audit_logs") && (
              <GLAuditTrailView
                activeSettingsTab="audit_logs"
                onSettingsTabChange={(t) => setActiveTab(t)}
              />
            )}
          </motion.div>
        )}
      </div>

      {/* Journal Entry Modal */}
      <AnimatePresence>
        {showEntryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEntryModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSubmitEntry}>
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      قيد يومية جديد
                    </h2>
                    <p className="text-sm text-slate-500">
                      تسجيل حركة مالية يدوية في الحسابات
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEntryModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        التاريخ
                      </label>
                      <input
                        type="date"
                        required
                        value={newEntry.date ?? ""}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, date: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-slate-500 mb-2">
                        البيان (الوصف)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={newEntry.description ?? ""}
                          onChange={(e) =>
                            setNewEntry({
                              ...newEntry,
                              description: e.target.value,
                            })
                          }
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500"
                          placeholder="مثال: سداد إيجار شهر مارس"
                        />
                        <VoiceInputButton
                          onTranscript={(text) =>
                            setNewEntry((prev) => ({
                              ...prev,
                              description: prev.description ? prev.description + " " + text : text,
                            }))
                          }
                          className="bg-amber-50/50 hover:bg-amber-100/80 border border-amber-200 text-amber-700 py-3 px-3.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-3xl overflow-hidden">
                    <table className="w-full text-right min-w-[800px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            الحساب
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500 text-center">
                            مدين (+)
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500 text-center">
                            دائن (-)
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-500">
                            ملاحظات
                          </th>
                          <th className="p-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {newEntry.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2">
                              <select
                                required
                                value={item.account_id ?? ""}
                                onChange={(e) =>
                                  handleEntryItemChange(
                                    idx,
                                    "account_id",
                                    parseInt(e.target.value),
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                              >
                                <option value="0">اختر الحساب...</option>
                                {accounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.debit || ""}
                                onChange={(e) =>
                                  handleEntryItemChange(
                                    idx,
                                    "debit",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-500"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.credit || ""}
                                onChange={(e) =>
                                  handleEntryItemChange(
                                    idx,
                                    "credit",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-500"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.cost_center_id || 0}
                                onChange={(e) =>
                                  handleEntryItemChange(
                                    idx,
                                    "cost_center_id",
                                    parseInt(e.target.value),
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                              >
                                <option value="0">بدون مركز تكلفة</option>
                                {costCenters.map((cc, cIdx) => (
                                  <option key={`cc-quick-line-${cc.id ?? cc.code}-${cIdx}`} value={cc.id}>
                                    {cc.code} - {cc.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.notes ?? ""}
                                onChange={(e) =>
                                  handleEntryItemChange(
                                    idx,
                                    "notes",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                                placeholder="اختياري..."
                              />
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveEntryItem(idx)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50 font-bold">
                        <tr>
                          <td className="p-4 text-left">الإجمالي:</td>
                          <td className="p-4 text-center text-emerald-600">
                            {newEntry.items
                              .reduce(
                                (sum, item) => sum + (Number(item.debit) || 0),
                                0,
                              )
                              .toLocaleString()}
                          </td>
                          <td className="p-4 text-center text-red-600">
                            {newEntry.items
                              .reduce(
                                (sum, item) => sum + (Number(item.credit) || 0),
                                0,
                              )
                              .toLocaleString()}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEntryItem}
                    className="flex items-center gap-2 text-amber-600 font-bold hover:text-amber-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة سطر جديد
                  </button>
                </div>

                <div className="p-8 bg-slate-50 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-600/20"
                  >
                    <Save className="w-6 h-6" />
                    حفظ القيد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEntryModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAccountModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      {editingAccount
                        ? "تعديل الحساب في الشجرة"
                        : "إضافة حساب جديد للشجرة"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      قم بملء البيانات المطلوبة لإنشاء أو تعديل حسابك بالنظام
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveAccount}
                className="flex-1 overflow-y-auto p-8 space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                  {/* Parent Account selector */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الحساب الرئيسي (الأب)
                    </label>
                    <select
                      value={accountFormData.parent_id ?? ""}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const parentAcc = accounts.find(
                          (a) => String(a.id) === pid,
                        );
                        setAccountFormData((prev) => ({
                          ...prev,
                          parent_id: pid,
                          account_type: parentAcc
                            ? parentAcc.account_type || "ASSET"
                            : prev.account_type,
                          account_nature: parentAcc
                            ? parentAcc.account_nature || "DEBIT"
                            : prev.account_nature,
                          level: parentAcc ? (parentAcc.level || 1) + 1 : 1,
                          code: parentAcc
                            ? generateNextChildCode(parentAcc)
                            : prev.code,
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="">
                        -- بدون حساب أب (حساب رئيسي في المستوى الأول) --
                      </option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name_ar || acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Account Code */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      كود الحساب (رقم فريد)
                    </label>
                    <input
                      type="text"
                      required
                      value={accountFormData.code ?? ""}
                      onChange={(e) =>
                        setAccountFormData({
                          ...accountFormData,
                          code: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500 font-mono font-bold text-left"
                      placeholder="مثال: 1101001"
                    />
                  </div>

                  {/* Level Display */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      المستوى في الشجرة
                    </label>
                    <div className="w-full bg-slate-100 border border-slate-200 text-slate-600 rounded-2xl px-4 py-3 font-bold">
                      المستوى الحالي: {accountFormData.level}
                    </div>
                  </div>

                  {/* Name Arabic */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الاسم بالعربي
                    </label>
                    <input
                      type="text"
                      required
                      value={accountFormData.name_ar ?? ""}
                      onChange={(e) =>
                        setAccountFormData({
                          ...accountFormData,
                          name_ar: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold"
                      placeholder="الأراضي، البنك الأهلي، إلخ..."
                    />
                  </div>

                  {/* Name English */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الاسم بالإنجليزي (اختياري)
                    </label>
                    <input
                      type="text"
                      value={accountFormData.name_en ?? ""}
                      onChange={(e) =>
                        setAccountFormData({
                          ...accountFormData,
                          name_en: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500 font-medium"
                      placeholder="e.g. Cash in Hand, Lands..."
                    />
                  </div>

                  {/* Account Type */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bold text-slate-700">
                      نوع الحساب في التقارير
                    </label>
                    <select
                      value={accountFormData.account_type ?? ""}
                      onChange={(e) => {
                        const type = e.target.value;
                        const defaultNature = ["ASSET", "EXPENSE"].includes(
                          type,
                        )
                          ? "DEBIT"
                          : "CREDIT";
                        setAccountFormData({
                          ...accountFormData,
                          account_type: type as any,
                          account_nature: defaultNature,
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="ASSET">أصول (ASSET)</option>
                      <option value="LIABILITY">خصوم (LIABILITY)</option>
                      <option value="EQUITY">حقوق ملكية (EQUITY)</option>
                      <option value="REVENUE">إيرادات (REVENUE)</option>
                      <option value="EXPENSE">مصروفات (EXPENSE)</option>
                    </select>
                  </div>

                  {/* Account Nature */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 font-bold text-slate-700">
                      طبيعة الحساب الافتراضية
                    </label>
                    <select
                      value={accountFormData.account_nature ?? ""}
                      onChange={(e) =>
                        setAccountFormData({
                          ...accountFormData,
                          account_nature: e.target.value as any,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="DEBIT">مدين (DEBIT)</option>
                      <option value="CREDIT">دائن (CREDIT)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100 text-right">
                  <h4 className="text-sm font-black text-slate-700">
                    محددات الحساب الفنيّة:
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Is Leaf */}
                    <label className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={accountFormData.is_leaf}
                        onChange={(e) =>
                          setAccountFormData({
                            ...accountFormData,
                            is_leaf: e.target.checked,
                          })
                        }
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          حساب فرعي نهائي
                        </p>
                        <p className="text-[10px] text-slate-400">
                          يسجل عليه قيم وحركات
                        </p>
                      </div>
                    </label>

                    {/* Allow Posting */}
                    <label className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={accountFormData.allow_posting}
                        onChange={(e) =>
                          setAccountFormData({
                            ...accountFormData,
                            allow_posting: e.target.checked,
                          })
                        }
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          يسمح بالترحيل
                        </p>
                        <p className="text-[10px] text-slate-400">
                          متاح لترحيل القيود المباشرة
                        </p>
                      </div>
                    </label>

                    {/* Status */}
                    <label className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={accountFormData.status}
                        onChange={(e) =>
                          setAccountFormData({
                            ...accountFormData,
                            status: e.target.checked,
                          })
                        }
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          حساب مفعّل نشط
                        </p>
                        <p className="text-[10px] text-slate-400">
                          جاهز للاستخدام في المعاملات
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl justify-end">
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-amber-600/10 text-sm"
                  >
                    <Save className="w-5 h-5" />
                    حفظ الحساب
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAccountModal(false)}
                    className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold transition-all text-sm"
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

const AccountTreeNode = ({
  node,
  onViewLedger,
  getAccountTypeName,
  onEdit,
  onDelete,
  onAddChild,
  level = 0,
}: any) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);

  const accType = node.account_type || node.type?.toUpperCase() || "ASSET";
  const accNature =
    node.account_nature ||
    (["ASSET", "EXPENSE"].includes(accType) ? "DEBIT" : "CREDIT");

  return (
    <div className="select-none">
      <div
        className={`flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer ${level === 0 ? "bg-slate-50/50" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ marginRight: `${level * 1.5}rem` }}
      >
        <div className="flex items-center gap-3">
          {node.children.length > 0 ? (
            <div
              className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </div>
          ) : (
            <div className="w-4" />
          )}
          <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
            {node.code}
          </span>
          <span
            className={`font-bold text-slate-900 ${level === 0 ? "text-base" : "text-sm"}`}
          >
            {node.name_ar || node.name}
          </span>
          {node.name_en && (
            <span className="text-xs text-slate-400 font-medium hidden md:inline">
              ({node.name_en})
            </span>
          )}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider ${
              accType === "ASSET"
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : accType === "LIABILITY"
                  ? "bg-red-50 text-red-600 border border-red-100"
                  : accType === "EQUITY"
                    ? "bg-purple-50 text-purple-600 border border-purple-100"
                    : accType === "REVENUE"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-orange-50 text-orange-600 border border-orange-100"
            }`}
          >
            {getAccountTypeName(accType.toLowerCase())}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              accNature === "DEBIT"
                ? "bg-indigo-50 text-indigo-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {accNature === "DEBIT" ? "مدين" : "دائن"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-slate-950 text-sm">
            {Number(node.balance || 0 || 0).toLocaleString()} ج.م
          </span>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onAddChild && (
              <button
                type="button"
                onClick={() => onAddChild(node)}
                className="p-1.5 hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 rounded-lg transition-colors"
                title="إضافة حساب فرعي"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="p-1.5 hover:bg-blue-50 hover:text-blue-600 text-slate-400 rounded-lg transition-colors"
                title="تعديل الحساب"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onViewLedger(node.id)}
              className="p-1.5 hover:bg-amber-50 hover:text-amber-600 text-slate-400 rounded-lg transition-colors"
              title="كشف حساب الأستاذ"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="p-1.5 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-lg transition-colors"
                title="حذف هذا الحساب"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child: any) => (
            <AccountTreeNode
              key={child.id}
              node={child}
              onViewLedger={onViewLedger}
              getAccountTypeName={getAccountTypeName}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BalanceSheetReport = ({
  date,
  setDate,
  onRefresh,
  exportToExcel,
  exportToWord,
}: any) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/api/reports/balance-sheet?date=${date}`)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => {
        console.warn("Failed to fetch balance sheet report", err);
        setData({ assets: [], liabilities: [], equity: [], netIncome: 0 });
      })
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return <div className="text-center p-12">جاري التحميل...</div>;

  // Support both old flat format and new grouped format
  const flatAssets = (data?.assets || []).flatMap((a: any) => a.accounts || [{ code: a.code, name: a.name, balance: a.balance }]);
  const flatLiabilities = (data?.liabilities || []).flatMap((l: any) => l.accounts || [{ code: l.code, name: l.name, balance: l.balance }]);
  const flatEquity = (data?.equity || []).flatMap((e: any) => e.accounts || [{ code: e.code, name: e.name, balance: e.balance }]);
  const totalAssets = data?.total_assets ?? flatAssets.reduce((sum: number, a: any) => sum + a.balance, 0);
  const totalLiabilities = data?.total_liabilities ?? flatLiabilities.reduce((sum: number, l: any) => sum + l.balance, 0);
  const totalEquity = data?.total_equity ?? flatEquity.reduce((sum: number, e: any) => sum + e.balance, 0);
  const netIncome = data?.net_income ?? data?.netIncome ?? 0;
  const isBalanced = data?.is_balanced;

  const handleExportExcel = () => {
    const rows = [
      ["الميزانية العمومية"],
      ["التاريخ", date],
      [""],
      ["الأصول"],
      ...(data?.assets || []).map((a: any) => [a.name, a.balance]),
      ["إجمالي الأصول", totalAssets],
      [""],
      ["الخصوم"],
      ...(data?.liabilities || []).map((l: any) => [l.name, l.balance]),
      ["إجمالي الخصوم", totalLiabilities],
      [""],
      ["حقوق الملكية"],
      ...(data?.equity || []).map((e: any) => [e.name, e.balance]),
      ["صافي الدخل", data?.netIncome || 0],
      ["إجمالي حقوق الملكية والخصوم", totalLiabilities + totalEquity],
    ];
    exportToExcel(
      rows.map((r) => ({ البيان: r[0], القيمة: r[1] })),
      "الميزانية_العمومية",
    );
  };

  return (
    <div className="w-full max-w-full px-2 lg:px-4 mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={date ?? ""}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold focus:outline-none"
          />
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() =>
              exportToWord("balance-sheet-table", "الميزانية_العمومية")
            }
            className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Word
          </button>
        </div>
      </div>

      <div
        id="balance-sheet-table"
        className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm"
      >
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">الميزانية العمومية</h2>
            <p className="text-slate-400 text-sm">كما في تاريخ {date}</p>
          </div>
          <FileText className="w-10 h-10 text-amber-500" />
        </div>

        <div className="p-8 grid grid-cols-2 gap-12">
          {/* Assets Side */}
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                الأصول
              </h3>
              <div className="space-y-3">
                {data?.assets?.length > 0 && data?.assets[0]?.accounts ? (
                  // New grouped format
                  data.assets.map((group: any, gIdx: number) => (
                    <div key={gIdx} className="mb-3">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-sm">
                        <span>{group.name} ({group.code})</span>
                        <span className="text-blue-600">{group.subtotal?.toLocaleString()} ج.م</span>
                      </div>
                      {group.accounts?.map((a: any, aIdx: number) => (
                        <div key={aIdx} className="flex justify-between items-center pl-4">
                          <span className="text-slate-500 text-sm">{a.name}</span>
                          <span className="text-slate-700">{Number(a.balance || 0 || 0).toLocaleString()} ج.م</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  // Old flat format
                  flatAssets.map((a: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600">{a.name}</span>
                      <span className="font-bold text-slate-900">
                        {Number(a.balance || 0 || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 font-black text-lg text-blue-700">
                  <span>إجمالي الأصول</span>
                  <span>{Number(totalAssets || 0 || 0).toLocaleString()} ج.م</span>
                </div>
              </div>
            </section>
          </div>

          {/* Liabilities & Equity Side */}
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                الخصوم
              </h3>
              <div className="space-y-3">
                {data?.liabilities?.length > 0 && data?.liabilities[0]?.accounts ? (
                  data.liabilities.map((group: any, gIdx: number) => (
                    <div key={gIdx} className="mb-3">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-sm">
                        <span>{group.name} ({group.code})</span>
                        <span className="text-red-600">{group.subtotal?.toLocaleString()} ج.م</span>
                      </div>
                      {group.accounts?.map((l: any, lIdx: number) => (
                        <div key={lIdx} className="flex justify-between items-center pl-4">
                          <span className="text-slate-500 text-sm">{l.name}</span>
                          <span className="text-slate-700">{Number(l.balance || 0 || 0).toLocaleString()} ج.م</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  flatLiabilities.map((l: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600">{l.name}</span>
                      <span className="font-bold text-slate-900">{Number(l.balance || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between items-center pt-4 border-t border-slate-50 font-bold">
                  <span>إجمالي الخصوم</span>
                  <span>{Number(totalLiabilities || 0 || 0).toLocaleString()} ج.م</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                حقوق الملكية
              </h3>
              <div className="space-y-3">
                {data?.equity?.length > 0 && data?.equity[0]?.accounts ? (
                  data.equity.map((group: any, gIdx: number) => (
                    <div key={gIdx} className="mb-3">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-sm">
                        <span>{group.name} ({group.code})</span>
                        <span className="text-purple-600">{group.subtotal?.toLocaleString()} ج.م</span>
                      </div>
                      {group.accounts?.map((e: any, eIdx: number) => (
                        <div key={eIdx} className="flex justify-between items-center pl-4">
                          <span className="text-slate-500 text-sm">{e.name}</span>
                          <span className="text-slate-700">{Number(e.balance || 0 || 0).toLocaleString()} ج.م</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  flatEquity.map((e: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600">{e.name}</span>
                      <span className="font-bold text-slate-900">{Number(e.balance || 0 || 0).toLocaleString()} ج.م</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between items-center italic text-slate-500">
                  <span>صافي الدخل (الفترة الحالية)</span>
                  <span>{Number(netIncome || 0).toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 font-black text-lg text-purple-700">
                  <span>إجمالي حقوق الملكية والخصوم</span>
                  <span>
                    {data?.total_liabilities_equity ?? (totalLiabilities + totalEquity + netIncome)}{" "}
                    ج.م
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {isBalanced === false && (
          <div className="p-4 bg-red-50 text-red-600 text-center font-bold border-t border-red-100 flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" />
            تنبيه: الميزانية غير متزنة! الفرق:{" "}
            {Number(Math.abs(totalAssets - totalLiabilities - totalEquity - netIncome || 0)).toLocaleString()}{" "}
            ج.م
          </div>
        )}
        {isBalanced === true && (
          <div className="p-3 bg-emerald-50 text-emerald-600 text-center font-bold border-t border-emerald-100 flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            الميزانية متزنة
          </div>
        )}
      </div>
    </div>
  );
};

const TrialBalanceReport = ({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onRefresh,
  exportToExcel,
  exportToWord,
}: any) => {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(
        `/api/reports/trial-balance?startDate=${startDate}&endDate=${endDate}`,
      )
      .then((res) => res.json())
      .then((result) => {
        // Support new { accounts, summary } format and old flat array format
        if (result && result.accounts) {
          setData(result.accounts);
          setSummary(result.summary);
        } else if (Array.isArray(result)) {
          setData(result);
          setSummary(null);
        } else {
          setData([]);
          setSummary(null);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch trial balance report", err);
        setData([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) return <div className="text-center p-12">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
            />
            <span className="text-slate-400">إلى</span>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToExcel(data, "ميزان_المراجعة")}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() =>
              exportToWord("trial-balance-table", "ميزان_المراجعة")
            }
            className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Word
          </button>
        </div>
      </div>

      <div
        id="trial-balance-table"
        className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold">
            ميزان المراجعة (من {startDate} إلى {endDate})
          </h3>
        </div>
        <table className="w-full text-right min-w-[800px]">
          <thead>
            <tr className="text-xs text-slate-400 font-bold border-b border-slate-50">
              <th className="p-4">كود الحساب</th>
              <th className="p-4">اسم الحساب</th>
              <th className="p-4 text-center">رصيد أول</th>
              <th className="p-4 text-center">مدين</th>
              <th className="p-4 text-center">دائن</th>
              <th className="p-4 text-center">رصيد مدين</th>
              <th className="p-4 text-center">رصيد دائن</th>
              <th className="p-4 text-center">الرصيد النهائي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {Array.isArray(data) && data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-4 font-mono text-slate-500">{row.code}</td>
                <td className="p-4 font-bold">{row.name}</td>
                <td className="p-4 text-center text-slate-600">
                  {row.opening_balance?.toLocaleString() || 0}
                </td>
                <td className="p-4 text-center text-emerald-600 font-bold">
                  {row.period_debit?.toLocaleString() || 0}
                </td>
                <td className="p-4 text-center text-red-600 font-bold">
                  {row.period_credit?.toLocaleString() || 0}
                </td>
                <td className="p-4 text-center text-blue-600">
                  {row.debit_balance?.toLocaleString() || 0}
                </td>
                <td className="p-4 text-center text-orange-600">
                  {row.credit_balance?.toLocaleString() || 0}
                </td>
                <td className="p-4 text-center font-black">
                  {row.balance?.toLocaleString() || 0}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
            <tr>
              <td
                colSpan={2}
                className="p-4 text-left font-bold text-slate-800"
              >
                الإجمالي:
              </td>
              <td className="p-4 text-center font-bold">
                {data
                  .reduce((sum, r) => sum + Number(r.opening_balance || 0), 0)
                  .toLocaleString()}
              </td>
              <td className="p-4 text-center text-emerald-600 font-bold">
                {data
                  .reduce((sum, r) => sum + Number(r.period_debit || 0), 0)
                  .toLocaleString()}
              </td>
              <td className="p-4 text-center text-red-600 font-bold">
                {data
                  .reduce((sum, r) => sum + Number(r.period_credit || 0), 0)
                  .toLocaleString()}
              </td>
              <td className="p-4 text-center font-bold">
                {data
                  .reduce((sum, r) => sum + Number(r.balance || 0), 0)
                  .toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {summary && (
        <div className={`p-4 rounded-2xl flex items-center justify-center gap-3 font-bold ${summary.is_balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {summary.is_balanced ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {summary.is_balanced 
            ? `ميزان المراجعة متزن — إجمالي المدين: ${summary.total_debit?.toLocaleString()} | إجمالي الدائن: ${summary.total_credit?.toLocaleString()}`
            : `ميزان المراجعة غير متزن — الفرق: ${summary.difference?.toLocaleString()} ج.م`
          }
        </div>
      )}
    </div>
  );
};

const IncomeStatementReport = ({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onRefresh,
  exportToExcel,
  exportToWord,
}: any) => {
  const [data, setData] = useState<any>(null);
  const [branchData, setBranchData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"consolidated" | "branches">(
    "consolidated",
  );
  const [groupBy, setGroupBy] = useState<"day" | "month" | "year">("day");

  useEffect(() => {
    setLoading(true);
    if (viewMode === "consolidated") {
      api
        .get(
          `/api/reports/income-statement?startDate=${startDate}&endDate=${endDate}`,
        )
        .then((res) => res.json())
        .then(setData)
        .catch((err) => {
          console.warn("Failed to fetch income statement", err);
          setData({ revenue: [], expenses: [] });
        })
        .finally(() => setLoading(false));
    } else {
      api
        .get(
          `/api/reports/branch-profitability?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`,
        )
        .then((res) => res.json())
        .then(setBranchData)
        .catch((err) => {
          console.warn("Failed to fetch branch profitability report", err);
          setBranchData([]);
        })
        .finally(() => setLoading(false));
    }
  }, [startDate, endDate, viewMode, groupBy]);

  if (loading) return <div className="text-center p-12">جاري التحميل...</div>;

  // Support new grouped format (revenue/expenses are arrays of {subtotal, accounts}) or old flat format
  const totalRevenue = data?.total_revenue ?? (data?.revenue?.reduce((sum: number, r: any) => sum + (r.subtotal ?? r.balance ?? 0), 0) || 0);
  const totalExpenses = data?.total_expenses ?? (data?.expenses?.reduce((sum: number, e: any) => sum + (e.subtotal ?? e.balance ?? 0), 0) || 0);
  const netProfit = data?.net_income ?? (totalRevenue - totalExpenses);
  const netMargin = data?.net_margin ?? (totalRevenue > 0 ? Math.round(netProfit / totalRevenue * 100) : 0);

  const handleExportExcel = () => {
    if (viewMode === "consolidated") {
      const rows = [
        ["قائمة الدخل"],
        ["الفترة", `${startDate} إلى ${endDate}`],
        [""],
        ["الإيرادات"],
        ...(data?.revenue || []).map((r: any) => [r.name, r.balance]),
        ["إجمالي الإيرادات", totalRevenue],
        [""],
        ["المصروفات"],
        ...(data?.expenses || []).map((e: any) => [e.name, e.balance]),
        ["إجمالي المصروفات", totalExpenses],
        [""],
        ["صافي الربح/الخسارة", netProfit],
      ];
      exportToExcel(
        rows.map((r) => ({ البيان: r[0], القيمة: r[1] })),
        "قائمة_الدخل",
      );
    } else {
      const rows = branchData.map((r) => ({
        الفرع: r.branch_name,
        الفترة: r.period,
        المبيعات: r.total_sales,
        التكلفة: r.total_cost,
        الربح: r.total_sales - r.total_cost,
      }));
      exportToExcel(rows, "ربحية_الفروع");
    }
  };

  return (
    <div className="w-full max-w-full px-2 lg:px-4 mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
            />
            <span className="text-slate-400">إلى</span>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("consolidated")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === "consolidated" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            القائمة المجمعة
          </button>
          <button
            onClick={() => setViewMode("branches")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === "branches" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            ربحية الفروع
          </button>
        </div>

        {viewMode === "branches" && (
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setGroupBy("day")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${groupBy === "day" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              يومي
            </button>
            <button
              onClick={() => setGroupBy("month")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${groupBy === "month" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              شهري
            </button>
            <button
              onClick={() => setGroupBy("year")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${groupBy === "year" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              سنوي
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() =>
              exportToWord("income-statement-table", "قائمة_الدخل")
            }
            className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Word
          </button>
        </div>
      </div>

      <div
        id="income-statement-table"
        className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm"
      >
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">
              {viewMode === "consolidated" ? "قائمة الدخل" : "ربحية الفروع"}
            </h2>
            <p className="text-slate-400 text-sm">
              عن الفترة من {startDate} إلى {endDate}
            </p>
          </div>
          <PieChart className="w-10 h-10 text-amber-500" />
        </div>

        {viewMode === "consolidated" ? (
          <div className="p-8 space-y-8">
            {/* Revenue */}
            <section>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                الإيرادات
              </h3>
              <div className="space-y-3">
                {data?.revenue?.map((r: any, idx: number) => (
                  r.accounts ? (
                    // Grouped format
                    <div key={idx} className="mb-2">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-sm">
                        <span>{r.name} ({r.code})</span>
                        <span className="text-emerald-600">{r.subtotal?.toLocaleString()} ج.م</span>
                      </div>
                      {r.accounts.map((a: any, aIdx: number) => (
                        <div key={aIdx} className="flex justify-between items-center pl-4">
                          <span className="text-slate-500 text-sm">{a.name}</span>
                          <span className="text-emerald-700">{Number(a.balance || 0 || 0).toLocaleString()} ج.م</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Flat format
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600">{r.name}</span>
                      <span className="font-bold text-emerald-600">
                        {Number(r.balance || 0 || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  )
                ))}
                <div className="flex justify-between items-center pt-4 border-t border-slate-50 font-black text-lg">
                  <span>إجمالي الإيرادات</span>
                  <span className="text-emerald-700">
                    {Number(totalRevenue || 0 || 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </section>

            {/* Expenses */}
            <section>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                المصروفات
              </h3>
              <div className="space-y-3">
                {data?.expenses?.map((e: any, idx: number) => (
                  e.accounts ? (
                    <div key={idx} className="mb-2">
                      <div className="flex justify-between items-center font-bold text-slate-700 text-sm">
                        <span>{e.name} ({e.code})</span>
                        <span className="text-red-600">{e.subtotal?.toLocaleString()} ج.م</span>
                      </div>
                      {e.accounts.map((a: any, aIdx: number) => (
                        <div key={aIdx} className="flex justify-between items-center pl-4">
                          <span className="text-slate-500 text-sm">{a.name}</span>
                          <span className="text-red-700">{Number(a.balance || 0 || 0).toLocaleString()} ج.م</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600">{e.name}</span>
                      <span className="font-bold text-red-600">
                        {Number(e.balance || 0 || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  )
                ))}
                <div className="flex justify-between items-center pt-4 border-t border-slate-50 font-black text-lg">
                  <span>إجمالي المصروفات</span>
                  <span className="text-red-700">
                    {Number(totalExpenses || 0 || 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </section>

            {/* Net Profit */}
            <div
              className={`p-6 rounded-3xl flex justify-between items-center ${netProfit >= 0 ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
            >
              <div>
                <p className="text-sm font-bold uppercase opacity-60">
                  صافي الربح / الخسارة
                </p>
                <h4 className="text-3xl font-black">
                  {Number(netProfit || 0 || 0).toLocaleString()} ج.م
                </h4>
                {netMargin !== undefined && (
                  <p className="text-sm mt-1 opacity-70">
                    هامش صافي الربح: {netMargin}%
                  </p>
                )}
              </div>
              {netProfit >= 0 ? (
                <ArrowUpRight className="w-12 h-12 opacity-20" />
              ) : (
                <ArrowDownLeft className="w-12 h-12 opacity-20" />
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold text-slate-600">الفرع</th>
                  <th className="p-4 font-bold text-slate-600">الفترة</th>
                  <th className="p-4 font-bold text-slate-600 text-center">
                    المبيعات
                  </th>
                  <th className="p-4 font-bold text-slate-600 text-center">
                    التكلفة
                  </th>
                  <th className="p-4 font-bold text-slate-600 text-center">
                    الربح
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchData.map((row: any, idx: number) => {
                  const profit = row.total_sales - row.total_cost;
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800">
                        {row.branch_name}
                      </td>
                      <td className="p-4 text-slate-600" dir="ltr">
                        {row.period}
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-600">
                        {Number(row.total_sales || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-4 text-center font-bold text-red-600">
                        {Number(row.total_cost || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td
                        className={`p-4 text-center font-black ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {Number(profit || 0).toLocaleString()} ج.م
                      </td>
                    </tr>
                  );
                })}
                {branchData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      لا توجد بيانات لهذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              {branchData.length > 0 && (
                <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                  <tr>
                    <td
                      colSpan={2}
                      className="p-4 text-left font-bold text-slate-800"
                    >
                      الإجمالي:
                    </td>
                    <td className="p-4 text-center text-emerald-600 font-bold">
                      {branchData
                        .reduce((sum, r) => sum + Number(r.total_sales || 0), 0)
                        .toLocaleString()}{" "}
                      <span className="text-sm font-normal">ج.م</span>
                    </td>
                    <td className="p-4 text-center text-red-600 font-bold">
                      {branchData
                        .reduce((sum, r) => sum + Number(r.total_cost || 0), 0)
                        .toLocaleString()}{" "}
                      <span className="text-sm font-normal">ج.م</span>
                    </td>
                    <td className="p-4 text-center text-emerald-700 font-bold">
                      {branchData
                        .reduce(
                          (sum, r) =>
                            sum +
                            (Number(r.total_sales || 0) -
                              Number(r.total_cost || 0)),
                          0,
                        )
                        .toLocaleString()}{" "}
                      <span className="text-sm font-normal">ج.م</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-POSTING INTEGRATION DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

const moduleInfo: Record<string, { label: string; icon: string; description: string }> = {
  sales: { label: "المبيعات", icon: "🛒", description: "ترحيل فواتير المبيعات تلقائياً — إيراد + ضريبة + خصم + صندوق/آجل" },
  purchase: { label: "المشتريات", icon: "📦", description: "ترحيل فواتير المشتريات — مخزون + موردون/صندوق" },
  payroll: { label: "المرتبات", icon: "💰", description: "ترحيل كشف المرتبات الشهري — مصروف رواتب + صافي + خصومات" },
  restaurant: { label: "طلبات المطعم", icon: "🍽️", description: "ترحيل طلبات الصالة/تيك أواي/دليفري — إيراد طعام + توصيل" },
  customer_payment: { label: "حركات العملاء", icon: "👥", description: "ترحيل تحصيلات ومبيعات الآجل — عملاء + صندوق/إيراد" },
  treasury: { label: "الخزينة", icon: "🏦", description: "ترحيل حركات النقدية والبنوك" },
  cost: { label: "المصروفات", icon: "📋", description: "ترحيل المصروفات حسب النوع — إيجار/مرافق/صيانة/تسويق" },
  sales_return: { label: "المرتجعات", icon: "↩️", description: "ترحيل إشعارات المرتجع" },
  complaint_refund: { label: "الشكاوى والتعويضات", icon: "⚠️", description: "ترحيل المردودات والتعويضات" },
  inventory_adjustment: { label: "تسويات المخزون", icon: "📊", description: "ترحيل عجز/زيادة المخزون" },
  employee_advance: { label: "سلف الموظفين", icon: "🤝", description: "ترحيل السلف — سلف موظفين + صندوق" },
};

const AutoPostingDashboard: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configData, setConfigData] = useState<any[]>([]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        api.get("/api/v2/erp-gl/auto-post/status"),
        api.get("/api/v2/erp-gl/account-config"),
      ]);
      const statusData = await statusRes.json();
      const configJson = await configRes.json();
      setStatus(statusData);
      setConfigData(configJson || []);
    } catch (e: any) {
      setStatus({ config_status: { total_keys: 27, configured_keys: 0, is_ready: false }, posting_stats: [] });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>;
  }

  const configStatus = status?.config_status || {};
  const postingStats: any[] = status?.posting_stats || [];
  const configuredKeys = configData.filter((c: any) => c.account_id);
  const unConfiguredKeys = configData.filter((c: any) => !c.account_id);
  const stLabels: Record<string, string> = {
    sales: "المبيعات", purchase: "المشتريات", payroll: "المرتبات",
    restaurant: "المطعم", customer_payment: "العملاء", treasury: "الخزينة",
    cost: "المصروفات", sales_return: "المرتجعات", complaint_refund: "الشكاوى",
    inventory_adjustment: "المخزون", employee_advance: "سلف الموظفين",
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-2xl"><Link2 className="w-7 h-7 text-amber-600" /></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">مركز الترحيل التلقائي (ERP)</h2>
              <p className="text-sm text-slate-500">ربط تلقائي بين جميع مديولات النظام والدفة العامة</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-sm font-bold ${configStatus.is_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {configStatus.is_ready ? <span className="flex items-center gap-1"><Check className="w-4 h-4" /> جاهز</span> : <span className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> يحتاج تهيئة</span>}
            </div>
            <button onClick={fetchStatus} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"><RefreshCw className="w-5 h-5 text-slate-600" /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-amber-600">{configStatus.configured_keys || 0}</div>
            <div className="text-sm text-slate-500 mt-1">حساب مضبوط من {configStatus.total_keys || 27}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-blue-600">{postingStats.reduce((s: number, p: any) => s + parseInt(p.count || 0), 0)}</div>
            <div className="text-sm text-slate-500 mt-1">إجمالي القيود المرحلة</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-emerald-600">{postingStats.reduce((s: number, p: any) => s + parseFloat(p.total_debit || 0), 0).toLocaleString()}</div>
            <div className="text-sm text-slate-500 mt-1">إجمالي المبالغ المدينة</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-purple-600">{postingStats.length}</div>
            <div className="text-sm text-slate-500 mt-1">مديولات متصلة</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">اتصال المديولات بالدفعة العامة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(moduleInfo).map(([key, info]) => {
            const stat = postingStats.find((s: any) => s.source_type === key);
            const hasEntries = stat && parseInt(stat.count || 0) > 0;
            const totalDebit = stat ? parseFloat(stat.total_debit || 0) : 0;
            return (
              <div key={key} className={`border rounded-2xl p-4 transition-all hover:shadow-md ${hasEntries ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">{info.label}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${hasEntries ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {hasEntries ? 'متصل ونشط' : 'في انتظار الحركات'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{info.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{stat?.count || 0} قيد</span>
                  <span className="font-bold text-slate-700">{Number(totalDebit || 0).toLocaleString()} ج.م</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">خريطة ربط الحسابات</h3>
          <span className="text-sm text-slate-500">{configuredKeys.length} من {configData.length} مضبوط</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {configData.map((cfg: any, index: number) => (
            <div key={`${cfg.key}_${index}`} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${cfg.account_id ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              {cfg.account_id ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-red-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 truncate">{cfg.description || cfg.key}</div>
                <div className="text-xs text-slate-500">{cfg.key} {cfg.account_id ? `→ #${cfg.account_id}` : '— غير مضبوط'}</div>
              </div>
            </div>
          ))}
        </div>
        {unConfiguredKeys.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">يوجد {unConfiguredKeys.length} حسابات غير مضبوطة</p>
              <p className="text-sm text-amber-700 mt-1">لازم تربط كل مفتاح بالحساب المناسب من شجرة الحسابات عشان الترحيل التلقائي يشتغل.</p>
            </div>
          </div>
        )}
      </div>

      {postingStats.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-4">تفاصيل القيود المرحلة</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead><tr className="bg-slate-50">
                <th className="p-3 font-bold text-slate-700">المديول</th>
                <th className="p-3 font-bold text-slate-700">عدد القيود</th>
                <th className="p-3 font-bold text-slate-700">المنشورة</th>
                <th className="p-3 font-bold text-slate-700">إجمالي المدين</th>
                <th className="p-3 font-bold text-slate-700">إجمالي الدائن</th>
              </tr></thead>
              <tbody>
                {postingStats.map((stat: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-bold">{stLabels[stat.source_type] || stat.source_type}</td>
                    <td className="p-3">{stat.count}</td>
                    <td className="p-3 text-emerald-600">{stat.posted}</td>
                    <td className="p-3">{parseFloat(stat.total_debit || 0 || 0).toLocaleString()} ج.م</td>
                    <td className="p-3">{parseFloat(stat.total_credit || 0 || 0).toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2"><Zap className="w-6 h-6" /> كيف يعمل الترحيل التلقائي؟</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-amber-800">
          <div className="bg-white/70 rounded-2xl p-4"><div className="text-2xl mb-2">1</div><h4 className="font-bold mb-1">حدث في أي مديول</h4><p>لما يحصل أي حركة مالية المديول بيبعت Event للنظام</p></div>
          <div className="bg-white/70 rounded-2xl p-4"><div className="text-2xl mb-2">2</div><h4 className="font-bold mb-1">استقبال وترحيل</h4><p>مركز الأحداث بيستقبل الـ Event ويبني قيد يومية تلقائي</p></div>
          <div className="bg-white/70 rounded-2xl p-4"><div className="text-2xl mb-2">3</div><h4 className="font-bold mb-1">تسجيل في الدفرة</h4><p>القيد بيتسجل وبيظهر في التقارير فوراً</p></div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── GL Dashboard ─────────────── */
const GLDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/gl-dashboard");
      const data = await res.json();
      setDashboardData(data);
    } catch {
      setDashboardData(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>;
  }

  const entries = dashboardData?.entries || {};
  const config = dashboardData?.config || {};
  const currentPeriod = dashboardData?.current_period || {};
  const modules: any[] = dashboardData?.modules || [];
  const recentPostings: any[] = dashboardData?.recent_postings || [];
  const bySource: any[] = dashboardData?.by_source || [];

  const stLabels: Record<string, string> = {
    sales: "المبيعات", purchase: "المشتريات", payroll: "المرتبات",
    restaurant: "المطعم", customer_payment: "العملاء", treasury: "الخزينة",
    cost: "المصروفات", sales_return: "المرتجعات", complaint_refund: "الشكاوى",
    inventory_adjustment: "المخزون", employee_advance: "سلف الموظفين",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-2xl"><Activity className="w-7 h-7 text-amber-600" /></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">لوحة تحكم الدفتر العام</h2>
              <p className="text-sm text-slate-500">نظرة شاملة على حالة النظام المحاسبي والربط مع ERP</p>
            </div>
          </div>
          <button onClick={fetchDashboard} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"><RefreshCw className="w-5 h-5 text-slate-600" /></button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2"><Database className="w-5 h-5 text-amber-600" /></div>
            <div className="text-3xl font-black text-amber-600">{entries.total_entries || 0}</div>
            <div className="text-sm text-slate-500 mt-1">إجمالي القيود</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2"><Clock className="w-5 h-5 text-emerald-600" /></div>
            <div className="text-3xl font-black text-emerald-600">{entries.today_entries || 0}</div>
            <div className="text-sm text-slate-500 mt-1">قيود اليوم</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
            <div className="text-3xl font-black text-blue-600">{config.completeness || 0}%</div>
            <div className="text-sm text-slate-500 mt-1">اكتمال الإعدادات</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2"><Zap className="w-5 h-5 text-purple-600" /></div>
            <div className="text-lg font-black text-purple-600">{currentPeriod.name || 'غير محدد'}</div>
            <div className="text-sm text-slate-500 mt-1">الفترة الحالية</div>
          </div>
        </div>
      </div>

      {/* Module Integration Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2"><Database className="w-6 h-6 text-amber-600" /> حالة ربط المديولات</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead><tr className="bg-slate-50">
              <th className="p-3 font-bold text-slate-700">المديول</th>
              <th className="p-3 font-bold text-slate-700">حالة الإعداد</th>
              <th className="p-3 font-bold text-slate-700">عدد القيود</th>
              <th className="p-3 font-bold text-slate-700">الحجم (ج.م)</th>
            </tr></thead>
            <tbody>
              {modules.map((mod: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-bold">{mod.label || stLabels[mod.source_type] || mod.source_type}</td>
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${mod.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {mod.configured ? 'مُعد' : 'غير مُعد'}
                    </span>
                  </td>
                  <td className="p-3">{mod.entry_count || 0}</td>
                  <td className="p-3">{parseFloat(mod.volume || 0 || 0).toLocaleString()}</td>
                </tr>
              ))}
              {modules.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">لا توجد بيانات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Auto Postings */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2"><Clock className="w-6 h-6 text-amber-600" /> آخر القيود المرحلة</h3>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50"><tr>
              <th className="p-3 font-bold text-slate-700">التاريخ</th>
              <th className="p-3 font-bold text-slate-700">المرجع</th>
              <th className="p-3 font-bold text-slate-700">البيان</th>
              <th className="p-3 font-bold text-slate-700">المصدر</th>
              <th className="p-3 font-bold text-slate-700">المدين</th>
              <th className="p-3 font-bold text-slate-700">الدائن</th>
            </tr></thead>
            <tbody>
              {recentPostings.slice(0, 20).map((p: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{p.date || '—'}</td>
                  <td className="p-3 font-mono text-xs">{p.reference || '—'}</td>
                  <td className="p-3 max-w-xs truncate">{p.description || '—'}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs">{stLabels[p.source_type] || p.source_type || '—'}</span></td>
                  <td className="p-3 text-amber-700 font-bold">{parseFloat(p.total_debit || 0 || 0).toLocaleString()}</td>
                  <td className="p-3 text-emerald-700 font-bold">{parseFloat(p.total_credit || 0 || 0).toLocaleString()}</td>
                </tr>
              ))}
              {recentPostings.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">لا توجد قيود مرحلة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Type Breakdown */}
      {bySource.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-amber-600" /> توزيع القيود حسب المصدر</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bySource.map((src: any, idx: number) => (
              <div key={idx} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                <span className="font-bold text-slate-700">{stLabels[src.source_type] || src.source_type}</span>
                <div className="text-left">
                  <div className="text-lg font-black text-amber-600">{src.count || 0}</div>
                  <div className="text-xs text-slate-400">{parseFloat(src.total || 0 || 0).toLocaleString()} ج.م</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────── Fiscal Years & Periods ─────────────── */

const FISCAL_SCHEMA_DDL = `-- ═════════════════════════════════════════════════════════════════════════════
-- REMO PRO ERP - Fiscal Years & Financial Periods Module (PostgreSQL Schema DDL)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. FISCAL YEARS TABLE (جدول السنوات المالية)
CREATE TABLE IF NOT EXISTS fiscal_years (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE, -- اسم السنة (مثال: السنة المالية 2026)
  start_date DATE NOT NULL,          -- تاريخ بداية السنة المالية
  end_date DATE NOT NULL,            -- تاريخ نهاية السنة المالية
  status VARCHAR(20) DEFAULT 'active', -- 'active' (نشطة), 'closed' (مغلقة), 'draft' (مسودة)
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. FINANCIAL PERIODS TABLE (جدول الفترات والشهور المالية)
CREATE TABLE IF NOT EXISTS financial_periods (
  id SERIAL PRIMARY KEY,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'open', -- 'open' (مفتوحة), 'closed' (مغلقة), 'frozen' (مجمدة للمراجعة)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP,
  UNIQUE(month, year)
);

-- PERFORMANCE INDEXES (فهارس الأداء السريع)
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_year_month ON financial_periods(year, month);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status ON financial_periods(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_years_status ON fiscal_years(status);
`;

const FiscalYearsViewContent: React.FC<{
  activeSettingsTab?: string;
  onSettingsTabChange?: (tab: "fiscal_years" | "account_config" | "budgets" | "audit_logs") => void;
}> = ({ activeSettingsTab = "fiscal_years", onSettingsTabChange }) => {
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [expandedYearId, setExpandedYearId] = useState<number | null>(null);
  const [yearPeriodsMap, setYearPeriodsMap] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState<Record<number, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showDdlModal, setShowDdlModal] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState(false);
  const [selectedClosingYear, setSelectedClosingYear] = useState<any | null>(null);
  const [periodReview, setPeriodReview] = useState<{ fyId: number; periodId: number; report: any; reason: string } | null>(null);
  const [reopenDialog, setReopenDialog] = useState<{ fyId: number; periodId: number; label: string; reason: string } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [closingPreview, setClosingPreview] = useState<any | null>(null);
  const [closingPreviewLoading, setClosingPreviewLoading] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: `السنة المالية ${new Date().getFullYear() + 1}`,
    start_date: `${new Date().getFullYear() + 1}-01-01`,
    end_date: `${new Date().getFullYear() + 1}-12-31`
  });

  const [closingForm, setClosingForm] = useState({
    next_year_name: `السنة المالية ${new Date().getFullYear() + 1}`,
    retained_account_code: "",
    auto_post_entries: true,
    force_close_periods: false,
    reason: ""
  });

  const fetchFiscalYears = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/fiscal-years");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.fiscal_years || [];
        setFiscalYears(list);
        if (list.length > 0) {
          setExpandedYearId(list[0].id);
        }
      } else {
        setFiscalYears([]);
      }
    } catch {
      setFiscalYears([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriodsForYear = async (fyId: number) => {
    setPeriodsLoading((prev) => ({ ...prev, [fyId]: true }));
    try {
      const res = await api.get(`/api/financial-periods?fiscal_year_id=${fyId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || data.periods || [];
        setYearPeriodsMap((prev) => ({ ...prev, [fyId]: list }));
      } else {
        setYearPeriodsMap((prev) => ({ ...prev, [fyId]: [] }));
      }
    } catch {
      setYearPeriodsMap((prev) => ({ ...prev, [fyId]: [] }));
    } finally {
      setPeriodsLoading((prev) => ({ ...prev, [fyId]: false }));
    }
  };

  useEffect(() => {
    fetchFiscalYears();
  }, []);

  useEffect(() => {
    if (expandedYearId && !yearPeriodsMap[expandedYearId]) {
      fetchPeriodsForYear(expandedYearId);
    }
  }, [expandedYearId]);

  const toggleAccordion = (fyId: number) => {
    if (expandedYearId === fyId) {
      setExpandedYearId(null);
    } else {
      setExpandedYearId(fyId);
      if (!yearPeriodsMap[fyId]) {
        fetchPeriodsForYear(fyId);
      }
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.start_date || !createForm.end_date) {
      alert("يرجى ملء كافة حقول السنة المالية");
      return;
    }
    try {
      const res = await api.post("/api/fiscal-years", createForm);
      if (res.ok) {
        alert("تم إنشاء السنة المالية وإنشاء الفترات الـ 12 شهراً بنجاح!");
        setShowCreateModal(false);
        fetchFiscalYears();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "فشل إنشاء السنة المالية");
      }
    } catch {
      alert("تعذّر الاتصال بالخادم. لم يتم إنشاء السنة المالية ولم تُحفظ أي بيانات.");
    }
  };

  // الحالة تُقرأ دائمًا من الخادم بعد أي إجراء؛ لا تحديث تفاولي يخفي فشل الـ API.
  const refreshAfterPeriodAction = async (fyId: number) => {
    await fetchFiscalYears();
    await fetchPeriodsForYear(fyId);
  };

  /** فتح نافذة التحقق قبل اإقفال: تعرض الأخطاء والتحذيرات الحقيقية من الخادم. */
  const handleTogglePeriodStatus = async (fyId: number, periodId: number, currentStatus: string) => {
    if (currentStatus !== "open") {
      setReopenDialog({ fyId, periodId, label: "هذه الفترة", reason: "" });
      return;
    }

    setActionBusy(true);
    try {
      const res = await api.post(`/api/financial-periods/${periodId}/preflight`, {});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error || "تعذّر التحقق من الفترة المالية");
        return;
      }
      setPeriodReview({ fyId, periodId, report: body, reason: "" });
    } catch {
      alert("تعذّر الاتصال بالخادم للتحقق من الفترة. لم تتغير حالة الفترة.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmClosePeriod = async () => {
    if (!periodReview) return;
    setActionBusy(true);
    try {
      const res = await api.post(`/api/financial-periods/${periodReview.periodId}/close`, {
        reason: periodReview.reason || "إقفال دوري معتمد",
        allow_drafts: !!periodReview.report?.counts?.status_draft,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(body?.report?.errors)
          ? "\n" + body.report.errors.map((e: any) => `• ${e.message}`).join("\n")
          : "";
        alert((body.error || "فشل إقفال الفترة") + details);
        await refreshAfterPeriodAction(periodReview.fyId);
        return;
      }
      setPeriodReview(null);
      await refreshAfterPeriodAction(periodReview.fyId);
      alert(body.message || "تم إقفال الفترة بنجاح.");
    } catch {
      alert("تعذّر الاتصال بالخادم. لم يتم إقفال الفترة.");
      await refreshAfterPeriodAction(periodReview.fyId);
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmReopenPeriod = async () => {
    if (!reopenDialog) return;
    const reason = reopenDialog.reason.trim();
    if (reason.length < 10) {
      alert("سبب إعادة الفتح إلزامي ويجب ألا يقل عن 10 أحرف، ويُسجَّل في سجل التدقيق.");
      return;
    }
    setActionBusy(true);
    try {
      const res = await api.post(`/api/financial-periods/${reopenDialog.periodId}/reopen`, { reason });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error || "فشل إعادة فتح الفترة");
      } else {
        alert(body.message || "تم إعادة فتح الفترة.");
      }
      setReopenDialog(null);
      await refreshAfterPeriodAction(reopenDialog.fyId);
    } catch {
      alert("تعذّر الاتصال بالخادم. لم يتم إعادة فتح الفترة.");
      await refreshAfterPeriodAction(reopenDialog.fyId);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSetPeriodStatus = async (fyId: number, periodId: number, status: string) => {
    if (status === "open") {
      setReopenDialog({ fyId, periodId, label: "هذه الفترة", reason: "" });
      return;
    }
    if (status === "frozen" && !confirm("تجميد الفترة يمنع الترحيل إليها حتى إلغاء التجميد. متابعة؟")) return;

    setActionBusy(true);
    try {
      const res = await api.post(`/api/financial-periods/${periodId}/toggle`, { target_status: status });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) alert(body.error || "فشل تغيير حالة الفترة");
    } catch {
      alert("تعذّر الاتصال بالخادم. لم تتغير حالة الفترة.");
    } finally {
      setActionBusy(false);
      await refreshAfterPeriodAction(fyId);
    }
  };

  const handleOpenYearClosingModal = async (fy: any) => {
    setSelectedClosingYear(fy);
    const yearNum = parseInt(fy.name.replace(/\D/g, '')) || new Date().getFullYear();
    setClosingForm({
      next_year_name: `السنة المالية ${yearNum + 1}`,
      retained_account_code: "",
      auto_post_entries: true,
      force_close_periods: false,
      reason: ""
    });
    setShowClosingModal(true);
    setClosingPreview(null);
    setClosingPreviewLoading(true);
    try {
      const res = await api.get(`/api/fiscal-years/${fy.id}/closing-preview`);
      const body = await res.json().catch(() => ({}));
      if (res.ok) setClosingPreview(body);
      else alert(body.error || "تعذّر تحميل معاينة الإقفال السنوي");
    } catch {
      alert("تعذّر الاتصال بالخادم لتحميل معاينة الإقفال.");
    } finally {
      setClosingPreviewLoading(false);
    }
  };

  const handleExecuteYearEndClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClosingYear) return;
    if (!confirm(`سيتم إقفال السنة «${selectedClosingYear.name}» وإنشاء قيود الإقفال والأرصدة الافتتاحية. متابعة؟`)) return;

    setActionBusy(true);
    try {
      const payload: any = {
        next_year_name: closingForm.next_year_name,
        auto_post_entries: closingForm.auto_post_entries,
        force_close_periods: closingForm.force_close_periods,
        carry_forward: closingForm.auto_post_entries,
        create_next_year: true,
      };
      if (closingForm.retained_account_code?.trim()) payload.retained_account_code = closingForm.retained_account_code.trim();
      if (closingForm.reason?.trim()) payload.reason = closingForm.reason.trim();

      const res = await api.post(`/api/fiscal-years/${selectedClosingYear.id}/close-and-carryover`, payload);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(body?.report?.errors)
          ? "\n" + body.report.errors.map((item: any) => `• ${item.message || item.code}`).join("\n")
          : "";
        alert((body.error || "فشل إقفال السنة المالية وترحيل الأرصدة") + details);
        return;
      }

      setShowClosingModal(false);
      await fetchFiscalYears();
      await fetchPeriodsForYear(selectedClosingYear.id);
      alert(body.message || ("تم إقفال " + selectedClosingYear.name + " وترحيل الأرصدة."));
    } catch {
      alert("تعذّر الاتصال بالخادم. لم يتم إقفال السنة المالية ولن تُنشأ أي قيود.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(FISCAL_SCHEMA_DDL);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2500);
  };

  // Summary Metrics
  const activeYearsCount = fiscalYears.filter((y) => y.status === "active").length;
  const totalYearsCount = fiscalYears.length;
  const currentExpandedYear = fiscalYears.find((y) => y.id === expandedYearId) || fiscalYears[0];
  const currentPeriods = (expandedYearId ? yearPeriodsMap[expandedYearId] : []) || [];
  const openPeriodsCount = currentPeriods.filter((p) => p.status === "open").length;
  const closedPeriodsCount = currentPeriods.filter((p) => p.status === "closed").length;
  const frozenPeriodsCount = currentPeriods.filter((p) => p.status === "frozen").length;

  return (
    <div className="space-y-6 text-slate-900">
      <GeneralAccountsSettingsNav
        activeTab={activeSettingsTab}
        onSelectTab={(tab) => {
          if (onSettingsTabChange) {
            onSettingsTabChange(tab);
          }
        }}
      />

      {/* Top Banner & Main Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 backdrop-blur-md border border-amber-400/30 rounded-2xl text-amber-400">
                <CalendarDays className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight text-white">إدارة السنوات المالية والفترات</h2>
                  <span className="px-3 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold rounded-full">
                    الحسابات العامة GL
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1">
                  التحكم المحاسبي في إغلاق الشهور، الإغلاق السنوي، ترحيل الأرصدة، وجدار حماية التعديل المحاسبي.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowDdlModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-sm transition shadow-sm"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span>PostgreSQL DDL</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/25 transition active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>إنشاء سنة مالية جديدة</span>
            </button>
          </div>
        </div>

        {/* Analytics Cards Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">السنوات المالية النشطة</div>
              <div className="text-xl font-black text-white">{activeYearsCount} من {totalYearsCount} سنة</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">فترات {currentExpandedYear?.name || 'السنة'}</div>
              <div className="text-xl font-black text-white">
                <span className="text-emerald-400">{openPeriodsCount} مفتوحة</span> / <span className="text-slate-400">{closedPeriodsCount} مغلقة</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">فترات مجمدة للمراجعة</div>
              <div className="text-xl font-black text-purple-300">{frozenPeriodsCount} فترة</div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">جدار حماية الفترات المغلقة</div>
              <div className="text-sm font-black text-cyan-300">مفعل (Validation Middleware)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fiscal Years List & Expandable Accordion */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">سجل السنوات الفتراية المحاسبية</h3>
            <p className="text-xs text-slate-500 mt-0.5">اضغط على أي سنة مالية لاستعراض وإدارة الشهور والفترات المالية الـ 12 الخاصة بها.</p>
          </div>
          <button
            onClick={fetchFiscalYears}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          {fiscalYears.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-[1.5]" />
              <p className="font-bold text-slate-600">لا توجد سنوات مالية مسجلة حالياً</p>
              <p className="text-xs text-slate-400 mt-1">اضغط على &quot;إنشاء سنة مالية جديدة&quot; لتهيئة الفترات المحاسبية السنوية.</p>
            </div>
          ) : (
            fiscalYears.map((fy) => {
            const isExpanded = expandedYearId === fy.id;
            const periods = yearPeriodsMap[fy.id] || [];
            const isLoadingPeriods = periodsLoading[fy.id];

            return (
              <div
                key={fy.id}
                className={`border rounded-2xl transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-amber-300 bg-amber-50/20 shadow-md ring-1 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {/* Accordion Header Row */}
                <div
                  onClick={() => toggleAccordion(fy.id)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className={`p-2 rounded-xl transition-transform ${
                        isExpanded ? 'bg-amber-100 text-amber-800 rotate-180' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>

                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-slate-900">{fy.name}</span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            fy.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : fy.status === 'closed'
                              ? 'bg-slate-200 text-slate-700 border border-slate-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {fy.status === 'active' ? 'نشطة للمُعاملات' : fy.status === 'closed' ? 'مغلقة كلياً' : 'مسودة'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                        <span>من {fy.start_date} إلى {fy.end_date}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          {fy.total_periods || 12} فترة ({fy.closed_periods || 0} مغلقة)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {fy.status === 'active' ? (
                      <button
                        onClick={() => handleOpenYearClosingModal(fy)}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>إغلاق السنة وترحيل الأرصدة</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> السنة مغلقة ومرحلة
                      </span>
                    )}

                    <button
                      onClick={() => toggleAccordion(fy.id)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>{isExpanded ? 'إخفاء الفترات' : 'استعراض الفترات'}</span>
                    </button>
                  </div>
                </div>

                {/* Accordion Expandable Periods Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-slate-200/80 bg-slate-50/50 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <CalendarDays className="w-4 h-4 text-amber-600" />
                          <span>فترات وشهور السنة: {fy.name}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          ملاحظة: يمكنك إغلاق أو فتح الفترة بنقرة واحدة باستخدام زر التغيير السريع (Toggle Switch).
                        </div>
                      </div>

                      {isLoadingPeriods ? (
                        <div className="p-8 text-center">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                          <p className="text-xs text-slate-500 mt-2">جاري تحميل الفترات المحاسبية...</p>
                        </div>
                      ) : periods.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">لا توجد فترات مسجلة لهذه السنة المالية</div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <table className="w-full text-right border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                                <th className="p-3"># الفترة والشهر</th>
                                <th className="p-3">تاريخ البداية</th>
                                <th className="p-3">تاريخ النهاية</th>
                                <th className="p-3">حالة الفترة</th>
                                <th className="p-3 text-center">عدد القيود المحاسبية</th>
                                <th className="p-3 text-center">التغيير السريع (Toggle)</th>
                                <th className="p-3 text-left">إجراءات المراجعة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {periods.map((period: any) => {
                                const isOpen = period.status === 'open';
                                const isClosed = period.status === 'closed';
                                const isFrozen = period.status === 'frozen';

                                return (
                                  <tr key={period.id} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="p-3 font-bold text-slate-900">
                                      {period.name || `شهر ${period.month} — ${period.year}`}
                                    </td>
                                    <td className="p-3 text-slate-600 font-mono">{period.start_date || '—'}</td>
                                    <td className="p-3 text-slate-600 font-mono">{period.end_date || '—'}</td>
                                    <td className="p-3">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                          isOpen
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                            : isClosed
                                            ? 'bg-slate-200 text-slate-700 border border-slate-300'
                                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                                        }`}
                                      >
                                        {isOpen ? (
                                          <>
                                            <Unlock className="w-3 h-3 text-emerald-600" />
                                            <span>مفتوحة للمُعاملات</span>
                                          </>
                                        ) : isClosed ? (
                                          <>
                                            <Lock className="w-3 h-3 text-slate-600" />
                                            <span>مغلقة</span>
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="w-3 h-3 text-purple-600" />
                                            <span>مجمدة للمراجعة</span>
                                          </>
                                        )}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center font-bold text-slate-700">
                                      {period.entry_count || 0} قيد
                                    </td>
                                    {/* Fast Toggle Switch */}
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePeriodStatus(fy.id, period.id, period.status)}
                                        className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner ${
                                          isOpen ? 'bg-emerald-500' : isClosed ? 'bg-slate-400' : 'bg-purple-500'
                                        }`}
                                        title={isOpen ? "انقر لإغلاق الفترة" : "انقر لفتح الفترة"}
                                      >
                                        <span
                                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                                            isOpen ? 'translate-x-1' : 'translate-x-7'
                                          }`}
                                        />
                                      </button>
                                    </td>

                                    <td className="p-3 text-left">
                                      <div className="flex items-center justify-end gap-2">
                                        {isFrozen ? (
                                          <button
                                            onClick={() => handleSetPeriodStatus(fy.id, period.id, 'open')}
                                            className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold transition"
                                          >
                                            إلغاء التجميد
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleSetPeriodStatus(fy.id, period.id, 'frozen')}
                                            className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition"
                                          >
                                            تجميد للمراجعة
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Modal 0: Period Close Review (preflight) */}
      <AnimatePresence>
        {periodReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !actionBusy && setPeriodReview(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl z-10 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${periodReview.report?.can_close ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">مراجعة إقفال الفترة {periodReview.report?.period?.label}</h3>
                    <p className="text-[11px] text-slate-500">
                      {periodReview.report?.range?.start} — {periodReview.report?.range?.end} ·
                      {' '}{periodReview.report?.counts?.entries ?? 0} قيد · {' '}
                      {periodReview.report?.can_close ? 'لا توجد أخطاء حرجة' : `${periodReview.report?.errors?.length ?? 0} خطأ حرج`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => !actionBusy && setPeriodReview(null)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                {Array.isArray(periodReview.report?.errors) && periodReview.report.errors.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 space-y-1.5">
                    <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> أخطاء تمنع الإقفال</div>
                    {periodReview.report.errors.map((item: any, idx: number) => (
                      <div key={idx} className="text-[11px] text-rose-700 leading-relaxed">• {item.message}</div>
                    ))}
                  </div>
                )}

                {Array.isArray(periodReview.report?.warnings) && periodReview.report.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1.5">
                    <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تحذيرات للمراجعة</div>
                    {periodReview.report.warnings.map((item: any, idx: number) => (
                      <div key={idx} className="text-[11px] text-amber-800 leading-relaxed">• {item.message}</div>
                    ))}
                  </div>
                )}

                {Array.isArray(periodReview.report?.reconciliations) && periodReview.report.reconciliations.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">مطابقة دفتر الأستاذ مع الدفاتر الفرعية</div>
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-white text-slate-500"><tr><th className="p-2">البيان</th><th className="p-2">دفتر الأستاذ</th><th className="p-2">الدفتر الفرعي</th><th className="p-2">الفرق</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {periodReview.report.reconciliations.map((row: any) => (
                          <tr key={row.key}>
                            <td className="p-2 font-bold text-slate-700">{row.label}</td>
                            <td className="p-2 font-mono">{Number(row.gl).toFixed(2)}</td>
                            <td className="p-2 font-mono">{Number(row.subledger).toFixed(2)}</td>
                            <td className={`p-2 font-mono font-bold ${Math.abs(Number(row.difference)) > 0.5 ? 'text-rose-600' : 'text-emerald-600'}`}>{Number(row.difference).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب الإقفال (يُسجَّل في سجل التدقيق)</label>
                  <input
                    type="text"
                    value={periodReview.reason}
                    onChange={(e) => setPeriodReview({ ...periodReview, reason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800"
                    placeholder="مثال: إقفال شهر أكتوبر بعد مراجعة القيود"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/60">
                <span className={`text-[11px] font-bold ${periodReview.report?.can_close ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {periodReview.report?.can_close ? 'جاهزة للإقفال' : 'يجب معالجة الأخطاء أولاً'}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPeriodReview(null)} disabled={actionBusy} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">إلغاء</button>
                  <button
                    type="button"
                    onClick={handleConfirmClosePeriod}
                    disabled={actionBusy || !periodReview.report?.can_close}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    {actionBusy ? 'جارٍ التنفيذ...' : 'تأكيد إقفال الفترة'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 0b: Reopen Period (mandatory reason) */}
      <AnimatePresence>
        {reopenDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !actionBusy && setReopenDialog(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl"><Unlock className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">إعادة فتح الفترة</h3>
                    <p className="text-[11px] text-slate-500">فتح الفترة يسمح بالترحيل إليها من جديد، ويُسجَّل الإجراء باسمك والسبب والتوقيت.</p>
                  </div>
                </div>
                <button type="button" onClick={() => !actionBusy && setReopenDialog(null)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب إعادة الفتح <span className="text-rose-600">*</span></label>
                <textarea
                  value={reopenDialog.reason}
                  onChange={(e) => setReopenDialog({ ...reopenDialog, reason: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800"
                  placeholder="اذكر سببًا واضحًا (10 أحرف على الأقل) — مثال: تصحيح قيد مورد مسجل بالخطأ"
                />
                <p className="text-[10px] text-slate-400 mt-1">لن يُسمح بإعادة الفتح إذا وُجدت فترة لاحقة مغلقة، أو إذا كانت السنة المالية مغلقة نهائيًا.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setReopenDialog(null)} disabled={actionBusy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">إلغاء</button>
                <button
                  type="button"
                  onClick={handleConfirmReopenPeriod}
                  disabled={actionBusy || reopenDialog.reason.trim().length < 10}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {actionBusy ? 'جارٍ التنفيذ...' : 'تأكيد إعادة الفتح'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 1: Create New Fiscal Year */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">إنشاء سنة مالية جديدة</h3>
                    <p className="text-xs text-slate-500">سيقوم النظام تلقائياً بتوليد 12 فترة مالية شهرية تابعة لها.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateYear} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم السنة المالية</label>
                  <input
                    type="text"
                    value={createForm.name ?? ""}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                    placeholder="مثال: السنة المالية 2027"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ البداية</label>
                    <input
                      type="date"
                      value={createForm.start_date ?? ""}
                      onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={createForm.end_date ?? ""}
                      onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" /> الإنشاء التلقائي الذكي للفترات
                  </div>
                  <p className="text-slate-600">
                    عند الاعتماد، ستقوم المنظومة تلقائياً بإنشاء 12 فترة مالية شهرية تبدأ من يناير وحتى ديسمبر وتفعيل جدار الحماية المحاسبي.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black shadow-md transition"
                  >
                    تأكيد وإصدار السنة المالية
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Year-End Closing & Balance Carryover */}
      <AnimatePresence>
        {showClosingModal && selectedClosingYear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClosingModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">إغلاق السنة وتكفيل الأرصدة</h3>
                    <p className="text-xs text-slate-500">{selectedClosingYear.name} ({selectedClosingYear.start_date} — {selectedClosingYear.end_date})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClosingModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteYearEndClosing} className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                  {closingPreviewLoading ? (
                    <div className="py-6 text-center text-slate-500 font-bold">جارٍ احتساب نتيجة السنة من دفتر الأستاذ...</div>
                  ) : closingPreview ? (
                    <>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>إجمالي إيرادات السنة (من القيود المرحلة):</span>
                        <span className="font-bold font-mono text-emerald-700">{Number(closingPreview.revenue_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>إجمالي المصروفات والتكاليف:</span>
                        <span className="font-bold font-mono text-rose-700">{Number(closingPreview.expense_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
                        <span>صافي نتيجة السنة:</span>
                        <span className={`font-mono ${Number(closingPreview.net_result || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {Number(closingPreview.net_result || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between"><span>فترات غير مغلقة:</span><span className="font-bold">{closingPreview.periods_open ?? 0}</span></div>
                        <div className="flex justify-between"><span>إجمالي الأرصدة الافتتاحية (مدين / دائن):</span><span className="font-bold font-mono">{Number(closingPreview.totals?.openingDebit || 0).toFixed(2)} / {Number(closingPreview.totals?.openingCredit || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>قيود إقفال سابقة:</span><span className="font-bold">{closingPreview.closing_entry_exists ? 'موجودة (لن تتكرر)' : 'لا توجد'}</span></div>
                      </div>
                      {Array.isArray(closingPreview.issues) && closingPreview.issues.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50 rounded-xl p-2 space-y-1">
                          {closingPreview.issues.map((issue: any, idx: number) => (
                            <div key={idx} className="text-[11px] font-bold text-amber-800">• {issue.message}</div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-4 text-center text-rose-600 font-bold">تعذّر تحميل أرقام السنة المالية من الخادم.</div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حساب الأرباح المحتجزة (كود الحساب)</label>
                  <input
                    type="text"
                    value={closingForm.retained_account_code ?? ""}
                    onChange={(e) => setClosingForm({ ...closingForm, retained_account_code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800"
                    placeholder="اتركه فارغًا لاستخدام الحساب المضبوط في إعدادات الحسابات"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب الإقفال (يُسجَّل في سجل التدقيق)</label>
                  <input
                    type="text"
                    value={closingForm.reason ?? ""}
                    onChange={(e) => setClosingForm({ ...closingForm, reason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800"
                    placeholder="مثال: إقفال السنة المالية بعد اعتماد القوائم"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">السنة المالية المستقبلة للأرصدة الافتتاحية</label>
                  <input
                    type="text"
                    value={closingForm.next_year_name ?? ""}
                    onChange={(e) => setClosingForm({ ...closingForm, next_year_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="auto_post"
                    checked={closingForm.auto_post_entries}
                    onChange={(e) => setClosingForm({ ...closingForm, auto_post_entries: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <label htmlFor="auto_post" className="text-xs font-bold text-slate-700">
                    إنشاء قيود الإقفال والأرصدة الافتتاحية آليًا في دفتر اليومية
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="force_close_periods"
                    checked={closingForm.force_close_periods}
                    onChange={(e) => setClosingForm({ ...closingForm, force_close_periods: e.target.checked })}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <label htmlFor="force_close_periods" className="text-xs font-bold text-slate-700">
                    إقفال الفترات الشهرية المتبقية تلقائيًا داخل نفس المعاملة
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowClosingModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    تأكيد إغلاق السنة وترحيل الأرصدة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: PostgreSQL DDL Schema Viewer */}
      <AnimatePresence>
        {showDdlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDdlModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl z-10 p-6 space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">PostgreSQL DDL Schema — Fiscal Years & Periods</h3>
                    <p className="text-xs text-slate-400">كويري إنشاء وتأمين جداول السنوات والفترات المحاسبية بالكامل</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyDdl}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedDdl ? "تم النسخ!" : "نسخ الكويري"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDdlModal(false)}
                    className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 max-h-96 overflow-y-auto font-mono text-xs text-cyan-300 leading-relaxed dir-ltr text-left">
                <pre>{FISCAL_SCHEMA_DDL}</pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowDdlModal(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Fallback Error Boundary to completely guard against rendering errors / blank screen
class FiscalYearsErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: any, errorInfo: any) {
    console.error("FiscalYearsErrorBoundary caught error:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-4">
          <div className="inline-p-3 bg-amber-100 text-amber-700 rounded-2xl p-4 inline-block">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">تعذر عرض شاشة السنوات المالية والفترات بشكل مؤقت</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            حدث خطأ غير متوقع أثناء المعالجة، يرجى النقر على زر إستعادة الواجهة لإعادة التحميل الآمن.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition"
          >
            إعادة الاستعادة والتحديث
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const FiscalYearsView: React.FC<{
  activeSettingsTab?: string;
  onSettingsTabChange?: (tab: "fiscal_years" | "account_config" | "budgets" | "audit_logs") => void;
}> = ({ activeSettingsTab, onSettingsTabChange }) => {
  return (
    <FiscalYearsErrorBoundary>
      <FiscalYearsViewContent activeSettingsTab={activeSettingsTab} onSettingsTabChange={onSettingsTabChange} />
    </FiscalYearsErrorBoundary>
  );
};

/* ─────────────── Account Config ─────────────── */
const AccountConfigView: React.FC<{
  activeSettingsTab?: string;
  onSettingsTabChange?: (tab: "fiscal_years" | "account_config" | "budgets" | "audit_logs") => void;
}> = ({ activeSettingsTab = "account_config", onSettingsTabChange }) => {
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [configData, setConfigData] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, accountsRes] = await Promise.all([
        api.get("/api/account-config"),
        api.get("/api/accounts"),
      ]);
      const configJson = await configRes.json();
      const accountsJson = await accountsRes.json();
      setConfigData(Array.isArray(configJson) ? configJson : configJson.data || []);
      setAccounts(Array.isArray(accountsJson) ? accountsJson : accountsJson.data || accountsJson.accounts || []);
    } catch { setConfigData([]); setAccounts([]); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdate = async (key: string, accountId: number | null) => {
    try {
      const res = await api.put(`/api/account-config/${key}`, { account_id: accountId });
      if (res.ok) {
        setConfigData((prev) => prev.map((c) => c.key === key ? { ...c, account_id: accountId } : c));
      } else {
        alert("فشل تحديث إعداد الحساب");
      }
    } catch { alert("خطأ في الاتصال بالخادم"); }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>;
  }

  const linkedCount = configData.filter((c: any) => c.account_id).length;
  const totalCount = configData.length;
  const completenessPercent = totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <GeneralAccountsSettingsNav
        activeTab={activeSettingsTab}
        onSelectTab={(tab) => {
          if (onSettingsTabChange) {
            onSettingsTabChange(tab);
          }
        }}
      />

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-2xl"><Settings className="w-7 h-7 text-amber-600" /></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">إعدادات الحسابات</h2>
              <p className="text-sm text-slate-500">ربط مفاتيح النظام المحاسبي بالحسابات في شجرة الحسابات</p>
            </div>
          </div>
        </div>

        {/* Completeness Indicator */}
        <div className="mt-6 bg-slate-50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-slate-700">مؤشر اكتمال الربط</span>
            <span className={`text-sm font-bold ${completenessPercent === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {linkedCount} من {totalCount} حساب مربوط ({completenessPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completenessPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${completenessPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
          </div>
          {completenessPercent < 100 && (
            <div className="mt-3 flex items-start gap-2 text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>يوجد {totalCount - linkedCount} حسابات غير مربوطة. يجب ربط جميع الحسابات لتفعيل الترحيل التلقائي.</span>
            </div>
          )}
          {completenessPercent === 100 && (
            <div className="mt-3 flex items-start gap-2 text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>جميع الحسابات مربوطة بنجاح! النظام جاهز للعمل.</span>
            </div>
          )}
        </div>
      </div>

      {/* Config Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2"><Link2 className="w-6 h-6 text-amber-600" /> جدول الربط</h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50"><tr>
              <th className="p-3 font-bold text-slate-700 w-8">#</th>
              <th className="p-3 font-bold text-slate-700">المفتاح</th>
              <th className="p-3 font-bold text-slate-700">الوصف</th>
              <th className="p-3 font-bold text-slate-700">الحساب المربوط</th>
              <th className="p-3 font-bold text-slate-700">الحالة</th>
            </tr></thead>
            <tbody>
              {configData.map((cfg: any, idx: number) => (
                <tr key={`${cfg.key}_${idx}`} className={`border-b border-slate-100 hover:bg-slate-50 ${cfg.account_id ? '' : 'bg-red-50/30'}`}>
                  <td className="p-3 text-slate-400 text-xs">{idx + 1}</td>
                  <td className="p-3 font-mono text-xs text-slate-600">{cfg.key}</td>
                  <td className="p-3 font-bold text-slate-800">{cfg.description || cfg.key}</td>
                  <td className="p-3">
                    <select
                      value={cfg.account_id || ''}
                      onChange={(e) => handleUpdate(cfg.key, e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full max-w-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="">— اختر حساب —</option>
                      {accounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    {cfg.account_id ? (
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> مربوط</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-4 h-4" /> غير مربوط</span>
                    )}
                  </td>
                </tr>
              ))}
              {configData.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">لا توجد إعدادات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceOCRModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onJournalPosted={() => {
          fetchData();
        }}
      />
    </div>
  );
};
