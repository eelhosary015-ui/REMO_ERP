import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, Plus, Edit2, Trash2, Warehouse as WarehouseIcon, Box, ArrowRightLeft,
  Calculator, AlertTriangle, Lock, Package, Settings, FileText,
  DollarSign, Building2, RefreshCw, Download, Printer, X,
  CheckCircle, XCircle, Clock, Eye, TrendingUp, TrendingDown,
  Truck, Users, BarChart3, History, Activity, Layers, MapPin,
  Phone, Mail, Filter, Calendar, ArrowDown, ArrowUp, AlertCircle,
  Bell, Star, Camera, Moon, Sun, ZapOff, Tag, Timer, Gauge,
  ThumbsUp, ThumbsDown, MessageSquare, ScanLine,
  Hotel, Utensils, ShoppingCart, Wrench, Factory, Sparkles, HeartPulse,
  Link as LinkIcon, Check, ShieldCheck, Zap, Boxes, Map, Upload
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { api } from "../utils/api";
import { WarehouseLocationsView } from "./inventory/WarehouseLocationsView";
import { GoodsReceiptsView } from "./inventory/GoodsReceiptsView";
import { MaterialRequestsView } from "./inventory/MaterialRequestsView";
import { InventoryPlanningView } from "./inventory/InventoryPlanningView";
import InventoryAdjustmentsView from "./inventory/adjustments/InventoryAdjustmentsView";
import WastageView from "./inventory/wastage/WastageView";
import { AIInventoryAdvisorView } from "./inventory/AIInventoryAdvisorView";
import { InventoryAuditTrailView } from "./inventory/InventoryAuditTrailView";
import { EnterpriseStockBalanceView } from "./inventory/EnterpriseStockBalanceView";
import { WarehouseTransfersView } from "./inventory/WarehouseTransfersView";
import { InventorySettingsView } from "./inventory/settings/InventorySettingsView";
import { InventoryReportsView } from "./inventory/reports/InventoryReportsView";
import { VoiceInputButton } from "./VoiceInputButton";
import { ProductBundles } from "./ProductBundles";
import { PutawayRules } from "./PutawayRules";

interface WarehouseModuleProps {
  onBack: () => void;
  subView?: string;
}

// Types
interface WarehouseItem {
  id: number; name: string; code: string; type: string; branch_id: number;
  manager: string; address: string; status: string; allow_negative: boolean;
  is_default: boolean; description: string; item_count?: number; stock_value?: number;
  linked_module?: string; linked_modules?: string | string[];
  is_module_default?: boolean; auto_sync?: boolean;
}

export const SYSTEM_MODULES = [
  { id: "all", name: "مشترك لجميع موديولات النظام", shortName: "الكل / مشترك", badge: "bg-purple-50 text-purple-700 border-purple-200", icon: Layers, desc: "مخزن مشترك متاح لجميع أقسام وموديولات المؤسسة" },
  { id: "hotels", name: "الفنادق وإدارة النزلاء (Hotel PMS)", shortName: "الفنادق", badge: "bg-blue-50 text-blue-700 border-blue-200", icon: Hotel, desc: "مستلزمات الغرف والنزلاء والبياضات والميني بار والمغسلة الفندقية" },
  { id: "restaurants", name: "المطاعم والكافيهات (Restaurant & POS)", shortName: "المطاعم", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: Utensils, desc: "المواد الخام الغذائية ومكونات الوجبات والمشروبات ووصفات الطهي" },
  { id: "pos", name: "نقاط البيع والتجزئة (Retail POS)", shortName: "نقاط البيع", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShoppingCart, desc: "بضاعة البيع المباشر والسوبرماركت والأرفف" },
  { id: "maintenance", name: "الصيانة والتشغيل (Maintenance)", shortName: "الصيانة", badge: "bg-orange-50 text-orange-700 border-orange-200", icon: Wrench, desc: "قطع الغيار والعدد ومستلزمات الصيانة والتشغيل الدورية" },
  { id: "production", name: "التصنيع والإنتاج (Manufacturing)", shortName: "الإنتاج", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Factory, desc: "خامات التصنيع ومستلزمات خطوط الإنتاج والتعبئة والتغليف" },
  { id: "laundry", name: "المغسلة والتنظيف (Laundry)", shortName: "المغسلة", badge: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: Sparkles, desc: "المنظفات ومستلزمات الغسيل والكي للمفروشات والملابس" },
  { id: "medical", name: "العيادات والخدمات الطبية (Clinics)", shortName: "العيادات", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: HeartPulse, desc: "الأدوية والمستلزمات الطبية ومستهلكات العيادة والمختبر" },
  { id: "hr", name: "الموارد البشرية والعهد (HR Assets)", shortName: "العهد والموظفين", badge: "bg-teal-50 text-teal-700 border-teal-200", icon: Users, desc: "الزي الرسمي، الأجهزة والعهد ومستلزمات الموظفين" },
  { id: "general", name: "المخزن العام المركزي (General)", shortName: "عام مركزي", badge: "bg-slate-100 text-slate-700 border-slate-200", icon: WarehouseIcon, desc: "المخزن الرئيسي للأصناف والأغراض العامة" },
];
interface Ingredient {
  id: number; name: string; code: string; item_code?: string; unit: string; barcode: string;
  category: string; min_stock: number; max_stock: number; reorder_point: number;
  last_purchase_price: number; avg_cost: number;
  total_stock?: number; total_reserved?: number; warehouses_count?: number;
}
interface InventoryItem {
  id: number; warehouse_id: number; ingredient_id: number;
  quantity: number; reserved: number; in_transit: number; available: number;
  ingredient_name?: string; ingredient_code?: string; ingredient_unit?: string;
  warehouse_name?: string; warehouse_code?: string;
  barcode?: string; category?: string; min_stock?: number; max_stock?: number;
  reorder_point?: number; last_purchase_price?: number; avg_cost?: number;
}
interface Transaction {
  id: number; transaction_number: string; date: string; transaction_date?: string; warehouse_id: number;
  type: string; reason: string; reference: string; user: string;
  status: string; notes: string; items: any[]; supplier_id?: number;
  warehouse_name?: string; items_count?: number; total_value?: number;
}
interface Transfer {
  id: number; transfer_number: string; date: string; from_warehouse_id: number;
  to_warehouse_id: number; status: string; user: string; notes: string; items: any[];
  from_warehouse_name?: string; to_warehouse_name?: string;
  items_count?: number; total_qty?: number;
}
interface Movement {
  id: number; warehouse_id: number; ingredient_id: number; field: string;
  before_qty: number; delta: number; after_qty: number; ref_type: string;
  ref_id: number; user: string; notes: string; created_at: string;
  ingredient_name?: string; ingredient_code?: string; unit?: string;
  warehouse_name?: string; warehouse_code?: string;
}
interface Supplier {
  id: number; name: string; code: string; phone: string; email: string;
  address: string; tax_number: string; contact_person: string;
  balance: number; notes: string; tx_count?: number; total_purchases?: number;
}

const TYPE_LABELS: Record<string, string> = {
  main: "رئيسي", sub: "فرعي", production: "إنتاج", raw: "خامات",
  sales: "بيع", returns: "مرتجع", damaged: "هالك",
};
const TX_TYPE_LABELS: Record<string, string> = {
  receive: "استلام", receipt: "استلام", issue: "صرف", transfer: "تحويل", opening: "افتتاحي",
  count: "جرد", adjustment: "تسوية", return: "مرتجع", damaged: "هالك", wastage: "هالك",
};
const TX_EFFECT: Record<string, string> = {
  receive: "in", receipt: "in", issue: "out", transfer: "transfer", opening: "in",
  count: "adjust", adjustment: "adjust", return: "in", damaged: "out", wastage: "out",
};
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "نشط", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  inactive: { label: "موقف", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
  archived: { label: "مؤرشف", color: "text-slate-400", bg: "bg-slate-50 border-slate-200" },
  pending: { label: "قيد الانتظار", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  approved: { label: "معتمد", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  rejected: { label: "مرفوض", color: "text-red-600", bg: "bg-red-50 border-red-200" },
  received: { label: "تم الاستلام", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  in_transit: { label: "قيد النقل", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  cancelled: { label: "ملغي", color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const CHART_COLORS = ["#ea580c", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16"];

// Helper: number formatter
const fmt = (n: number, dec = 2) => {
  if (isNaN(n) || n === null || n === undefined) return "0";
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: dec });
};
const fmtMoney = (n: number) => `${fmt(Number(n) || 0, 2)} ج.م`;

const safeParseItems = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {
      return [];
    }
  }
  if (typeof raw === "object") return [raw];
  return [];
};

// Date formatter: preserves date-only values and converts ISO timestamps to the user's local date/time.
const inventoryDateKey = (value: any) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatInventoryDate = (value: any, withTime = false) => {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  // A pure SQL DATE must never be shifted by timezone conversion.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (!withTime) return raw.split("-").reverse().join("/");
    return raw;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.replace("T", " ").replace(/\.000Z$/, "");
  return d.toLocaleString("ar-EG", {
    year: "numeric", month: "2-digit", day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  });
};

// Helper: export data to Excel
const exportToExcel = (data: any[], filename: string, sheetName = "Sheet1") => {
  try {
    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fname = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    try {
      XLSX.writeFile(wb, fname);
    } catch {
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  } catch (e) {
    console.error("Excel export error:", e);
  }
};

// Helper: export data to PDF (RTL Arabic)
const exportToPDF = (title: string, headers: string[], rows: any[][], filename: string) => {
  const doc = new jsPDF({ orientation: rows.length > 10 || headers.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.text(`تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}`, 14, 26);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 32,
    styles: { font: "helvetica", fontSize: 9, halign: "right" },
    headStyles: { fillColor: [234, 88, 12], textColor: 255, halign: "right" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
};

// Simple barcode generator (Code128-style visual bars using SVG)
function BarcodeDisplay({ value, height = 50 }: { value: string; height?: number }) {
  if (!value) return <div className="text-slate-400 text-xs">— لا يوجد باركود —</div>;
  // Generate pseudo-random bars from the string
  const bars: { x: number; w: number; h: number }[] = [];
  let x = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const pattern = [(code >> 0) & 7, (code >> 1) & 7, (code >> 2) & 7, (code >> 3) & 7];
    for (const p of pattern) {
      const w = (p % 3) + 1;
      const isFilled = (p & 1) === 0;
      if (isFilled) bars.push({ x, w, h: height });
      x += w;
    }
    x += 2; // separator
  }
  const totalWidth = x;
  return (
    <svg width={totalWidth} height={height + 18} viewBox={`0 0 ${totalWidth} ${height + 18}`}>
      <rect x="0" y="0" width={totalWidth} height={height} fill="white" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height={b.h} fill="black" />
      ))}
      <text x={totalWidth / 2} y={height + 14} textAnchor="middle" fontSize="11" fontFamily="monospace" fontWeight="bold">
        {value}
      </text>
    </svg>
  );
}

export const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
    <Icon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
    <p className="text-slate-400 font-bold text-lg">{title}</p>
    <p className="text-slate-300 text-sm mt-1">{subtitle}</p>
  </div>
);

interface InventoryFilterBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedWarehouse?: string;
  setSelectedWarehouse?: (w: string) => void;
  warehouses?: any[];
  statusFilter?: string;
  setStatusFilter?: (s: string) => void;
  typeFilter?: string;
  setTypeFilter?: (t: string) => void;
  dateFrom?: string;
  setDateFrom?: (d: string) => void;
  dateTo?: string;
  setDateTo?: (d: string) => void;
  fetchData?: () => void;
  loading?: boolean;
  showWarehouseFilter?: boolean;
  showStatusFilter?: boolean;
  showTypeFilter?: boolean;
  showDateFilter?: boolean;
}

export const InventoryFilterBar: React.FC<InventoryFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedWarehouse = "all",
  setSelectedWarehouse,
  warehouses = [],
  statusFilter = "all",
  setStatusFilter,
  typeFilter = "all",
  setTypeFilter,
  dateFrom = "",
  setDateFrom,
  dateTo = "",
  setDateTo,
  fetchData,
  loading = false,
  showWarehouseFilter = true,
  showStatusFilter = false,
  showTypeFilter = false,
  showDateFilter = false,
}) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
    <div className="relative flex-1 min-w-[220px] flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="بحث سريع برقم الصنف، الاسم، الباركود، أو الملاحظات..."
          value={searchQuery ?? ""}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-9 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 font-medium text-sm transition-all"
          dir="rtl"
          autoComplete="off"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
            title="مسح البحث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <VoiceInputButton onTranscript={(txt) => setSearchQuery(txt)} />
    </div>

    {showWarehouseFilter && setSelectedWarehouse && (
      <select
        value={selectedWarehouse ?? "all"}
        onChange={(e) => setSelectedWarehouse(e.target.value)}
        className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-500 font-medium cursor-pointer"
      >
        <option value="all">كل المخازن</option>
        {warehouses.map((w: any) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    )}

    {showStatusFilter && setStatusFilter && (
      <select
        value={statusFilter ?? "all"}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-500 font-medium cursor-pointer"
      >
        <option value="all">كل الحالات</option>
        <option value="active">نشط</option>
        <option value="inactive">موقف</option>
        <option value="pending">قيد الانتظار</option>
        <option value="approved">معتمد</option>
        <option value="received">تم الاستلام</option>
        <option value="in_transit">قيد النقل</option>
        <option value="cancelled">ملغي</option>
      </select>
    )}

    {showTypeFilter && setTypeFilter && (
      <select
        value={typeFilter ?? "all"}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-500 font-medium cursor-pointer"
      >
        <option value="all">كل الأنواع</option>
        <option value="receive">استلام</option>
        <option value="issue">صرف</option>
        <option value="transfer">تحويل</option>
        <option value="opening">افتتاحي</option>
        <option value="count">جرد</option>
        <option value="adjustment">تسوية</option>
        <option value="return">مرتجع</option>
        <option value="damaged">هالك</option>
      </select>
    )}

    {showDateFilter && setDateFrom && setDateTo && (
      <>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent focus:outline-none text-sm text-slate-700 font-medium"
            placeholder="من"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateTo ?? ""}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent focus:outline-none text-sm text-slate-700 font-medium"
            placeholder="إلى"
          />
        </div>
      </>
    )}

    {fetchData && (
      <button
        onClick={fetchData}
        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200 cursor-pointer"
        title="تحديث البيانات"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    )}
  </div>
);

