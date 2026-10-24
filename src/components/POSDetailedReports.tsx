import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, BarChart3, PackageSearch, RefreshCw, Search, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

type ReportKind = "items" | "employee_items" | "employees" | "categories" | "details";
type ReportRow = Record<string, string | number | null>;

interface POSDetailedReportsProps {
  onBack: () => void;
}

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const money = (value: unknown) => Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const reportTabs: { id: ReportKind; label: string }[] = [
  { id: "items", label: "مبيعات الأصناف" },
  { id: "employee_items", label: "الصنف حسب الموظف" },
  { id: "employees", label: "مبيعات الموظفين" },
  { id: "categories", label: "مبيعات الأقسام" },
  { id: "details", label: "تفاصيل الفواتير والأصناف" },
];

const reportColumns: Record<ReportKind, { key: string; label: string }[]> = {
  items: [
    { key: "product_name", label: "الصنف" }, { key: "category_name", label: "القسم" },
    { key: "quantity_sold", label: "الكمية المباعة" }, { key: "invoice_count", label: "عدد الفواتير" },
    { key: "gross_sales", label: "إجمالي البيع قبل الخصم" }, { key: "net_sales", label: "صافي البيع بعد الخصم" },
  ],
  employee_items: [
    { key: "employee_name", label: "الموظف" }, { key: "product_name", label: "الصنف" },
    { key: "category_name", label: "القسم" }, { key: "quantity_sold", label: "الكمية المباعة" },
    { key: "invoice_count", label: "عدد الفواتير" }, { key: "gross_sales", label: "إجمالي البيع قبل الخصم" },
    { key: "net_sales", label: "صافي البيع بعد الخصم" },
  ],
  employees: [
    { key: "employee_name", label: "الموظف" }, { key: "invoice_count", label: "عدد الفواتير" },
    { key: "quantity_sold", label: "إجمالي الوحدات" }, { key: "gross_sales", label: "إجمالي البيع قبل الخصم" },
    { key: "net_sales", label: "صافي البيع بعد الخصم" },
  ],
  categories: [
    { key: "category_name", label: "القسم" }, { key: "product_count", label: "عدد الأصناف" },
    { key: "quantity_sold", label: "الكمية المباعة" }, { key: "invoice_count", label: "عدد الفواتير" },
    { key: "gross_sales", label: "إجمالي البيع قبل الخصم" }, { key: "net_sales", label: "صافي البيع بعد الخصم" },
  ],
  details: [
    { key: "order_number", label: "رقم الفاتورة" }, { key: "sold_at", label: "التاريخ والوقت" },
    { key: "employee_name", label: "الموظف" }, { key: "product_name", label: "الصنف" },
    { key: "category_name", label: "القسم" }, { key: "quantity", label: "الكمية" },
    { key: "unit_price", label: "سعر الوحدة" }, { key: "line_gross", label: "إجمالي السطر" },
    { key: "line_net", label: "صافي السطر بعد توزيع الخصم" },
    { key: "payment_method", label: "طريقة الدفع" }, { key: "status", label: "الحالة" },
  ],
};

