import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  Download,
  Printer,
  Filter,
  Search,
  Wallet,
  Landmark,
  Coins,
  History,
  Calendar,
  RefreshCcw,
  FileText,
  ShieldCheck,
  Users,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingDown,
  Building2,
  Layers
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "../utils/fetcher";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type TreasuryReportType = "detailed" | "closings" | "custodies" | "transfers" | "payroll";

interface TreasuryReportsProps {
  onBack: () => void;
  initialTab?: TreasuryReportType;
}

const safeFormat = (dateVal: any, formatStr: string, options?: any) => {
  if (!dateVal) return "---";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "---";
  try {
    return format(d, formatStr, options);
  } catch (err) {
    return "---";
  }
};

export const TreasuryReports: React.FC<TreasuryReportsProps> = ({ onBack, initialTab }) => {
  const [activeReportType, setActiveReportType] = useState<TreasuryReportType>(initialTab || "detailed");
  // شهر تقرير صرف المرتبات (YYYY-MM) — منفصل عن مدى فلترة حركات الخزينة.
  const [payrollMonth, setPayrollMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  React.useEffect(() => {
    if (initialTab) {
      setActiveReportType(initialTab);
    }
  }, [initialTab]);

  // شريط تبويبات التقارير أفقي وقابل للتمرير، وتبويب المرتبات هو الأخير؛
  // نجعل التبويب النشط ظاهرًا دائمًا حتى لا يبدو التقرير المفتوح من القائمة مخفيًا.
  const reportTabsRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const strip = reportTabsRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(`[data-report-tab="${activeReportType}"]`);
    if (active) active.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeReportType]);

  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Custody Specific Filters
  const [custodyStatus, setCustodyStatus] = useState<string>("all");
  const [custodyCategory, setCustodyCategory] = useState<string>("all");
  const [custodySearch, setCustodySearch] = useState<string>("");
  const [custodyOverdueOnly, setCustodyOverdueOnly] = useState<boolean>(false);

  const { data: accountsRaw } = useSWR("/api/treasury/accounts", fetcher);
  const accounts: any[] = Array.isArray(accountsRaw) ? accountsRaw : [];

  // 1. Detailed transactions and inter-account transfer reports
  const reportUrl = `/api/treasury/reports/detailed?accountId=${selectedAccountId === "all" ? "" : selectedAccountId}&startDate=${startDate}&endDate=${endDate}&transactionType=${selectedType}`;
  const { data: reportDataRaw, isLoading: isDetailedLoading } = useSWR(
    activeReportType === "detailed" ? reportUrl : null,
    fetcher
  );
  const reportData: any[] = Array.isArray(reportDataRaw) ? reportDataRaw : [];

  const transfersUrl = `/api/treasury/transfers/reports?startDate=${startDate}&endDate=${endDate}&accountId=${selectedAccountId === "all" ? "" : selectedAccountId}`;
  const { data: transfersReportRaw, isLoading: isTransfersLoading } = useSWR(
    activeReportType === "transfers" ? transfersUrl : null,
    fetcher
  );
  const transferData: any[] = Array.isArray(transfersReportRaw?.transfers)
    ? transfersReportRaw.transfers.map((transfer: any) => ({
        id: transfer.id,
        created_at: transfer.transfer_date,
        account_name: `${transfer.source_account_name || "خزينة المصدر"} ← ${transfer.destination_account_name || "خزينة الوجهة"}`,
        account_type: transfer.source_account_type,
        transaction_type: "transfer",
        notes: `${transfer.transfer_number || ""}${transfer.transfer_type_name ? ` — ${transfer.transfer_type_name}` : ""}${transfer.notes ? ` — ${transfer.notes}` : ""}`,
        user_name: transfer.created_by_name || "",
        amount: Number(transfer.amount) || 0,
      }))
    : [];

  // 2. Closings Report Fetching
  const { data: closingsRaw, isLoading: isClosingsLoading } = useSWR(
    activeReportType === "closings" ? "/api/treasury/closings" : null,
    fetcher
  );

  // 3. Custodies Report Fetching with advanced filters and totals
  const custodiesUrl = `/api/treasury/custodies-reports?account_id=${selectedAccountId === "all" ? "" : selectedAccountId}&start_date=${startDate}&end_date=${endDate}&status=${custodyStatus}&category=${custodyCategory}&is_overdue=${custodyOverdueOnly}&search=${encodeURIComponent(custodySearch)}`;
  const { data: custodiesReportRaw, isLoading: isCustodiesLoading } = useSWR(
    activeReportType === "custodies" ? custodiesUrl : null,
    fetcher
  );

  // 4. تقرير صرف المرتبات الشهري — صف لكل موظف والمستحق له
  const [payrollYear, payrollMonthNumber] = payrollMonth
    .split("-")
    .map((part) => Number(part));
  const payrollUrl = `/api/payroll/runs/disbursement-report?year=${payrollYear || 0}&month=${payrollMonthNumber || 0}${
    selectedAccountId !== "all" ? `&treasury_account_id=${selectedAccountId}` : ""
  }`;
  const { data: payrollRaw, isLoading: isPayrollLoading } = useSWR(
    activeReportType === "payroll" ? payrollUrl : null,
    fetcher,
  );
  const payrollReport: any = (payrollRaw as any)?.data || (Array.isArray(payrollRaw) ? null : payrollRaw) || null;
  const payrollRows: any[] = Array.isArray(payrollReport?.rows) ? payrollReport.rows : [];
  const payrollRuns: any[] = Array.isArray(payrollReport?.runs) ? payrollReport.runs : [];
  const payrollVouchers: any[] = Array.isArray(payrollReport?.vouchers) ? payrollReport.vouchers : [];
  const payrollTotals = payrollReport?.totals || {
    employees_count: payrollRows.length,
    total_net: payrollRows.reduce((acc: number, row: any) => acc + Number(row.net_salary || 0), 0),
    total_paid: payrollRows.reduce((acc: number, row: any) => acc + Number(row.paid_amount || 0), 0),
    remaining: 0,
  };

  const custodiesRows: any[] = Array.isArray(custodiesReportRaw?.rows) ? custodiesReportRaw.rows : [];
  const custodiesTotals = custodiesReportRaw?.totals || {
    count: custodiesRows.length,
    total_amount: custodiesRows.reduce((acc, c) => acc + Number(c.amount || 0), 0),
    total_spent: custodiesRows.reduce((acc, c) => acc + Number(c.spent_amount || 0), 0),
    total_remaining: custodiesRows.reduce((acc, c) => acc + Number(c.remaining_amount || 0), 0),
    total_returned: custodiesRows.reduce((acc, c) => acc + Number(c.returned_amount || 0), 0),
  };

  const getFilteredData = () => {
    if (activeReportType === "detailed") {
      return reportData;
    }
    if (activeReportType === "transfers") {
      return transferData;
    }
    if (activeReportType === "closings") {
      const list = Array.isArray(closingsRaw) ? closingsRaw : [];
      return list.filter((item: any) => {
        const closingDate = item.closing_date || item.created_at || "";
        const itemDate = String(closingDate).split("T")[0];
        const inDateRange = itemDate >= startDate && itemDate <= endDate;
        const matchesAccount = selectedAccountId === "all" || String(item.account_id) === String(selectedAccountId);
        return inDateRange && matchesAccount;
      });
    }
    if (activeReportType === "custodies") {
      return custodiesRows;
    }
    if (activeReportType === "payroll") {
      return payrollRows;
    }
    return [];
  };

  const filteredData = getFilteredData();
  const isLoading =
    activeReportType === "detailed"
      ? isDetailedLoading
      : activeReportType === "transfers"
        ? isTransfersLoading
      : activeReportType === "closings"
        ? isClosingsLoading
        : activeReportType === "payroll"
          ? isPayrollLoading
          : isCustodiesLoading;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = "";

    if (activeReportType === "detailed" || activeReportType === "transfers") {
      headers = ["التاريخ", "الخزينة", "النوع", "القيمة", "المستخدم", "الملاحظات"];
      rows = filteredData.map((t) => [
        safeFormat(t.created_at, "yyyy-MM-dd HH:mm", { locale: ar }),
        t.account_name,
        t.transaction_type === "cash_in"
          ? "إيداع"
          : t.transaction_type === "cash_out"
            ? "صرف"
            : t.transaction_type === "transfer"
              ? "تحويل"
              : "تعديل",
        t.amount,
        t.user_name,
        t.notes || "",
      ]);
      filename = `تقرير_${activeReportType === "detailed" ? "حركة_الخزينة" : "التحويلات_البينية"}_${startDate}_إلى_${endDate}.csv`;
    } else if (activeReportType === "closings") {
      headers = [
        "التاريخ",
        "الحساب/الخزينة",
        "الرصيد الدفتري",
        "الرصيد الفعلي",
        "العجز والزيادة",
        "الحالة",
        "المسؤول",
        "المعتمد",
      ];
      rows = filteredData.map((c) => [
        safeFormat(c.closing_date || c.created_at, "yyyy-MM-dd", { locale: ar }),
        c.account_name,
        c.system_balance,
        c.actual_balance,
        c.difference,
        c.status === "approved" ? "معتمد" : "معلق",
        c.creator_name || "",
        c.approver_name || "---",
      ]);
      filename = `تقرير_تقفيلات_الخزينة_${startDate}_إلى_${endDate}.csv`;
    } else if (activeReportType === "custodies") {
      headers = [
        "رقم العهدة",
        "تاريخ الإنشاء",
        "الموظف المستلم",
        "الخزينة",
        "النوع / التصنيف",
        "المبلغ المنصرف",
        "المصروف المثبت",
        "المتبقي المطلوب استرداده",
        "المسترد للخزينة",
        "تاريخ الاستحقاق",
        "الحالة",
        "الغرض"
      ];
      rows = filteredData.map((c) => [
        c.custody_number || `#${c.id}`,
        safeFormat(c.created_at, "yyyy-MM-dd", { locale: ar }),
        c.employee_name || `موظف #${c.employee_id}`,
        c.account_name || "---",
        c.custody_type_name || c.custody_type || "نقدية",
        c.amount,
        c.spent_amount || c.cleared_amount || 0,
        c.remaining_amount || 0,
        c.returned_amount || 0,
        c.due_date ? safeFormat(c.due_date, "yyyy-MM-dd") : "---",
        getCustodyStatusLabel(c.status),
        c.purpose || ""
      ]);
      filename = `تقرير_العهد_والأمانات_الشامل_${startDate}_إلى_${endDate}.csv`;
    } else if (activeReportType === "payroll") {
      headers = [
        "الشهر",
        "المسير",
        "حالة المسير",
        "كود الموظف",
        "اسم الموظف",
        "الأساسي",
        "الإضافات والبدلات",
        "الاستقطاعات",
        "المستحق (صافي)",
        "المصروف للموظف",
        "حالة الصرف",
        "سندات الصرف",
      ];
      rows = filteredData.map((row: any) => [
        row.period_label || payrollMonth,
        row.run_number || row.run_id,
        row.run_status_label || "",
        row.employee_code || "",
        row.employee_name || `موظف #${row.employee_id}`,
        row.basic_salary,
        row.additions,
        row.deductions,
        row.net_salary,
        row.paid_amount,
        row.payment_state_label || "",
        (row.voucher_numbers || []).join(" | "),
      ]);
      filename = `تقرير_صرف_المرتبات_${payrollMonth}.csv`;
    }

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCustodyStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'مسودة';
      case 'pending_approval':
      case 'pending': return 'بانتظار الاعتماد';
      case 'approved': return 'معتمدة - بانتظار الصرف';
      case 'issued':
      case 'active': return 'منصرفة / سارية';
      case 'pending_settlement': return 'تحت التسوية والمراجعة';
      case 'partially_settled':
      case 'partially_cleared': return 'مسواة جزئياً';
      case 'closed':
      case 'fully_cleared': return 'مقفلة ومسواة بالكامل';
      case 'cancelled':
      case 'rejected': return 'ملغاة / مرفوضة';
      default: return status || '---';
    }
  };

  const getCustodyStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && ['active', 'issued', 'pending_settlement'].includes(status)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          متأخرة عن موعدها
        </span>
      );
    }
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">مسودة</span>;
      case 'pending_approval':
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">بانتظار الاعتماد</span>;
      case 'approved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">معتمدة للصرف</span>;
      case 'issued':
      case 'active':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">منصرفة / سارية</span>;
      case 'pending_settlement':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">تحت التسوية</span>;
      case 'partially_settled':
      case 'partially_cleared':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200">مسواة جزئياً</span>;
      case 'closed':
      case 'fully_cleared':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">مقفلة ومسواة بالكامل</span>;
      case 'cancelled':
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">ملغاة</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  const money = (value: any) =>
    Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const payrollStateBadge = (state?: string, label?: string) => {
    switch (state) {
      case "paid":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">مصروف</span>;
      case "partially_paid":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">مصروف جزئيًا</span>;
      case "due":
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">مستحق لم يُصرف</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">{label || "لم يُعتمد بعد"}</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "cash":
        return <Coins className="w-4 h-4" />;
      case "bank":
        return <Landmark className="w-4 h-4" />;
      case "petty_cash":
        return <Wallet className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col font-cairo bg-slate-50 overflow-hidden">
      {/* Header - Hidden on Print */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 print:hidden shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-slate-500" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              {activeReportType === "detailed" && "كشف حساب حركات الخزائن التفصيلي"}
              {activeReportType === "closings" && "تقرير التقفيلات والمطابقات اليومية"}
              {activeReportType === "custodies" && "تقرير وتحليلات العهد والأمانات المالية"}
              {activeReportType === "transfers" && "تقرير التحويلات المالية البينية"}
              {activeReportType === "payroll" && "تقرير صرف المرتبات الشهري — لكل موظف"}
            </h1>
            <p className="text-xs text-slate-500 font-bold">
              تقارير الخزينة بمستوى الأنظمة الاحترافية المتكاملة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all border border-emerald-100 text-sm"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs - Hidden on Print */}
      <div ref={reportTabsRef} className="bg-white border-b border-slate-200 px-6 flex print:hidden shrink-0 overflow-x-auto gap-1">
        <button
          data-report-tab="detailed"
          onClick={() => setActiveReportType("detailed")}
          className={`px-4 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeReportType === "detailed" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          كشف حساب الحركة التفصيلي
        </button>
        <button
          data-report-tab="closings"
          onClick={() => setActiveReportType("closings")}
          className={`px-4 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeReportType === "closings" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          تقرير التقفيلات والمطابقات اليومية
        </button>
        <button
          data-report-tab="custodies"
          onClick={() => setActiveReportType("custodies")}
          className={`px-4 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeReportType === "custodies" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          تقرير وتحليلات العهد والأمانات
        </button>
        <button
          data-report-tab="transfers"
          onClick={() => setActiveReportType("transfers")}
          className={`px-4 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeReportType === "transfers" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          تقرير التحويلات المالية البينية
        </button>
        <button
          data-report-tab="payroll"
          onClick={() => setActiveReportType("payroll")}
          className={`px-4 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeReportType === "payroll" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          تقرير صرف المرتبات الشهري
        </button>
      </div>

      {/* Filters - Hidden on Print */}
      <div className="p-6 bg-white border-b border-slate-200 print:hidden shrink-0 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {activeReportType !== "payroll" && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                تاريخ البداية
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 text-sm"
              />
            </div>
          )}

          {activeReportType !== "payroll" && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                تاريخ النهاية
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 text-sm"
              />
            </div>
          )}

          {activeReportType === "payroll" && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                شهر صرف المرتبات
              </label>
              <input
                type="month"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value || new Date().toISOString().slice(0, 7))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" />
              اختر الخزينة / الحساب
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 text-sm"
            >
              <option value="all">جميع الخزائن</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {(activeReportType === "detailed" || activeReportType === "transfers") && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                نوع الحركة
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                disabled={activeReportType === "transfers"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 disabled:opacity-55 text-sm"
              >
                {activeReportType === "transfers" ? (
                  <option value="transfer">تحويل</option>
                ) : (
                  <>
                    <option value="all">الكل</option>
                    <option value="cash_in">إيداع</option>
                    <option value="cash_out">صرف</option>
                    <option value="transfer">تحويل</option>
                    <option value="adjustment">تعديل</option>
                  </>
                )}
              </select>
            </div>
          )}

          {activeReportType === "custodies" && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                حالة العهدة
              </label>
              <select
                value={custodyStatus}
                onChange={(e) => setCustodyStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 text-sm"
              >
                <option value="all">جميع الحالات</option>
                <option value="issued">منصرفة وسارية</option>
                <option value="pending_settlement">تحت التسوية</option>
                <option value="partially_settled">مسواة جزئياً</option>
                <option value="closed">مقفلة ومسواة بالكامل</option>
                <option value="pending_approval">بانتظار الاعتماد</option>
                <option value="draft">مسودة</option>
              </select>
            </div>
          )}
        </div>

        {/* Custody Additional Filter Bar */}
        {activeReportType === "custodies" && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="relative min-w-[240px] max-w-sm flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="بحث برقم العهدة، اسم الموظف، الغرض..."
                  value={custodySearch}
                  onChange={(e) => setCustodySearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={custodyCategory}
                onChange={(e) => setCustodyCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">جميع تصنيفات العهد</option>
                <option value="cash">عهد نقدية ومشتريات فورية</option>
                <option value="petty_cash">أمانة نثريات ومصروفات دورية</option>
                <option value="purchase">مشتريات وتوريدات</option>
                <option value="asset">أصول ومعدات وأجهزة</option>
                <option value="vehicles">سيارات ومركبات</option>
              </select>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={custodyOverdueOnly}
                  onChange={(e) => setCustodyOverdueOnly(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <span>العهد المتأخرة عن الاستحقاق فقط</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 print:bg-white print:p-0 space-y-6">
        {/* Custodies KPI Metric Cards */}
        {activeReportType === "custodies" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">إجمالي المبالغ المنصرفة</p>
                <h3 className="text-xl font-black text-slate-800 mt-0.5">
                  {Number(custodiesTotals.total_amount || 0).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">{custodiesTotals.count} عهدة مسجلة</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">المصروف المثبت بالفواتير</p>
                <h3 className="text-xl font-black text-purple-700 mt-0.5">
                  {Number(custodiesTotals.total_spent || 0).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                </h3>
                <p className="text-[11px] text-purple-600 font-bold">
                  {custodiesTotals.total_amount > 0 ? `${Math.round((custodiesTotals.total_spent / custodiesTotals.total_amount) * 100)}% من إجمالي المبالغ` : '0%'}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">المتبقي المطلوب استرداده</p>
                <h3 className="text-xl font-black text-rose-600 mt-0.5">
                  {Number(custodiesTotals.total_remaining || 0).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                </h3>
                <p className="text-[11px] text-rose-500 font-bold">طرف الموظفين حالياً</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">المسترد للخزائن فعلياً</p>
                <h3 className="text-xl font-black text-emerald-600 mt-0.5">
                  {Number(custodiesTotals.total_returned || 0).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                </h3>
                <p className="text-[11px] text-emerald-600 font-bold">تم إيداعه وتسويته بالخزينة</p>
              </div>
            </div>
          </div>
        )}

        {activeReportType === "payroll" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">عدد الموظفين في الشهر</p>
                  <h3 className="text-xl font-black text-slate-800 mt-0.5">{payrollTotals.employees_count || 0}</h3>
                  <p className="text-[11px] text-slate-500 font-bold">{payrollRuns.length} مسير مرتبات</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">إجمالي المستحق للموظفين</p>
                  <h3 className="text-xl font-black text-slate-800 mt-0.5">
                    {money(payrollTotals.total_net)} <span className="text-xs text-slate-400">ج.م</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold">صافي المرتبات المستحقة بعد الاستقطاعات</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">المصروف فعليًا من الخزينة</p>
                  <h3 className="text-xl font-black text-emerald-700 mt-0.5">
                    {money(payrollTotals.total_paid)} <span className="text-xs text-slate-400">ج.م</span>
                  </h3>
                  <p className="text-[11px] text-emerald-600 font-bold">{payrollVouchers.length} سند صرف مرتبات</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">المتبقي لم يُصرف</p>
                  <h3 className="text-xl font-black text-rose-600 mt-0.5">
                    {money(payrollTotals.remaining)} <span className="text-xs text-slate-400">ج.م</span>
                  </h3>
                  <p className="text-[11px] text-rose-500 font-bold">
                    {selectedAccountId !== "all" ? "محسوب على الخزينة المختارة فقط" : "على جميع الخزائن"}
                  </p>
                </div>
              </div>
            </div>

            {payrollRuns.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                  <Wallet className="w-4 h-4 text-indigo-600" /> ملخص مسيرات الشهر وسندات الصرف
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {payrollRuns.map((run: any) => (
                    <div key={run.run_id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-black text-slate-800">
                        <span className="font-mono">{run.run_number || `#${run.run_id}`}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {run.status_label}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>عدد الموظفين</span>
                        <span>{run.employees_count}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>المستحق</span>
                        <span className="text-indigo-900">{money(run.total_net)} ج.م</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>المصروف</span>
                        <span className="text-emerald-700">
                          {money(selectedAccountId !== "all" ? run.paid_from_scope : run.total_paid)} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>المتبقي</span>
                        <span className="text-rose-600">
                          {money(selectedAccountId !== "all" ? run.scope_remaining : run.remaining)} ج.م
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 text-[11px] font-bold text-slate-500 font-mono">
                        سندات الصرف: {(run.voucher_numbers || []).join(" | ") || "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                  الصرف يُسجَّل على مستوى المسير بسند واحد للخزينة، لذلك يُوزَّع المبلغ المصروف على
                  الموظفين بنسبة صافي مرتب كل موظف من إجمالي المسير — والعمود «المصروف له» يساوي
                  المستحق بالكامل عندما يكون المسير مصروفًا بالكامل.
                  {selectedAccountId !== "all"
                    ? " التقرير الآن محصور على السندات الصادرة من الخزينة المختارة فقط."
                    : ""}
                </p>
              </div>
            )}
          </>
        )}

        <div className="w-full bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none">
          {/* Print Header */}
          <div className="hidden print:block p-8 border-b-2 border-slate-900 border-dashed mb-6 text-center">
            <h1 className="text-3xl font-black mb-2">
              {activeReportType === "detailed" && "تقرير كشف حساب الخزينة التفصيلي"}
              {activeReportType === "closings" && "تقرير تقفيلات وتسويات الخزينة"}
              {activeReportType === "custodies" && "تقرير وتحليلات العهد والأمانات المالية للموظفين"}
              {activeReportType === "transfers" && "تقرير التحويلات البينية للموجات النقدية"}
              {activeReportType === "payroll" && `تقرير صرف المرتبات الشهري — ${payrollMonth}`}
            </h1>
            <div className="flex justify-center gap-8 text-sm font-bold">
              <span>تاريخ الطباعة: {safeFormat(new Date(), "yyyy/MM/dd")}</span>
              <span>
                {activeReportType === "payroll" ? `شهر الصرف: ${payrollMonth}` : `الفترة: من ${startDate} إلى ${endDate}`}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeReportType === "detailed" || activeReportType === "transfers" ? (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      تاريخ الحركة
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">
                      الخزينة / الحساب
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      نوع الحركة
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">
                      الملاحظات
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">
                      المستخدم
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      القيمة
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={6} className="h-16 bg-slate-50/50"></td>
                        </tr>
                      ))
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-400 font-bold italic"
                      >
                        لا توجد حركات مطابقة للفلترة المختارة
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-600 text-center">
                          {safeFormat(t.created_at, "yyyy-MM-dd HH:mm", {
                            locale: ar,
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                              {getTypeIcon(t.account_type)}
                            </div>
                            <span className="font-bold text-slate-900">
                              {t.account_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                              t.transaction_type === "cash_in"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : t.transaction_type === "cash_out"
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : t.transaction_type === "transfer"
                                    ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                    : "bg-slate-50 text-slate-600 border border-slate-100"
                            }`}
                          >
                            {t.transaction_type === "cash_in"
                              ? "إيداع"
                              : t.transaction_type === "cash_out"
                                ? "صرف"
                                : t.transaction_type === "transfer"
                                  ? "تحويل"
                                  : "تعديل"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500 max-w-xs">
                          {t.notes || "---"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-600">
                          {t.user_name}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-center font-black ${
                            t.amount > 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {t.amount > 0 ? "+" : ""}
                          {Number(t.amount || 0).toLocaleString()} EGP
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-sm font-black text-right uppercase tracking-[0.2em] opacity-80"
                    >
                      إجمالي الرصيد الصافي للفترة المختارة
                    </td>
                    <td className="px-6 py-4 text-center font-black text-lg border-l border-white/10">
                      {filteredData
                        .reduce((acc, t) => acc + Number(t.amount), 0)
                        .toLocaleString()}{" "}
                      EGP
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : activeReportType === "payroll" ? (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-black">
                    <th className="px-5 py-4">الموظف</th>
                    <th className="px-5 py-4">المسير / الشهر</th>
                    <th className="px-5 py-4 text-center">الأساسي</th>
                    <th className="px-5 py-4 text-center">إضافات وبدلات</th>
                    <th className="px-5 py-4 text-center">استقطاعات</th>
                    <th className="px-5 py-4 text-center">المستحق (صافي)</th>
                    <th className="px-5 py-4 text-center">المصروف له</th>
                    <th className="px-5 py-4 text-center">حالة الصرف</th>
                    <th className="px-5 py-4">سند الصرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={9} className="h-16 bg-slate-50/50"></td>
                        </tr>
                      ))
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                        لا توجد مسيرات مرتبات مصروفة في {payrollMonth}
                        {selectedAccountId !== "all" ? " من هذه الخزينة" : ""} — تأكد من اختيار الشهر الصحيح
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row: any) => (
                      <tr
                        key={`${row.run_id}-${row.employee_id}`}
                        className="hover:bg-slate-50/50 transition-colors text-xs font-bold"
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">{row.employee_name || `موظف #${row.employee_id}`}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{row.employee_code || "—"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-indigo-700">{row.run_number || `#${row.run_id}`}</span>
                            <span className="text-[10px] text-slate-400">
                              {row.period_label || ""} · {row.run_status_label || ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center text-slate-700">{money(row.basic_salary)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-center text-emerald-700">{money(row.additions)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-center text-rose-600">{money(row.deductions)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-center font-black text-indigo-900">
                          {money(row.net_salary)} ج.م
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center font-black text-emerald-700">
                          {money(row.paid_amount)} ج.م
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          {payrollStateBadge(row.payment_state, row.payment_state_label)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {(row.voucher_numbers || []).join(" | ") || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td colSpan={2} className="px-5 py-4 text-xs font-black text-right uppercase tracking-wider opacity-80">
                      إجماليات {payrollMonth} ({payrollTotals.employees_count || 0} موظف)
                    </td>
                    <td className="px-5 py-4 text-center font-black text-sm">{money(payrollTotals.total_basic)}</td>
                    <td className="px-5 py-4 text-center font-black text-sm text-emerald-300">{money(payrollTotals.total_additions)}</td>
                    <td className="px-5 py-4 text-center font-black text-sm text-rose-300">{money(payrollTotals.total_deductions)}</td>
                    <td className="px-5 py-4 text-center font-black text-sm">{money(payrollTotals.total_net)}</td>
                    <td className="px-5 py-4 text-center font-black text-sm text-emerald-300">{money(payrollTotals.total_paid)}</td>
                    <td className="px-5 py-4 text-center font-black text-sm text-amber-300">{money(payrollTotals.remaining)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            ) : activeReportType === "closings" ? (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      تاريخ التقفيل
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">
                      الخزينة / الحساب
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      الرصيد الدفتري
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      الرصيد الفعلي
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      العجز / الزيادة
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                      الحالة
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">
                      المسؤول
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={7} className="h-16 bg-slate-50/50"></td>
                        </tr>
                      ))
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-slate-400 font-bold italic"
                      >
                        لا توجد تقفيلات مطابقة للفترة المختارة
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/50 transition-colors text-sm"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-600 text-center">
                          {safeFormat(c.closing_date || c.created_at, "yyyy-MM-dd", {
                            locale: ar,
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                          {c.account_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-slate-700">
                          {Number(c.system_balance || 0).toLocaleString()} ج.م
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-slate-800">
                          {Number(c.actual_balance || 0).toLocaleString()} ج.م
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-center font-black ${
                            Number(c.difference) < 0
                              ? "text-rose-600"
                              : Number(c.difference) > 0
                                ? "text-emerald-600"
                                : "text-slate-500"
                          }`}
                        >
                          {Number(c.difference) > 0 ? "+" : ""}
                          {Number(c.difference || 0).toLocaleString()} ج.م
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black ${
                              c.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}
                          >
                            {c.status === "approved" ? "معتمد" : "مسودة معلقة"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-bold">
                          {c.creator_name || "---"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* Enterprise Custodies Report Table */
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-black">
                    <th className="px-5 py-4">رقم العهدة</th>
                    <th className="px-5 py-4">الموظف والفرع</th>
                    <th className="px-5 py-4">الخزينة المانحة</th>
                    <th className="px-5 py-4">النوع والتصنيف</th>
                    <th className="px-5 py-4 text-center">المبلغ المنصرف</th>
                    <th className="px-5 py-4 text-center">المصروف الفعلي</th>
                    <th className="px-5 py-4 text-center">المتبقي المطلوب</th>
                    <th className="px-5 py-4 text-center">المسترد للخزينة</th>
                    <th className="px-5 py-4 text-center">الاستحقاق</th>
                    <th className="px-5 py-4 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={10} className="h-16 bg-slate-50/50"></td>
                        </tr>
                      ))
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-6 py-12 text-center text-slate-400 font-bold italic"
                      >
                        لا توجد عهد وأمانات مطابقة للفترة والفلترة المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/50 transition-colors text-xs font-bold"
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-indigo-700">
                              {c.custody_number || `#${c.id}`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {safeFormat(c.created_at, "yyyy-MM-dd")}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">
                              {c.employee_name || `موظف #${c.employee_id}`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {c.branch_name || c.employee_department || "---"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                          {c.account_name || "---"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                            {c.custody_type_name || c.custody_type || "نقدية"}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center font-black text-slate-900">
                          {Number(c.amount || 0).toLocaleString()} ج.م
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center font-black text-purple-700">
                          {Number(c.spent_amount || c.cleared_amount || 0).toLocaleString()} ج.م
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center font-black text-rose-600">
                          {Number(c.remaining_amount || 0).toLocaleString()} ج.م
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center font-black text-emerald-600">
                          {Number(c.returned_amount || 0).toLocaleString()} ج.م
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center text-slate-500 font-mono">
                          {c.due_date ? safeFormat(c.due_date, "yyyy-MM-dd") : "---"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          {getCustodyStatusBadge(c.status, c.is_overdue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-4 text-xs font-black text-right uppercase tracking-wider opacity-80"
                    >
                      إجماليات تقرير العهد والأمانات المختارة ({filteredData.length} عهدة)
                    </td>
                    <td className="px-5 py-4 text-center font-black text-sm">
                      {custodiesTotals.total_amount.toLocaleString()} ج.م
                    </td>
                    <td className="px-5 py-4 text-center font-black text-sm text-purple-300">
                      {custodiesTotals.total_spent.toLocaleString()} ج.م
                    </td>
                    <td className="px-5 py-4 text-center font-black text-sm text-rose-300">
                      {custodiesTotals.total_remaining.toLocaleString()} ج.م
                    </td>
                    <td className="px-5 py-4 text-center font-black text-sm text-emerald-300">
                      {custodiesTotals.total_returned.toLocaleString()} ج.م
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