export function Inventory({ onBack, subView }: WarehouseModuleProps) {
  // Direct opening on features (no internal dashboard) — section tabs at top
  const initialTab = subView && ["stock_balance", "low_stock", "transactions_report", "transfers_report", "valuation", "damaged_report"].includes(subView)
    ? "reports"
    : subView && ["settings", "warehouse_types", "transaction_types", "transaction_reasons"].includes(subView)
    ? "settings"
    : "features";

  const [activeTab, setActiveTab] = useState<"features" | "settings" | "reports">(initialTab);
  const [activePage, setActivePage] = useState<string>(""); // current page id (warehouse/stock/transactions/...)
  const [activeFeature, setActiveFeature] = useState<string>(() => {
    if (subView) return subView;
    const saved = localStorage.getItem("last_inventory_feature");
    return saved || "main";
  });

  useEffect(() => {
    if (activeFeature) {
      try {
        localStorage.setItem("last_inventory_feature", activeFeature);
      } catch (_) {}
    }
  }, [activeFeature]);

  useEffect(() => {
    if (subView) {
      const isSubReport = ["stock_balance", "low_stock", "transactions_report", "transfers_report", "valuation", "damaged_report", "abc", "suppliers_report"].includes(subView);
      const isReportPage = ["movements", "turnover", "slow_moving", "reports"].includes(subView);
      const isSetting = ["settings", "warehouse_types", "transaction_types", "transaction_reasons"].includes(subView);
      
      const newTab = (isSubReport || isReportPage) ? "reports" : isSetting ? "settings" : "features";
      
      setActiveTab(newTab);
      // If it's one of the exportable reports, the page itself is "reports"
      setActivePage(isSubReport ? "reports" : subView);
      setActiveFeature(subView);
    }
  }, [subView]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Data
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]);
  const [transactionReasons, setTransactionReasons] = useState<any[]>([]);
  const [warehouseSettings, setWarehouseSettings] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [abcData, setAbcData] = useState<any>(null);
  const [valuation, setValuation] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [turnover, setTurnover] = useState<any>(null);
  const [slowMoving, setSlowMoving] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [ratingSupplier, setRatingSupplier] = useState<Supplier | null>(null);
  const [ratingForm, setRatingForm] = useState({ rating: 5, criteria: "جودة المنتجات", comment: "" });
  const [supplierRatings, setSupplierRatings] = useState<any>(null);

  // Modals
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showImportIngredientsModal, setShowImportIngredientsModal] = useState(false);
  const [importIngredientNames, setImportIngredientNames] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [isImportingIngredients, setIsImportingIngredients] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showDamagedModal, setShowDamagedModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showMovementHistoryModal, setShowMovementHistoryModal] = useState(false);
  const [showTransferDetailsModal, setShowTransferDetailsModal] = useState(false);
  const [showTxDetailsModal, setShowTxDetailsModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Partial<WarehouseItem> | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [warehouseModuleFilter, setWarehouseModuleFilter] = useState<string>("all");
  const [historyItem, setHistoryItem] = useState<any>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [selectedBarcode, setSelectedBarcode] = useState<Ingredient | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // New warehouses take the next serial code from the server (WH-001, WH-002,
  // ...) so the sequence stays authoritative instead of being typed by hand.
  useEffect(() => {
    if (!showWarehouseModal || editingWarehouse?.id) return;
    let cancelled = false;
    api.get("/api/warehouses/next-code")
      .then((res: Response) => (res.ok ? res.json() : null))
      .then((data: any) => {
        if (cancelled || !data?.code) return;
        setEditingWarehouse(prev => (prev && !prev.id ? { ...prev, code: data.code } : prev));
      })
      .catch(() => { /* the server assigns the code on save if this fails */ });
    return () => { cancelled = true; };
  }, [showWarehouseModal, editingWarehouse?.id]);

  // Transaction form state
  const [txForm, setTxForm] = useState({
    type: "receive", warehouse_id: "", reason: "", reference: "", notes: "",
    date: new Date().toISOString().split("T")[0], items: [] as any[],
    supplier_id: "", status: "approved",
  });
  const [txItemSearch, setTxItemSearch] = useState("");
  const [transferItemSearch, setTransferItemSearch] = useState("");
  const [adjItemSearch, setAdjItemSearch] = useState("");
  const [dmgItemSearch, setDmgItemSearch] = useState("");

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    from_warehouse_id: "", to_warehouse_id: "", notes: "", date: new Date().toISOString().split("T")[0],
    items: [] as any[], status: "pending",
  });

  // Count form state
  const [countForm, setCountForm] = useState({
    warehouse_id: "", notes: "", date: new Date().toISOString().split("T")[0],
    items: [] as any[],
  });

  // ═══════════════════════════════════════════════════════════════
  // Advanced Stocktaking & Inventory Count System State (الجرد المتقدم)
  // ═══════════════════════════════════════════════════════════════
  interface CountItemRow {
    product_id: number;
    ingredient_id: number;
    code: string;
    name: string;
    unit: string;
    warehouse_id: number;
    warehouse_name: string;
    book_quantity: number;
    physical_quantity: number;
    difference_quantity: number;
    cost_price: number;
    difference_cost: number;
    difference_percent: number;
    status: "matched" | "surplus" | "shortage";
    notes: string;
    is_settled?: boolean;
  }

  const [activeCount, setActiveCount] = useState<{
    id: number | null;
    inventory_no: string;
    inventory_date: string;
    warehouse_id: string;
    user_name: string;
    status: "draft" | "in_progress" | "approved";
    notes: string;
  }>({
    id: null,
    inventory_no: `GR-${new Date().getFullYear()}-001`,
    inventory_date: new Date().toISOString().split("T")[0],
    warehouse_id: "all",
    user_name: "المشرف العام",
    status: "draft",
    notes: "",
  });

  const [countItemsList, setCountItemsList] = useState<CountItemRow[]>([]);
  const [countFilterWarehouse, setCountFilterWarehouse] = useState<string>("all");
  const [countFilterStatus, setCountFilterStatus] = useState<string>("all");
  const [countSearchQuery, setCountSearchQuery] = useState<string>("");
  const [countCurrentPage, setCountCurrentPage] = useState<number>(1);
  const [countItemsPerPage, setCountItemsPerPage] = useState<number>(20);
  const [isApprovingCount, setIsApprovingCount] = useState<boolean>(false);
  const [showCountHistoryModal, setShowCountHistoryModal] = useState<boolean>(false);
  const [countHistoryList, setCountHistoryList] = useState<any[]>([]);
  const [loadingCountSession, setLoadingCountSession] = useState<boolean>(false);
  const [selectedPastCount, setSelectedPastCount] = useState<any | null>(null);

  // Initialize or fetch counting items
  const initCountSession = useCallback(async (targetWhId: string = "all") => {
    setLoadingCountSession(true);
    try {
      const url = targetWhId && targetWhId !== "all" 
        ? `/api/inventory/counts/prepare-new?warehouse_id=${targetWhId}`
        : `/api/inventory/counts/prepare-new`;
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const processedItems: CountItemRow[] = rawItems.map((it: any) => {
          const bQty = Number(it.book_quantity ?? it.quantity ?? it.current_stock ?? it.available_stock ?? 0);
          const cPrice = Number(it.cost_price ?? it.unit_cost ?? it.cost ?? it.avg_cost ?? it.standard_cost ?? 0);
          return {
            product_id: it.product_id || it.ingredient_id || it.id,
            ingredient_id: it.ingredient_id || it.product_id || it.id,
            code: it.code || `ITEM-${it.ingredient_id || it.id}`,
            name: it.name || it.ingredient_name || "صنف مخزني",
            unit: it.unit || "قطعة",
            warehouse_id: Number(it.warehouse_id) || (targetWhId !== "all" ? Number(targetWhId) : (warehouses[0]?.id || 1)),
            warehouse_name: it.warehouse_name || (targetWhId !== "all" ? (warehouses.find(w => w.id === Number(targetWhId))?.name || "المخزن الرئيسي") : "جميع المخازن"),
            book_quantity: bQty,
            physical_quantity: Number(it.physical_quantity ?? bQty),
            difference_quantity: 0,
            cost_price: cPrice,
            difference_cost: 0,
            difference_percent: 0,
            status: "matched",
            notes: it.notes || "",
            is_settled: false,
          };
        });

        setActiveCount({
          id: null,
          inventory_no: data.inventory_no || `GR-${new Date().getFullYear()}-001`,
          inventory_date: data.inventory_date || new Date().toISOString().split("T")[0],
          warehouse_id: targetWhId,
          user_name: data.user?.name || "المشرف العام",
          status: "draft",
          notes: "",
        });
        setCountItemsList(processedItems);
        setCountCurrentPage(1);
      } else {
        // Fallback using loaded ingredients & inventoryItems
        const fallbackItems: CountItemRow[] = ingredients.map((ing) => {
          let bookQty = 0;
          let whName = "المخزن الرئيسي";
          if (targetWhId !== "all") {
            const row = inventoryItems.find(i => Number(i.ingredient_id) === Number(ing.id) && Number(i.warehouse_id) === Number(targetWhId));
            bookQty = row ? Number(row.quantity || row.available || 0) : 0;
            const wh = warehouses.find(w => w.id === Number(targetWhId));
            if (wh) whName = wh.name;
          } else {
            const sumInv = inventoryItems.filter(i => Number(i.ingredient_id) === Number(ing.id)).reduce((sum, r) => sum + Number(r.quantity || 0), 0);
            bookQty = sumInv > 0 ? sumInv : Number((ing as any).current_stock || 0);
            whName = "جميع المخازن";
          }
          const cost = Number((ing as any).avg_cost || (ing as any).cost || (ing as any).unit_cost || (ing as any).cost_per_unit || (ing as any).cost_price || (ing as any).last_cost || 0);
          return {
            product_id: ing.id,
            ingredient_id: ing.id,
            code: ing.code || (ing as any).item_code || `ITEM-${1000 + ing.id}`,
            name: ing.name || (ing as any).ingredient_name,
            unit: ing.unit || "قطعة",
            warehouse_id: targetWhId !== "all" ? Number(targetWhId) : (warehouses[0]?.id || 1),
            warehouse_name: whName,
            book_quantity: bookQty,
            physical_quantity: bookQty,
            difference_quantity: 0,
            cost_price: cost,
            difference_cost: 0,
            difference_percent: 0,
            status: "matched",
            notes: "",
            is_settled: false,
          };
        });
        setActiveCount({
          id: null,
          inventory_no: `GR-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
          inventory_date: new Date().toISOString().split("T")[0],
          warehouse_id: targetWhId,
          user_name: "المشرف العام",
          status: "draft",
          notes: "",
        });
        setCountItemsList(fallbackItems);
      }
    } catch (e) {
      console.error("Error init count session:", e);
    } finally {
      setLoadingCountSession(false);
    }
  }, [ingredients, inventoryItems, warehouses]);

  // Load past count history
  const fetchCountHistory = useCallback(async () => {
    try {
      const res = await api.get("/api/inventory/counts");
      if (res.ok) {
        const data = await res.json();
        setCountHistoryList(data.data || []);
      }
    } catch (e) {
      console.error("Count history error:", e);
    }
  }, []);

  // Recalculate item difference on physical quantity change
  const handlePhysicalQtyChange = (globalIndex: number, valStr: string) => {
    const rawVal = parseFloat(valStr);
    const validVal = isNaN(rawVal) || rawVal < 0 ? 0 : rawVal;

    setCountItemsList((prev) => {
      const updated = [...prev];
      const item = { ...updated[globalIndex] };
      item.physical_quantity = validVal;
      const diff = Number((validVal - item.book_quantity).toFixed(3));
      item.difference_quantity = diff;
      item.difference_percent = item.book_quantity > 0 
        ? Number(((diff / item.book_quantity) * 100).toFixed(2)) 
        : (diff > 0 ? 100 : 0);
      item.difference_cost = Number((diff * item.cost_price).toFixed(2));
      item.status = diff === 0 ? "matched" : diff > 0 ? "surplus" : "shortage";
      item.is_settled = false;
      updated[globalIndex] = item;
      return updated;
    });

    if (activeCount.status === "draft") {
      setActiveCount(prev => ({ ...prev, status: "in_progress" }));
    }
  };

  // Recalculate item notes
  const handleItemNotesChange = (globalIndex: number, note: string) => {
    setCountItemsList((prev) => {
      const updated = [...prev];
      updated[globalIndex] = { ...updated[globalIndex], notes: note };
      return updated;
    });
  };

  // Settle single item in active count
  const handleSettleSingleItem = async (item: CountItemRow, idx: number) => {
    if (!confirm(`هل تريد تسوية الفارق للصنف (${item.name}) وتحديث الرصيد بالمخزن؟`)) return;
    try {
      if (activeCount.id) {
        const res = await api.post(`/api/inventory/counts/${activeCount.id}/settle-item`, {
          item_id: item.product_id,
          user: activeCount.user_name || "admin"
        });
        if (res.ok) {
          showToast(`تمت تسوية الصنف (${item.name}) بنجاح`);
          setCountItemsList(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], is_settled: true };
            return next;
          });
          fetchData();
          return;
        }
      }

      // Fallback: Post instant adjustment transaction
      const txNum = `TX-ADJ-${Date.now().toString().slice(-6)}`;
      const res = await api.post("/api/inventory-transactions", {
        transaction_number: txNum,
        date: activeCount.inventory_date,
        warehouse_id: item.warehouse_id,
        type: item.difference_quantity > 0 ? "in" : "out",
        reason: "تسوية جرد فردية",
        user: activeCount.user_name,
        status: "approved",
        notes: `تسوية جرد صنف: ${item.name} (${item.notes || ''})`,
        items: [{
          ingredient_id: item.ingredient_id,
          name: item.name,
          unit: item.unit,
          quantity: Math.abs(item.difference_quantity),
          price: item.cost_price
        }]
      });

      if (res.ok) {
        showToast(`تمت تسوية الصنف (${item.name}) بنجاح وتحديث الرصيد الدفتري`);
        setCountItemsList(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], is_settled: true, book_quantity: next[idx].physical_quantity, difference_quantity: 0, difference_cost: 0, difference_percent: 0, status: "matched" };
          return next;
        });
        fetchData();
      }
    } catch (e) {
      showToast("حدث خطأ أثناء تسوية البند", "error");
    }
  };

  // Full Count Approval & Posting
  const handleApproveAndSettleCount = async () => {
    if (countItemsList.length === 0) {
      showToast("لا توجد أصناف في جدول الجرد", "error");
      return;
    }

    const diffItems = countItemsList.filter(i => i.difference_quantity !== 0);
    const confirmMsg = diffItems.length > 0 
      ? `هل أنت متأكد من اعتماد الجرد؟ سيتم إنشاء قيود تسوية مخزنية آلية لعدد (${diffItems.length}) صنف به فروقات وتحديث الأرصدة الفعلية.`
      : "جميع الأصناف مطابقة (0 فروقات). هل تريد اعتماد هذا الجرد وتوثيقه؟";

    if (!confirm(confirmMsg)) return;

    setIsApprovingCount(true);
    try {
      // 1. Save count record
      const saveRes = await api.post("/api/inventory/counts", {
        inventory_no: activeCount.inventory_no,
        inventory_date: activeCount.inventory_date,
        warehouse_id: activeCount.warehouse_id === "all" ? null : Number(activeCount.warehouse_id),
        notes: activeCount.notes,
        user_name: activeCount.user_name,
        items: countItemsList
      });

      if (saveRes.ok) {
        const savedData = await saveRes.json();
        const countId = savedData.count_id;

        // 2. Approve and post adjustments
        const approveRes = await api.post(`/api/inventory/counts/${countId}/approve`, {
          user: activeCount.user_name
        });

        if (approveRes.ok) {
          const appData = await approveRes.json();
          showToast(appData.message || "تم اعتماد الجرد وترحيل التسويات بنجاح", "success");
          setActiveCount(prev => ({ ...prev, id: countId, status: "approved" }));
          setCountItemsList(prev => prev.map(i => ({ ...i, is_settled: true })));
          fetchData();
          fetchCountHistory();
        } else {
          showToast("تم حفظ الجرد ولكن حدث خطأ أثناء الترحيل التلقائي", "error");
        }
      } else {
        showToast("خطأ في حفظ عملية الجرد", "error");
      }
    } catch (err: any) {
      showToast("حدث خطأ أثناء اعتماد الجرد: " + (err.message || "فشل الاتصال"), "error");
    } finally {
      setIsApprovingCount(false);
    }
  };

  // Export to Excel using XLSX
  const handleExportCountExcel = () => {
    try {
      const dataRows = countItemsList.map(item => ({
        "كود الصنف": item.code,
        "اسم الصنف": item.name,
        "المخزن": item.warehouse_name,
        "الوحدة": item.unit,
        "الكمية الدفترية": item.book_quantity,
        "الكمية الفعلية": item.physical_quantity,
        "الفرق": item.difference_quantity,
        "نسبة الفرق %": `${item.difference_percent}%`,
        "سعر التكلفة": item.cost_price,
        "تكلفة الفرق (ج.م)": item.difference_cost,
        "الحالة": item.status === "matched" ? "مطابق" : item.status === "surplus" ? "زيادة" : "عجز",
        "ملاحظات": item.notes || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "جرد المخازن");

      // Auto width for columns
      const colWidths = [
        { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 10 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 25 }
      ];
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(workbook, `جرد_مخازن_${activeCount.inventory_no}_${activeCount.inventory_date}.xlsx`);
      showToast("تم تصدير ملف الإكسيل بنجاح");
    } catch (e) {
      showToast("فشل تصدير ملف الإكسيل", "error");
    }
  };

  // Print Stocktaking Sheet
  const handlePrintCountSheet = () => {
    window.print();
  };

  // Adjustment form state
  const [adjForm, setAdjForm] = useState({
    warehouse_id: "", type: "increase", reason: "", notes: "",
    date: new Date().toISOString().split("T")[0], items: [] as any[],
  });

  // Damaged form state
  const [dmgForm, setDmgForm] = useState({
    warehouse_id: "", reason: "", notes: "",
    date: new Date().toISOString().split("T")[0], items: [] as any[],
  });

  // Toast helper
  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleIngredientExcelFile = async (file: File) => {
    try {
      setImportFileName(file.name);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        showToast("ملف Excel لا يحتوي على أي ورقة", "error");
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });
      if (!rows.length) {
        showToast("ملف Excel فارغ", "error");
        setImportIngredientNames([]);
        return;
      }

      const findColumn = (row: Record<string, any>) => {
        const keys = Object.keys(row);
        const exact = keys.find(k => k.trim() === "الصنف");
        if (exact) return exact;
        return keys.find(k => ["اسم الصنف", "الاسم", "name", "item", "item name"].includes(k.trim().toLowerCase()));
      };

      const firstColumn = findColumn(rows[0]);
      if (!firstColumn) {
        showToast('يجب أن يحتوي الشيت على عمود باسم "الصنف"', "error");
        setImportIngredientNames([]);
        return;
      }

      const seen = new Set<string>();
      const names: string[] = [];
      for (const row of rows) {
        const raw = row[firstColumn];
        const name = String(raw ?? "").trim();
        const key = name.replace(/\s+/g, " ").toLocaleLowerCase("ar-EG");
        if (!name || seen.has(key)) continue;
        seen.add(key);
        names.push(name.replace(/\s+/g, " "));
      }

      setImportIngredientNames(names);
      if (!names.length) showToast("لم يتم العثور على أسماء أصناف صالحة", "error");
    } catch (e: any) {
      console.error("Ingredient Excel import parse error", e);
      showToast("تعذر قراءة ملف Excel", "error");
      setImportIngredientNames([]);
    }
  };

  const handleImportIngredients = async () => {
    if (!importIngredientNames.length || isImportingIngredients) return;
    setIsImportingIngredients(true);
    try {
      const res = await api.post("/api/ingredients/import", { names: importIngredientNames });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "فشل استيراد الأصناف", "error");
        return;
      }

      const imported = Number(data.imported_count || data.imported?.length || 0);
      const skipped = Number(data.skipped_count || data.skipped?.length || 0);
      showToast(`تم إنشاء ${imported} صنف${skipped ? ` وتم تخطي ${skipped} مكرر` : ""} بنجاح`, "success");
      setShowImportIngredientsModal(false);
      setImportIngredientNames([]);
      setImportFileName("");
      fetchData();
    } catch (e) {
      console.error("Ingredient Excel import error", e);
      showToast("خطأ في الاتصال أثناء الاستيراد", "error");
    } finally {
      setIsImportingIngredients(false);
    }
  };

  const downloadIngredientTemplate = () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([["الصنف"], ["مثال: أرز"], ["مثال: زيت طعام"], ["مثال: سكر"]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الأصناف");
      const fname = "نموذج_استيراد_الأصناف.xlsx";
      try {
        XLSX.writeFile(wb, fname);
      } catch {
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    } catch (e) {
      console.error("Template download error:", e);
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.allSettled([
        api.get("/api/warehouses").then(async r => {
          const d = await r.json().catch(() => ({}));
          if (r.ok) {
            const list = Array.isArray(d) ? d : d?.data || [];
            setWarehouses(Array.isArray(list) ? list : []);
          } else {
            console.error("Failed to load warehouses:", d?.error || r.statusText);
            showToast(d?.error || "فشل تحميل المخازن", "error");
          }
        }).catch(err => {
          console.error("Warehouse list request failed:", err);
          showToast("تعذر الاتصال بخدمة المخازن", "error");
        }),
        api.get("/api/ingredients").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setIngredients(Array.isArray(d) ? d : d?.data || []);
          }
        }),
        api.get("/api/inventory-items").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setInventoryItems(Array.isArray(d) ? d : d?.data || []);
          }
        }),
        api.get("/api/inventory-transactions").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            const list = Array.isArray(d) ? d : d?.data || [];
            setTransactions(list.map((tx: any) => ({ ...tx, items: safeParseItems(tx.items) })));
          }
        }),
        api.get("/api/branches").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setBranches(Array.isArray(d) ? d : []);
          }
        }),
        api.get("/api/warehouse-transfers").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            const list = Array.isArray(d) ? d : d?.data || [];
            setTransfers(list.map((trf: any) => ({ ...trf, items: safeParseItems(trf.items) })));
          }
        }),
        api.get("/api/inventory-movements").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setMovements(Array.isArray(d) ? d : d?.data || []);
          }
        }),
        api.get("/api/warehouse-suppliers").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setSuppliers(Array.isArray(d) ? d : d?.data || []);
          }
        }),
        api.get("/api/warehouse-dashboard").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => null);
            if (d) setDashboard(d);
          }
        }),
        api.get("/api/stock-batches").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setBatches(Array.isArray(d) ? d : d?.data || []);
          }
        }),
        api.get("/api/inventory-notifications?unread_only=true").then(async r => {
          if (r.ok) {
            const d = await r.json().catch(() => []);
            setNotifications(Array.isArray(d) ? d : d?.data || []);
          }
        }),
      ]);
    } catch (e) { console.error("Fetch error:", e); }
    setLoading(false);
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const [wtRes, ttRes, trRes, wsRes] = await Promise.all([
        api.get("/api/warehouse-types"),
        api.get("/api/transaction-types"),
        api.get("/api/transaction-reasons"),
        api.get("/api/warehouse-settings"),
      ]);
      if (wtRes.ok) setWarehouseTypes(await wtRes.json().then(d => Array.isArray(d) ? d : d.data || []));
      if (ttRes.ok) setTransactionTypes(await ttRes.json().then(d => Array.isArray(d) ? d : d.data || []));
      if (trRes.ok) setTransactionReasons(await trRes.json().then(d => Array.isArray(d) ? d : d.data || []));
      if (wsRes.ok) setWarehouseSettings(await wsRes.json().then(d => Array.isArray(d) ? d : d.data || []));
    } catch (e) { console.error("Settings fetch error:", e); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (activePage === "settings") fetchSettings(); }, [activePage, fetchSettings]);
  useEffect(() => {
    if (activePage === "count") {
      initCountSession(countFilterWarehouse);
      fetchCountHistory();
    }
  }, [activePage]);
  useEffect(() => { if (activePage === "reports" && !abcData) fetchABC(); }, [activePage, abcData]);
  useEffect(() => { if (activePage === "reports" && valuation.length === 0) fetchValuation(); }, [activePage, valuation]);
  // Fetch turnover/slow-moving when those pages are opened
  useEffect(() => {
    if (activePage === "turnover" && !turnover) {
      (async () => { try { const r = await api.get("/api/warehouse-turnover?days=30"); if (r.ok) setTurnover(await r.json()); } catch {} })();
    }
    if (activePage === "slow_moving" && !slowMoving) {
      (async () => { try { const r = await api.get("/api/warehouse-slow-moving?days=30"); if (r.ok) setSlowMoving(await r.json()); } catch {} })();
    }
  }, [activePage, turnover, slowMoving]);
  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setShowGlobalSearch(true); }
      if (e.key === "Escape") { setShowGlobalSearch(false); setShowNotifications(false); setShowBarcodeScanner(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


  const fetchABC = async () => {
    try {
      const res = await api.get("/api/warehouse-abc");
      if (res.ok) setAbcData(await res.json());
    } catch (e) { console.error(e); }
  };
  const fetchValuation = async () => {
    try {
      const res = await api.get("/api/warehouse-valuation");
      if (res.ok) setValuation(await res.json());
    } catch (e) { console.error(e); }
  };

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedWarehouse, activeFeature, pageSize, statusFilter, typeFilter, dateFrom, dateTo]);

  // Dashboard navigation cards — every page accessible directly from dashboard
  const dashboardCards = [
    // ─── القسم الأول: الإدارة ───
    { id: "main", label: "إدارة المخازن", desc: "إنشاء وتعديل المخازن والفروع", icon: WarehouseIcon, color: "from-orange-500 to-orange-600", iconBg: "bg-orange-50 text-orange-600", section: "الإدارة" },
    { id: "locations", label: "مواقع التخزين والأرفف", desc: "هيكل المناطق والأرفف والحاويات (Bins)", icon: Layers, color: "from-amber-500 to-amber-600", iconBg: "bg-amber-50 text-amber-600", section: "الإدارة" },
    { id: "ingredients", label: "إدارة الأصناف", desc: "إضافة وتعديل الأصناف والباركود", icon: Package, color: "from-blue-500 to-blue-600", iconBg: "bg-blue-50 text-blue-600", section: "الإدارة" },
    { id: "suppliers", label: "الموردين", desc: "إدارة الموردين والتقييمات", icon: Users, color: "from-pink-500 to-pink-600", iconBg: "bg-pink-50 text-pink-600", section: "الإدارة" },
    { id: "barcode", label: "الباركود", desc: "توليد وطباعة الباركود", icon: ScanLine, color: "from-violet-500 to-violet-600", iconBg: "bg-violet-50 text-violet-600", section: "الإدارة" },
    { id: "product_bundles", label: "حزم المنتجات", desc: "تجميع عدة أصناف في وحدة بيع أو تصنيع واحدة", icon: Boxes, color: "from-teal-500 to-teal-600", iconBg: "bg-teal-50 text-teal-600", section: "الإدارة" },

    // ─── القسم الثاني: العمليات ───
    { id: "goods_receipts", label: "سندات الاستلام (GRN & QC)", desc: "استلام وفحص المشتريات والتشغيلات", icon: ShieldCheck, color: "from-emerald-600 to-emerald-700", iconBg: "bg-emerald-50 text-emerald-600", section: "العمليات" },
    { id: "material_requests", label: "طلبات وصرف المواد", desc: "صرف المواد للأقسام والإنتاج والصيانة", icon: FileText, color: "from-blue-600 to-blue-700", iconBg: "bg-blue-50 text-blue-600", section: "العمليات" },
    { id: "stock", label: "أرصدة الأصناف", desc: "عرض الكميات المتاحة والمحجوزة", icon: Box, color: "from-emerald-500 to-emerald-600", iconBg: "bg-emerald-50 text-emerald-600", section: "العمليات" },
    { id: "transactions", label: "الحركات المخزنية", desc: "استلام/صرف/افتتاحي/مرتجع", icon: ArrowRightLeft, color: "from-purple-500 to-purple-600", iconBg: "bg-purple-50 text-purple-600", section: "العمليات" },
    { id: "transfers", label: "التحويل بين المخازن", desc: "تحويل الأصناف بين المخازن", icon: Truck, color: "from-cyan-500 to-cyan-600", iconBg: "bg-cyan-50 text-cyan-600", section: "العمليات" },
    { id: "planning", label: "تخطيط وإعادة الطلب (ROP)", desc: "مخزون الأمان ونقاط إعادة الشراء", icon: TrendingUp, color: "from-violet-600 to-violet-700", iconBg: "bg-violet-50 text-violet-600", section: "العمليات" },
    { id: "putaway_rules", label: "قواعد التخزين التلقائي", desc: "تحديد أولوية وسعة تخزين كل صنف بكل مخزن (Putaway)", icon: Map, color: "from-lime-600 to-lime-700", iconBg: "bg-lime-50 text-lime-700", section: "العمليات" },
    { id: "count", label: "الجرد", desc: "جرد فعلي ومقارنة بالدفتري", icon: Calculator, color: "from-amber-500 to-amber-600", iconBg: "bg-amber-50 text-amber-600", section: "العمليات" },
    { id: "adjustments", label: "التسويات", desc: "تسوية الأرصدة والكميات", icon: Edit2, color: "from-indigo-500 to-indigo-600", iconBg: "bg-indigo-50 text-indigo-600", section: "العمليات" },
    { id: "damaged", label: "الهالك والتالف", desc: "تسجيل الأصناف التالفة", icon: AlertTriangle, color: "from-red-500 to-red-600", iconBg: "bg-red-50 text-red-600", section: "العمليات" },
    { id: "reserved", label: "المخزون المحجوز", desc: "الكميات المحجوزة للطلبات", icon: Lock, color: "from-yellow-500 to-yellow-600", iconBg: "bg-yellow-50 text-yellow-600", section: "العمليات" },
    { id: "batches", label: "التشغيلات والصلاحية", desc: "تتبع تواريخ انتهاء الصلاحية", icon: Tag, color: "from-fuchsia-500 to-fuchsia-600", iconBg: "bg-fuchsia-50 text-fuchsia-600", section: "العمليات" },

    // ─── القسم الثالث: التقارير ───
    { id: "ai_advisor", label: "المستشار الذكي (AI Advisor)", desc: "توقعات النفاد والركود والتوصيات", icon: Sparkles, color: "from-purple-600 to-indigo-600", iconBg: "bg-purple-50 text-purple-600", section: "التقارير والتحليلات" },
    { id: "audit_trail", label: "سجل التدقيق الشامل", desc: "تتبع العمليات والمستخدمين غير القابل للتعديل", icon: History, color: "from-slate-700 to-slate-800", iconBg: "bg-slate-100 text-slate-700", section: "التقارير والتحليلات" },
    { id: "movements", label: "سجل الحركات", desc: "audit log لكل العمليات", icon: History, color: "from-slate-500 to-slate-600", iconBg: "bg-slate-100 text-slate-600", section: "التقارير والتحليلات" },
    { id: "turnover", label: "دوران المخزون", desc: "معدل الدوران وأيام التزويد", icon: Gauge, color: "from-cyan-600 to-cyan-700", iconBg: "bg-cyan-50 text-cyan-700", section: "التقارير والتحليلات" },
    { id: "slow_moving", label: "الأصناف الراكدة", desc: "الأصناف بدون حركة صرف", icon: Timer, color: "from-rose-500 to-rose-600", iconBg: "bg-rose-50 text-rose-600", section: "التقارير والتحليلات" },
    { id: "reports", label: "كل التقارير", desc: "ABC، التقييم، الهالك، الموردين", icon: FileText, color: "from-teal-500 to-teal-600", iconBg: "bg-teal-50 text-teal-600", section: "التقارير والتحليلات" },

    // ─── القسم الرابع: الإعدادات ───
    { id: "settings", label: "الإعدادات", desc: "إعدادات المخازن والأنواع والصلاحيات", icon: Settings, color: "from-slate-600 to-slate-700", iconBg: "bg-slate-100 text-slate-700", section: "الإعدادات" },
  ];

  // For backward compatibility (referenced elsewhere as features[])
  const features = dashboardCards.map(c => ({ id: c.id, label: c.label, icon: c.icon, color: c.iconBg.split(" ")[1] }));

  // Pagination helper
  const paginate = (data: any[]) => {
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const start = (currentPage - 1) * pageSize;
    return { data: data.slice(start, start + pageSize), totalPages, total: data.length };
  };

  // Pagination controls helper
  const renderPaginationControls = (total: number, totalPages: number) => (
    <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="font-bold">عرض</span>
        <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-bold text-xs">
          {total > 0 ? (currentPage - 1) * pageSize + 1 : 0}
        </span>
        <span>إلى</span>
        <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-bold text-xs">
          {Math.min(currentPage * pageSize, total)}
        </span>
        <span>من</span>
        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-all"><ChevronsRight className="w-4 h-4" /></button>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
        {(() => {
          const pages: number[] = [];
          let s = Math.max(1, currentPage - 2), e = Math.min(totalPages, currentPage + 2);
          if (currentPage <= 3) e = Math.min(totalPages, 5);
          if (currentPage >= totalPages - 2) s = Math.max(1, totalPages - 4);
          for (let i = s; i <= e; i++) pages.push(i);
          return pages.map(p => (
            <button key={p} onClick={() => setCurrentPage(p)}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${p === currentPage ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30" : "border border-slate-200 hover:bg-slate-100 text-slate-600"}`}>{p}</button>
          ));
        })()}
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-all"><ChevronsLeft className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-500 font-bold">صفحة {currentPage} من {totalPages}</div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <span className="text-xs text-slate-500 font-bold">صف</span>
          <select value={pageSize ?? ""} onChange={e => setPageSize(parseInt(e.target.value))}
            className="bg-transparent focus:outline-none text-sm font-bold text-slate-700 cursor-pointer">
            {PAGE_SIZE_OPTIONS.map((o: any) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  // Filter bar helper function (renders InventoryFilterBar directly so component type stays constant)
  const renderFilterBar = (props?: {
    showWarehouseFilter?: boolean;
    showStatusFilter?: boolean;
    showTypeFilter?: boolean;
    showDateFilter?: boolean;
  }) => (
    <InventoryFilterBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedWarehouse={selectedWarehouse}
      setSelectedWarehouse={setSelectedWarehouse}
      warehouses={warehouses}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      dateFrom={dateFrom}
      setDateFrom={setDateFrom}
      dateTo={dateTo}
      setDateTo={setDateTo}
      fetchData={fetchData}
      loading={loading}
      {...props}
    />
  );

  // ===== DASHBOARD =====
  const renderDashboard = () => {
    if (!dashboard) return <EmptyState icon={BarChart3} title="تحميل..." subtitle="جاري تحميل البيانات" />;
    const d = dashboard;
    const kpiCards = [
      { label: "إجمالي المخازن", value: d.totalWarehouses, icon: WarehouseIcon, color: "orange", trend: "+1" },
      { label: "إجمالي الأصناف", value: d.totalIngredients, icon: Package, color: "blue", trend: "+5" },
      { label: "أرصدة نشطة", value: d.totalItems, icon: Box, color: "emerald", trend: "+12" },
      { label: "قيمة المخزون", value: fmtMoney(d.stockValue), icon: DollarSign, color: "amber", trend: "+8%" },
      { label: "أصناف منخفضة", value: d.lowStockCount, icon: AlertTriangle, color: "red", trend: "-2" },
      { label: "حركات اليوم", value: d.todayMovements, icon: Activity, color: "purple", trend: "" },
      { label: "تحويلات معلقة", value: d.pendingTransfers, icon: Truck, color: "cyan", trend: "" },
      { label: "حركات معلقة", value: d.pendingTx, icon: Clock, color: "slate", trend: "" },
    ];
    const colorMap: any = {
      orange: "bg-orange-50 text-orange-600", blue: "bg-blue-50 text-blue-600",
      emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600",
      red: "bg-red-50 text-red-600", purple: "bg-purple-50 text-purple-600",
      cyan: "bg-cyan-50 text-cyan-600", slate: "bg-slate-100 text-slate-600",
    };

    return (
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[k.color]}`}>
                  <k.icon className="w-5 h-5" />
                </div>
                {k.trend && <span className={`text-xs font-bold ${k.trend.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>{k.trend}</span>}
              </div>
              <p className="text-xs text-slate-500 font-bold mb-1">{k.label}</p>
              <p className="text-xl font-black text-slate-800">{k.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Movements Trend - 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Activity className="w-5 h-5 text-orange-600" /> حركة آخر 7 أيام</h3>
              <button onClick={() => exportToExcel(d.trend.map((t: any) => ({ التاريخ: formatInventoryDate(t.transaction_date || t.date, false), الحركات: t.movements, المعاملات: t.transactions })), "movements-trend")}
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" /> Excel</button>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={(v) => v.substring(5)} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ direction: "rtl", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="movements" stroke="#ea580c" strokeWidth={2} name="الحركات" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="transactions" stroke="#0ea5e9" strokeWidth={2} name="المعاملات" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stock by Warehouse - Pie */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Building2 className="w-5 h-5 text-orange-600" /> توزيع القيمة بالمخازن</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={d.byWarehouse} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={(e: any) => `${e.name?.substring(0, 8) || ""}`}>
                  {d.byWarehouse.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: "rtl", borderRadius: "12px", fontSize: "12px" }} formatter={(v: any) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top items + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top items by value */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> أعلى 5 أصناف بالقيمة</h3>
              <button onClick={() => exportToExcel(d.topItems.map((t: any) => ({ الصنف: t.name, الكود: t.code, الكمية: t.qty, القيمة: t.value })), "top-items")}
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" /> Excel</button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} width={80} />
                <Tooltip contentStyle={{ direction: "rtl", borderRadius: "12px", fontSize: "12px" }} formatter={(v: any) => fmtMoney(v)} />
                <Bar dataKey="value" name="القيمة" radius={[0, 8, 8, 0]}>
                  {d.topItems.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Low stock alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5 text-red-600" /> تنبيهات المخزون المنخفض</h3>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {inventoryItems.filter(i => i.min_stock && Number(i.min_stock) > 0 && Number(i.quantity) <= Number(i.min_stock)).slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-red-50/50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.ingredient_name}</p>
                      <p className="text-[10px] text-slate-500">{item.warehouse_name}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-red-600">{item.quantity} / {item.min_stock}</p>
                    <p className="text-[10px] text-slate-400">{item.ingredient_unit}</p>
                  </div>
                </div>
              ))}
              {inventoryItems.filter(i => i.min_stock && Number(i.min_stock) > 0 && Number(i.quantity) <= Number(i.min_stock)).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">لا توجد تنبيهات حالياً</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-purple-600" /> آخر الحركات المخزنية</h3>
            <button onClick={() => { setActiveFeature("movements"); setActivePage("movements"); setActiveTab("features"); }} className="text-xs font-bold text-orange-600 hover:underline">عرض الكل</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["التاريخ", "الصنف", "المخزن", "النوع", "الكمية قبل", "التغير", "الكمية بعد", "المستخدم"].map(h => <th key={h} className="p-3 font-bold text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.slice(0, 8).map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{formatInventoryDate(m.created_at, true)}</td>
                    <td className="p-3 font-bold text-slate-800">{m.ingredient_name}</td>
                    <td className="p-3 text-slate-600">{m.warehouse_name}</td>
                    <td className="p-3">
                      {m.ref_type === "production_consumption" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">صرف إنتاج</span>
                      ) : m.ref_type === "production_receipt" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">استلام إنتاج</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{m.ref_type}</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-slate-500">{fmt(m.before_qty, 0)}</td>
                    <td className={`p-3 text-center font-bold ${Number(m.delta) > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(m.delta) > 0 ? "+" : ""}{fmt(m.delta, 0)}</td>
                    <td className="p-3 text-center font-bold text-slate-800">{fmt(m.after_qty, 0)}</td>
                    <td className="p-3 text-xs text-slate-500">{m.user}</td>
                  </tr>
                ))}
                {movements.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا توجد حركات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ===== WAREHOUSES MANAGEMENT =====
  const renderWarehouses = () => {
    const filtered = warehouses.filter(w => {
      const matchesSearch = !searchQuery || (w.name || "").includes(searchQuery) || (w.code || "").includes(searchQuery);
      const mod = w.linked_module || "general";
      const matchesModule = warehouseModuleFilter === "all" ||
        mod === warehouseModuleFilter ||
        (w.linked_modules && String(w.linked_modules).includes(warehouseModuleFilter));
      return matchesSearch && matchesModule;
    });
    const { data, totalPages, total } = paginate(filtered);
    const activeCount = warehouses.filter(w => !w.status || w.status === "active").length;
    const defaultCount = warehouses.filter(w => w.is_default).length;
    const totalValue = warehouses.reduce((s, w) => s + (Number(w.stock_value) || 0), 0);

    const handleSaveWarehouse = async () => {
      if (!editingWarehouse?.name || !editingWarehouse?.code) { showToast("اسم المخزن والكود مطلوبان", "error"); return; }
      try {
        const method = editingWarehouse.id ? "PUT" : "POST";
        const url = editingWarehouse.id ? `/api/warehouses/${editingWarehouse.id}` : "/api/warehouses";
        const res = await (method === "PUT" ? api.put(url, editingWarehouse) : api.post(url, editingWarehouse));
        const result = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(editingWarehouse.id ? "تم تحديث المخزن" : "تم إضافة المخزن");
          setShowWarehouseModal(false);
          setEditingWarehouse(null);
          // Immediately reflect the saved warehouse in the current view,
          // then refresh the complete list from the server. This prevents a
          // successful POST from leaving an apparently empty table.
          if (result?.id) {
            setWarehouses(prev => {
              const saved = { ...editingWarehouse, ...result };
              const exists = prev.some(w => Number(w.id) === Number(saved.id));
              return exists
                ? prev.map(w => Number(w.id) === Number(saved.id) ? { ...w, ...saved } as WarehouseItem : w)
                : [...prev, saved as WarehouseItem];
            });
          }
          await fetchData();
        } else {
          showToast(result?.error || "خطأ في حفظ المخزن", "error"); }
      } catch (e) { showToast("خطأ في الاتصال", "error"); }
    };

    const handleDeleteWarehouse = async (id: number) => {
      if (!confirm("هل أنت متأكد من حذف هذا المخزن؟")) return;
      const res = await api.delete(`/api/warehouses/${id}`);
      if (res.ok) { showToast("تم حذف المخزن"); fetchData(); }
      else { const e = await res.json().catch(() => ({})); showToast(e.error || "فشل الحذف", "error"); }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <WarehouseIcon className="w-6 h-6 text-orange-600" /> إدارة المخازن وربط موديولات النظام
            </h2>
            <p className="text-xs text-slate-500 mt-1">تخصيص المخازن وربطها آلياً بموديولات الفنادق، المطاعم، نقاط البيع، الصيانة والإنتاج</p>
          </div>
          <button onClick={() => { setEditingWarehouse({ status: "active", type: "main", linked_module: warehouseModuleFilter !== "all" ? warehouseModuleFilter : "general", allow_negative: false, is_default: false, auto_sync: true, is_module_default: false }); setShowWarehouseModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all">
            <Plus className="w-4 h-4" /> إضافة مخزن جديد
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center"><WarehouseIcon className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي المخازن</p><p className="text-2xl font-black text-orange-600">{warehouses.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">مخازن نشطة</p><p className="text-2xl font-black text-emerald-600">{activeCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><LinkIcon className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-slate-500 font-bold">مخازن موديولات مربوطة</p><p className="text-2xl font-black text-blue-600">{warehouses.filter(w => w.linked_module && w.linked_module !== 'general').length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-slate-500 font-bold">مخزن افتراضي عام</p><p className="text-2xl font-black text-purple-600">{defaultCount}</p></div></div></div>
        </div>

        {/* Module Filter Chips */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-orange-600" /> تصفية حسب موديول النظام المرتبط:
            </span>
            <span className="text-[11px] text-slate-400 font-bold">
              المعروض: {filtered.length} من {warehouses.length} مخزن
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {SYSTEM_MODULES.map(mod => {
              const ModIcon = mod.icon;
              const isSelected = warehouseModuleFilter === mod.id;
              const count = mod.id === "all"
                ? warehouses.length
                : warehouses.filter(w => (w.linked_module || "general") === mod.id || (w.linked_modules && String(w.linked_modules).includes(mod.id))).length;
              return (
                <button
                  key={mod.id}
                  onClick={() => setWarehouseModuleFilter(mod.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                    isSelected
                      ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <ModIcon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-500"}`} />
                  <span>{mod.shortName}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSelected ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {renderFilterBar({ showStatusFilter: false })}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["الكود", "اسم المخزن", "المديول المرتبط", "النوع", "الفرع", "المسؤول", "الأصناف", "القيمة", "الحالة", "الافتراضي", "إجراءات"].map(h => (
                  <th key={h} className="p-4 font-bold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(w => {
                const st = STATUS_LABELS[w.status] || STATUS_LABELS.active;
                const branch = branches.find(b => b.id === w.branch_id);
                const modInfo = SYSTEM_MODULES.find(m => m.id === (w.linked_module || "general")) || SYSTEM_MODULES.find(m => m.id === "general")!;
                const ModIcon = modInfo.icon;
                return (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-orange-600">{w.code}</td>
                    <td className="p-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{w.name}</span>
                        {w.is_module_default && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title="المخزن الافتراضي للموديول">
                            افتراضي الموديول
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">{w.address || w.description || "—"}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${modInfo.badge}`}>
                          <ModIcon className="w-3.5 h-3.5" />
                          <span>{modInfo.shortName}</span>
                        </span>
                        {w.auto_sync !== false && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                            <Zap className="w-3 h-3 text-emerald-500" /> ربط تلقائي نشط
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">{TYPE_LABELS[w.type] || w.type}</span></td>
                    <td className="p-4 text-slate-600">{branch?.name || "—"}</td>
                    <td className="p-4 text-slate-600">{w.manager || "—"}</td>
                    <td className="p-4 text-center font-bold text-blue-600">{w.item_count || 0}</td>
                    <td className="p-4 font-bold text-amber-600">{fmtMoney(w.stock_value || 0)}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-lg text-xs font-bold border ${st.bg} ${st.color}`}>{st.label}</span></td>
                    <td className="p-4 text-center">{w.is_default ? <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> : <span className="text-slate-300">—</span>}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingWarehouse(w); setShowWarehouseModal(true); }} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteWarehouse(w.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPaginationControls(total, totalPages)}
      </div>
    );
  };

  // ===== INGREDIENTS MANAGEMENT =====
  const renderIngredients = () => {
    const filtered = ingredients.filter(ing =>
      !searchQuery || (ing.name || "").includes(searchQuery) || (ing.code || ing.item_code || "").includes(searchQuery) || (ing.barcode || "").includes(searchQuery)
    );
    const { data, totalPages, total } = paginate(filtered);
    const totalValue = ingredients.reduce((s, i) => s + (Number(i.total_stock || 0) * Number(i.avg_cost || 0)), 0);
    const lowStock = ingredients.filter(i => Number(i.min_stock) > 0 && Number(i.total_stock || 0) <= Number(i.min_stock)).length;

    const handleSaveIngredient = async () => {
      if (!editingIngredient?.name) { showToast("اسم الصنف مطلوب", "error"); return; }
      try {
        const code = editingIngredient.code || `ING-${String(ingredients.length + 1).padStart(3, "0")}`;
        const payload = { ...editingIngredient, code };
        const method = editingIngredient.id ? "PUT" : "POST";
        const url = editingIngredient.id ? `/api/ingredients/${editingIngredient.id}` : "/api/ingredients";
        const res = await (method === "PUT" ? api.put(url, payload) : api.post(url, payload));
        if (res.ok) {
          showToast(editingIngredient.id ? "تم تحديث الصنف بنجاح" : "تم إضافة الصنف بنجاح");
          setShowIngredientModal(false);
          setEditingIngredient(null);
          fetchData();
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData?.error || errData?.message || "خطأ في الحفظ", "error");
        }
      } catch (e) { showToast("خطأ في الاتصال", "error"); }
    };

    const handleDeleteIngredient = async (id: number) => {
      if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
      const res = await api.delete(`/api/ingredients/${id}`);
      if (res.ok) { showToast("تم حذف الصنف"); fetchData(); }
      else { const e = await res.json().catch(() => ({})); showToast(e.error || "فشل الحذف", "error"); }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-6 h-6 text-blue-600" /> إدارة الأصناف</h2>
          <div className="flex gap-2">
            <button onClick={() => exportToExcel(filtered.map((i: any) => ({ الكود: i.code || i.item_code, الاسم: i.name, الوحدة: i.unit, الباركود: i.barcode, الفئة: i.category, "حد الطلب": i.min_stock, "آخر سعر": i.last_purchase_price, "متوسط التكلفة": i.avg_cost, "إجمالي المخزون": i.total_stock })), "ingredients")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 transition-all">
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
            <button onClick={() => { setImportIngredientNames([]); setImportFileName(""); setShowImportIngredientsModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold border border-blue-200 transition-all">
              <Download className="w-4 h-4" /> استيراد Excel
            </button>
            <button onClick={() => { setEditingIngredient({ unit: "قطعة", min_stock: 0, max_stock: 0, reorder_point: 0, last_purchase_price: 0, avg_cost: 0 }); setShowIngredientModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all">
              <Plus className="w-4 h-4" /> إضافة صنف
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي الأصناف</p><p className="text-2xl font-black text-blue-600">{ingredients.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي القيمة</p><p className="text-lg font-black text-amber-600">{fmtMoney(totalValue)}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-slate-500 font-bold">أصناف منخفضة</p><p className="text-2xl font-black text-red-600">{lowStock}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><Layers className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">الفئات</p><p className="text-2xl font-black text-emerald-600">{new Set(ingredients.map(i => i.category).filter(Boolean)).size}</p></div></div></div>
        </div>
        {renderFilterBar({ showWarehouseFilter: false })}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["الكود", "الاسم", "الباركود", "الفئة", "الوحدة", "إجمالي المخزون", "حد الطلب", "متوسط التكلفة", "القيمة", "إجراءات"].map(h => <th key={h} className="p-4 font-bold text-slate-500 text-center">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(ing => {
                const isLow = Number(ing.min_stock) > 0 && Number(ing.total_stock || 0) <= Number(ing.min_stock);
                const value = Number(ing.total_stock || 0) * Number(ing.avg_cost || 0);
                return (
                  <tr key={ing.id} className={`hover:bg-slate-50 ${isLow ? "bg-red-50/30" : ""}`}>
                    <td className="p-4 font-mono font-bold text-orange-600 text-center">{ing.code || ing.item_code || "—"}</td>
                    <td className="p-4 font-bold text-slate-900">{ing.name}</td>
                    <td className="p-4 text-center font-mono text-xs text-slate-500">{ing.barcode || "—"}</td>
                    <td className="p-4 text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">{ing.category || "عام"}</span></td>
                    <td className="p-4 text-center text-slate-600">{ing.unit}</td>
                    <td className="p-4 text-center font-bold text-slate-900">{fmt(ing.total_stock || 0, 0)}</td>
                    <td className="p-4 text-center"><span className={`font-bold ${isLow ? "text-red-600" : "text-slate-500"}`}>{ing.min_stock || "—"}</span></td>
                    <td className="p-4 text-center text-slate-600">{fmtMoney(ing.avg_cost)}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">{fmtMoney(value)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => { setHistoryItem(ing); setShowMovementHistoryModal(true); }} className="p-2 hover:bg-purple-50 rounded-lg text-purple-500 transition-colors" title="سجل الحركات"><History className="w-4 h-4" /></button>
                        <button onClick={() => { setSelectedBarcode(ing); setShowBarcodeModal(true); }} className="p-2 hover:bg-violet-50 rounded-lg text-violet-500 transition-colors" title="باركود"><Package className="w-4 h-4" /></button>
                        <button onClick={() => { setEditingIngredient(ing); setShowIngredientModal(true); }} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteIngredient(ing.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPaginationControls(total, totalPages)}
      </div>
    );
  };

  // ===== STOCK BALANCES =====
  const renderStock = () => {
    return (
      <EnterpriseStockBalanceView
        warehouses={warehouses}
        ingredients={ingredients}
        onNotify={(msg, type) => showToast(msg, type === "error" ? "error" : "success")}
        onNavigateToFeature={(featureId) => {
          setActiveFeature(featureId);
          setActivePage(featureId);
          setActiveTab("features");
        }}
      />
    );
  };

  // ===== TRANSACTIONS =====
  const renderTransactions = () => {
    const filtered = transactions.filter(tx => {
      if (selectedWarehouse !== "all" && tx.warehouse_id !== Number(selectedWarehouse)) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      const txDateKey = inventoryDateKey(tx.transaction_date || tx.date);
      if (dateFrom && txDateKey < dateFrom) return false;
      if (dateTo && txDateKey > dateTo) return false;
      return !searchQuery || (tx.transaction_number || "").includes(searchQuery) || tx.reference?.includes(searchQuery) || tx.notes?.includes(searchQuery);
    });
    const { data, totalPages, total } = paginate(filtered);
    const inCount = filtered.filter(t => TX_EFFECT[t.type] === "in").length;
    const outCount = filtered.filter(t => TX_EFFECT[t.type] === "out").length;
    const pendingCount = filtered.filter(t => t.status === "pending").length;
    const totalValue = filtered.reduce((s, t) => s + Number(t.total_value || 0), 0);

    const handleApprove = async (id: number) => {
      if (!confirm("اعتماد هذه الحركة؟ سيتم تحديث الأرصدة.")) return;
      const res = await api.put(`/api/inventory-transactions/${id}/approve`, { user: "admin" });
      if (res.ok) { showToast("تم اعتماد الحركة وتحديث الأرصدة"); fetchData(); }
      else { const e = await res.json().catch(() => ({})); showToast(e.error || "فشل الاعتماد", "error"); }
    };

    const handleDelete = async (id: number) => {
      if (!confirm("حذف هذه الحركة؟ سيتم عكس تأثيرها على الأرصدة.")) return;
      const res = await api.delete(`/api/inventory-transactions/${id}`);
      if (res.ok) { showToast("تم حذف الحركة وعكس الأرصدة"); fetchData(); }
      else { const e = await res.json().catch(() => ({})); showToast(e.error || "فشل الحذف", "error"); }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft className="w-6 h-6 text-purple-600" /> الحركات المخزنية</h2>
          <div className="flex gap-2">
            <button onClick={() => exportToExcel(filtered.map((t: any) => ({ "رقم الحركة": t.transaction_number, التاريخ: formatInventoryDate(t.transaction_date || t.date, false), المخزن: t.warehouse_name, النوع: TX_TYPE_LABELS[t.type] || t.type, السبب: t.reason, المرجع: t.reference, المستخدم: t.user, الحالة: t.status, "عدد الأصناف": Number(t.items_count ?? (Array.isArray(t.items) ? t.items.length : 1)), القيمة: t.total_value })), "transactions")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 transition-all">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => { setTxForm({ type: "receive", warehouse_id: "", reason: "", reference: "", notes: "", date: new Date().toISOString().split("T")[0], items: [], supplier_id: "", status: "approved" }); setTxItemSearch(""); setShowTransactionModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all">
              <Plus className="w-4 h-4" /> حركة جديدة
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي الحركات</p><p className="text-2xl font-black text-orange-600">{filtered.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">وارد</p><p className="text-2xl font-black text-emerald-600">{inCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-slate-500 font-bold">صادر</p><p className="text-2xl font-black text-red-600">{outCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-slate-500 font-bold">قيد الانتظار</p><p className="text-2xl font-black text-amber-600">{pendingCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي القيمة</p><p className="text-lg font-black text-purple-600">{fmtMoney(totalValue)}</p></div></div></div>
        </div>
        {renderFilterBar({ showStatusFilter: true, showTypeFilter: true, showDateFilter: true })}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["رقم الحركة", "التاريخ", "المخزن", "النوع", "السبب", "المرجع", "عدد الأصناف", "القيمة", "المستخدم", "الحالة", "إجراءات"].map(h => <th key={h} className="p-4 font-bold text-slate-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(tx => {
                const st = STATUS_LABELS[tx.status] || STATUS_LABELS.approved;
                const effect = TX_EFFECT[tx.type];
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-orange-600">{tx.transaction_number}</td>
                    <td className="p-4 text-slate-600 text-xs whitespace-nowrap">{formatInventoryDate(tx.transaction_date || tx.date, false)}</td>
                    <td className="p-4 text-slate-600">{tx.warehouse_name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${effect === "in" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : effect === "out" ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                        {TX_TYPE_LABELS[tx.type] || tx.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{tx.reason || "—"}</td>
                    <td className="p-4 font-mono text-slate-500 text-xs">{tx.reference || "—"}</td>
                    <td className="p-4 text-center font-bold text-slate-700">{Number(tx.items_count ?? (Array.isArray(tx.items) ? tx.items.length : 1))}</td>
                    <td className="p-4 font-bold text-purple-600">{fmtMoney(tx.total_value || 0)}</td>
                    <td className="p-4 text-xs text-slate-500">{tx.user}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-lg text-xs font-bold border ${st.bg} ${st.color}`}>{st.label}</span></td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedTx(tx); setShowTxDetailsModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400" title="عرض"><Eye className="w-3.5 h-3.5" /></button>
                        {tx.status === "pending" && <button onClick={() => handleApprove(tx.id)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-400" title="اعتماد"><CheckCircle className="w-3.5 h-3.5" /></button>}
                        <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderPaginationControls(total, totalPages)}
      </div>
    );
  };

  // ===== TRANSFERS =====
  const renderTransfers = () => {
    const { data, totalPages, total } = paginate(transfers);
    const pendingCount = transfers.filter(t => t.status === "pending").length;
    const inTransitCount = transfers.filter(t => t.status === "in_transit").length;
    const receivedCount = transfers.filter(t => t.status === "received").length;

    const handleStatusChange = async (id: number, status: string) => {
      const actionLabel = status === "in_transit" ? "تحويل إلى قيد النقل" : status === "received" ? "استلام التحويل" : "إلغاء التحويل";
      if (!confirm(`${actionLabel}؟`)) return;
      const res = await api.put(`/api/warehouse-transfers/${id}/status`, { status, user: "admin" });
      if (res.ok) { showToast("تم تحديث حالة التحويل"); fetchData(); }
      else { const e = await res.json().catch(() => ({})); showToast(e.error || "فشل التحديث", "error"); }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-6 h-6 text-cyan-600" /> التحويل بين المخازن</h2>
          <button onClick={() => { setTransferForm({ from_warehouse_id: "", to_warehouse_id: "", notes: "", date: new Date().toISOString().split("T")[0], items: [], status: "pending" }); setTransferItemSearch(""); setShowTransferModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all">
            <Plus className="w-4 h-4" /> تحويل جديد
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center"><Truck className="w-5 h-5 text-cyan-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي التحويلات</p><p className="text-2xl font-black text-cyan-600">{transfers.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-slate-500 font-bold">قيد الانتظار</p><p className="text-2xl font-black text-amber-600">{pendingCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-slate-500 font-bold">قيد النقل</p><p className="text-2xl font-black text-blue-600">{inTransitCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">تم الاستلام</p><p className="text-2xl font-black text-emerald-600">{receivedCount}</p></div></div></div>
        </div>
        {renderFilterBar({ showWarehouseFilter: false, showStatusFilter: true })}
        {data.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["رقم التحويل", "التاريخ", "من مخزن", "إلى مخزن", "عدد الأصناف", "إجمالي الكمية", "المستخدم", "الحالة", "ملاحظات", "إجراءات"].map(h => <th key={h} className="p-4 font-bold text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(trf => {
                  const st = STATUS_LABELS[trf.status] || STATUS_LABELS.pending;
                  return (
                    <tr key={trf.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-orange-600">{trf.transfer_number}</td>
                      <td className="p-4 text-slate-600 text-xs">{trf.date}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-100">{trf.from_warehouse_name || "—"}</span></td>
                      <td className="p-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">{trf.to_warehouse_name || "—"}</span></td>
                      <td className="p-4 text-center font-bold">{trf.items_count || 0}</td>
                      <td className="p-4 text-center font-bold text-slate-700">{fmt(trf.total_qty || 0, 0)}</td>
                      <td className="p-4 text-xs text-slate-500">{trf.user}</td>
                      <td className="p-4"><span className={`px-2 py-1 rounded-lg text-xs font-bold border ${st.bg} ${st.color}`}>{st.label}</span></td>
                      <td className="p-4 text-xs text-slate-500 max-w-[150px] truncate">{trf.notes || "—"}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelectedTransfer(trf); setShowTransferDetailsModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400" title="عرض"><Eye className="w-3.5 h-3.5" /></button>
                          {trf.status === "pending" && (
                            <>
                              <button onClick={() => handleStatusChange(trf.id, "in_transit")} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400" title="تحويل لقيد النقل"><Truck className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleStatusChange(trf.id, "received")} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-400" title="استلام"><CheckCircle className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleStatusChange(trf.id, "cancelled")} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="إلغاء"><XCircle className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          {trf.status === "in_transit" && (
                            <>
                              <button onClick={() => handleStatusChange(trf.id, "received")} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-400" title="استلام"><CheckCircle className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleStatusChange(trf.id, "cancelled")} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="إلغاء"><XCircle className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Truck} title="لا توجد تحويلات" subtitle="اضغط 'تحويل جديد' لإنشاء تحويل بين المخازن" />}
        {total > 0 && renderPaginationControls(total, totalPages)}
      </div>
    );
  };

  // ===== COUNT (إدارة وجرد المخازن والتسويات المحاسبية المتطورة) =====
  const renderCount = () => {
    // Filter items
    const filteredCountItems = countItemsList.filter((item) => {
      if (countFilterWarehouse !== "all" && item.warehouse_id !== Number(countFilterWarehouse)) {
        return false;
      }
      if (countFilterStatus === "matched" && item.status !== "matched") return false;
      if (countFilterStatus === "unmatched" && item.status === "matched") return false;
      if (countFilterStatus === "shortage" && item.status !== "shortage") return false;
      if (countFilterStatus === "surplus" && item.status !== "surplus") return false;
      if (countSearchQuery.trim()) {
        const q = countSearchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });

    // 4 KPI Statistics
    const countStats = {
      totalItems: countItemsList.length,
      matchedCount: countItemsList.filter(i => i.status === "matched").length,
      surplusCount: countItemsList.filter(i => i.status === "surplus").length,
      shortageCount: countItemsList.filter(i => i.status === "shortage").length,
      totalSurplusQty: countItemsList.filter(i => i.status === "surplus").reduce((acc, i) => acc + i.difference_quantity, 0),
      totalShortageQty: countItemsList.filter(i => i.status === "shortage").reduce((acc, i) => acc + Math.abs(i.difference_quantity), 0),
      netDifferenceCost: countItemsList.reduce((acc, i) => acc + i.difference_cost, 0),
    };

    // Pagination
    const countTotalPages = Math.ceil(filteredCountItems.length / countItemsPerPage) || 1;
    const countStartIndex = (countCurrentPage - 1) * countItemsPerPage;
    const countPaginatedItems = filteredCountItems.slice(countStartIndex, countStartIndex + countItemsPerPage);

    const getStatusBadge = (st: string) => {
      if (st === "approved") {
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black rounded-lg flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> معتمد ومسوى</span>;
      }
      if (st === "in_progress") {
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-xs font-black rounded-lg flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> جاري الحصر والتعديل</span>;
      }
      return <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-black rounded-lg flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> مسودة جرد جديدة</span>;
    };

    return (
      <div className="space-y-5 print:p-0 print:space-y-3">
        {/* 1. Header with Metadata, Auto-number & Action Buttons */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm print:border-none print:shadow-none print:p-0">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Calculator className="w-7 h-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">إدارة وجرد المخازن والتسوية</h2>
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 font-mono font-black text-sm rounded-xl border border-orange-200 shadow-xs">
                    {activeCount.inventory_no}
                  </span>
                  {getStatusBadge(activeCount.status)}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5 font-semibold">
                  <span className="flex items-center gap-1">📅 التاريخ: <strong className="text-slate-700 font-bold">{activeCount.inventory_date}</strong></span>
                  <span className="flex items-center gap-1">👤 المستخدم: <strong className="text-slate-700 font-bold">{activeCount.user_name}</strong></span>
                  <span className="flex items-center gap-1">🏢 المستودع المستهدف: <strong className="text-slate-700 font-bold">{activeCount.warehouse_id === "all" ? "جميع المخازن" : (warehouses.find(w => w.id === Number(activeCount.warehouse_id))?.name || "المخزن المحدد")}</strong></span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <button 
                id="btn-new-count"
                onClick={() => {
                  initCountSession(countFilterWarehouse);
                  showToast("تم فتح نموذج جرد جديد");
                }} 
                className="flex items-center gap-2 px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-600/20 transition-all active:scale-95 cursor-pointer"
                title="بدء عملية جرد جديدة"
              >
                <Plus className="w-4 h-4" /> جرد جديد
              </button>

              <button 
                onClick={() => { fetchCountHistory(); setShowCountHistoryModal(true); }}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-200 transition-all active:scale-95"
                title="استعراض العمليات السابقة"
              >
                <History className="w-4 h-4 text-slate-600" /> سجل الجرود
              </button>

              <button 
                onClick={handleExportCountExcel} 
                className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                title="تصدير جدول الجرد إلى إكسيل"
              >
                <Download className="w-4 h-4" /> تصدير إكسيل
              </button>

              <button 
                onClick={handlePrintCountSheet} 
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-md shadow-slate-800/20 transition-all active:scale-95"
                title="طباعة محضر الجرد"
              >
                <Printer className="w-4 h-4" /> طباعة
              </button>

              {activeCount.status !== "approved" && (
                <button 
                  onClick={handleApproveAndSettleCount}
                  disabled={isApprovingCount || countItemsList.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50"
                  title="اعتماد وترحيل فروقات الجرد والتسوية"
                >
                  <CheckCircle className="w-4 h-4" /> {isApprovingCount ? "جاري الترحيل..." : "اعتماد الجرد والتسوية"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Four KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
          {/* Card 1: Total Items */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي الأصناف المجرودة</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{countStats.totalItems}</p>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                <Check className="w-3.5 h-3.5" /> مطابق: {countStats.matchedCount} صنف
              </span>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">
              <Package className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Shortage Quantity */}
          <div className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-red-500 uppercase tracking-wider">إجمالي كميات العجز</p>
              <p className="text-2xl font-black text-red-600 mt-1">
                {countStats.totalShortageQty > 0 ? `-${Number(countStats.totalShortageQty || 0).toLocaleString()}` : "0"}
              </p>
              <span className="text-xs text-red-500 font-bold flex items-center gap-1 mt-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {countStats.shortageCount} صنف به عجز
              </span>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center font-black">
              <ArrowDown className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Surplus Quantity */}
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">إجمالي كميات الزيادة</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {countStats.totalSurplusQty > 0 ? `+${Number(countStats.totalSurplusQty || 0).toLocaleString()}` : "0"}
              </p>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> {countStats.surplusCount} صنف به زيادة
              </span>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
              <ArrowUp className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Net Difference Cost */}
          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">صافي تكلفة الفروقات</p>
              <p className={`text-2xl font-black mt-1 ${countStats.netDifferenceCost < 0 ? "text-red-600" : countStats.netDifferenceCost > 0 ? "text-emerald-600" : "text-slate-800"}`}>
                {countStats.netDifferenceCost > 0 ? "+" : ""}{Number(countStats.netDifferenceCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
              </p>
              <span className={`text-[11px] font-black ${countStats.netDifferenceCost < 0 ? "text-red-600" : countStats.netDifferenceCost > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                {countStats.netDifferenceCost < 0 ? "عجز مالي يستوجب التسوية" : countStats.netDifferenceCost > 0 ? "فائض مالي بالمخزون" : "مطابق تماماً"}
              </span>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-black">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 3. Filters & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">المخزن:</label>
              <select 
                value={countFilterWarehouse ?? ""}
                onChange={(e) => {
                  setCountFilterWarehouse(e.target.value);
                  initCountSession(e.target.value);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500"
              >
                <option value="all">جميع المخازن</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">حالة المطابقة:</label>
              <select 
                value={countFilterStatus ?? ""}
                onChange={(e) => { setCountFilterStatus(e.target.value); setCountCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500"
              >
                <option value="all">كل الحالات ({countItemsList.length})</option>
                <option value="matched">مطابق فقط ({countStats.matchedCount})</option>
                <option value="unmatched">غير مطابق / فروقات ({countStats.surplusCount + countStats.shortageCount})</option>
                <option value="shortage">عجز فقط ({countStats.shortageCount})</option>
                <option value="surplus">زيادة فقط ({countStats.surplusCount})</option>
              </select>
            </div>

            {/* Per Page */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">عرض:</label>
              <select 
                value={countItemsPerPage ?? ""}
                onChange={(e) => { setCountItemsPerPage(Number(e.target.value)); setCountCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500"
              >
                <option value="10">10 صنف</option>
                <option value="20">20 صنف</option>
                <option value="50">50 صنف</option>
                <option value="100">100 صنف</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              value={countSearchQuery ?? ""}
              onChange={(e) => { setCountSearchQuery(e.target.value); setCountCurrentPage(1); }}
              placeholder="بحث بالكود أو اسم الصنف..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* 4. The Main Stocktaking Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none">
          {loadingCountSession ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500 mb-2" />
              <p className="font-bold text-sm">جاري تحميل أصناف وأرصدة المخزون للجرد...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 text-center w-24">الكود</th>
                    <th className="p-3.5">الصنف</th>
                    <th className="p-3.5">المخزن</th>
                    <th className="p-3.5 text-center">الوحدة</th>
                    <th className="p-3.5 text-center bg-slate-50/70">الدفترية</th>
                    <th className="p-3.5 text-center w-28">الفعلية</th>
                    <th className="p-3.5 text-center">الفرق</th>
                    <th className="p-3.5 text-center">نسبة الفرق %</th>
                    <th className="p-3.5 text-center">تكلفة الفرق</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 w-44">ملاحظات</th>
                    <th className="p-3.5 text-center print:hidden">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {countPaginatedItems.map((item, pIdx) => {
                    const globalIdx = countStartIndex + pIdx;
                    const isShortage = item.status === "shortage";
                    const isSurplus = item.status === "surplus";
                    const rowBg = isShortage 
                      ? "bg-red-50/50 hover:bg-red-50" 
                      : isSurplus 
                        ? "bg-blue-50/40 hover:bg-blue-50" 
                        : "hover:bg-slate-50";

                    return (
                      <tr key={`${item.product_id}-${item.warehouse_id}-${globalIdx}`} className={`${rowBg} transition-colors`}>
                        {/* الكود */}
                        <td className="p-3 text-center font-mono font-black text-orange-600 text-xs">
                          {item.code}
                        </td>

                        {/* الصنف */}
                        <td className="p-3 font-bold text-slate-800">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">تكلفة: {Number(item.cost_price).toFixed(2)} ج.م</div>
                        </td>

                        {/* المخزن */}
                        <td className="p-3 text-slate-600 font-semibold text-xs">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                            {item.warehouse_name}
                          </span>
                        </td>

                        {/* الوحدة */}
                        <td className="p-3 text-center text-slate-500 font-bold text-xs">
                          {item.unit}
                        </td>

                        {/* الكمية الدفترية */}
                        <td className="p-3 text-center font-mono font-black text-slate-800 bg-slate-50/50">
                          {Number(item.book_quantity || 0).toLocaleString()}
                        </td>

                        {/* الكمية الفعلية Input */}
                        <td className="p-2 text-center">
                          <input 
                            type="number"
                            min="0"
                            step="any"
                            value={item.physical_quantity ?? ""}
                            onChange={(e) => handlePhysicalQtyChange(globalIdx, e.target.value)}
                            disabled={activeCount.status === "approved"}
                            className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-xs disabled:bg-slate-100"
                          />
                        </td>

                        {/* الفرق */}
                        <td className={`p-3 text-center font-mono font-black text-xs ${isShortage ? "text-red-600" : isSurplus ? "text-blue-600" : "text-slate-400"}`}>
                          {item.difference_quantity > 0 ? `+${Number(item.difference_quantity || 0).toLocaleString()}` : Number(item.difference_quantity || 0).toLocaleString()}
                        </td>

                        {/* نسبة الفرق % */}
                        <td className={`p-3 text-center font-mono font-bold text-xs ${isShortage ? "text-red-600" : isSurplus ? "text-blue-600" : "text-slate-400"}`}>
                          {item.difference_percent > 0 ? `+${item.difference_percent}%` : `${item.difference_percent}%`}
                        </td>

                        {/* تكلفة الفرق */}
                        <td className={`p-3 text-center font-mono font-black text-xs ${isShortage ? "text-red-600" : isSurplus ? "text-emerald-600" : "text-slate-400"}`}>
                          {item.difference_cost > 0 ? `+${Number(item.difference_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : Number(item.difference_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* الحالة Badge */}
                        <td className="p-3 text-center">
                          {item.status === "matched" ? (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> مطابق
                            </span>
                          ) : item.status === "surplus" ? (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                              <ArrowUp className="w-3 h-3" /> زيادة
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1">
                              <ArrowDown className="w-3 h-3" /> عجز
                            </span>
                          )}
                        </td>

                        {/* ملاحظات */}
                        <td className="p-2">
                          <input 
                            type="text"
                            value={item.notes ?? ""}
                            onChange={(e) => handleItemNotesChange(globalIdx, e.target.value)}
                            disabled={activeCount.status === "approved"}
                            placeholder="سبب الفرق..."
                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 bg-white placeholder:text-slate-300 disabled:bg-slate-100"
                          />
                        </td>

                        {/* زر تسوية فردي */}
                        <td className="p-3 text-center print:hidden">
                          {item.difference_quantity !== 0 && !item.is_settled && activeCount.status !== "approved" ? (
                            <button 
                              onClick={() => handleSettleSingleItem(item, globalIdx)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-xs transition-all active:scale-95"
                              title="تسوية هذا الصنف الآن"
                            >
                              تسوية
                            </button>
                          ) : item.is_settled ? (
                            <span className="text-[11px] text-emerald-600 font-black flex items-center justify-center gap-0.5">
                              <CheckCircle className="w-3 h-3" /> تمت التسوية
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {countPaginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-10 text-center text-slate-400 font-bold">
                        لا توجد أصناف مطابقة للبحث أو الفلتر المختار
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs print:hidden">
            <span className="text-slate-500 font-medium">
              عرض <strong>{filteredCountItems.length > 0 ? countStartIndex + 1 : 0}</strong> إلى <strong>{Math.min(countStartIndex + countItemsPerPage, filteredCountItems.length)}</strong> من إجمالي <strong>{filteredCountItems.length}</strong> صنف
            </span>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setCountCurrentPage(p => Math.max(1, p - 1))}
                disabled={countCurrentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                السابق
              </button>
              <span className="px-3 py-1.5 font-black text-slate-700 bg-slate-50 rounded-lg border border-slate-200">
                صفحة {countCurrentPage} من {countTotalPages}
              </span>
              <button 
                onClick={() => setCountCurrentPage(p => Math.min(countTotalPages, p + 1))}
                disabled={countCurrentPage >= countTotalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                التالي
              </button>
            </div>
          </div>
        </div>

        {/* 5. Modal: Count History (سجل الجرود السابقة) */}
        {showCountHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-orange-600" /> سجل عمليات الجرد السابقة
                </h3>
                <button onClick={() => setShowCountHistoryModal(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {countHistoryList.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 font-bold">لا توجد عمليات جرد سابقة مسجلة</div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                      <tr>
                        <th className="p-3 text-center">رقم الجرد</th>
                        <th className="p-3 text-center">التاريخ</th>
                        <th className="p-3">المخزن</th>
                        <th className="p-3 text-center">الأصناف</th>
                        <th className="p-3 text-center">فروقات العجز</th>
                        <th className="p-3 text-center">فروقات الزيادة</th>
                        <th className="p-3 text-center">صافي التكلفة</th>
                        <th className="p-3 text-center">الحالة</th>
                        <th className="p-3 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {countHistoryList.map((ch: any) => (
                        <tr key={ch.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-mono font-black text-orange-600">{ch.inventory_no}</td>
                          <td className="p-3 text-center font-mono">{ch.inventory_date ? String(ch.inventory_date).slice(0, 10) : "—"}</td>
                          <td className="p-3 font-bold">{ch.warehouse_name || "جميع المخازن"}</td>
                          <td className="p-3 text-center font-bold">{ch.items_count || 0}</td>
                          <td className="p-3 text-center font-bold text-red-600">{ch.shortage_count || 0}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{ch.surplus_count || 0}</td>
                          <td className="p-3 text-center font-mono font-black">{Number(ch.total_difference_cost || 0 || 0).toLocaleString()} ج.م</td>
                          <td className="p-3 text-center">{getStatusBadge(ch.status)}</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={async () => {
                                try {
                                  const dRes = await api.get(`/api/inventory/counts/${ch.id}`);
                                  if (dRes.ok) {
                                    const d = await dRes.json();
                                    setActiveCount({
                                      id: d.count.id,
                                      inventory_no: d.count.inventory_no,
                                      inventory_date: String(d.count.inventory_date).slice(0, 10),
                                      warehouse_id: d.count.warehouse_id ? String(d.count.warehouse_id) : "all",
                                      user_name: d.count.user_name || "المشرف العام",
                                      status: d.count.status,
                                      notes: d.count.notes || "",
                                    });
                                    setCountItemsList(d.items.map((it: any) => ({
                                      product_id: it.ingredient_id,
                                      ingredient_id: it.ingredient_id,
                                      code: it.code || `ITM-${it.ingredient_id}`,
                                      name: it.name,
                                      unit: it.unit || "قطعة",
                                      warehouse_id: it.warehouse_id,
                                      warehouse_name: it.warehouse_name || "المخزن",
                                      book_quantity: Number(it.book_quantity),
                                      physical_quantity: Number(it.physical_quantity),
                                      difference_quantity: Number(it.difference_quantity),
                                      cost_price: Number(it.cost_price),
                                      difference_cost: Number(it.difference_cost),
                                      difference_percent: Number(it.difference_percent),
                                      status: it.status,
                                      notes: it.notes || "",
                                      is_settled: Boolean(it.is_settled),
                                    })));
                                    setShowCountHistoryModal(false);
                                    showToast(`تم فتح الجرد رقم ${d.count.inventory_no}`);
                                  }
                                } catch (e) {
                                  showToast("فشل فتح تفاصيل الجرد", "error");
                                }
                              }}
                              className="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold rounded-lg border border-orange-200 transition-colors"
                            >
                              عرض وتفاصيل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===== ADJUSTMENTS =====
  const renderAdjustments = () => {
    const filtered = transactions.filter(tx => tx.type === "adjustment" || tx.type === "count");
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Edit2 className="w-6 h-6 text-indigo-600" /> التسويات</h2>
          <button onClick={() => { setAdjForm({ warehouse_id: "", type: "increase", reason: "", notes: "", date: new Date().toISOString().split("T")[0], items: [] }); setAdjItemSearch(""); setShowAdjustmentModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all"><Plus className="w-4 h-4" /> تسوية جديدة</button>
        </div>
        {renderFilterBar()}
        {filtered.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["رقم الحركة", "التاريخ", "المخزن", "النوع", "السبب", "عدد الأصناف", "القيمة", "المستخدم", "الحالة"].map(h => <th key={h} className="p-4 font-bold text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-orange-600">{tx.transaction_number}</td>
                    <td className="p-4 text-slate-600 text-xs whitespace-nowrap">{formatInventoryDate(tx.transaction_date || tx.date, false)}</td>
                    <td className="p-4 text-slate-600">{tx.warehouse_name}</td>
                    <td className="p-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">{TX_TYPE_LABELS[tx.type] || tx.type}</span></td>
                    <td className="p-4 text-slate-600">{tx.reason || "—"}</td>
                    <td className="p-4 text-center font-bold">{Number(tx.items_count ?? (Array.isArray(tx.items) ? tx.items.length : 1))}</td>
                    <td className="p-4 font-bold text-purple-600">{fmtMoney(tx.total_value || 0)}</td>
                    <td className="p-4 text-xs text-slate-500">{tx.user}</td>
                    <td className="p-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">معتمد</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Edit2} title="لا توجد تسويات" subtitle="سيتم عرض التسويات هنا بعد إنشائها" />}
      </div>
    );
  };

  // ===== DAMAGED =====
  const renderDamaged = () => {
    const filtered = transactions.filter(tx => tx.type === "damaged" || tx.type === "wastage");
    const totalCost = filtered.reduce((s, tx) => s + Number(tx.total_value || 0), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-red-600" /> الهالك والتالف</h2>
          <button onClick={() => { setDmgForm({ warehouse_id: "", reason: "", notes: "", date: new Date().toISOString().split("T")[0], items: [] }); setDmgItemSearch(""); setShowDamagedModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all"><Plus className="w-4 h-4" /> تسجيل هالك</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-slate-500 font-bold">عدد عمليات الهالك</p><p className="text-2xl font-black text-red-600">{filtered.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي التكلفة</p><p className="text-xl font-black text-amber-600">{fmtMoney(totalCost)}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center"><Calendar className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-slate-500 font-bold">هالك هذا الشهر</p><p className="text-2xl font-black text-purple-600">{filtered.filter(t => inventoryDateKey(t.transaction_date || t.date).startsWith(inventoryDateKey(new Date()).substring(0, 7))).length}</p></div></div></div>
        </div>
        {renderFilterBar()}
        {filtered.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["رقم الحركة", "التاريخ", "المخزن", "السبب", "عدد الأصناف", "التكلفة", "المستخدم", "الحالة"].map(h => <th key={h} className="p-4 font-bold text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-red-600">{tx.transaction_number}</td>
                    <td className="p-4 text-slate-600 text-xs whitespace-nowrap">{formatInventoryDate(tx.transaction_date || tx.date, false)}</td>
                    <td className="p-4 text-slate-600">{tx.warehouse_name}</td>
                    <td className="p-4 text-slate-600">{tx.reason || "—"}</td>
                    <td className="p-4 text-center font-bold">{Number(tx.items_count ?? (Array.isArray(tx.items) ? tx.items.length : 1))}</td>
                    <td className="p-4 font-bold text-red-600">{fmtMoney(tx.total_value || 0)}</td>
                    <td className="p-4 text-xs text-slate-500">{tx.user}</td>
                    <td className="p-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">معتمد</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={AlertTriangle} title="لا توجد أصناف هالكة" subtitle="سيتم عرض الهالك هنا بعد تسجيله" />}
      </div>
    );
  };

  // ===== RESERVED =====
  const renderReserved = () => {
    const filtered = inventoryItems.filter(item => {
      if (Number(item.reserved || 0) <= 0) return false;
      if (selectedWarehouse !== "all" && item.warehouse_id !== Number(selectedWarehouse)) return false;
      return !searchQuery || item.ingredient_name?.includes(searchQuery) || item.ingredient_code?.includes(searchQuery);
    });
    const totalReserved = filtered.reduce((sum, item) => sum + Number(item.reserved || 0), 0);
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Lock className="w-6 h-6 text-yellow-600" /> المخزون المحجوز</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <span className="font-bold text-amber-700 flex items-center gap-2"><Lock className="w-5 h-5" /> إجمالي الكميات المحجوزة</span>
          <span className="text-2xl font-black text-amber-700">{fmt(totalReserved, 0)}</span>
        </div>
        {renderFilterBar()}
        {filtered.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["الصنف", "المخزن", "الكمية الكلية", "المحجوز", "المتاح", "نسبة الحجز", "إجراء"].map(h => <th key={h} className="p-4 font-bold text-slate-500 text-center">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => {
                  const ratio = Number(item.quantity) > 0 ? (Number(item.reserved) / Number(item.quantity)) * 100 : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{item.ingredient_name}</td>
                      <td className="p-4 text-slate-600 text-center">{item.warehouse_name}</td>
                      <td className="p-4 text-center font-bold">{fmt(item.quantity, 0)} {item.ingredient_unit}</td>
                      <td className="p-4 text-center font-bold text-amber-600">{fmt(item.reserved, 0)} {item.ingredient_unit}</td>
                      <td className="p-4 text-center font-bold text-emerald-600">{fmt(item.available, 0)} {item.ingredient_unit}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, ratio)}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-amber-600 w-10">{ratio.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-center"><button className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-xs font-bold border border-amber-200 transition-colors">فك الحجز</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Lock} title="لا توجد كميات محجوزة" subtitle="لم يتم حجز أي كميات حالياً" />}
      </div>
    );
  };

  // ===== SUPPLIERS =====
  const renderSuppliers = () => {
    const filtered = suppliers.filter(s =>
      !searchQuery || (s.name || "").includes(searchQuery) || (s.code || "").includes(searchQuery) || (s.phone || "").includes(searchQuery)
    );
    const { data, totalPages, total } = paginate(filtered);
    const totalBalance = suppliers.reduce((s, sup) => s + Number(sup.balance || 0), 0);
    const totalPurchases = suppliers.reduce((s, sup) => s + Number(sup.total_purchases || 0), 0);

    const handleSaveSupplier = async () => {
      if (!editingSupplier?.name) { showToast("اسم المورد مطلوب", "error"); return; }
      try {
        const method = editingSupplier.id ? "PUT" : "POST";
        const url = editingSupplier.id ? `/api/warehouse-suppliers/${editingSupplier.id}` : "/api/warehouse-suppliers";
        const res = await (method === "PUT" ? api.put(url, editingSupplier) : api.post(url, editingSupplier));
        if (res.ok) {
          showToast(editingSupplier.id ? "تم تحديث المورد" : "تم إضافة المورد");
          setShowSupplierModal(false);
          setEditingSupplier(null);
          fetchData();
        } else { showToast("خطأ في الحفظ", "error"); }
      } catch (e) { showToast("خطأ في الاتصال", "error"); }
    };

    const handleDeleteSupplier = async (id: number) => {
      if (!confirm("حذف هذا المورد؟")) return;
      const res = await api.delete(`/api/warehouse-suppliers/${id}`);
      if (res.ok) { showToast("تم حذف المورد"); fetchData(); }
      else { showToast("فشل الحذف", "error"); }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="w-6 h-6 text-pink-600" /> الموردين</h2>
          <div className="flex gap-2">
            <button onClick={() => exportToExcel(filtered.map((s: any) => ({ الكود: s.code, الاسم: s.name, الهاتف: s.phone, "البريد الإلكتروني": s.email, العنوان: s.address, "الرقم الضريبي": s.tax_number, "مسؤول الاتصال": s.contact_person, الرصيد: s.balance, "إجمالي المشتريات": s.total_purchases })), "suppliers")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 transition-all">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => { setEditingSupplier({ balance: 0 }); setShowSupplierModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all">
              <Plus className="w-4 h-4" /> إضافة مورد
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-pink-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي الموردين</p><p className="text-2xl font-black text-pink-600">{suppliers.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي الأرصدة</p><p className="text-xl font-black text-amber-600">{fmtMoney(totalBalance)}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي المشتريات</p><p className="text-xl font-black text-emerald-600">{fmtMoney(totalPurchases)}</p></div></div></div>
        </div>
        {renderFilterBar({ showWarehouseFilter: false })}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["الكود", "الاسم", "مسؤول الاتصال", "الهاتف", "العنوان", "الرقم الضريبي", "عدد المعاملات", "إجمالي المشتريات", "الرصيد", "إجراءات"].map(h => <th key={h} className="p-4 font-bold text-slate-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-orange-600">{s.code}</td>
                  <td className="p-4 font-bold text-slate-900">{s.name}</td>
                  <td className="p-4 text-slate-600">{s.contact_person || "—"}</td>
                  <td className="p-4 text-slate-600 font-mono text-xs"><Phone className="w-3 h-3 inline ml-1" />{s.phone || "—"}</td>
                  <td className="p-4 text-slate-600 text-xs"><MapPin className="w-3 h-3 inline ml-1" />{s.address || "—"}</td>
                  <td className="p-4 font-mono text-slate-500 text-xs">{s.tax_number || "—"}</td>
                  <td className="p-4 text-center font-bold text-blue-600">{s.tx_count || 0}</td>
                  <td className="p-4 font-bold text-emerald-600">{fmtMoney(s.total_purchases || 0)}</td>
                  <td className={`p-4 font-bold ${Number(s.balance) < 0 ? "text-red-600" : Number(s.balance) > 0 ? "text-amber-600" : "text-slate-500"}`}>{fmtMoney(s.balance || 0)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setRatingSupplier(s); loadSupplierRatings(s.id); setRatingForm({ rating: 5, criteria: "جودة المنتجات", comment: "" }); setShowRatingModal(true); }} className="p-2 hover:bg-amber-50 rounded-lg text-amber-500" title="تقييم"><Star className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingSupplier(s); setShowSupplierModal(true); }} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteSupplier(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400" title="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderPaginationControls(total, totalPages)}
      </div>
    );
  };

  // ===== MOVEMENTS (Audit log) =====
  const renderMovements = () => {
    const filtered = movements.filter(m => {
      if (selectedWarehouse !== "all" && m.warehouse_id !== Number(selectedWarehouse)) return false;
      return !searchQuery || m.ingredient_name?.includes(searchQuery) || m.notes?.includes(searchQuery) || (m.ref_type || "").includes(searchQuery);
    });
    const { data, totalPages, total } = paginate(filtered);
    const inCount = filtered.filter(m => Number(m.delta) > 0).length;
    const outCount = filtered.filter(m => Number(m.delta) < 0).length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History className="w-6 h-6 text-slate-600" /> سجل الحركات المخزنية</h2>
          <button onClick={() => exportToExcel(filtered.map((m: any) => ({ التاريخ: formatInventoryDate(m.created_at, true), الصنف: m.ingredient_name, المخزن: m.warehouse_name, "الحقل": m.field, "قبل": m.before_qty, "التغير": m.delta, "بعد": m.after_qty, "النوع": m.ref_type, "المرجع": m.ref_id, المستخدم: m.user, ملاحظات: m.notes })), "movements-log")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 transition-all">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center"><History className="w-5 h-5 text-slate-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي الحركات</p><p className="text-2xl font-black text-slate-600">{filtered.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><ArrowUp className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">وارد (زيادة)</p><p className="text-2xl font-black text-emerald-600">{inCount}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><ArrowDown className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-slate-500 font-bold">صادر (نقص)</p><p className="text-2xl font-black text-red-600">{outCount}</p></div></div></div>
        </div>
        {renderFilterBar()}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["التاريخ والوقت", "الصنف", "المخزن", "الحقل", "النوع", "المرجع", "قبل", "التغير", "بعد", "المستخدم", "ملاحظات"].map(h => <th key={h} className="p-3 font-bold text-slate-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-xs text-slate-500">{(m.created_at || "").substring(0, 16).replace("T", " ")}</td>
                  <td className="p-3 font-bold text-slate-800">{m.ingredient_name}</td>
                  <td className="p-3 text-slate-600">{m.warehouse_name}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{m.field === "quantity" ? "الكمية" : m.field === "reserved" ? "محجوز" : m.field === "in_transit" ? "قيد النقل" : m.field}</span></td>
                  <td className="p-3">
                    {m.ref_type === "production_consumption" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">صرف إنتاج</span>
                    ) : m.ref_type === "production_receipt" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">استلام إنتاج</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.ref_type === "transaction" ? "bg-blue-50 text-blue-600" : m.ref_type === "transfer" ? "bg-cyan-50 text-cyan-600" : "bg-slate-100 text-slate-600"}`}>{m.ref_type}</span>
                    )}
                  </td>
                  <td className="p-3 text-xs font-mono text-slate-500">#{m.ref_id}</td>
                  <td className="p-3 text-center text-slate-500">{fmt(m.before_qty, 0)}</td>
                  <td className={`p-3 text-center font-bold ${Number(m.delta) > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(m.delta) > 0 ? "+" : ""}{fmt(m.delta, 0)}</td>
                  <td className="p-3 text-center font-bold text-slate-800">{fmt(m.after_qty, 0)}</td>
                  <td className="p-3 text-xs text-slate-500">{m.user}</td>
                  <td className="p-3 text-xs text-slate-400 max-w-[150px] truncate">{m.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderPaginationControls(total, totalPages)}
      </div>
    );
  };

  // ===== BARCODE =====
  const renderBarcode = () => {
    const filtered = ingredients.filter(ing => !searchQuery || (ing.name || "").includes(searchQuery) || (ing.code || "").includes(searchQuery) || (ing.barcode || "").includes(searchQuery));
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-6 h-6 text-violet-600" /> الباركود</h2>
        {renderFilterBar({ showWarehouseFilter: false })}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ing => (
            <div key={ing.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all">
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4 mb-3 flex items-center justify-center">
                <BarcodeDisplay value={ing.barcode || ing.code} height={50} />
              </div>
              <h3 className="font-bold text-slate-800 text-center">{ing.name}</h3>
              <p className="text-sm text-slate-500 text-center">{ing.unit} • {ing.code}</p>
              <div className="flex items-center gap-2 mt-3 justify-center">
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold border border-orange-200 transition-colors flex items-center gap-1"><Printer className="w-3 h-3" /> طباعة</button>
                <button onClick={() => { setSelectedBarcode(ing); setShowBarcodeModal(true); }} className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg text-xs font-bold border border-violet-200 transition-colors flex items-center gap-1"><Eye className="w-3 h-3" /> عرض كبير</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== BATCHES (Expiry Tracking) =====
  const renderBatches = () => {
    const filtered = batches.filter(b => {
      if (selectedWarehouse !== "all" && b.warehouse_id !== Number(selectedWarehouse)) return false;
      return !searchQuery || b.ingredient_name?.includes(searchQuery) || b.batch_number?.includes(searchQuery);
    });
    const today = new Date();
    const expiringSoon = filtered.filter(b => b.days_to_expiry !== null && b.days_to_expiry <= 7 && b.days_to_expiry >= 0);
    const expired = filtered.filter(b => b.days_to_expiry !== null && b.days_to_expiry < 0);
    const active = filtered.filter(b => b.status === "active");
    const totalValue = filtered.reduce((s, b) => s + (Number(b.quantity || 0) * Number(b.cost || 0)), 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Tag className="w-6 h-6 text-fuchsia-600" /> التشغيلات والصلاحية</h2>
          <button onClick={() => exportToExcel(filtered.map((b: any) => ({ "رقم التشغيلة": b.batch_number, الصنف: b.ingredient_name, المخزن: b.warehouse_name, "تاريخ الاستلام": b.received_date, "تاريخ الانتهاء": b.expiry_date, "أيام متبقية": b.days_to_expiry, الكمية: b.quantity, التكلفة: b.cost, "القيمة": Number(b.quantity) * Number(b.cost), الحالة: b.status })), "stock-batches")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 transition-all">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><Tag className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-slate-500 font-bold">تشغيلات نشطة</p><p className="text-2xl font-black text-emerald-600">{active.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4 bg-amber-50/30"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-slate-500 font-bold">قاربت الانتهاء (≤ 7 أيام)</p><p className="text-2xl font-black text-amber-600">{expiringSoon.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-red-200 p-4 bg-red-50/30"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><XCircle className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-slate-500 font-bold">منتهية الصلاحية</p><p className="text-2xl font-black text-red-600">{expired.length}</p></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-slate-500 font-bold">إجمالي القيمة</p><p className="text-lg font-black text-purple-600">{fmtMoney(totalValue)}</p></div></div></div>
        </div>
        {renderFilterBar()}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["رقم التشغيلة", "الصنف", "المخزن", "تاريخ الاستلام", "تاريخ الانتهاء", "أيام متبقية", "الكمية", "الأصلية", "التكلفة", "القيمة", "الحالة"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(b => {
                const days = b.days_to_expiry;
                let statusBadge;
                if (days === null) statusBadge = <span className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">—</span>;
                else if (days < 0) statusBadge = <span className="px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-200">منتهية</span>;
                else if (days <= 3) statusBadge = <span className="px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-200 animate-pulse">حرج ({days} يوم)</span>;
                else if (days <= 7) statusBadge = <span className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">قاربت ({days} يوم)</span>;
                else statusBadge = <span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">سليم ({days} يوم)</span>;
                return (
                  <tr key={b.id} className={`hover:bg-slate-50 ${days !== null && days < 0 ? "bg-red-50/40" : days !== null && days <= 7 ? "bg-amber-50/30" : ""}`}>
                    <td className="p-3 font-mono font-bold text-fuchsia-600 text-center">{b.batch_number}</td>
                    <td className="p-3 font-bold text-slate-900">{b.ingredient_name}</td>
                    <td className="p-3 text-slate-600 text-center">{b.warehouse_name}</td>
                    <td className="p-3 text-center text-xs text-slate-500">{b.received_date}</td>
                    <td className="p-3 text-center text-xs text-slate-500">{b.expiry_date || "—"}</td>
                    <td className="p-3 text-center">{statusBadge}</td>
                    <td className="p-3 text-center font-bold text-slate-800">{fmt(b.quantity, 0)} {b.ingredient_unit}</td>
                    <td className="p-3 text-center text-slate-500">{fmt(b.original_quantity, 0)}</td>
                    <td className="p-3 text-center text-slate-600">{fmtMoney(b.cost)}</td>
                    <td className="p-3 text-center font-bold text-purple-600">{fmtMoney(Number(b.quantity) * Number(b.cost))}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${b.status === "active" ? "bg-emerald-50 text-emerald-600" : b.status === "expiring_soon" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{b.status === "active" ? "نشط" : b.status === "expiring_soon" ? "قاربت" : b.status === "expired" ? "منتهية" : b.status}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={11} className="p-12 text-center text-slate-400">لا توجد تشغيلات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ===== TURNOVER REPORT =====
  const renderTurnover = () => {
    if (!turnover) return <EmptyState icon={Gauge} title="جاري التحميل..." subtitle="اضغط زر التحديث" />;
    const { items, summary, period_days } = turnover;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Gauge className="w-6 h-6 text-cyan-700" /> تقرير دوران المخزون</h2>
          <div className="flex items-center gap-2">
            <select value={pageSize ?? ""} onChange={() => {}} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none">
              <option value="30">آخر 30 يوم</option>
              <option value="60">آخر 60 يوم</option>
              <option value="90">آخر 90 يوم</option>
            </select>
            <button onClick={async () => {
              const days = (document.querySelector("select") as HTMLSelectElement)?.value || "30";
              const res = await api.get(`/api/warehouse-turnover?days=${days}`);
              if (res.ok) setTurnover(await res.json());
            }} className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold">تحديث</button>
            <button onClick={() => exportToExcel(items.map((i: any) => ({ الصنف: i.name, "الكمية الحالية": i.current_qty, "متوسط التكلفة": i.avg_cost, "قيمة المخزون": i.inventory_value, "تكلفة المبيعات": i.cogs_period, "معدل الدوران": i.turnover_ratio, "أيام التزويد": i.days_of_supply, "الحالة": i.status })), "inventory-turnover")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 font-bold">قيمة المخزون</p><p className="text-lg font-black text-emerald-600">{fmtMoney(summary.total_inventory_value)}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 font-bold">تكلفة المبيعات</p><p className="text-lg font-black text-orange-600">{fmtMoney(summary.total_cogs)}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 font-bold">معدل الدوران العام</p><p className="text-2xl font-black text-cyan-700">{summary.overall_turnover_ratio}</p></div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 bg-emerald-50/30"><p className="text-xs text-slate-500 font-bold">سريع الحركة</p><p className="text-2xl font-black text-emerald-600">{summary.fast_moving_count}</p></div>
          <div className="bg-white rounded-2xl border border-rose-200 p-4 bg-rose-50/30"><p className="text-xs text-slate-500 font-bold">راكد / بلا حركة</p><p className="text-2xl font-black text-rose-600">{summary.slow_moving_count + summary.no_movement_count}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["الصنف", "الكمية", "متوسط التكلفة", "قيمة المخزون", "تكلفة المبيعات", "معدل الدوران", "أيام التزويد", "الحالة"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((it: any) => (
                <tr key={it.id} className={`hover:bg-slate-50 ${it.status === "slow_moving" ? "bg-rose-50/30" : it.status === "no_movement" ? "bg-slate-100/40" : it.status === "fast_moving" ? "bg-emerald-50/30" : ""}`}>
                  <td className="p-3 font-bold text-slate-900">{it.name}</td>
                  <td className="p-3 text-center">{fmt(it.current_qty, 0)} {it.unit}</td>
                  <td className="p-3 text-center text-slate-600">{fmtMoney(it.avg_cost)}</td>
                  <td className="p-3 text-center font-bold text-emerald-600">{fmtMoney(it.inventory_value)}</td>
                  <td className="p-3 text-center font-bold text-orange-600">{fmtMoney(it.cogs_period)}</td>
                  <td className="p-3 text-center font-bold text-cyan-700">{it.turnover_ratio}</td>
                  <td className="p-3 text-center text-slate-600">{it.days_of_supply !== null ? `${it.days_of_supply} يوم` : "—"}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${it.status === "fast_moving" ? "bg-emerald-50 text-emerald-600" : it.status === "normal" ? "bg-blue-50 text-blue-600" : it.status === "slow_moving" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>{it.status === "fast_moving" ? "سريع" : it.status === "normal" ? "عادي" : it.status === "slow_moving" ? "بطيء" : "بلا حركة"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length > pageSize && renderPaginationControls(items.length, Math.ceil(items.length / pageSize))}
      </div>
    );
  };

  // ===== SLOW-MOVING ITEMS =====
  const renderSlowMoving = () => {
    if (!slowMoving) return <EmptyState icon={Timer} title="جاري التحميل..." subtitle="اضغط زر التحديث" />;
    const { items, summary } = slowMoving;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Timer className="w-6 h-6 text-rose-600" /> الأصناف الراكدة</h2>
          <div className="flex items-center gap-2">
            <button onClick={async () => { const res = await api.get("/api/warehouse-slow-moving?days=30"); if (res.ok) setSlowMoving(await res.json()); }}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold">تحديث</button>
            <button onClick={() => exportToExcel(items.map((i: any) => ({ الصنف: i.name, الكمية: i.quantity, "متوسط التكلفة": i.avg_cost, "قيمة المخزون": i.inventory_value, "آخر سعر شراء": i.last_purchase_price, "أيام بلا حركة": i.days_without_movement })), "slow-moving")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><Timer className="w-8 h-8 text-rose-600" /><div><p className="font-bold text-rose-700">عدد الأصناف الراكدة</p><p className="text-xs text-rose-600">بدون حركة صرف منذ 30 يوم</p></div></div>
          <span className="text-3xl font-black text-rose-700">{summary.count}</span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><DollarSign className="w-8 h-8 text-amber-600" /><div><p className="font-bold text-amber-700">إجمالي القيمة الراكدة</p><p className="text-xs text-amber-600">رأس مال مجمد</p></div></div>
          <span className="text-2xl font-black text-amber-700">{fmtMoney(summary.total_stuck_value)}</span>
        </div>
        {items.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["الصنف", "الفئة", "الكمية", "متوسط التكلفة", "قيمة المخزون", "آخر سعر شراء", "أيام بلا حركة", "إجراء"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it: any) => (
                  <tr key={it.id} className="hover:bg-slate-50 bg-rose-50/20">
                    <td className="p-3 font-bold text-slate-900">{it.name}</td>
                    <td className="p-3 text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">{it.category || "عام"}</span></td>
                    <td className="p-3 text-center font-bold">{fmt(it.quantity, 0)} {it.unit}</td>
                    <td className="p-3 text-center text-slate-600">{fmtMoney(it.avg_cost)}</td>
                    <td className="p-3 text-center font-bold text-rose-600">{fmtMoney(it.inventory_value)}</td>
                    <td className="p-3 text-center text-slate-500">{fmtMoney(it.last_purchase_price)}</td>
                    <td className="p-3 text-center"><span className="px-2 py-1 rounded text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">{it.days_without_movement} يوم</span></td>
                    <td className="p-3 text-center">
                      <button className="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold border border-orange-200">تسجيل هالك</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={CheckCircle} title="لا توجد أصناف راكدة" subtitle="كل الأصناف لها حركة صرف خلال آخر 30 يوم" />}
      </div>
    );
  };

  // ===== SETTINGS =====
  const renderSettings = () => {
    const handleSaveSetting = async (id: number, value: string) => {
      const res = await api.put(`/api/warehouse-settings/${id}`, { value });
      if (res.ok) { showToast("تم حفظ الإعداد"); fetchSettings(); }
      else { showToast("فشل الحفظ", "error"); }
    };

    const handleAddType = async (table: "warehouse-types" | "transaction-types" | "transaction-reasons", fields: any) => {
      const res = await api.post(`/api/${table}`, fields);
      if (res.ok) { showToast("تمت الإضافة"); fetchSettings(); }
      else { showToast("فشل الإضافة", "error"); }
    };

    const handleDeleteType = async (table: "warehouse-types" | "transaction-types" | "transaction-reasons", id: number) => {
      if (!confirm("حذف؟")) return;
      const res = await api.delete(`/api/${table}/${id}`);
      if (res.ok) { showToast("تم الحذف"); fetchSettings(); }
    };

    const handleQuickLinkModule = async (moduleId: string, warehouseId: number, isDefault: boolean) => {
      try {
        const res = await api.post("/api/warehouses/link-module", {
          warehouse_id: warehouseId,
          module_id: moduleId,
          is_default: isDefault,
          auto_sync: true,
        });
        if (res.ok) {
          showToast(`تم ربط المخزن بموديول ${SYSTEM_MODULES.find(m => m.id === moduleId)?.shortName || moduleId} بنجاح`);
          fetchData();
        } else {
          showToast("حدث خطأ أثناء الربط", "error");
        }
      } catch (e) {
        showToast("خطأ في الاتصال", "error");
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-orange-600" /> إعدادات المخازن وربط موديولات النظام
          </h2>
          <p className="text-xs text-slate-500 mt-1">تخصيص قواعد المخازن، أنواع الحركات، والربط التلقائي بموديولات النظام (الفنادق، المطاعم، نقاط البيع وغيرها)</p>
        </div>

        {/* ─── موديولات النظام وربط المخازن التلقائي ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <LinkIcon className="w-5 h-5 text-orange-600" /> ربط وتخصيص المخازن بموديولات النظام (System Modules Integration)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                قم بتعيين مخزن لكل موديول في النظام ليتم التعامل معه وخصم/إضافة الأصناف والمستلزمات منه تلقائياً
              </p>
            </div>
            <button
              onClick={() => {
                setEditingWarehouse({
                  status: "active",
                  type: "main",
                  linked_module: "hotels",
                  is_module_default: true,
                  auto_sync: true,
                  allow_negative: false,
                  is_default: false,
                });
                setShowWarehouseModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-xs font-bold border border-orange-200 transition-colors w-fit"
            >
              <Plus className="w-4 h-4" /> إضافة مخزن جديد وربطه
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SYSTEM_MODULES.filter(m => m.id !== "all").map(mod => {
              const ModIcon = mod.icon;
              const linkedWarehouses = warehouses.filter(w => w.linked_module === mod.id || (w.linked_modules && String(w.linked_modules).includes(mod.id)));
              const defaultWarehouse = linkedWarehouses.find(w => w.is_module_default) || linkedWarehouses[0];

              return (
                <div key={mod.id} className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${mod.badge}`}>
                          <ModIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{mod.shortName}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{mod.id}</span>
                        </div>
                      </div>
                      {defaultWarehouse ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" /> مربوط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          غير محدد
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <label className="text-[11px] font-bold text-slate-600 block">المخزن المرتبط حالياً:</label>
                    <select
                      value={defaultWarehouse?.id || ""}
                      onChange={(e) => {
                        const targetId = Number(e.target.value);
                        if (targetId) {
                          handleQuickLinkModule(mod.id, targetId, true);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 shadow-sm"
                    >
                      <option value="">— اختر مخزن للربط —</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.code} - {w.name} {w.linked_module === mod.id ? "✓" : ""}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-slate-400">عدد المخازن المربوطة:</span>
                      <span className="font-bold text-slate-700">{linkedWarehouses.length} مخزن</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditingWarehouse({
                            name: `مخزن ${mod.shortName}`,
                            status: "active",
                            type: "main",
                            linked_module: mod.id,
                            is_module_default: true,
                            auto_sync: true,
                            allow_negative: false,
                            is_default: false,
                          });
                          setShowWarehouseModal(true);
                        }}
                        className="flex-1 text-center py-1.5 px-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-[11px] font-bold transition-colors"
                      >
                        + إضافة مخزن لهذا الموديول
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* General Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Settings className="w-5 h-5 text-orange-600" /> الإعدادات العامة</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warehouseSettings.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="font-bold text-slate-700 text-sm">{s.label}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{s.key}</p>
                </div>
                {s.value === "true" || s.value === "false" ? (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={s.value === "true"} onChange={e => handleSaveSetting(s.id, String(e.target.checked))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                ) : s.options ? (
                  <select defaultValue={s.value} onChange={e => handleSaveSetting(s.id, e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-orange-500">
                    {s.options.split(",").map((o: any) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                  </select>
                ) : (
                  <input type="text" defaultValue={s.value} onBlur={e => handleSaveSetting(s.id, e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-orange-500 w-32" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Warehouse Types */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-600" /> أنواع المخازن</h3>
            <button onClick={() => { const name = prompt("اسم النوع:"); if (name) { const code = prompt("الكود:", name.toLowerCase()); if (code) handleAddType("warehouse-types", { name, code }); } }}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold border border-orange-200 transition-colors"><Plus className="w-3 h-3" /> إضافة</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {warehouseTypes.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div><span className="font-bold text-sm text-slate-700">{t.name}</span><p className="text-[10px] font-mono text-slate-400">{t.code}</p></div>
                <button onClick={() => handleDeleteType("warehouse-types", t.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Types */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-orange-600" /> أنواع الحركات</h3>
            <button onClick={() => { const name = prompt("اسم النوع:"); if (name) { const code = prompt("الكود:", name.toLowerCase()); const effect = prompt("التأثير (in/out/adjust):", "in"); if (code) handleAddType("transaction-types", { name, code, effect }); } }}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold border border-orange-200 transition-colors"><Plus className="w-3 h-3" /> إضافة</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {transactionTypes.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="font-bold text-sm text-slate-700">{t.name}</span>
                  <p className="text-[10px] font-mono text-slate-400">{t.code}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${t.effect === "in" ? "bg-emerald-50 text-emerald-600" : t.effect === "out" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{t.effect === "in" ? "وارد" : t.effect === "out" ? "صادر" : "تسوية"}</span>
                </div>
                <button onClick={() => handleDeleteType("transaction-types", t.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Reasons */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText className="w-5 h-5 text-orange-600" /> أسباب الحركات</h3>
            <button onClick={() => { const name = prompt("اسم السبب:"); if (name) { const code = prompt("الكود:", name.toLowerCase()); if (code) handleAddType("transaction-reasons", { name, code }); } }}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold border border-orange-200 transition-colors"><Plus className="w-3 h-3" /> إضافة</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {transactionReasons.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div><span className="font-bold text-sm text-slate-700">{r.name}</span><p className="text-[10px] font-mono text-slate-400">{r.code}</p></div>
                <button onClick={() => handleDeleteType("transaction-reasons", r.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><Lock className="w-5 h-5 text-orange-600" /> الصلاحيات</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["إنشاء", "تعديل", "حذف", "اعتماد", "جرد", "تحويل", "طباعة", "تصدير", "إلغاء اعتماد"].map(p => (
              <label key={p} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded" /><span className="text-sm font-bold text-slate-700">{p}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ===== REPORTS =====
  const renderReports = () => {
    const lowStockItems = inventoryItems.filter(item => Number(item.min_stock) > 0 && Number(item.quantity) <= Number(item.min_stock));
    const totalValue = inventoryItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.avg_cost || 0)), 0);
    const isWastageTx = (tx: any) => tx.type === "damaged" || tx.type === "wastage";
    const damagedCost = transactions.filter(isWastageTx).reduce((sum, tx) => sum + Number(tx.total_value || 0), 0);

    const reports = [
      { id: "stock_balance", label: "رصيد المخزون", icon: Box, desc: "عرض أرصدة جميع الأصناف", count: inventoryItems.length, color: "text-blue-600 bg-blue-50", action: () => exportToExcel(inventoryItems.map((i: any) => ({ الصنف: i.ingredient_name, المخزن: i.warehouse_name, الكمية: i.quantity, المتاح: i.available, المحجوز: i.reserved, القيمة: Number(i.quantity) * Number(i.avg_cost || 0) })), "stock-balance-report") },
      { id: "low_stock", label: "الأصناف منخفضة الكمية", icon: AlertTriangle, desc: "الأصناف التي وصلت للحد الأدنى", count: lowStockItems.length, color: "text-red-600 bg-red-50", action: () => exportToExcel(lowStockItems.map((i: any) => ({ الصنف: i.ingredient_name, المخزن: i.warehouse_name, الكمية: i.quantity, "حد الطلب": i.min_stock, "متوسط التكلفة": i.avg_cost })), "low-stock-report") },
      { id: "transactions_report", label: "تقارير الحركات", icon: ArrowRightLeft, desc: "تقرير شامل بالحركات", count: transactions.length, color: "text-purple-600 bg-purple-50", action: () => exportToExcel(transactions.map((t: any) => ({ "رقم الحركة": t.transaction_number, التاريخ: formatInventoryDate(t.transaction_date || t.date, false), النوع: TX_TYPE_LABELS[t.type] || t.type, المخزن: t.warehouse_name, القيمة: t.total_value })), "transactions-report") },
      { id: "transfers_report", label: "تقارير التحويلات", icon: Truck, desc: "التحويلات بين المخازن", count: transfers.length, color: "text-cyan-600 bg-cyan-50", action: () => exportToExcel(transfers.map((t: any) => ({ "رقم التحويل": t.transfer_number, التاريخ: formatInventoryDate(t.date, false), "من مخزن": t.from_warehouse_name, "إلى مخزن": t.to_warehouse_name, الحالة: t.status })), "transfers-report") },
      { id: "valuation", label: "تقييم المخزون", icon: DollarSign, desc: `القيمة الإجمالية: ${fmtMoney(totalValue)}`, count: 0, color: "text-amber-600 bg-amber-50", isValue: true, action: () => exportToExcel(valuation.map((v: any) => ({ المخزن: v.warehouse_name, الصنف: v.name, الكمية: v.quantity, "متوسط التكلفة": v.avg_cost, القيمة: v.total_value })), "valuation-report") },
      { id: "damaged_report", label: "تقرير الهالك", icon: AlertTriangle, desc: `تكلفة الهالك: ${fmtMoney(damagedCost)}`, count: transactions.filter(isWastageTx).length, color: "text-red-600 bg-red-50", action: () => exportToExcel(transactions.filter(isWastageTx).map((t: any) => ({ "رقم الحركة": t.transaction_number, التاريخ: formatInventoryDate(t.transaction_date || t.date, false), المخزن: t.warehouse_name, السبب: t.reason, التكلفة: t.total_value })), "damaged-report") },
      { id: "abc", label: "تحليل ABC (باريتو)", icon: BarChart3, desc: "تصنيف الأصناف حسب القيمة", count: abcData?.items?.length || 0, color: "text-violet-600 bg-violet-50", action: () => abcData && exportToExcel(abcData.items.map((i: any) => ({ الصنف: i.name, الكود: i.code, الكمية: i.qty, القيمة: i.value, "نسبة تراكمية": i.cum_pct, التصنيف: i.class })), "abc-analysis") },
      { id: "suppliers_report", label: "تقرير الموردين", icon: Users, desc: "أداء الموردين", count: suppliers.length, color: "text-pink-600 bg-pink-50", action: () => exportToExcel(suppliers.map((s: any) => ({ المورد: s.name, "عدد المعاملات": s.tx_count, "إجمالي المشتريات": s.total_purchases, الرصيد: s.balance })), "suppliers-report") },
    ];

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="w-6 h-6 text-orange-600" /> تقارير المخازن</h2>
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500 font-bold">إجمالي المخازن</p><p className="text-3xl font-black text-orange-600 mt-1">{warehouses.length}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500 font-bold">إجمالي الأصناف</p><p className="text-3xl font-black text-blue-600 mt-1">{ingredients.length}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500 font-bold">أصناف منخفضة</p><p className="text-3xl font-black text-red-600 mt-1">{lowStockItems.length}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500 font-bold">قيمة المخزون</p><p className="text-3xl font-black text-emerald-600 mt-1">{fmt(totalValue, 0)}</p><p className="text-[10px] text-slate-400">ج.م</p></div>
        </div>

        {/* ABC Analysis chart */}
        {abcData && abcData.items && abcData.items.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-violet-600" /> تحليل ABC (باريتو)</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-emerald-700">فئة A (80% من القيمة)</p>
                <p className="text-2xl font-black text-emerald-600">{abcData.items.filter((i: any) => i.class === "A").length}</p>
                <p className="text-[10px] text-emerald-600">أصناف متميزة</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-amber-700">فئة B (15% التالية)</p>
                <p className="text-2xl font-black text-amber-600">{abcData.items.filter((i: any) => i.class === "B").length}</p>
                <p className="text-[10px] text-amber-600">أصناف متوسطة</p>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-slate-700">فئة C (5% المتبقية)</p>
                <p className="text-2xl font-black text-slate-600">{abcData.items.filter((i: any) => i.class === "C").length}</p>
                <p className="text-[10px] text-slate-500">أصناف عادية</p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>{["الصنف", "الكمية", "القيمة", "النسبة التراكمية", "التصنيف"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {abcData.items.slice(0, 30).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3 text-center">{fmt(item.qty, 0)}</td>
                      <td className="p-3 text-center font-bold text-purple-600">{fmtMoney(item.value)}</td>
                      <td className="p-3 text-center text-slate-600">{item.cum_pct}%</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${item.class === "A" ? "bg-emerald-50 text-emerald-600" : item.class === "B" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"}`}>{item.class}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all cursor-pointer group" onClick={r.action}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.color}`}>
                  <r.icon className="w-6 h-6" />
                </div>
                {!r.isValue && <span className={`px-2 py-1 rounded-lg text-xs font-bold ${r.color}`}>{r.count}</span>}
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{r.label}</h3>
              <p className="text-sm text-slate-500">{r.desc}</p>
              <div className="flex items-center gap-2 mt-4">
                <button className="text-xs font-bold text-orange-600 hover:underline">عرض التقرير</button>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Download className="w-3 h-3" /> Excel</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== RENDER FEATURE CONTENT =====
  // Unified page renderer — supports all pages accessible from dashboard
  const renderPage = (pageId: string) => {
    switch (pageId) {
      case "main": return renderWarehouses();
      case "locations": return <WarehouseLocationsView warehouses={warehouses} onNotify={showToast} />;
      case "ingredients": return renderIngredients();
      case "stock": return renderStock();
      case "transactions": return renderTransactions();
      case "goods_receipts": return <GoodsReceiptsView warehouses={warehouses} ingredients={ingredients} suppliers={suppliers} onNotify={showToast} />;
      case "material_requests": return <MaterialRequestsView warehouses={warehouses} ingredients={ingredients} onNotify={showToast} />;
      case "transfers": return <WarehouseTransfersView warehouses={warehouses} ingredients={ingredients} onNotify={showToast} />;
      case "planning": return <InventoryPlanningView warehouses={warehouses} onNotify={showToast} />;
      case "putaway_rules": return <PutawayRules />;
      case "count": return renderCount();
      case "adjustments": return <InventoryAdjustmentsView onNotify={showToast} />;
      case "damaged": return <WastageView onNotify={showToast} userRole="admin" />;
      case "reserved": return renderReserved();
      case "suppliers": return renderSuppliers();
      case "movements": return renderMovements();
      case "barcode": return renderBarcode();
      case "product_bundles": return <ProductBundles />;
      case "batches": return renderBatches();
      case "turnover": return renderTurnover();
      case "slow_moving": return renderSlowMoving();
      case "ai_advisor": return <AIInventoryAdvisorView onNotify={showToast} />;
      case "audit_trail": return <InventoryAuditTrailView onNotify={showToast} />;
      case "settings":
      case "warehouse_types":
      case "transaction_types":
      case "transaction_reasons":
        return (
          <InventorySettingsView
            initialSubTab={pageId}
            warehouses={warehouses}
            onNotify={showToast}
            onRefreshData={fetchData}
          />
        );
      case "reports":
      case "stock_balance":
      case "low_stock":
      case "transactions_report":
      case "transfers_report":
      case "valuation":
      case "damaged_report":
      case "item_ledger":
      case "aging_report":
      case "abc":
      case "suppliers_report":
        return (
          <InventoryReportsView
            initialReportId={pageId}
            warehouses={warehouses}
            ingredients={ingredients}
            inventoryItems={inventoryItems}
            transactions={transactions}
            transfers={transfers}
            suppliers={suppliers}
            valuation={valuation}
            onNotify={showToast}
          />
        );
      default: return renderWarehouses();
    }
  };

  // Keep renderFeature for backward compat (calls renderPage)
  const renderFeature = () => renderPage(activeFeature);

  return (
    <div className={`min-h-screen flex flex-col text-slate-900 ${darkMode ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"}`} dir="rtl">
      {/* Header - Sticky */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <WarehouseIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">موديول المخازن الاحترافي</h1>
              <p className="text-sm text-slate-500">إدارة شاملة للمخازن والأرصدة والحركات والموردين</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGlobalSearch(true)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200" title="بحث عام (Ctrl+K)">
            <Search className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowBarcodeScanner(true); }} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200" title="ماسح الباركود">
            <ScanLine className="w-5 h-5" />
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200" title="الوضع الليلي">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setShowNotifications(true)} className="relative p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200" title="الإشعارات">
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">{notifications.length}</span>
            )}
          </button>
          <button onClick={fetchData} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200" title="تحديث">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Section Tabs (الخصائص / الإعدادات / التقارير) — direct from outside */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-1 sticky top-[88px] z-20">
        {([
          { id: "features" as const, label: "الخصائص", icon: Box },
          { id: "settings" as const, label: "الإعدادات", icon: Settings },
          { id: "reports" as const, label: "التقارير", icon: FileText },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setActivePage("");
              setCurrentPage(1);
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-orange-500 text-orange-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-page header (shown when a specific page is open inside a section) */}
      {activePage && (
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between">
          <button
            onClick={() => { setActivePage(""); setCurrentPage(1); setSearchQuery(""); setSelectedWarehouse("all"); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-xs transition-all border border-slate-200"
          >
            <ChevronRight className="w-4 h-4" /> رجوع لقائمة {activeTab === "features" ? "الخصائص" : activeTab === "settings" ? "الإعدادات" : "التقارير"}
          </button>
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            {(() => {
              const card = dashboardCards.find(c => c.id === activePage);
              if (!card) return null;
              const Icon = card.icon;
              return <><Icon className={`w-4 h-4 ${card.iconBg.split(" ")[1]}`} /> {card.label}</>;
            })()}
          </h2>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-6">
        {/* ─── قسم الخصائص ─── */}
        {activeTab === "features" && !activePage && (
          <div className="space-y-6">
            {(() => {
              const sections = Array.from(new Set(dashboardCards.filter(c => c.section === "الإدارة" || c.section === "العمليات").map(c => c.section)));
              return sections.map(section => (
                <div key={section} className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                    <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                    {section}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dashboardCards.filter(c => c.section === section).map(card => {
                      const Icon = card.icon;
                      return (
                        <motion.button
                          key={card.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -3 }}
                          onClick={() => {
                            setActiveFeature(card.id);
                            setActivePage(card.id);
                            setCurrentPage(1);
                            setSearchQuery("");
                            setSelectedWarehouse("all");
                          }}
                          className="bg-white rounded-2xl border border-slate-200 p-4 text-right hover:shadow-lg hover:border-orange-200 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.iconBg} group-hover:scale-110 transition-transform`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-orange-500 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm mb-1">{card.label}</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        {activeTab === "features" && activePage && renderPage(activePage)}

        {/* ─── قسم الإعدادات ─── */}
        {activeTab === "settings" && (
          <InventorySettingsView
            initialSubTab={activePage || "general"}
            warehouses={warehouses}
            onNotify={showToast}
            onRefreshData={fetchData}
          />
        )}

        {/* ─── قسم التقارير ─── */}
        {activeTab === "reports" && (
          <InventoryReportsView
            initialReportId={activePage || "reports"}
            warehouses={warehouses}
            ingredients={ingredients}
            inventoryItems={inventoryItems}
            transactions={transactions}
            transfers={transfers}
            suppliers={suppliers}
            valuation={valuation}
            onNotify={showToast}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-2xl font-bold text-white flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600" : toast.type === "error" ? "bg-red-600" : "bg-blue-600"}`}>
          {toast.type === "success" && <CheckCircle className="w-5 h-5" />}
          {toast.type === "error" && <XCircle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      {/* === MODALS === */}
      {/* Warehouse Modal */}
      {showWarehouseModal && editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><WarehouseIcon className="w-5 h-5 text-orange-600" /> {editingWarehouse.id ? "تعديل مخزن" : "إضافة مخزن جديد"}</h2>
              <button onClick={() => setShowWarehouseModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">اسم المخزن *</label><input required value={editingWarehouse.name || ""} onChange={e => setEditingWarehouse({ ...editingWarehouse, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div>
                  <label className="text-sm text-slate-500 font-bold">كود المخزن *</label>
                  <input
                    required={Boolean(editingWarehouse.id)}
                    readOnly={!editingWarehouse.id}
                    value={editingWarehouse.code || ""}
                    onChange={e => setEditingWarehouse({ ...editingWarehouse, code: e.target.value })}
                    placeholder={editingWarehouse.id ? "" : "يتولد تلقائيًا"}
                    className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none ${editingWarehouse.id ? "bg-slate-50 border-slate-200 focus:border-orange-500" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"}`}
                  />
                  {!editingWarehouse.id && <p className="text-[10px] text-slate-500 mt-1">تسلسل تلقائي — يُحدَّد عند الحفظ</p>}
                </div>
                <div><label className="text-sm text-slate-500 font-bold">نوع المخزن</label>
                  <select value={editingWarehouse.type || "main"} onChange={e => setEditingWarehouse({ ...editingWarehouse, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-500 font-bold">الفرع</label>
                  <select value={editingWarehouse.branch_id || ""} onChange={e => setEditingWarehouse({ ...editingWarehouse, branch_id: e.target.value ? Number(e.target.value) : undefined })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    <option value="">—</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-500 font-bold">المسؤول</label><input value={editingWarehouse.manager || ""} onChange={e => setEditingWarehouse({ ...editingWarehouse, manager: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الحالة</label>
                  <select value={editingWarehouse.status || "active"} onChange={e => setEditingWarehouse({ ...editingWarehouse, status: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    <option value="active">نشط</option><option value="inactive">موقف</option><option value="archived">مؤرشف</option>
                  </select>
                </div>
                <div className="col-span-2 p-4 bg-orange-50/50 rounded-2xl border border-orange-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-orange-950 flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-orange-600" /> الربط بموديول النظام (System Module Integration)
                    </label>
                    <span className="text-[11px] text-orange-700/80 bg-orange-100/70 px-2 py-0.5 rounded-full font-bold">
                      ربط تلقائي بالعمليات
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-600 font-bold block mb-1">الموديول المرتبط بهذا المخزن</label>
                      <select
                        value={editingWarehouse.linked_module || "general"}
                        onChange={e => setEditingWarehouse({ ...editingWarehouse, linked_module: e.target.value })}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-orange-500 shadow-sm"
                      >
                        {SYSTEM_MODULES.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {SYSTEM_MODULES.find(m => m.id === (editingWarehouse.linked_module || "general"))?.desc}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-orange-100">
                        <input
                          type="checkbox"
                          checked={editingWarehouse.is_module_default ?? false}
                          onChange={e => setEditingWarehouse({ ...editingWarehouse, is_module_default: e.target.checked })}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">المخزن الافتراضي لهذا الموديول</span>
                          <span className="text-[10px] text-slate-500">يتم اختياره تلقائياً عند طلب أو صرف مستلزمات هذا الموديول</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-orange-100">
                        <input
                          type="checkbox"
                          checked={editingWarehouse.auto_sync ?? true}
                          onChange={e => setEditingWarehouse({ ...editingWarehouse, auto_sync: e.target.checked })}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">مزامنة وخصم تلقائي مع الموديول</span>
                          <span className="text-[10px] text-slate-500">خصم وإضافة الأرصدة آلياً مع حركات الموديول المباشرة</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="col-span-2"><label className="text-sm text-slate-500 font-bold">العنوان</label><input value={editingWarehouse.address || ""} onChange={e => setEditingWarehouse({ ...editingWarehouse, address: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div className="col-span-2"><label className="text-sm text-slate-500 font-bold">الوصف</label><textarea value={editingWarehouse.description || ""} onChange={e => setEditingWarehouse({ ...editingWarehouse, description: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 h-16" /></div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingWarehouse.allow_negative || false} onChange={e => setEditingWarehouse({ ...editingWarehouse, allow_negative: e.target.checked })} /><span className="text-sm font-bold text-slate-700">السماح بالسالب</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingWarehouse.is_default || false} onChange={e => setEditingWarehouse({ ...editingWarehouse, is_default: e.target.checked })} /><span className="text-sm font-bold text-slate-700">مخزن افتراضي عام للنظام</span></label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowWarehouseModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="button" onClick={handleSaveWarehouseAction} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors">{editingWarehouse.id ? "تحديث" : "حفظ"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Ingredients from Excel Modal */}
      {showImportIngredientsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Download className="w-5 h-5 text-blue-600" /> استيراد الأصناف من Excel</h2>
                <p className="text-xs text-slate-500 mt-1">ارفع شيت يحتوي على عمود واحد باسم <strong>الصنف</strong> وسيتم إنشاء كود صنف تلقائي لكل صنف.</p>
              </div>
              <button onClick={() => setShowImportIngredientsModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button type="button" onClick={downloadIngredientTemplate} className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold">
                  <Download className="w-4 h-4" /> تحميل نموذج Excel
                </button>
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer shadow-lg shadow-blue-600/20">
                  <Upload className="w-4 h-4" /> اختيار ملف Excel
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleIngredientExcelFile(file); e.currentTarget.value = ""; }} />
                </label>
              </div>

              {importFileName && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
                  <span className="font-bold text-blue-800">الملف:</span> <span className="text-blue-700">{importFileName}</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-slate-700">الأصناف التي سيتم إنشاؤها</span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-black">{(importIngredientNames || []).length} صنف</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {(importIngredientNames || []).length ? (
                    <table className="w-full text-right text-sm">
                      <thead className="bg-white border-b border-slate-100 sticky top-0"><tr><th className="p-3 text-center text-slate-500">#</th><th className="p-3 text-right text-slate-500">الصنف</th><th className="p-3 text-center text-slate-500">كود الصنف</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(importIngredientNames || []).slice(0, 200).map((name, idx) => (
                          <tr key={`${name}-${idx}`}><td className="p-3 text-center text-slate-400">{idx + 1}</td><td className="p-3 font-bold text-slate-800">{name}</td><td className="p-3 text-center font-mono text-orange-500">سيُنشأ تلقائيًا</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-bold">لم يتم اختيار ملف بعد</p>
                      <p className="text-xs mt-1">يجب أن يكون اسم العمود الأول: الصنف</p>
                    </div>
                  )}
                </div>
                {(importIngredientNames || []).length > 200 && <div className="px-4 py-2 bg-amber-50 text-amber-700 text-xs font-bold">يتم عرض أول 200 صنف فقط في المعاينة، وسيتم استيراد {(importIngredientNames || []).length} صنف بالكامل.</div>}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-6">
                <strong className="text-slate-800">ملاحظات:</strong> سيتم تخطي الصفوف الفارغة والتكرارات الموجودة داخل الشيت، كما سيتم تخطي الصنف الموجود بالفعل في النظام بدلًا من إنشاء نسخة مكررة. كل صنف جديد يحصل على كود تلقائي وفريد.
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex gap-3">
              <button type="button" onClick={() => setShowImportIngredientsModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
              <button type="button" disabled={!(importIngredientNames || []).length || isImportingIngredients} onClick={handleImportIngredients} className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2">
                {isImportingIngredients ? <><RefreshCw className="w-4 h-4 animate-spin" /> جاري الإنشاء...</> : <><CheckCircle className="w-4 h-4" /> إنشاء الأصناف على السيستم</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredient Modal */}
      {showIngredientModal && editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /> {editingIngredient.id ? "تعديل صنف" : "إضافة صنف جديد"}</h2>
              <button onClick={() => setShowIngredientModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">اسم الصنف *</label><input required value={editingIngredient.name || ""} onChange={e => setEditingIngredient({ ...editingIngredient, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الكود</label><input value={editingIngredient.code || ""} onChange={e => setEditingIngredient({ ...editingIngredient, code: e.target.value })} placeholder="تلقائي" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الوحدة</label>
                  <select value={editingIngredient.unit || "قطعة"} onChange={e => setEditingIngredient({ ...editingIngredient, unit: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    {["قطعة", "كجم", "جرام", "لتر", "ملل", "علبة", "كرتون", "متر", "باكت"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-500 font-bold">الباركود</label><input value={editingIngredient.barcode || ""} onChange={e => setEditingIngredient({ ...editingIngredient, barcode: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 font-mono" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الفئة</label><input value={editingIngredient.category || ""} onChange={e => setEditingIngredient({ ...editingIngredient, category: e.target.value })} placeholder="عام" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">حد الطلب (min)</label><input type="number" value={editingIngredient.min_stock || 0} onChange={e => setEditingIngredient({ ...editingIngredient, min_stock: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">أقصى مخزون (max)</label><input type="number" value={editingIngredient.max_stock || 0} onChange={e => setEditingIngredient({ ...editingIngredient, max_stock: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">نقطة إعادة الطلب</label><input type="number" value={editingIngredient.reorder_point || 0} onChange={e => setEditingIngredient({ ...editingIngredient, reorder_point: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">آخر سعر شراء</label><input type="number" step="0.01" value={editingIngredient.last_purchase_price || 0} onChange={e => setEditingIngredient({ ...editingIngredient, last_purchase_price: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">متوسط التكلفة</label><input type="number" step="0.01" value={editingIngredient.avg_cost || 0} onChange={e => setEditingIngredient({ ...editingIngredient, avg_cost: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowIngredientModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="button" onClick={handleSaveIngredientAction} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors">{editingIngredient.id ? "تحديث" : "حفظ"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-purple-600" /> حركة مخزنية جديدة</h2>
              <button onClick={() => setShowTransactionModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const txNumber = `TX-${String(transactions.length + 1).padStart(5, "0")}`;
                const res = await api.post("/api/inventory-transactions", {
                  ...txForm,
                  transaction_number: txNumber, user: "admin",
                  warehouse_id: Number(txForm.warehouse_id),
                  supplier_id: txForm.supplier_id ? Number(txForm.supplier_id) : null,
                });
                if (res.ok) {
                  showToast("تم حفظ الحركة وتحديث الأرصدة");
                  setShowTransactionModal(false);
                  setTxForm({ type: "receive", warehouse_id: "", reason: "", reference: "", notes: "", date: new Date().toISOString().split("T")[0], items: [], supplier_id: "", status: "approved" });
                  setTxItemSearch("");
                  fetchData();
                } else { showToast("فشل الحفظ", "error"); }
              } catch (err) { showToast("خطأ في الاتصال", "error"); }
            }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">نوع الحركة</label>
                  <select value={txForm.type ?? ""} onChange={e => setTxForm({ ...txForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    {Object.entries(TX_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-500 font-bold">المخزن *</label>
                  <select required value={txForm.warehouse_id ?? ""} onChange={e => setTxForm({ ...txForm, warehouse_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    <option value="">اختر</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-500 font-bold">التاريخ</label><input type="date" required value={txForm.date ?? ""} onChange={e => setTxForm({ ...txForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                {txForm.type === "receive" && (
                  <div><label className="text-sm text-slate-500 font-bold">المورد</label>
                    <select value={txForm.supplier_id ?? ""} onChange={e => setTxForm({ ...txForm, supplier_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                      <option value="">—</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="text-sm text-slate-500 font-bold">السبب</label><input value={txForm.reason ?? ""} onChange={e => setTxForm({ ...txForm, reason: e.target.value })} placeholder="شراء/صرف/إلخ" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">المرجع</label><input value={txForm.reference ?? ""} onChange={e => setTxForm({ ...txForm, reference: e.target.value })} placeholder="رقم الفاتورة" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الحالة</label>
                  <select value={txForm.status ?? ""} onChange={e => setTxForm({ ...txForm, status: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500">
                    <option value="approved">معتمد (تطبيق فوري)</option>
                    <option value="pending">قيد الانتظار</option>
                  </select>
                </div>
              </div>
              <div><label className="text-sm text-slate-500 font-bold">ملاحظات</label><input value={txForm.notes ?? ""} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              {/* Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-700">الأصناف</span>
                  <div className="relative flex-1 min-w-[280px] max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث باسم الصنف أو الكود أو الباركود..."
                      value={txItemSearch ?? ""}
                      onChange={e => setTxItemSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    {txItemSearch.trim() && (() => {
                      const q = txItemSearch.trim().toLowerCase();
                      const matches = ingredients
                        .filter(ing => {
                          if (!q) return false;
                          const name = (ing.name || "").toLowerCase();
                          const code = (ing.code || "").toLowerCase();
                          const barcode = (ing.barcode || "").toLowerCase();
                          const category = (ing.category || "").toLowerCase();
                          return name.includes(q) || code.includes(q) || barcode.includes(q) || category.includes(q);
                        })
                        .filter(ing => !txForm.items.some(it => it.ingredient_id === ing.id)) // exclude already-added
                        .slice(0, 8);
                      if (matches.length === 0) return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 p-3 text-sm text-slate-400 text-center">
                          لا توجد أصناف مطابقة
                        </div>
                      );
                      return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 max-h-72 overflow-y-auto">
                          {matches.map(ing => (
                            <button
                              key={ing.id}
                              type="button"
                              onClick={() => {
                                setTxForm({ ...txForm, items: [...txForm.items, { ingredient_id: ing.id, name: ing.name, unit: ing.unit, quantity: 1, price: ing.last_purchase_price || ing.avg_cost || 0 }] });
                                setTxItemSearch("");
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-orange-50 border-b border-slate-100 last:border-0 text-right transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{ing.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {ing.code}{ing.barcode ? ` • ${ing.barcode}` : ""}{ing.category ? ` • ${ing.category}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-slate-500">{ing.unit}</span>
                                {Number(ing.min_stock) > 0 && <span className="text-[10px] text-slate-400">min: {ing.min_stock}</span>}
                                <Plus className="w-4 h-4 text-orange-600" />
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50">
                    <tr>{["الصنف", "الوحدة", "الكمية", "السعر", "الإجمالي", ""].map(h => <th key={h} className="p-2 font-bold text-slate-500 text-center">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {txForm.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold text-slate-700">{item.name}</td>
                        <td className="p-2 text-center text-slate-500">{item.unit}</td>
                        <td className="p-2 text-center"><input type="number" min="1" value={item.quantity ?? ""} onChange={e => { const items = [...txForm.items]; items[idx].quantity = Number(e.target.value); setTxForm({ ...txForm, items }); }} className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td>
                        <td className="p-2 text-center"><input type="number" step="0.01" value={item.price ?? ""} onChange={e => { const items = [...txForm.items]; items[idx].price = Number(e.target.value); setTxForm({ ...txForm, items }); }} className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td>
                        <td className="p-2 text-center font-bold text-slate-700">{(item.quantity * item.price).toFixed(2)}</td>
                        <td className="p-2 text-center"><button type="button" onClick={() => setTxForm({ ...txForm, items: txForm.items.filter((_, i) => i !== idx) })} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                      </tr>
                    ))}
                    {txForm.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">أضف أصناف للحركة — ابحث بالاسم أو الكود أو الباركود بالأعلى</td></tr>}
                  </tbody>
                  {txForm.items.length > 0 && (
                    <tfoot className="bg-slate-50">
                      <tr><td colSpan={4} className="p-3 text-right font-bold text-slate-700">الإجمالي:</td><td className="p-3 text-center font-black text-purple-700">{txForm.items.reduce((s, i) => s + i.quantity * i.price, 0).toFixed(2)} ج.م</td><td></td></tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTransactionModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={txForm.items.length === 0} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50">حفظ الحركة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-cyan-600" /> تحويل بين المخازن</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const trfNumber = `TRF-${String(transfers.length + 1).padStart(3, "0")}`;
                const res = await api.post("/api/warehouse-transfers", { ...transferForm, transfer_number: trfNumber, user: "admin", from_warehouse_id: Number(transferForm.from_warehouse_id), to_warehouse_id: Number(transferForm.to_warehouse_id) });
                if (res.ok) { showToast("تم إنشاء التحويل"); setShowTransferModal(false); setTransferForm({ from_warehouse_id: "", to_warehouse_id: "", notes: "", date: new Date().toISOString().split("T")[0], items: [], status: "pending" }); setTransferItemSearch(""); fetchData(); }
                else { showToast("فشل الإنشاء", "error"); }
              } catch (err) { showToast("خطأ في الاتصال", "error"); }
            }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">من مخزن</label><select required value={transferForm.from_warehouse_id ?? ""} onChange={e => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="">اختر</option>{warehouses.map(w => <option key={w.id} value={w.id ?? ""}>{w.name}</option>)}</select></div>
                <div className="flex items-center justify-center pt-6"><ArrowRightLeft className="w-8 h-8 text-orange-400" /></div>
                <div><label className="text-sm text-slate-500 font-bold">إلى مخزن</label><select required value={transferForm.to_warehouse_id ?? ""} onChange={e => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="">اختر</option>{warehouses.map(w => <option key={w.id} value={w.id ?? ""}>{w.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">التاريخ</label><input type="date" required value={transferForm.date ?? ""} onChange={e => setTransferForm({ ...transferForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الحالة</label><select value={transferForm.status ?? ""} onChange={e => setTransferForm({ ...transferForm, status: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="pending">قيد الانتظار</option><option value="received">معتمد (تطبيق فوري)</option></select></div>
              </div>
              <div><label className="text-sm text-slate-500 font-bold">ملاحظات</label><input value={transferForm.notes ?? ""} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              {/* Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-700">الأصناف</span>
                  <div className="relative flex-1 min-w-[280px] max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث باسم الصنف أو الكود أو الباركود..."
                      value={transferItemSearch ?? ""}
                      onChange={e => setTransferItemSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    {transferItemSearch.trim() && (() => {
                      const q = transferItemSearch.trim().toLowerCase();
                      const matches = ingredients
                        .filter(ing => {
                          if (!q) return false;
                          return (ing.name || "").toLowerCase().includes(q) ||
                                 (ing.code || "").toLowerCase().includes(q) ||
                                 (ing.barcode || "").toLowerCase().includes(q) ||
                                 (ing.category || "").toLowerCase().includes(q);
                        })
                        .filter(ing => !transferForm.items.some(it => it.ingredient_id === ing.id))
                        .slice(0, 8);
                      if (matches.length === 0) return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 p-3 text-sm text-slate-400 text-center">
                          لا توجد أصناف مطابقة
                        </div>
                      );
                      return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 max-h-72 overflow-y-auto">
                          {matches.map(ing => (
                            <button key={ing.id} type="button"
                              onClick={() => {
                                setTransferForm({ ...transferForm, items: [...transferForm.items, { ingredient_id: ing.id, name: ing.name, unit: ing.unit, quantity: 1 }] });
                                setTransferItemSearch("");
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-orange-50 border-b border-slate-100 last:border-0 text-right transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{ing.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {ing.code}{ing.barcode ? ` • ${ing.barcode}` : ""}{ing.category ? ` • ${ing.category}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-slate-500">{ing.unit}</span>
                                <Plus className="w-4 h-4 text-orange-600" />
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50"><tr>{["الصنف", "الوحدة", "الكمية", ""].map(h => <th key={h} className="p-2 font-bold text-slate-500 text-center">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {transferForm.items.map((item, idx) => (
                      <tr key={idx}><td className="p-2 font-bold text-slate-700">{item.name}</td><td className="p-2 text-center text-slate-500">{item.unit}</td><td className="p-2 text-center"><input type="number" min="1" value={item.quantity ?? ""} onChange={e => { const items = [...transferForm.items]; items[idx].quantity = Number(e.target.value); setTransferForm({ ...transferForm, items }); }} className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td><td className="p-2 text-center"><button type="button" onClick={() => setTransferForm({ ...transferForm, items: transferForm.items.filter((_, i) => i !== idx) })} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td></tr>
                    ))}
                    {transferForm.items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">أضف أصناف للتحويل</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={transferForm.items.length === 0} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50">تحويل</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Count Modal */}
      {showCountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calculator className="w-5 h-5 text-amber-600" /> جرد جديد</h2>
              <button onClick={() => setShowCountModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const txNumber = `CNT-${String(transactions.length + 1).padStart(4, "0")}`;
                const items = countForm.items.filter(i => Number(i.actual_qty) !== Number(i.book_qty)).map(i => ({ ingredient_id: i.ingredient_id, name: i.name, unit: i.unit, quantity: Number(i.actual_qty), diff: Number(i.actual_qty) - Number(i.book_qty), price: 0 }));
                if (items.length === 0) { showToast("لا توجد فروقات للجرد", "info"); return; }
                const res = await api.post("/api/inventory-transactions", {
                  transaction_number: txNumber, date: countForm.date, warehouse_id: Number(countForm.warehouse_id),
                  type: "count", reason: "جرد", user: "admin", status: "approved", notes: countForm.notes, items,
                });
                if (res.ok) {
                  showToast(`تم اعتماد الجرد وتحديث ${items.length} صنف`);
                  setShowCountModal(false);
                  setCountForm({ warehouse_id: "", notes: "", date: new Date().toISOString().split("T")[0], items: [] });
                  fetchData();
                }
              } catch (err) { showToast("خطأ في الاتصال", "error"); }
            }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">المخزن</label><select required value={countForm.warehouse_id ?? ""} onChange={e => { const whId = Number(e.target.value); const items = inventoryItems.filter(i => i.warehouse_id === whId).map(i => ({ ingredient_id: i.ingredient_id, name: i.ingredient_name, unit: i.ingredient_unit, book_qty: i.quantity, actual_qty: i.quantity })); setCountForm({ ...countForm, warehouse_id: e.target.value, items }); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="">اختر المخزن</option>{warehouses.map(w => <option key={w.id} value={w.id ?? ""}>{w.name}</option>)}</select></div>
                <div><label className="text-sm text-slate-500 font-bold">التاريخ</label><input type="date" required value={countForm.date ?? ""} onChange={e => setCountForm({ ...countForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">ملاحظات</label><input value={countForm.notes ?? ""} onChange={e => setCountForm({ ...countForm, notes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              </div>
              {countForm.items.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50"><tr>{["الصنف", "الوحدة", "الكمية الدفترية", "الكمية الفعلية", "الفرق"].map(h => <th key={h} className="p-2 font-bold text-slate-500 text-center">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {countForm.items.map((item, idx) => { const diff = item.actual_qty - item.book_qty; return (
                        <tr key={idx}><td className="p-2 font-bold text-slate-700">{item.name}</td><td className="p-2 text-center text-slate-500">{item.unit}</td><td className="p-2 text-center font-bold">{item.book_qty}</td><td className="p-2 text-center"><input type="number" value={item.actual_qty ?? ""} onChange={e => { const items = [...countForm.items]; items[idx].actual_qty = Number(e.target.value); setCountForm({ ...countForm, items }); }} className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td><td className={`p-2 text-center font-bold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-emerald-600" : "text-slate-400"}`}>{diff > 0 ? "+" : ""}{diff}</td></tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCountModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={countForm.items.length === 0} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50">اعتماد الجرد</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Edit2 className="w-5 h-5 text-indigo-600" /> تسوية جديدة</h2>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const txNumber = `ADJ-${String(transactions.length + 1).padStart(4, "0")}`;
                const items = adjForm.items.map(it => ({
                  ingredient_id: it.ingredient_id, name: it.name, unit: it.unit,
                  quantity: Number(it.quantity), price: Number(it.price),
                  diff: adjForm.type === "increase" ? Number(it.quantity) : adjForm.type === "decrease" ? -Number(it.quantity) : 0,
                }));
                const res = await api.post("/api/inventory-transactions", {
                  transaction_number: txNumber, date: adjForm.date, warehouse_id: Number(adjForm.warehouse_id),
                  type: "adjustment", reason: adjForm.reason || "تسوية", user: "admin", status: "approved", notes: adjForm.notes, items,
                });
                if (res.ok) {
                  showToast("تم اعتماد التسوية وتحديث الأرصدة");
                  setShowAdjustmentModal(false);
                  setAdjForm({ warehouse_id: "", type: "increase", reason: "", notes: "", date: new Date().toISOString().split("T")[0], items: [] });
                  setAdjItemSearch("");
                  fetchData();
                }
              } catch (err) { showToast("خطأ في الاتصال", "error"); }
            }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">المخزن</label><select required value={adjForm.warehouse_id ?? ""} onChange={e => setAdjForm({ ...adjForm, warehouse_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="">اختر</option>{warehouses.map(w => <option key={w.id} value={w.id ?? ""}>{w.name}</option>)}</select></div>
                <div><label className="text-sm text-slate-500 font-bold">نوع التسوية</label><select value={adjForm.type ?? ""} onChange={e => setAdjForm({ ...adjForm, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="increase">زيادة كمية</option><option value="decrease">نقص كمية</option><option value="cost">تعديل تكلفة</option></select></div>
                <div><label className="text-sm text-slate-500 font-bold">السبب</label><input value={adjForm.reason ?? ""} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">التاريخ</label><input type="date" required value={adjForm.date ?? ""} onChange={e => setAdjForm({ ...adjForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              </div>
              <div><label className="text-sm text-slate-500 font-bold">ملاحظات</label><textarea value={adjForm.notes ?? ""} onChange={e => setAdjForm({ ...adjForm, notes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 h-16" /></div>
              {/* Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-700">الأصناف</span>
                  <div className="relative flex-1 min-w-[280px] max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث باسم الصنف أو الكود أو الباركود..."
                      value={adjItemSearch ?? ""}
                      onChange={e => setAdjItemSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    {adjItemSearch.trim() && (() => {
                      const q = adjItemSearch.trim().toLowerCase();
                      const matches = ingredients
                        .filter(ing => {
                          if (!q) return false;
                          return (ing.name || "").toLowerCase().includes(q) ||
                                 (ing.code || "").toLowerCase().includes(q) ||
                                 (ing.barcode || "").toLowerCase().includes(q) ||
                                 (ing.category || "").toLowerCase().includes(q);
                        })
                        .filter(ing => !adjForm.items.some(it => it.ingredient_id === ing.id))
                        .slice(0, 8);
                      if (matches.length === 0) return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 p-3 text-sm text-slate-400 text-center">
                          لا توجد أصناف مطابقة
                        </div>
                      );
                      return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 max-h-72 overflow-y-auto">
                          {matches.map(ing => (
                            <button key={ing.id} type="button"
                              onClick={() => {
                                setAdjForm({ ...adjForm, items: [...adjForm.items, { ingredient_id: ing.id, name: ing.name, unit: ing.unit, quantity: 0, price: ing.avg_cost || 0 }] });
                                setAdjItemSearch("");
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-orange-50 border-b border-slate-100 last:border-0 text-right transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{ing.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {ing.code}{ing.barcode ? ` • ${ing.barcode}` : ""}{ing.category ? ` • ${ing.category}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-slate-500">{ing.unit}</span>
                                <Plus className="w-4 h-4 text-orange-600" />
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50"><tr>{["الصنف", "الكمية", "السعر", "الإجمالي", ""].map(h => <th key={h} className="p-2 font-bold text-slate-500 text-center">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {adjForm.items.map((item, idx) => (
                      <tr key={idx}><td className="p-2 font-bold text-slate-700">{item.name}</td><td className="p-2 text-center"><input type="number" value={item.quantity ?? ""} onChange={e => { const items = [...adjForm.items]; items[idx].quantity = Number(e.target.value); setAdjForm({ ...adjForm, items }); }} className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td><td className="p-2 text-center"><input type="number" step="0.01" value={item.price ?? ""} onChange={e => { const items = [...adjForm.items]; items[idx].price = Number(e.target.value); setAdjForm({ ...adjForm, items }); }} className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td><td className="p-2 text-center font-bold">{(item.quantity * item.price).toFixed(2)}</td><td className="p-2 text-center"><button type="button" onClick={() => setAdjForm({ ...adjForm, items: adjForm.items.filter((_, i) => i !== idx) })} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td></tr>
                    ))}
                    {adjForm.items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">أضف أصناف للتسوية</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={adjForm.items.length === 0} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50">اعتماد التسوية</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Damaged Modal */}
      {showDamagedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-red-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> تسجيل هالك / تالف</h2>
              <button onClick={() => setShowDamagedModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const txNumber = `DMG-${String(transactions.length + 1).padStart(4, "0")}`;
                const items = dmgForm.items.map(it => ({ ingredient_id: it.ingredient_id, name: it.name, unit: it.unit, quantity: Number(it.quantity), price: Number(it.price), cost: Number(it.quantity) * Number(it.price) }));
                const res = await api.post("/api/inventory-transactions", {
                  transaction_number: txNumber, date: dmgForm.date, warehouse_id: Number(dmgForm.warehouse_id),
                  type: "damaged", reason: dmgForm.reason, user: "admin", status: "approved", notes: dmgForm.notes, items,
                });
                if (res.ok) {
                  showToast("تم تسجيل الهالك وتحديث الأرصدة");
                  setShowDamagedModal(false);
                  setDmgForm({ warehouse_id: "", reason: "", notes: "", date: new Date().toISOString().split("T")[0], items: [] });
                  setDmgItemSearch("");
                  fetchData();
                }
              } catch (err) { showToast("خطأ في الاتصال", "error"); }
            }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">المخزن</label><select required value={dmgForm.warehouse_id ?? ""} onChange={e => setDmgForm({ ...dmgForm, warehouse_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="">اختر</option>{warehouses.map(w => <option key={w.id} value={w.id ?? ""}>{w.name}</option>)}</select></div>
                <div><label className="text-sm text-slate-500 font-bold">سبب الهالك</label><select required value={dmgForm.reason ?? ""} onChange={e => setDmgForm({ ...dmgForm, reason: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500"><option value="">—</option><option value="انتهاء الصلاحية">انتهاء الصلاحية</option><option value="تلف">تلف</option><option value="كسر">كسر</option><option value="فقدان">فقدان</option><option value="أخرى">أخرى</option></select></div>
                <div><label className="text-sm text-slate-500 font-bold">التاريخ</label><input type="date" required value={dmgForm.date ?? ""} onChange={e => setDmgForm({ ...dmgForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              </div>
              <div><label className="text-sm text-slate-500 font-bold">ملاحظات</label><textarea value={dmgForm.notes ?? ""} onChange={e => setDmgForm({ ...dmgForm, notes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 h-16" /></div>
              {/* Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-700">الأصناف التالفة</span>
                  <div className="relative flex-1 min-w-[280px] max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث باسم الصنف أو الكود أو الباركود..."
                      value={dmgItemSearch ?? ""}
                      onChange={e => setDmgItemSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    {dmgItemSearch.trim() && (() => {
                      const q = dmgItemSearch.trim().toLowerCase();
                      const matches = ingredients
                        .filter(ing => {
                          if (!q) return false;
                          return (ing.name || "").toLowerCase().includes(q) ||
                                 (ing.code || "").toLowerCase().includes(q) ||
                                 (ing.barcode || "").toLowerCase().includes(q) ||
                                 (ing.category || "").toLowerCase().includes(q);
                        })
                        .filter(ing => !dmgForm.items.some(it => it.ingredient_id === ing.id))
                        .slice(0, 8);
                      if (matches.length === 0) return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 p-3 text-sm text-slate-400 text-center">
                          لا توجد أصناف مطابقة
                        </div>
                      );
                      return (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-10 max-h-72 overflow-y-auto">
                          {matches.map(ing => (
                            <button key={ing.id} type="button"
                              onClick={() => {
                                setDmgForm({ ...dmgForm, items: [...dmgForm.items, { ingredient_id: ing.id, name: ing.name, unit: ing.unit, quantity: 1, price: ing.avg_cost || 0, cost: ing.avg_cost || 0 }] });
                                setDmgItemSearch("");
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-orange-50 border-b border-slate-100 last:border-0 text-right transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{ing.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {ing.code}{ing.barcode ? ` • ${ing.barcode}` : ""}{ing.category ? ` • ${ing.category}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-slate-500">{ing.unit}</span>
                                <Plus className="w-4 h-4 text-orange-600" />
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50"><tr>{["الصنف", "الكمية", "التكلفة", "الإجمالي", ""].map(h => <th key={h} className="p-2 font-bold text-slate-500 text-center">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {dmgForm.items.map((item, idx) => (
                      <tr key={idx}><td className="p-2 font-bold text-slate-700">{item.name}</td><td className="p-2 text-center"><input type="number" min="1" value={item.quantity ?? ""} onChange={e => { const items = [...dmgForm.items]; items[idx].quantity = Number(e.target.value); items[idx].cost = items[idx].quantity * items[idx].price; setDmgForm({ ...dmgForm, items }); }} className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td><td className="p-2 text-center"><input type="number" step="0.01" value={item.price ?? ""} onChange={e => { const items = [...dmgForm.items]; items[idx].price = Number(e.target.value); items[idx].cost = items[idx].quantity * items[idx].price; setDmgForm({ ...dmgForm, items }); }} className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-orange-500" /></td><td className="p-2 text-center font-bold text-red-600">{item.cost.toFixed(2)}</td><td className="p-2 text-center"><button type="button" onClick={() => setDmgForm({ ...dmgForm, items: dmgForm.items.filter((_, i) => i !== idx) })} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td></tr>
                    ))}
                    {dmgForm.items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">أضف أصناف تالفة</td></tr>}
                  </tbody>
                  {dmgForm.items.length > 0 && (
                    <tfoot className="bg-red-50"><tr><td colSpan={3} className="p-3 text-right font-bold text-red-700">إجمالي تكلفة الهالك:</td><td className="p-3 text-center font-black text-red-700">{dmgForm.items.reduce((s, i) => s + i.cost, 0).toFixed(2)} ج.م</td><td></td></tr></tfoot>
                  )}
                </table>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDamagedModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={dmgForm.items.length === 0} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50">تسجيل الهالك</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-pink-600" /> {editingSupplier.id ? "تعديل مورد" : "إضافة مورد جديد"}</h2>
              <button onClick={() => setShowSupplierModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); }} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-slate-500 font-bold">اسم المورد *</label><input required value={editingSupplier.name || ""} onChange={e => setEditingSupplier({ ...editingSupplier, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الكود</label><input value={editingSupplier.code || ""} onChange={e => setEditingSupplier({ ...editingSupplier, code: e.target.value })} placeholder="تلقائي" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">مسؤول الاتصال</label><input value={editingSupplier.contact_person || ""} onChange={e => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الهاتف</label><input value={editingSupplier.phone || ""} onChange={e => setEditingSupplier({ ...editingSupplier, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">البريد الإلكتروني</label><input type="email" value={editingSupplier.email || ""} onChange={e => setEditingSupplier({ ...editingSupplier, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الرقم الضريبي</label><input value={editingSupplier.tax_number || ""} onChange={e => setEditingSupplier({ ...editingSupplier, tax_number: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 font-mono" /></div>
                <div className="col-span-2"><label className="text-sm text-slate-500 font-bold">العنوان</label><input value={editingSupplier.address || ""} onChange={e => setEditingSupplier({ ...editingSupplier, address: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">الرصيد الافتتاحي</label><input type="number" step="0.01" value={editingSupplier.balance || 0} onChange={e => setEditingSupplier({ ...editingSupplier, balance: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
                <div><label className="text-sm text-slate-500 font-bold">ملاحظات</label><input value={editingSupplier.notes || ""} onChange={e => setEditingSupplier({ ...editingSupplier, notes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                <button type="button" onClick={handleSaveSupplierAction} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors">{editingSupplier.id ? "تحديث" : "حفظ"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History Modal */}
      {showMovementHistoryModal && historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-purple-600" /> سجل حركات: {historyItem.name}</h2>
              <button onClick={() => setShowMovementHistoryModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const itemMovements = movements.filter(m => Number(m.ingredient_id) === Number(historyItem.id));
                return itemMovements.length > 0 ? (
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50">
                      <tr>{["التاريخ", "المخزن", "النوع", "قبل", "التغير", "بعد", "المستخدم", "ملاحظات"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemMovements.map(m => (
                        <tr key={m.id}>
                          <td className="p-3 text-xs text-slate-500 text-center">{(m.created_at || "").substring(0, 16).replace("T", " ")}</td>
                          <td className="p-3 text-center text-slate-600">{m.warehouse_name}</td>
                          <td className="p-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{m.ref_type}</span></td>
                          <td className="p-3 text-center text-slate-500">{fmt(m.before_qty, 0)}</td>
                          <td className={`p-3 text-center font-bold ${Number(m.delta) > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(m.delta) > 0 ? "+" : ""}{fmt(m.delta, 0)}</td>
                          <td className="p-3 text-center font-bold text-slate-800">{fmt(m.after_qty, 0)}</td>
                          <td className="p-3 text-xs text-slate-500 text-center">{m.user}</td>
                          <td className="p-3 text-xs text-slate-400 text-center">{m.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <EmptyState icon={History} title="لا توجد حركات لهذا الصنف" subtitle="لم يتم تسجيل أي حركات بعد" />;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showTxDetailsModal && selectedTx && (() => {
        const tx = selectedTx as any;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Eye className="w-5 h-5 text-blue-600" /> تفاصيل الحركة {tx.transaction_number || `TXN-#${tx.id}`}</h2>
                <button onClick={() => setShowTxDetailsModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-slate-500">التاريخ:</span><p className="font-bold">{formatInventoryDate(tx.transaction_date || tx.date || tx.created_at, true)}</p></div>
                  <div><span className="text-slate-500">المخزن:</span><p className="font-bold">{tx.warehouse_name || warehouses.find(w => Number(w.id) === Number(tx.warehouse_id))?.name || "—"}</p></div>
                  <div><span className="text-slate-500">النوع:</span><p className="font-bold">{TX_TYPE_LABELS[tx.type] || tx.type}</p></div>
                  <div><span className="text-slate-500">السبب:</span><p className="font-bold">{tx.reason || "—"}</p></div>
                  <div><span className="text-slate-500">المرجع:</span><p className="font-bold">{tx.reference || tx.reference_no || "—"}</p></div>
                  <div><span className="text-slate-500">المستخدم:</span><p className="font-bold">{tx.user || "admin"}</p></div>
                  <div><span className="text-slate-500">الحالة:</span><p className="font-bold">{(STATUS_LABELS[tx.status] || STATUS_LABELS.approved)?.label || tx.status}</p></div>
                  <div className="col-span-2"><span className="text-slate-500">ملاحظات:</span><p className="font-bold">{tx.notes || "—"}</p></div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50"><tr>{["الصنف", "الكمية", "السعر", "الإجمالي"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const txItems = safeParseItems(tx.items);
                        const finalItems = txItems.length > 0 ? txItems : tx.ingredient_id ? [{
                          ingredient_id: tx.ingredient_id,
                          name: tx.ingredient_name || ingredients.find(g => Number(g.id) === Number(tx.ingredient_id))?.name || `صنف #${tx.ingredient_id}`,
                          unit: tx.unit || ingredients.find(g => Number(g.id) === Number(tx.ingredient_id))?.unit || "",
                          quantity: tx.quantity || 1,
                          price: tx.unit_cost || (tx.total_cost && tx.quantity ? Number(tx.total_cost) / Number(tx.quantity) : 0) || tx.price || 0
                        }] : [];
                        
                        return (
                          <>
                            {finalItems.map((it: any, i: number) => {
                              const itemName = it.name || it.ingredient_name || it.item_name || ingredients.find(g => Number(g.id) === Number(it.ingredient_id))?.name || `صنف #${it.ingredient_id || i + 1}`;
                              const itemUnit = it.unit || ingredients.find(g => Number(g.id) === Number(it.ingredient_id))?.unit || "";
                              const itemQty = Number(it.quantity || it.qty || 0);
                              const itemPrice = Number(it.price || it.unit_cost || it.cost || 0);
                              return (
                                <tr key={i}>
                                  <td className="p-3 font-bold text-slate-800">{itemName}</td>
                                  <td className="p-3 text-center">{itemQty} {itemUnit}</td>
                                  <td className="p-3 text-center">{fmtMoney(itemPrice)}</td>
                                  <td className="p-3 text-center font-bold">{fmtMoney(itemQty * itemPrice)}</td>
                                </tr>
                              );
                            })}
                            {finalItems.length === 0 && (
                              <tr><td colSpan={4} className="p-4 text-center text-slate-400">لا توجد تفاصيل للأصناف</td></tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Transfer Details Modal */}
      {showTransferDetailsModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Eye className="w-5 h-5 text-cyan-600" /> تفاصيل التحويل {selectedTransfer.transfer_number}</h2>
              <button onClick={() => setShowTransferDetailsModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-slate-500">التاريخ:</span><p className="font-bold">{selectedTransfer.date}</p></div>
                <div><span className="text-slate-500">من مخزن:</span><p className="font-bold text-red-600">{selectedTransfer.from_warehouse_name}</p></div>
                <div><span className="text-slate-500">إلى مخزن:</span><p className="font-bold text-emerald-600">{selectedTransfer.to_warehouse_name}</p></div>
                <div><span className="text-slate-500">المستخدم:</span><p className="font-bold">{selectedTransfer.user}</p></div>
                <div><span className="text-slate-500">الحالة:</span><p className="font-bold">{STATUS_LABELS[selectedTransfer.status]?.label || selectedTransfer.status}</p></div>
                <div className="col-span-3"><span className="text-slate-500">ملاحظات:</span><p className="font-bold">{selectedTransfer.notes || "—"}</p></div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50"><tr>{["الصنف", "الكمية", "الوحدة"].map(h => <th key={h} className="p-3 font-bold text-slate-500 text-center">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {safeParseItems(selectedTransfer.items).map((it, i) => (
                      <tr key={i}><td className="p-3 font-bold text-slate-800">{it.name || ingredients.find(g => g.id === it.ingredient_id)?.name || `صنف #${it.ingredient_id || i + 1}`}</td><td className="p-3 text-center font-bold">{it.quantity}</td><td className="p-3 text-center text-slate-500">{it.unit || ""}</td></tr>
                    ))}
                    {safeParseItems(selectedTransfer.items).length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-slate-400">لا توجد تفاصيل للأصناف</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {showBarcodeModal && selectedBarcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package className="w-5 h-5 text-violet-600" /> باركود الصنف</h2>
              <button onClick={() => setShowBarcodeModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 text-center space-y-4">
              <div className="bg-white border-4 border-slate-200 rounded-xl p-6 flex items-center justify-center">
                <BarcodeDisplay value={selectedBarcode.barcode || selectedBarcode.code} height={80} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{selectedBarcode.name}</h3>
                <p className="text-sm text-slate-500">{selectedBarcode.code} • {selectedBarcode.unit}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center gap-2 justify-center transition-colors"><Printer className="w-4 h-4" /> طباعة</button>
                <button onClick={() => setShowBarcodeModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowNotifications(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl max-h-[85vh] flex flex-col mt-16" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Bell className="w-5 h-5 text-orange-600" /> الإشعارات ({notifications.length})</h2>
              <div className="flex gap-2">
                <button onClick={async () => { await api.put("/api/inventory-notifications/read-all", {}); fetchData(); }} className="text-xs font-bold text-emerald-600 hover:underline">تعليم الكل كمقروء</button>
                <button onClick={() => setShowNotifications(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-bold">لا توجد إشعارات</p>
                </div>
              ) : notifications.map(n => (
                <div key={n.id} className={`p-3 rounded-xl border ${n.severity === "critical" ? "bg-red-50 border-red-200" : n.severity === "warning" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <AlertCircle className={`w-5 h-5 mt-0.5 ${n.severity === "critical" ? "text-red-600" : n.severity === "warning" ? "text-amber-600" : "text-blue-600"}`} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">{n.message}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{n.ingredient_name} • {n.warehouse_name} • {(n.created_at || "").substring(0, 16).replace("T", " ")}</p>
                      </div>
                    </div>
                    <button onClick={async () => { await api.put(`/api/inventory-notifications/${n.id}/read`); fetchData(); }} className="p-1 hover:bg-white/50 rounded text-slate-400 hover:text-emerald-600" title="تعليم كمقروء"><CheckCircle className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      {showGlobalSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowGlobalSearch(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl mt-20" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
              <Search className="w-5 h-5 text-slate-400" />
              <input autoFocus type="text" placeholder="ابحث في المخازن، الأصناف، الحركات، الموردين..." value={globalSearchQuery ?? ""}
                onChange={e => setGlobalSearchQuery(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none text-slate-800 text-lg" />
              <kbd className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded font-mono">ESC</kbd>
              <button onClick={() => setShowGlobalSearch(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {globalSearchQuery.length < 2 ? (
                <div className="text-center py-8 text-slate-400">
                  <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">اكتب حرفين على الأقل للبحث</p>
                </div>
              ) : (
                <>
                  {/* Search results across entities */}
                  {warehouses.filter(w => w.name.includes(globalSearchQuery) || w.code.includes(globalSearchQuery)).slice(0, 3).map(w => (
                    <button key={w.id} onClick={() => { setActiveFeature("main"); setActivePage("main"); setActiveTab("features"); setShowGlobalSearch(false); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-right">
                      <WarehouseIcon className="w-5 h-5 text-orange-600" />
                      <div className="flex-1"><p className="font-bold text-slate-800">{w.name}</p><p className="text-xs text-slate-500">مخزن • {w.code}</p></div>
                    </button>
                  ))}
                  {ingredients.filter(i => i.name.includes(globalSearchQuery) || i.code.includes(globalSearchQuery) || i.barcode?.includes(globalSearchQuery)).slice(0, 5).map(i => (
                    <button key={i.id} onClick={() => { setActiveFeature("ingredients"); setActivePage("ingredients"); setActiveTab("features"); setShowGlobalSearch(false); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-right">
                      <Package className="w-5 h-5 text-blue-600" />
                      <div className="flex-1"><p className="font-bold text-slate-800">{i.name}</p><p className="text-xs text-slate-500">صنف • {i.code} • {i.barcode}</p></div>
                    </button>
                  ))}
                  {transactions.filter(t => t.transaction_number?.includes(globalSearchQuery) || t.reference?.includes(globalSearchQuery) || t.notes?.includes(globalSearchQuery)).slice(0, 5).map(t => (
                    <button key={t.id} onClick={() => { setActiveFeature("transactions"); setActivePage("transactions"); setActiveTab("features"); setShowGlobalSearch(false); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-right">
                      <ArrowRightLeft className="w-5 h-5 text-purple-600" />
                      <div className="flex-1"><p className="font-bold text-slate-800">{t.transaction_number}</p><p className="text-xs text-slate-500">حركة • {TX_TYPE_LABELS[t.type]} • {t.date}</p></div>
                    </button>
                  ))}
                  {suppliers.filter(s => s.name.includes(globalSearchQuery) || s.code.includes(globalSearchQuery) || s.phone.includes(globalSearchQuery)).slice(0, 3).map(s => (
                    <button key={s.id} onClick={() => { setActiveFeature("suppliers"); setActivePage("suppliers"); setActiveTab("features"); setShowGlobalSearch(false); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-right">
                      <Users className="w-5 h-5 text-pink-600" />
                      <div className="flex-1"><p className="font-bold text-slate-800">{s.name}</p><p className="text-xs text-slate-500">مورد • {s.code} • {s.phone}</p></div>
                    </button>
                  ))}
                  {warehouses.filter(w => w.name.includes(globalSearchQuery) || w.code.includes(globalSearchQuery)).length === 0 &&
                   ingredients.filter(i => i.name.includes(globalSearchQuery) || i.code.includes(globalSearchQuery)).length === 0 &&
                   transactions.filter(t => t.transaction_number?.includes(globalSearchQuery)).length === 0 &&
                   suppliers.filter(s => s.name.includes(globalSearchQuery)).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-sm">لا توجد نتائج</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal (Camera) */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => setShowBarcodeScanner(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><ScanLine className="w-5 h-5 text-violet-600" /> ماسح الباركود</h2>
              <button onClick={() => setShowBarcodeScanner(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-900 rounded-2xl p-8 text-center">
                <Camera className="w-16 h-16 text-slate-500 mx-auto mb-3" />
                <p className="text-white text-sm mb-2">وجّه الكاميرا نحو الباركود</p>
                <p className="text-slate-400 text-xs">(يتطلب إذن الكاميرا)</p>
              </div>
              <div>
                <label className="text-sm text-slate-500 font-bold">أو أدخل الباركود يدوياً</label>
                <input type="text" placeholder="6001234567890" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 font-mono text-center text-lg" onKeyDown={e => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value;
                    const ing = ingredients.find(i => i.barcode === val);
                    if (ing) { setSelectedBarcode(ing); setShowBarcodeModal(true); setShowBarcodeScanner(false); showToast(`تم العثور على: ${ing.name}`); }
                    else { showToast("لم يتم العثور على صنف بهذا الباركود", "error"); }
                  }
                }} />
              </div>
              <p className="text-xs text-slate-400 text-center">اضغط Enter للبحث عن الصنف بالباركود</p>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Rating Modal */}
      {showRatingModal && ratingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> تقييم: {ratingSupplier.name}</h2>
              <button onClick={() => setShowRatingModal(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const res = await api.post("/api/supplier-ratings", { supplier_id: ratingSupplier.id, ...ratingForm });
              if (res.ok) { showToast("تم إضافة التقييم"); setShowRatingModal(false); loadSupplierRatings(ratingSupplier.id); }
            }} className="p-6 space-y-4">
              {supplierRatings && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700 font-bold mb-1">التقييم الحالي</p>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className={`w-6 h-6 ${n <= Math.round(Number(supplierRatings.average)) ? "text-amber-500 fill-amber-500" : "text-slate-300"}`} />
                    ))}
                  </div>
                  <p className="text-2xl font-black text-amber-700">{supplierRatings.average} / 5</p>
                  <p className="text-xs text-amber-600">{supplierRatings.count} تقييم</p>
                </div>
              )}
              <div>
                <label className="text-sm text-slate-500 font-bold">التقييم</label>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button type="button" key={n} onClick={() => setRatingForm({ ...ratingForm, rating: n })}>
                      <Star className={`w-10 h-10 transition-all ${n <= ratingForm.rating ? "text-amber-500 fill-amber-500" : "text-slate-300 hover:text-amber-300"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-500 font-bold">معيار التقييم</label>
                <select value={ratingForm.criteria ?? ""} onChange={e => setRatingForm({ ...ratingForm, criteria: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 mt-1">
                  {["جودة المنتجات", "الالتزام بموعد التسليم", "أسعار تنافسية", "خدمة ما بعد البيع", "مرونة في التعامل", "التغليف والشحن"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 font-bold">تعليق</label>
                <textarea value={ratingForm.comment ?? ""} onChange={e => setRatingForm({ ...ratingForm, comment: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 h-20 mt-1" placeholder="تعليق إضافي..." />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRatingModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700">حفظ التقييم</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Helper save actions declared after JSX return so they're hoisted
  function handleSaveWarehouseAction() {
    if (!editingWarehouse?.name || (editingWarehouse.id && !editingWarehouse.code)) { showToast("اسم المخزن والكود مطلوبان", "error"); return; }
    (async () => {
      try {
        const method = editingWarehouse.id ? "PUT" : "POST";
        const url = editingWarehouse.id ? `/api/warehouses/${editingWarehouse.id}` : "/api/warehouses";
        // On create the previewed code is not sent: the server assigns the next
        // serial number at save time, which keeps two concurrent saves unique.
        const payload = editingWarehouse.id ? editingWarehouse : { ...editingWarehouse, code: undefined };
        const res = await (method === "PUT" ? api.put(url, payload) : api.post(url, payload));
        const result = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(editingWarehouse.id ? "تم تحديث المخزن" : "تم إضافة المخزن");
          setShowWarehouseModal(false);
          setEditingWarehouse(null);
          // Immediately reflect the saved warehouse in the current view,
          // then refresh the complete list from the server. This prevents a
          // successful POST from leaving an apparently empty table.
          if (result?.id) {
            setWarehouses(prev => {
              const saved = { ...editingWarehouse, ...result };
              const exists = prev.some(w => Number(w.id) === Number(saved.id));
              return exists
                ? prev.map(w => Number(w.id) === Number(saved.id) ? { ...w, ...saved } as WarehouseItem : w)
                : [...prev, saved as WarehouseItem];
            });
          }
          await fetchData();
        } else {
          showToast(result?.error || "خطأ في حفظ المخزن", "error"); }
      } catch (e) { showToast("خطأ في الاتصال", "error"); }
    })();
  }
  function handleSaveIngredientAction() {
    if (!editingIngredient?.name) { showToast("اسم الصنف مطلوب", "error"); return; }
    (async () => {
      try {
        const payload = { ...editingIngredient };
        const method = editingIngredient.id ? "PUT" : "POST";
        const url = editingIngredient.id ? `/api/ingredients/${editingIngredient.id}` : "/api/ingredients";
        const res = await (method === "PUT" ? api.put(url, payload) : api.post(url, payload));
        if (res.ok) {
          showToast(editingIngredient.id ? "تم تحديث الصنف بنجاح" : "تم إضافة الصنف بنجاح");
          setShowIngredientModal(false);
          setEditingIngredient(null);
          fetchData();
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData?.error || errData?.message || "خطأ في الحفظ", "error");
        }
      } catch (e) { showToast("خطأ في الاتصال", "error"); }
    })();
  }
  function handleSaveSupplierAction() {
    if (!editingSupplier?.name) { showToast("اسم المورد مطلوب", "error"); return; }
    (async () => {
      try {
        const method = editingSupplier.id ? "PUT" : "POST";
        const url = editingSupplier.id ? `/api/warehouse-suppliers/${editingSupplier.id}` : "/api/warehouse-suppliers";
        const res = await (method === "PUT" ? api.put(url, editingSupplier) : api.post(url, editingSupplier));
        if (res.ok) {
          showToast(editingSupplier.id ? "تم تحديث المورد بنجاح" : "تم إضافة المورد بنجاح");
          setShowSupplierModal(false);
          setEditingSupplier(null);
          fetchData();
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData?.error || errData?.message || "خطأ في الحفظ", "error");
        }
      } catch (e) { showToast("خطأ في الاتصال", "error"); }
    })();
  }

  function loadSupplierRatings(supplierId: number) {
    (async () => {
      try {
        const res = await api.get(`/api/supplier-ratings/${supplierId}`);
        if (res.ok) setSupplierRatings(await res.json());
      } catch (e) { /* ignore */ }
    })();
  }
}