export function POSDetailedReports({ onBack }: POSDetailedReportsProps) {
  const { user, hasPermission } = useAuth();
  const canSeeAllUsers = user?.role === "admin"
    || hasPermission("branch_reports.all_users")
    || hasPermission("reports.branch_all_users");
  const canSeeAllBranches = user?.role === "admin" || hasPermission("branch_reports.all_branches");
  const [report, setReport] = useState<ReportKind>("items");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState(user?.branch_id ? String(user.branch_id) : "all");
  const [userId, setUserId] = useState(user?.id && !canSeeAllUsers ? String(user.id) : "all");
  const [categoryId, setCategoryId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    let alive = true;
    api.get("/api/branches").then(async (branchesRes) => {
      const branchData = branchesRes.ok ? await branchesRes.json() : [];
      if (!alive) return;
      setBranches(Array.isArray(branchData) ? branchData : []);
    }).catch((loadError) => {
      console.error("Load POS report filter lists failed:", loadError);
      if (alive) setError("تعذر تحميل بعض قوائم الفلاتر؛ يمكنك استخدام الفلاتر المتاحة.");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!canSeeAllBranches && user?.branch_id) setBranchId(String(user.branch_id));
    if (!canSeeAllUsers && user?.id) setUserId(String(user.id));
  }, [canSeeAllBranches, canSeeAllUsers, user?.branch_id, user?.id]);

  const loadReport = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        report,
        startDate,
        endDate,
        branchId,
        userId,
        categoryId,
        productId,
        paymentMethod,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await api.get(`/api/reports/pos/detailed?${params}`);
      const data = await response.json();
      if (currentRequestId !== requestId.current) return;
      if (!response.ok) throw new Error(data.error || "تعذر تحميل التقرير");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(data.summary || {});
      setTotalRows(Number(data.totalRows || 0));
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setUsers(Array.isArray(data.employees) ? data.employees : []);
    } catch (loadError: any) {
      if (currentRequestId === requestId.current) {
        setRows([]);
        setSummary({});
        setTotalRows(0);
        setError(loadError.message || "تعذر تحميل التقرير التفصيلي");
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [report, startDate, endDate, branchId, userId, categoryId, productId, paymentMethod, status, page, pageSize]);

  useEffect(() => {
    loadReport();
    return () => { requestId.current += 1; };
  }, [loadReport]);

  useEffect(() => { setPage(1); }, [report, startDate, endDate, branchId, userId, categoryId, productId, paymentMethod, status, pageSize]);

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const columns = reportColumns[report];
  const visibleProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLocaleLowerCase();
    return products.filter((product: any) => {
      const matchesCategory = categoryId === "all" || String(product.category_id) === categoryId;
      const matchesName = !normalizedSearch || String(product.name || "").toLocaleLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesName;
    });
  }, [products, categoryId, productSearch]);

  const exportExcel = () => {
    if (!rows.length) return;
    const sheetRows = rows.map((row) => Object.fromEntries(columns.map(({ key, label }) => [label, row[key] ?? ""])));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير POS");
    XLSX.writeFile(workbook, `POS-${report}-${startDate}-${endDate}.xlsx`);
  };

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50" dir="rtl">
      <div className="mx-auto flex min-h-full w-full flex-1 flex-col gap-4 p-3 md:p-4 xl:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
            <div>
              <h1 className="text-xl font-black text-slate-900">تقارير المبيعات التفصيلية - POS</h1>
              <p className="mt-1 text-sm text-slate-500">تحليل الأصناف والأقسام وأداء كل موظف حسب الفواتير المسجلة فعليًا.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadReport} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث</button>
            <button onClick={exportExcel} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ArrowDownToLine className="h-4 w-4" /> تصدير Excel</button>
          </div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["الفواتير", Number(summary.invoice_count || 0).toLocaleString("ar-EG")],
            ["الوحدات المباعة", Number(summary.quantity_sold || 0).toLocaleString("ar-EG")],
            ["إجمالي البيع قبل الخصم", `${money(summary.gross_sales)} ج.م`],
            ["صافي البيع بعد الخصم", `${money(summary.net_sales)} ج.م`],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-2 text-lg font-black text-slate-900">{value}</div></div>)}
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2 border-b pb-3">
            {reportTabs.map((tab) => (
              <button key={tab.id} onClick={() => setReport(tab.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${report === tab.id ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {tab.id === "employees" ? <Users className="ml-1 inline h-4 w-4" /> : tab.id === "categories" ? <BarChart3 className="ml-1 inline h-4 w-4" /> : <PackageSearch className="ml-1 inline h-4 w-4" />}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <label className="text-xs font-bold text-slate-600">من تاريخ<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-slate-600">إلى تاريخ<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-slate-600">الفرع<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm">{canSeeAllBranches && <option value="all">كل الفروع</option>}{branches.filter((branch: any) => canSeeAllBranches || String(branch.id) === String(user?.branch_id)).map((branch: any) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">الموظف<select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm">{canSeeAllUsers && <option value="all">كل الموظفين</option>}{users.map((reportUser: any) => <option key={reportUser.id} value={reportUser.id}>{reportUser.username}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">القسم<select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setProductId("all"); }} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"><option value="all">كل الأقسام</option>{categories.map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">بحث واختيار الصنف
              <div className="relative mt-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProductSearchOpen(false); }}>
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={productSearch}
                  onFocus={() => setProductSearchOpen(true)}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setProductId("all");
                    setProductSearchOpen(true);
                  }}
                  onKeyDown={(event) => { if (event.key === "Escape") setProductSearchOpen(false); }}
                  placeholder="اكتب اسم الصنف..."
                  aria-label="بحث واختيار الصنف"
                  aria-autocomplete="list"
                  aria-expanded={productSearchOpen && Boolean(productSearch.trim())}
                  aria-controls="pos-product-search-results"
                  className="w-full rounded-lg border bg-slate-50 py-2 pl-3 pr-9 text-sm"
                />
                {productSearchOpen && productSearch.trim() && (
                  <div id="pos-product-search-results" role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">
                    {visibleProducts.length ? visibleProducts.slice(0, 30).map((product: any) => (
                      <button
                        key={product.id}
                        type="button"
                        role="option"
                        aria-selected={String(product.id) === productId}
                        onClick={() => {
                          setProductId(String(product.id));
                          setProductSearch(String(product.name || ""));
                          setProductSearchOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-right text-sm text-slate-700 hover:bg-indigo-50"
                      >
                        {product.name}
                      </button>
                    )) : <div className="px-3 py-2 text-sm text-slate-500">لا توجد أصناف مطابقة.</div>}
                  </div>
                )}
              </div>
            </label>
            <label className="text-xs font-bold text-slate-600">طريقة الدفع<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"><option value="all">كل الطرق</option>{["cash", "visa", "mastercard", "wallet", "instapay", "transfer", "credit", "mixed"].map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">حالة الفاتورة<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"><option value="all">كل الحالات عدا الملغي</option><option value="completed">مكتمل</option><option value="delivered">تم التوصيل</option><option value="pending">قيد الانتظار</option><option value="preparing">جاري التحضير</option><option value="ready">جاهز</option><option value="cancelled">ملغي</option></select></label>
          </div>
        </section>

        <section className="flex min-h-[min(55vh,30rem)] flex-1 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
            <div className="text-sm font-black text-slate-800">{reportTabs.find((tab) => tab.id === report)?.label} <span className="mr-2 text-xs font-semibold text-slate-500">({totalRows.toLocaleString("ar-EG")} نتيجة)</span></div>
            <div className="flex items-center gap-2 text-xs">
              <span>صفوف الصفحة</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border bg-white px-2 py-1.5"><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] text-right text-xs">
              <thead className="bg-slate-100 text-slate-600"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 font-black">{column.label}</th>)}</tr></thead>
              <tbody className="divide-y">
                {loading ? <tr><td colSpan={columns.length} className="p-10 text-center text-slate-500">جارٍ تحميل التقرير...</td></tr>
                  : rows.length ? rows.map((row, index) => <tr key={`${index}-${String(row.order_number || row.product_id || "")}`} className="hover:bg-slate-50">{columns.map((column) => <td key={column.key} className="whitespace-nowrap px-3 py-2.5">{column.key.includes("sales") || column.key.includes("price") || column.key.includes("gross") || column.key.includes("net") ? money(row[column.key]) : row[column.key] == null ? "—" : String(row[column.key])}</td>)}</tr>)
                  : <tr><td colSpan={columns.length} className="p-10 text-center text-slate-400">لا توجد بيانات مطابقة للفلاتر.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-center gap-3 border-t p-3 text-xs">
            <button disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-40">السابق</button>
            <span className="font-bold">صفحة {page} من {pageCount}</span>
            <button disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-40">التالي</button>
          </div>
        </section>
      </div>
    </div>
  );
}
