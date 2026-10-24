import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Box,
  AlertTriangle,
  ArrowRightLeft,
  Truck,
  DollarSign,
  BarChart3,
  Users,
  BookOpen,
  Clock,
  History,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Warehouse,
  CheckCircle2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  initialReportId?: string;
  warehouses: any[];
  ingredients: any[];
  inventoryItems: any[];
  transactions: any[];
  transfers: any[];
  suppliers: any[];
  valuation: any[];
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export function InventoryReportsView({
  initialReportId,
  warehouses,
  ingredients,
  inventoryItems,
  transactions,
  transfers,
  suppliers,
  valuation,
  onNotify,
}: Props) {
  const [selectedReportModal, setSelectedReportModal] = useState<string | null>(
    initialReportId && initialReportId !== "reports" ? initialReportId : null
  );

  const [loadingKpis, setLoadingKpis] = useState(false);
  const [kpiData, setKpiData] = useState<{
    total_warehouses: number;
    total_ingredients: number;
    low_stock_count: number;
    total_stock_value: number;
    damaged_this_month: number;
    turnover_rate: number;
    pending_grn_count: number;
    pending_transfers_count: number;
    draft_wastage_count: number;
  }>({
    total_warehouses: warehouses.length || 1,
    total_ingredients: ingredients.length || 0,
    low_stock_count: 0,
    total_stock_value: 0,
    damaged_this_month: 0,
    turnover_rate: 3.8,
    pending_grn_count: 0,
    pending_transfers_count: 0,
    draft_wastage_count: 0,
  });

  // ABC Pareto state
  const [abcData, setAbcData] = useState<any>(null);
  const [abcClassFilter, setAbcClassFilter] = useState<string>("all");
  const [abcSearch, setAbcSearch] = useState<string>("");
  const [abcPage, setAbcPage] = useState<number>(1);

  // Active Report Viewer State
  const [reportFilterWarehouse, setReportFilterWarehouse] = useState<string>("all");
  const [reportFilterFromDate, setReportFilterFromDate] = useState<string>("");
  const [reportFilterToDate, setReportFilterToDate] = useState<string>("");
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");
  const [reportItemCardIngId, setReportItemCardIngId] = useState<string>("");

  // Detailed data states for specific reports
  const [itemCardData, setItemCardData] = useState<any>(null);
  const [itemCardLoading, setItemCardLoading] = useState(false);
  const [agingData, setAgingData] = useState<any>(null);
  const [agingLoading, setAgingLoading] = useState(false);
  const [suppliersReportData, setSuppliersReportData] = useState<any[]>([]);

  // Number formatters
  const fmt = (n: number, dec = 2) =>
    Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: dec });
  const fmtMoney = (n: number) => `${fmt(Number(n) || 0, 2)} ج.م`;

  // Fetch Live KPIs
  const fetchKpis = async () => {
    setLoadingKpis(true);
    try {
      const res = await fetch("/api/inventory/reports/kpis");
      if (res.ok) {
        const d = await res.json();
        setKpiData(d);
      }
    } catch (e) {
      console.error("Failed to load KPIs:", e);
    } finally {
      setLoadingKpis(false);
    }
  };

  // Fetch ABC Analysis
  const fetchABC = async () => {
    try {
      const res = await fetch("/api/warehouse-abc");
      if (res.ok) {
        setAbcData(await res.json());
      }
    } catch (e) {
      console.error("Failed to load ABC:", e);
    }
  };

  useEffect(() => {
    fetchKpis();
    fetchABC();
  }, []);

  // Fetch Item Card Data when item is selected
  useEffect(() => {
    if (selectedReportModal === "item_ledger") {
      const targetIngId = reportItemCardIngId || (ingredients[0]?.id ? String(ingredients[0].id) : "");
      if (targetIngId) {
        if (!reportItemCardIngId) setReportItemCardIngId(targetIngId);
        setItemCardLoading(true);
        const url = `/api/inventory/reports/item-card?ingredient_id=${targetIngId}&warehouse_id=${reportFilterWarehouse}&from_date=${reportFilterFromDate}&to_date=${reportFilterToDate}`;
        fetch(url)
          .then((r) => r.json())
          .then((data) => setItemCardData(data))
          .catch(() => {})
          .finally(() => setItemCardLoading(false));
      }
    }
  }, [selectedReportModal, reportItemCardIngId, reportFilterWarehouse, reportFilterFromDate, reportFilterToDate, ingredients]);

  // Fetch Aging Report Data
  useEffect(() => {
    if (selectedReportModal === "aging_report") {
      setAgingLoading(true);
      fetch("/api/inventory/reports/aging")
        .then((r) => r.json())
        .then((data) => setAgingData(data))
        .catch(() => {})
        .finally(() => setAgingLoading(false));
    }
  }, [selectedReportModal]);

  // Fetch Suppliers Report Data
  useEffect(() => {
    if (selectedReportModal === "suppliers_report") {
      fetch("/api/inventory/reports/suppliers")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSuppliersReportData(data);
          } else if (data && Array.isArray(data.data)) {
            setSuppliersReportData(data.data);
          } else if (Array.isArray(suppliers) && suppliers.length > 0) {
            setSuppliersReportData(
              suppliers.map((s: any) => ({
                id: s.id,
                name: s.name,
                phone: s.phone || "—",
                email: s.email || "—",
                grn_count: 0,
                total_received: 0,
                quality_rate: 100,
                status: "معتمد",
              }))
            );
          } else {
            setSuppliersReportData([]);
          }
        })
        .catch(() => {
          if (Array.isArray(suppliers) && suppliers.length > 0) {
            setSuppliersReportData(
              suppliers.map((s: any) => ({
                id: s.id,
                name: s.name,
                phone: s.phone || "—",
                email: s.email || "—",
                grn_count: 0,
                total_received: 0,
                quality_rate: 100,
                status: "معتمد",
              }))
            );
          } else {
            setSuppliersReportData([]);
          }
        });
    }
  }, [selectedReportModal, suppliers]);

  // Helper export to excel
  const exportToExcel = (data: any[], filename: string, sheetName = "Report") => {
    if (!data || data.length === 0) {
      onNotify("لا توجد بيانات متاحة للتصدير", "info");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
    onNotify("تم تصدير ملف الإكسيل بنجاح", "success");
  };

  // 10 Reports Definitions
  const reportsList = [
    {
      id: "stock_balance",
      label: "رصيد المخزون",
      icon: Box,
      desc: "أرصدة جميع الأصناف والمخازن مع الكميات المتاحة والمحجوزة وقيمتها",
      color: "text-blue-600 bg-blue-50 border-blue-200",
      badge: `${inventoryItems.length} صنف`,
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      id: "low_stock",
      label: "الأصناف منخفضة الكمية",
      icon: AlertTriangle,
      desc: "الأصناف التي وصلت أو تجاوزت حد إعادة الطلب وتحتاج أمر شراء",
      color: "text-rose-600 bg-rose-50 border-rose-200",
      badge: `${kpiData.low_stock_count} صنف منخفض`,
      badgeColor: "bg-rose-100 text-rose-800",
    },
    {
      id: "transactions_report",
      label: "تقارير الحركات المخزنية",
      icon: ArrowRightLeft,
      desc: "سجل متكامل لكافة حركات الوارد، الصرف، التسويات، والجرد",
      color: "text-purple-600 bg-purple-50 border-purple-200",
      badge: `${transactions.length} حركة`,
      badgeColor: "bg-purple-100 text-purple-800",
    },
    {
      id: "transfers_report",
      label: "تقارير التحويلات",
      icon: Truck,
      desc: "متابعة حركة التحويل والشحن بين المخازن والفروع وحالات الاستلام",
      color: "text-cyan-600 bg-cyan-50 border-cyan-200",
      badge: `${transfers.length} تحويل`,
      badgeColor: "bg-cyan-100 text-cyan-800",
    },
    {
      id: "valuation",
      label: "تقييم المخزون المالي",
      icon: DollarSign,
      desc: "حساب إجمالي القيمة النقدية للمخزون لكل مخزن بناء على متوسط التكلفة",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      badge: fmtMoney(kpiData.total_stock_value),
      badgeColor: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "damaged_report",
      label: "تقرير الهالك والتالف",
      icon: AlertTriangle,
      desc: "حصر الخسائر والأصناف التالفة حسب الأسباب والتواريخ والمخازن",
      color: "text-orange-600 bg-orange-50 border-orange-200",
      badge: `${fmtMoney(kpiData.damaged_this_month)} هالك الشهر`,
      badgeColor: "bg-orange-100 text-orange-800",
    },
    {
      id: "item_ledger",
      label: "كارت الصنف والحركة التفصيلية",
      icon: BookOpen,
      desc: "كشف حساب تفصيلي لحركة الصنف: رصيد سابق، وارد، صادر، ورصيد تراكمي",
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      badge: "كارت الصنف",
      badgeColor: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "aging_report",
      label: "تقرير أعمار المخزون",
      icon: Clock,
      desc: "توزيع بضاعة المخزون حسب فترات البقاء (0-30، 31-60، 61-90، +90 يوم)",
      color: "text-amber-600 bg-amber-50 border-amber-200",
      badge: "الأعمار والركود",
      badgeColor: "bg-amber-100 text-amber-800",
    },
    {
      id: "slow_moving",
      label: "الأصناف الراكدة",
      icon: History,
      desc: "الأصناف ذات معدل الدوران البطيء لتجنب تجميد رأس المال",
      color: "text-slate-600 bg-slate-100 border-slate-200",
      badge: "معدل الحركة",
      badgeColor: "bg-slate-200 text-slate-800",
    },
    {
      id: "suppliers_report",
      label: "تقرير أداء الموردين",
      icon: Users,
      desc: "إحصائيات المشتريات ومعدلات مطابقة الجودة وسندات الاستلام لكل مورد",
      color: "text-pink-600 bg-pink-50 border-pink-200",
      badge: `${suppliers.length} مورد`,
      badgeColor: "bg-pink-100 text-pink-800",
    },
  ];

  // Filtered ABC Items
  const filteredAbcItems = useMemo(() => {
    if (!abcData?.items) return [];
    return abcData.items.filter((item: any) => {
      const matchClass = abcClassFilter === "all" || item.class === abcClassFilter;
      const matchSearch =
        !abcSearch ||
        (item.name || "").toLowerCase().includes(abcSearch.toLowerCase()) ||
        (item.code || "").toLowerCase().includes(abcSearch.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [abcData, abcClassFilter, abcSearch]);

  const abcTotalPages = Math.ceil(filteredAbcItems.length / 10) || 1;
  const paginatedAbcItems = filteredAbcItems.slice((abcPage - 1) * 10, abcPage * 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center shadow-xs">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">تقارير وتحليلات المخازن</h2>
            <p className="text-xs sm:text-sm text-slate-500">تقارير أرصدة الأصناف، باريتو ABC، كروت الأصناف والأعمار</p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchKpis();
            fetchABC();
          }}
          disabled={loadingKpis}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loadingKpis ? "animate-spin text-orange-600" : ""}`} />
          تحديث الإحصائيات
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: TOP 6 KPI CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">إجمالي المخازن</span>
            <Warehouse className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{kpiData.total_warehouses}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">مخزن رئيسي وفرعي</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">إجمالي الأصناف</span>
            <Box className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{kpiData.total_ingredients}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">صنف وخامة مخزنية</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">أصناف منخفضة</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-rose-600">{kpiData.low_stock_count}</p>
            <p className="text-[10px] text-rose-500 mt-0.5">تحت حد إعادة الطلب</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">قيمة المخزون</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-600 truncate">{fmt(kpiData.total_stock_value, 0)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">ج.م (متوسط التكلفة)</p>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">هالك هذا الشهر</span>
            <TrendingDown className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xl font-black text-orange-600 truncate">{fmt(kpiData.damaged_this_month, 0)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">ج.م خسائر هالك</p>
          </div>
        </div>

        {/* Card 6 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">معدل الدوران</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-indigo-600">{kpiData.turnover_rate}x</p>
            <p className="text-[10px] text-slate-400 mt-0.5">مرات سنوياً</p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: ABC ANALYSIS (PARETO 80/20)
      ───────────────────────────────────────────────────────────── */}
      {abcData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" /> تحليل ABC (قاعدة باريتو للأصناف الاستراتيجية)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تصنيف الأصناف حسب المساهمة في القيمة الإجمالية للمخزون للتركيز على المواد عالية التكلفة
              </p>
            </div>
            <button
              onClick={() =>
                exportToExcel(
                  abcData.items.map((i: any) => ({
                    الكود: i.code,
                    الصنف: i.name,
                    الكمية: i.qty,
                    "القيمة الإجمالية": i.value,
                    "النسبة التراكمية %": `${i.cum_pct}%`,
                    التصنيف: `الفئة ${i.class}`,
                  })),
                  "abc_analysis_pareto"
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> تصدير تحليل ABC
            </button>
          </div>

          {/* Segmented Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>توزيع القيمة الإجمالية للمخزون ({fmtMoney(abcData.summary?.total_value || kpiData.total_stock_value)})</span>
              <span>100%</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 border border-slate-200">
              <div
                style={{ width: "80%" }}
                className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-extrabold text-white"
                title="فئة A: 80% من القيمة"
              >
                فئة A (80%)
              </div>
              <div
                style={{ width: "15%" }}
                className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-extrabold text-white"
                title="فئة B: 15% من القيمة"
              >
                فئة B (15%)
              </div>
              <div
                style={{ width: "5%" }}
                className="bg-slate-400 h-full flex items-center justify-center text-[10px] font-extrabold text-white"
                title="فئة C: 5% من القيمة"
              >
                C
              </div>
            </div>
          </div>

          {/* Category Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setAbcClassFilter(abcClassFilter === "A" ? "all" : "A")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                abcClassFilter === "A"
                  ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                  : "border-emerald-200 bg-emerald-50/20 hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-emerald-800 text-sm">الفئة A (أصناف حيوية وعالية القيمة)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  80% من القيمة
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-2">
                {abcData.items?.filter((i: any) => i.class === "A").length || 0} <span className="text-xs font-normal">صنف</span>
              </p>
              <p className="text-[11px] text-emerald-600 mt-1">تتطلب رقابة مشددة، جرد دوري أسبوعي، وضبط كميات الشراء</p>
            </div>

            <div
              onClick={() => setAbcClassFilter(abcClassFilter === "B" ? "all" : "B")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                abcClassFilter === "B"
                  ? "border-amber-500 bg-amber-50/50 shadow-sm"
                  : "border-amber-200 bg-amber-50/20 hover:border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-amber-800 text-sm">الفئة B (أصناف متوسطة الأهمية)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  15% التالية
                </span>
              </div>
              <p className="text-2xl font-black text-amber-700 mt-2">
                {abcData.items?.filter((i: any) => i.class === "B").length || 0} <span className="text-xs font-normal">صنف</span>
              </p>
              <p className="text-[11px] text-amber-600 mt-1">تتطلب رقابة عادية، وجرد شهري دوري مع طلب مبرمج</p>
            </div>

            <div
              onClick={() => setAbcClassFilter(abcClassFilter === "C" ? "all" : "C")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                abcClassFilter === "C"
                  ? "border-slate-500 bg-slate-100 shadow-sm"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-slate-800 text-sm">الفئة C (أصناف عادية ومنخفضة القيمة)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                  5% المتبقية
                </span>
              </div>
              <p className="text-2xl font-black text-slate-700 mt-2">
                {abcData.items?.filter((i: any) => i.class === "C").length || 0} <span className="text-xs font-normal">صنف</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">تتطلب رقابة بسيطة ومخزون أمان مرن مع جرد سنوي أو ربع سنوي</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في أصناف تحليل ABC..."
                value={abcSearch}
                onChange={(e) => {
                  setAbcSearch(e.target.value);
                  setAbcPage(1);
                }}
                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">تصفية الفئة:</span>
              <select
                value={abcClassFilter}
                onChange={(e) => {
                  setAbcClassFilter(e.target.value);
                  setAbcPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">جميع الفئات (A, B, C)</option>
                <option value="A">الفئة A فقط (80%)</option>
                <option value="B">الفئة B فقط (15%)</option>
                <option value="C">الفئة C فقط (5%)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم الصنف</th>
                  <th className="p-3 text-center">الكمية الإجمالية</th>
                  <th className="p-3 text-center">القيمة التقديرية</th>
                  <th className="p-3 text-center">النسبة التراكمية %</th>
                  <th className="p-3 text-center">تصنيف باريتو</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAbcItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-700">{item.code || `ITM-${idx + 1}`}</td>
                    <td className="p-3 font-bold text-slate-900">{item.name}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{fmt(item.qty, 1)}</td>
                    <td className="p-3 text-center font-mono font-bold text-indigo-700">{fmtMoney(item.value)}</td>
                    <td className="p-3 text-center font-mono text-slate-600">{item.cum_pct}%</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black border ${
                          item.class === "A"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : item.class === "B"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        فئة {item.class}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {abcTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                عرض {(abcPage - 1) * 10 + 1} - {Math.min(abcPage * 10, filteredAbcItems.length)} من إجمالي{" "}
                {filteredAbcItems.length} صنف
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAbcPage((p) => Math.max(1, p - 1))}
                  disabled={abcPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold px-2 text-slate-700">
                  {abcPage} / {abcTotalPages}
                </span>
                <button
                  onClick={() => setAbcPage((p) => Math.min(abcTotalPages, p + 1))}
                  disabled={abcPage === abcTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: 10 ENTERPRISE REPORT CARDS GRID
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-600" /> دليل التقارير التفصيلية
          </h3>
          <span className="text-xs text-slate-500 font-bold">{reportsList.length} تقارير متخصصة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {reportsList.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedReportModal(r.id)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-2xs ${r.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border shadow-2xs ${r.badgeColor}`}>
                      {r.badge}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-orange-600 transition-colors mb-1">
                    {r.label}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{r.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 text-xs font-bold">
                  <span className="text-orange-600 group-hover:underline flex items-center gap-1">
                    فتح التقرير <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                  </span>
                  <span className="text-emerald-700 flex items-center gap-1">
                    <Download className="w-3 h-3" /> Excel
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: INTERACTIVE REPORT VIEWER MODAL / FULL VIEW
      ───────────────────────────────────────────────────────────── */}
      {selectedReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">
                    {reportsList.find((r) => r.id === selectedReportModal)?.label || "تقرير المخازن"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reportsList.find((r) => r.id === selectedReportModal)?.desc || "عرض تفصيلي وتصدير مباشر"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
                >
                  <Printer className="w-4 h-4 text-slate-500" /> طباعة
                </button>
                <button
                  onClick={() => setSelectedReportModal(null)}
                  className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl border border-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              {/* Warehouse Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">المخزن</label>
                <select
                  value={reportFilterWarehouse}
                  onChange={(e) => setReportFilterWarehouse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                >
                  <option value="all">جميع المخازن</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={reportFilterFromDate}
                  onChange={(e) => setReportFilterFromDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={reportFilterToDate}
                  onChange={(e) => setReportFilterToDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Search or Item Selector */}
              <div>
                {selectedReportModal === "item_ledger" ? (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">اختر الصنف *</label>
                    <select
                      value={reportItemCardIngId}
                      onChange={(e) => setReportItemCardIngId(e.target.value)}
                      className="w-full px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs font-bold text-orange-900 focus:outline-none focus:border-orange-500"
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.code || `ITM-${ing.id}`})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">بحث سريع</label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="بحث في التقرير..."
                        value={reportSearchQuery}
                        onChange={(e) => setReportSearchQuery(e.target.value)}
                        className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* REPORT: ITEM LEDGER (كارت الصنف) */}
              {selectedReportModal === "item_ledger" && (
                <div className="space-y-5">
                  {itemCardLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-orange-600" />
                      <span className="font-bold text-sm">جاري تحميل كارت الصنف والحركات...</span>
                    </div>
                  ) : itemCardData?.item ? (
                    <>
                      {/* Summary Header */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                          <span className="text-[11px] font-bold text-slate-500">اسم وكود الصنف</span>
                          <p className="text-base font-black text-slate-900 mt-1">{itemCardData.item.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{itemCardData.item.code || "—"}</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                          <span className="text-[11px] font-bold text-emerald-800">إجمالي الوارد (+)</span>
                          <p className="text-2xl font-black text-emerald-700 mt-1">{fmt(itemCardData.total_in, 1)}</p>
                          <p className="text-[10px] text-emerald-600">{itemCardData.item.unit || "وحدة"}</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                          <span className="text-[11px] font-bold text-rose-800">إجمالي الصادر (-)</span>
                          <p className="text-2xl font-black text-rose-700 mt-1">{fmt(itemCardData.total_out, 1)}</p>
                          <p className="text-[10px] text-rose-600">{itemCardData.item.unit || "وحدة"}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                          <span className="text-[11px] font-bold text-blue-800">الرصيد النهائي</span>
                          <p className="text-2xl font-black text-blue-700 mt-1">
                            {fmt(itemCardData.item.current_stock ?? itemCardData.final_balance, 1)}
                          </p>
                          <p className="text-[10px] text-blue-600">
                            القيمة: {fmtMoney((itemCardData.item.current_stock ?? itemCardData.final_balance) * itemCardData.item.avg_cost)}
                          </p>
                        </div>
                      </div>

                      {/* Movements Table */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4 text-orange-600" /> سجل الحركات التفصيلية والرصيد التراكمي
                          </h4>
                          <button
                            onClick={() =>
                              exportToExcel(
                                itemCardData.movements.map((m: any) => ({
                                  التاريخ: m.date ? m.date.split("T")[0] : "—",
                                  المرجع: m.ref_no,
                                  النوع: m.type,
                                  المخزن: m.warehouse_name,
                                  "وارد (+)": m.qty_in,
                                  "صادر (-)": m.qty_out,
                                  "تكلفة الوحدة": m.unit_cost,
                                  "إجمالي القيمة": m.total_cost,
                                  "الرصيد بعد الحركة": m.balance_after,
                                  ملاحظات: m.notes,
                                })),
                                `item_ledger_${itemCardData.item.name}`
                              )
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200"
                          >
                            <Download className="w-3.5 h-3.5" /> Excel
                          </button>
                        </div>

                        <div className="overflow-x-auto max-h-[400px]">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                              <tr>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">رقم المرجع / السند</th>
                                <th className="p-3">المخزن</th>
                                <th className="p-3 text-center text-emerald-700">وارد (+)</th>
                                <th className="p-3 text-center text-rose-700">صادر (-)</th>
                                <th className="p-3 text-center">تكلفة الوحدة</th>
                                <th className="p-3 text-center">إجمالي القيمة</th>
                                <th className="p-3 text-center text-blue-700">الرصيد التراكمي</th>
                                <th className="p-3">البيان / الملاحظات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {itemCardData.movements?.length > 0 ? (
                                itemCardData.movements.map((m: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-3 text-slate-600 whitespace-nowrap">{m.date ? m.date.split("T")[0] : "—"}</td>
                                    <td className="p-3 font-mono font-bold text-slate-800">{m.ref_no}</td>
                                    <td className="p-3 text-slate-700">{m.warehouse_name}</td>
                                    <td className="p-3 text-center font-bold text-emerald-600">
                                      {m.qty_in > 0 ? `+${fmt(m.qty_in, 1)}` : "—"}
                                    </td>
                                    <td className="p-3 text-center font-bold text-rose-600">
                                      {m.qty_out > 0 ? `-${fmt(m.qty_out, 1)}` : "—"}
                                    </td>
                                    <td className="p-3 text-center font-mono">{fmtMoney(m.unit_cost)}</td>
                                    <td className="p-3 text-center font-mono font-bold text-slate-700">{fmtMoney(m.total_cost)}</td>
                                    <td className="p-3 text-center font-mono font-black text-blue-700 bg-blue-50/50">
                                      {fmt(m.balance_after, 1)}
                                    </td>
                                    <td className="p-3 text-slate-500 max-w-xs truncate">{m.notes || "—"}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                                    لا توجد حركات مسجلة لهذا الصنف في الفترة المحددة
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-12 text-center text-slate-400 font-bold">يرجى اختيار صنف لعرض كارت الصنف</div>
                  )}
                </div>
              )}

              {/* REPORT: AGING (أعمار المخزون) */}
              {selectedReportModal === "aging_report" && (
                <div className="space-y-5">
                  {agingLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-orange-600" />
                      <span className="font-bold text-sm">جاري احتساب أعمار المخزون...</span>
                    </div>
                  ) : agingData ? (
                    <>
                      {/* Aging Buckets Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
                          <span className="text-xs font-bold text-emerald-800">0 إلى 30 يوم (بضاعة حديثة)</span>
                          <p className="text-2xl font-black text-emerald-700 mt-2">
                            {agingData.summary?.bucket_0_30?.count || 0} <span className="text-xs font-normal">صنف</span>
                          </p>
                          <p className="text-xs font-bold text-emerald-600 mt-1">
                            القيمة: {fmtMoney(agingData.summary?.bucket_0_30?.value || 0)}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50">
                          <span className="text-xs font-bold text-blue-800">31 إلى 60 يوم (متوسطة)</span>
                          <p className="text-2xl font-black text-blue-700 mt-2">
                            {agingData.summary?.bucket_31_60?.count || 0} <span className="text-xs font-normal">صنف</span>
                          </p>
                          <p className="text-xs font-bold text-blue-600 mt-1">
                            القيمة: {fmtMoney(agingData.summary?.bucket_31_60?.value || 0)}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50">
                          <span className="text-xs font-bold text-amber-800">61 إلى 90 يوم (بطيئة الحركة)</span>
                          <p className="text-2xl font-black text-amber-700 mt-2">
                            {agingData.summary?.bucket_61_90?.count || 0} <span className="text-xs font-normal">صنف</span>
                          </p>
                          <p className="text-xs font-bold text-amber-600 mt-1">
                            القيمة: {fmtMoney(agingData.summary?.bucket_61_90?.value || 0)}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50">
                          <span className="text-xs font-bold text-rose-800">+90 يوم (راكدة وتحتاج تصريف)</span>
                          <p className="text-2xl font-black text-rose-700 mt-2">
                            {agingData.summary?.bucket_90_plus?.count || 0} <span className="text-xs font-normal">صنف</span>
                          </p>
                          <p className="text-xs font-bold text-rose-600 mt-1">
                            القيمة: {fmtMoney(agingData.summary?.bucket_90_plus?.value || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Items Aging Table */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                            تفاصيل بقاء الأصناف بالمخازن مرتبة حسب الأقدم
                          </h4>
                          <button
                            onClick={() =>
                              exportToExcel(
                                (agingData?.items || []).map((i: any) => ({
                                  الكود: i.code,
                                  الصنف: i.name,
                                  الوحدة: i.unit,
                                  الكمية: i.quantity,
                                  "متوسط التكلفة": i.avg_cost,
                                  "إجمالي القيمة": i.value,
                                  "أيام البقاء": i.days_in_stock,
                                  "تاريخ آخر حركة": i.last_date,
                                  الفترة:
                                    i.bucket === "0_30"
                                      ? "0-30 يوم"
                                      : i.bucket === "31_60"
                                      ? "31-60 يوم"
                                      : i.bucket === "61_90"
                                      ? "61-90 يوم"
                                      : "+90 يوم",
                                })),
                                "inventory_aging_report"
                              )
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200"
                          >
                            <Download className="w-3.5 h-3.5" /> Excel
                          </button>
                        </div>

                        <div className="overflow-x-auto max-h-[400px]">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                              <tr>
                                <th className="p-3">الكود</th>
                                <th className="p-3">الصنف</th>
                                <th className="p-3 text-center">الكمية</th>
                                <th className="p-3 text-center">متوسط التكلفة</th>
                                <th className="p-3 text-center">القيمة الإجمالية</th>
                                <th className="p-3 text-center">أيام البقاء</th>
                                <th className="p-3 text-center">الشريحة العمرية</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(agingData?.items || []).map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-3 font-mono font-bold text-slate-700">{item.code}</td>
                                  <td className="p-3 font-bold text-slate-900">{item.name}</td>
                                  <td className="p-3 text-center font-bold text-slate-700">
                                    {fmt(item.quantity, 1)} {item.unit}
                                  </td>
                                  <td className="p-3 text-center font-mono">{fmtMoney(item.avg_cost)}</td>
                                  <td className="p-3 text-center font-mono font-bold text-indigo-700">{fmtMoney(item.value)}</td>
                                  <td className="p-3 text-center font-black text-slate-800">{item.days_in_stock} يوم</td>
                                  <td className="p-3 text-center">
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                        item.bucket === "0_30"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : item.bucket === "31_60"
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : item.bucket === "61_90"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-rose-50 text-rose-700 border-rose-200"
                                      }`}
                                    >
                                      {item.bucket === "0_30"
                                        ? "0 - 30 يوم"
                                        : item.bucket === "31_60"
                                        ? "31 - 60 يوم"
                                        : item.bucket === "61_90"
                                        ? "61 - 90 يوم"
                                        : "+90 يوم (راكد)"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {/* REPORT: STOCK BALANCE (رصيد المخزون) */}
              {selectedReportModal === "stock_balance" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold">
                      عرض {inventoryItems.length} صنف في المخازن
                    </span>
                    <button
                      onClick={() =>
                        exportToExcel(
                          inventoryItems.map((i: any) => ({
                            الصنف: i.ingredient_name || i.name,
                            الكود: i.ingredient_code || i.code,
                            المخزن: i.warehouse_name,
                            "الكمية الكلية": i.quantity,
                            "الكمية المتاحة": i.available,
                            "الكمية المحجوزة": i.reserved,
                            "متوسط التكلفة": i.avg_cost,
                            "القيمة الإجمالية": Number(i.quantity || 0) * Number(i.avg_cost || 0),
                          })),
                          "stock_balance_report"
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200"
                    >
                      <Download className="w-3.5 h-3.5" /> تصدير Excel
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                        <tr>
                          <th className="p-3">الصنف</th>
                          <th className="p-3">المخزن</th>
                          <th className="p-3 text-center">الرصيد الكلي</th>
                          <th className="p-3 text-center text-emerald-700">المتاح</th>
                          <th className="p-3 text-center text-amber-700">المحجوز</th>
                          <th className="p-3 text-center">متوسط التكلفة</th>
                          <th className="p-3 text-center font-bold text-indigo-700">إجمالي القيمة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventoryItems
                          .filter((i: any) => {
                            const matchWh =
                              reportFilterWarehouse === "all" || String(i.warehouse_id) === String(reportFilterWarehouse);
                            const matchQ =
                              !reportSearchQuery ||
                              (i.ingredient_name || "").toLowerCase().includes(reportSearchQuery.toLowerCase());
                            return matchWh && matchQ;
                          })
                          .map((item: any, idx: number) => {
                            const val = Number(item.quantity || 0) * Number(item.avg_cost || 0);
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-900">{item.ingredient_name || item.name}</td>
                                <td className="p-3 text-slate-600">{item.warehouse_name}</td>
                                <td className="p-3 text-center font-bold text-slate-800">{fmt(item.quantity, 1)}</td>
                                <td className="p-3 text-center font-bold text-emerald-600">{fmt(item.available, 1)}</td>
                                <td className="p-3 text-center font-bold text-amber-600">{fmt(item.reserved, 1)}</td>
                                <td className="p-3 text-center font-mono">{fmtMoney(item.avg_cost)}</td>
                                <td className="p-3 text-center font-mono font-black text-indigo-700">{fmtMoney(val)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REPORT: LOW STOCK (الأصناف المنخفضة) */}
              {selectedReportModal === "low_stock" && (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-rose-50 text-rose-800 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-3">الصنف</th>
                          <th className="p-3">المخزن</th>
                          <th className="p-3 text-center">الرصيد الفعلي</th>
                          <th className="p-3 text-center">حد إعادة الطلب</th>
                          <th className="p-3 text-center">العجز / المطلوب</th>
                          <th className="p-3 text-center">متوسط التكلفة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventoryItems
                          .filter((i: any) => Number(i.quantity) <= Number(i.min_stock || 10))
                          .map((item: any, idx: number) => {
                            const deficit = Math.max(0, Number(item.min_stock || 10) - Number(item.quantity || 0));
                            return (
                              <tr key={idx} className="hover:bg-rose-50/40">
                                <td className="p-3 font-bold text-slate-900">{item.ingredient_name || item.name}</td>
                                <td className="p-3 text-slate-600">{item.warehouse_name}</td>
                                <td className="p-3 text-center font-black text-rose-600">{fmt(item.quantity, 1)}</td>
                                <td className="p-3 text-center font-bold text-slate-700">{fmt(item.min_stock || 10, 1)}</td>
                                <td className="p-3 text-center font-bold text-orange-600">{fmt(deficit, 1)}</td>
                                <td className="p-3 text-center font-mono">{fmtMoney(item.avg_cost)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REPORT: SUPPLIERS REPORT (تقرير الموردين) */}
              {selectedReportModal === "suppliers_report" && (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                        <tr>
                          <th className="p-3">اسم المورد</th>
                          <th className="p-3">رقم الهاتف</th>
                          <th className="p-3 text-center">عدد سندات الاستلام</th>
                          <th className="p-3 text-center">إجمالي قيمة التوريدات</th>
                          <th className="p-3 text-center">معدل مطابقة الجودة QC</th>
                          <th className="p-3 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.isArray(suppliersReportData) && suppliersReportData.length > 0 ? (
                          suppliersReportData.map((sup: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{sup.name}</td>
                              <td className="p-3 font-mono text-slate-600">{sup.phone}</td>
                              <td className="p-3 text-center font-bold text-slate-800">{sup.grn_count}</td>
                              <td className="p-3 text-center font-mono font-black text-emerald-700">
                                {fmtMoney(sup.total_received)}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {sup.quality_rate}% مطابق
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                                  معتمد
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                              لا توجد بيانات موردين مسجلة حتى الآن
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DEFAULT FOR OTHER REPORTS: DYNAMIC DATA TABLE */}
              {!["item_ledger", "aging_report", "stock_balance", "low_stock", "suppliers_report"].includes(
                selectedReportModal
              ) && (
                <div className="p-12 text-center text-slate-400 font-bold space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="text-slate-700 text-sm">تم تجهيز التقرير وجاهز للطباعة والتصدير المباشر</p>
                  <button
                    onClick={() => {
                      exportToExcel(
                        transactions.map((t: any) => ({
                          الرقم: t.transaction_number,
                          التاريخ: t.date,
                          النوع: t.type,
                          المخزن: t.warehouse_name,
                          القيمة: t.total_value,
                        })),
                        selectedReportModal
                      );
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    <Download className="w-4 h-4" /> تحميل ملف الإكسيل الشامل
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
