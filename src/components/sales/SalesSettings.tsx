import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  Warehouse,
  Percent,
  DollarSign,
  Truck,
  ShieldAlert,
  Clock,
  Award,
  FileText,
  Printer,
  ChevronLeft,
  Info,
  Sliders,
  Sparkles,
  CreditCard,
  Building,
  Package,
  Store,
  RefreshCw,
  ArrowRightLeft,
  Tag,
  Check,
  Eye,
  AlertCircle,
} from "lucide-react";
import { api } from "../../utils/api";
import { SalesProductsView } from "./SalesProductsView";

export interface SalesConfig {
  defaultWarehouseId: number | string;
  defaultWarehouseName: string;
  defaultPriceList: string;
  defaultPaymentMethod: string;
  defaultVatRate: number;
  quotationValidityDays: number;
  quotationPrefix: string;
  orderPrefix: string;
  deliveryPrefix: string;
  invoicePrefix: string;
  returnPrefix: string;
  autoReserveStockOnOrder: boolean;
  autoDispatchDeliveryOnConfirm: boolean;
  preventNegativeInventory: boolean;
  allowPartialDelivery: boolean;
  enforceCustomerCreditLimit: boolean;
  blockOverdueCustomers: boolean;
  maxReturnDays: number;
  requireOriginalInvoiceForReturn: boolean;
  autoGenerateCreditNote: boolean;
  commissionTrigger: "invoice" | "payment";
  defaultCommissionRate: number;
  minProfitMarginForCommission: number;
  companyCommercialName: string;
  companyTaxId: string;
  companyCommercialReg: string;
  quotationTerms: string;
  invoiceFooterNotes: string;
  showSignaturesOnPrint: boolean;
  showTaxDetailsOnPrint: boolean;
  showItemCodeOnPrint: boolean;
  // POS Integration Settings (الربط مع نقطة البيع)
  linkPosWithSales: boolean;
  posPriceStrategy: "same" | "markup" | "discount" | "custom";
  posPriceMarginPercent: number;
  posSyncActiveOnly: boolean;
  posDefaultWarehouseId: number | string;
  posAllowPriceOverrideInSales: boolean;
  posShowBadge: boolean;
}

export const DEFAULT_SALES_CONFIG: SalesConfig = {
  defaultWarehouseId: 1,
  defaultWarehouseName: "المخزن الرئيسي",
  defaultPriceList: "قطاعي",
  defaultPaymentMethod: "أجل",
  defaultVatRate: 0,
  quotationValidityDays: 30,
  quotationPrefix: "QUO-",
  orderPrefix: "SO-",
  deliveryPrefix: "DN-",
  invoicePrefix: "INV-",
  returnPrefix: "SR-",
  autoReserveStockOnOrder: true,
  autoDispatchDeliveryOnConfirm: true,
  preventNegativeInventory: true,
  allowPartialDelivery: true,
  enforceCustomerCreditLimit: true,
  blockOverdueCustomers: false,
  maxReturnDays: 14,
  requireOriginalInvoiceForReturn: true,
  autoGenerateCreditNote: true,
  commissionTrigger: "invoice",
  defaultCommissionRate: 2.5,
  minProfitMarginForCommission: 10,
  companyCommercialName: "شركة REMO PRO ERP - قطاع المبيعات والتوريد",
  companyTaxId: "492-819-204",
  companyCommercialReg: "104928",
  quotationTerms:
    "العرض ساري لمدة 30 يوماً من تاريخ الإصدار. الأسعار تشمل ضريبة القيمة المضافة ما لم يذكر خلاف ذلك. التوريد يتم فور اعتماد أمر الشراء.",
  invoiceFooterNotes:
    "البضاعة المباعة لا ترد ولا تستبدل بعد 14 يوماً من تاريخ الاستلام. يرجى مراجعة الأصناف ومطابقتها فور الاستلام.",
  showSignaturesOnPrint: true,
  showTaxDetailsOnPrint: true,
  showItemCodeOnPrint: true,
  linkPosWithSales: false,
  posPriceStrategy: "markup",
  posPriceMarginPercent: 10,
  posSyncActiveOnly: true,
  posDefaultWarehouseId: 1,
  posAllowPriceOverrideInSales: true,
  posShowBadge: true,
};

interface SalesSettingsProps {
  onBack?: () => void;
  initialSubTab?: "products" | "general" | "pos_integration" | "inventory" | "credit_returns" | "commissions" | "print_docs";
  systemWarehouses?: any[];
  onConfigUpdated?: (config: SalesConfig) => void;
  showToast?: (msg: string) => void;
}

export const SalesSettings: React.FC<SalesSettingsProps> = ({
  onBack,
  initialSubTab = "products",
  systemWarehouses = [],
  onConfigUpdated,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    "products" | "general" | "pos_integration" | "inventory" | "credit_returns" | "commissions" | "print_docs"
  >(initialSubTab);

  const [config, setConfig] = useState<SalesConfig>(() => {
    try {
      const saved = localStorage.getItem("sales_settings_config");
      if (saved) {
        return { ...DEFAULT_SALES_CONFIG, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_SALES_CONFIG;
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>(systemWarehouses);
  const [posStatus, setPosStatus] = useState<{
    isPosLinked: boolean;
    totalPosProducts: number;
    activePosProducts: number;
    salesEnabledProducts?: number;
    posPriceStrategy: string;
    posPriceMarginPercent: number;
  }>({
    isPosLinked: false,
    totalPosProducts: 0,
    activePosProducts: 0,
    salesEnabledProducts: 0,
    posPriceStrategy: "markup",
    posPriceMarginPercent: 10,
  });
  const [posPreviewItems, setPosPreviewItems] = useState<any[]>([]);
  const [loadingPosPreview, setLoadingPosPreview] = useState(false);
  const [syncingPos, setSyncingPos] = useState(false);
  const [posSearchTerm, setPosSearchTerm] = useState("");
  const [posCategoryFilter, setPosCategoryFilter] = useState("all");
  const [posSalesStatusFilter, setPosSalesStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [togglingProductId, setTogglingProductId] = useState<number | null>(null);
  const [bulkUpdatingPos, setBulkUpdatingPos] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState<string>("");

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    loadSettings();
    if (!warehouses || warehouses.length === 0) {
      loadWarehouses();
    }
  }, []);

  useEffect(() => {
    if (activeTab === "pos_integration" || activeTab === "general") {
      loadPosStatus();
      loadPosPreview(config.posPriceStrategy, config.posPriceMarginPercent);
    }
  }, [activeTab]);

  const loadPosStatus = async () => {
    try {
      const res = await api.get("/api/v2/sales/pos/status");
      if (res.ok) {
        const data = await res.json();
        setPosStatus(data);
      }
    } catch (_) {}
  };

  const loadPosPreview = async (strategy?: string, margin?: number) => {
    setLoadingPosPreview(true);
    try {
      const s = strategy !== undefined ? strategy : config.posPriceStrategy;
      const m = margin !== undefined ? margin : config.posPriceMarginPercent;
      const res = await api.get(`/api/v2/sales/pos/preview?strategy=${encodeURIComponent(s)}&margin=${encodeURIComponent(m)}&limit=1000`);
      if (res.ok) {
        const data = await res.json();
        setPosPreviewItems(data.items || []);
      }
    } catch (_) {}
    finally {
      setLoadingPosPreview(false);
    }
  };

  const handleToggleSinglePosProductSales = async (item: any) => {
    setTogglingProductId(item.id);
    const nextState = !item.isAvailableInSales;
    try {
      const res = await api.post("/api/v2/sales/pos/toggle-sales-availability", {
        productId: item.id,
        isAvailableInSales: nextState,
      });
      if (res.ok) {
        setPosPreviewItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, isAvailableInSales: nextState, showInSales: nextState }
              : p
          )
        );
        loadPosStatus();
        window.dispatchEvent(new CustomEvent("sales_products_updated"));
        if (showToast) {
          showToast(
            nextState
              ? `🟢 تم تفعيل صنف "${item.name}" وإتاحته فوراً في مبيعات وأوامر البيع!`
              : `⏸️ تم إلغاء إتاحة صنف "${item.name}" من موديول المبيعات`
          );
        }
      } else {
        const err = await res.json();
        if (showToast) showToast(`❌ فشل التحديث: ${err.error || ""}`);
      }
    } catch (err: any) {
      if (showToast) showToast(`❌ خطأ: ${err.message}`);
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleBulkToggleSales = async (enableAll: boolean) => {
    if (
      !window.confirm(
        enableAll
          ? "هل أنت متأكد من تفعيل ومشاركة كافة منتجات نقطة البيع (POS) لتصبح متاحة في موديول المبيعات وأوامر البيع؟"
          : "هل أنت متأكد من تعطيل مشاركة كافة منتجات نقطة البيع في موديول المبيعات؟"
      )
    ) {
      return;
    }

    setBulkUpdatingPos(true);
    try {
      const res = await api.post("/api/v2/sales/pos/bulk-toggle-sales", {
        enableAll,
      });
      if (res.ok) {
        setPosPreviewItems((prev) =>
          prev.map((p) => ({
            ...p,
            isAvailableInSales: enableAll,
            showInSales: enableAll,
          }))
        );
        await loadPosStatus();
        window.dispatchEvent(new CustomEvent("sales_products_updated"));
        if (showToast) {
          showToast(
            enableAll
              ? "🟢 تم بنجاح تفعيل وإتاحة جميع منتجات نقطة البيع (POS) في موديول المبيعات!"
              : "ℹ️ تم تعطيل مشاركة منتجات نقطة البيع في المبيعات"
          );
        }
      } else {
        const err = await res.json();
        if (showToast) showToast(`❌ خطأ: ${err.error || ""}`);
      }
    } catch (err: any) {
      if (showToast) showToast(`❌ خطأ: ${err.message}`);
    } finally {
      setBulkUpdatingPos(false);
    }
  };

  const handleSaveCustomPrice = async (item: any) => {
    const val = parseFloat(editingPriceVal);
    if (isNaN(val) || val < 0) {
      setEditingPriceId(null);
      return;
    }

    try {
      const res = await api.post("/api/v2/sales/pos/toggle-sales-availability", {
        productId: item.id,
        isAvailableInSales: item.isAvailableInSales,
        salesPrice: val > 0 ? val : null,
      });
      if (res.ok) {
        setPosPreviewItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  customSalesPrice: val > 0 ? val : null,
                  salesPrice: val > 0 ? val : p.posPrice,
                  priceDifference: Math.round(((val > 0 ? val : p.posPrice) - p.posPrice) * 100) / 100,
                }
              : p
          )
        );
        window.dispatchEvent(new CustomEvent("sales_products_updated"));
        if (showToast) showToast(`✅ تم حفظ سعر المبيعات المخصص للصنف "${item.name}"`);
      }
    } catch (err: any) {
      if (showToast) showToast(`❌ خطأ: ${err.message}`);
    } finally {
      setEditingPriceId(null);
    }
  };

  const handleSyncPosNow = async () => {
    setSyncingPos(true);
    try {
      await handleSave();
      await loadPosStatus();
      await loadPosPreview(config.posPriceStrategy, config.posPriceMarginPercent);
      window.dispatchEvent(new CustomEvent("sales_products_updated"));
      window.dispatchEvent(new CustomEvent("sales_pricing_updated"));
      if (showToast) {
        showToast("🟢 تم تفعيل وتطبيق ربط نقطة البيع (POS) بنجاح ومزامنة الأسعار في مديول المبيعات!");
      }
    } catch (err: any) {
      if (showToast) showToast(`❌ تعذر المزامنة: ${err.message}`);
    } finally {
      setSyncingPos(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      const res = await api.get("/api/inventory/warehouses");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setWarehouses(list);
      }
    } catch (err) {
      console.error("Error loading warehouses for sales settings:", err);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/settings/sales_settings_config");
      if (res.ok) {
        const data = await res.json();
        if (data && data.value) {
          const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          const merged = { ...DEFAULT_SALES_CONFIG, ...parsed };
          setConfig(merged);
          try {
            localStorage.setItem("sales_settings_config", JSON.stringify(merged));
          } catch (_) {}
          if (onConfigUpdated) onConfigUpdated(merged);
        }
      }
    } catch (err) {
      console.error("Error fetching sales settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const stringified = JSON.stringify(config);
      try {
        localStorage.setItem("sales_settings_config", stringified);
      } catch (_) {}

      const res = await api.post("/api/settings", {
        key: "sales_settings_config",
        value: stringified,
      });

      if (res.ok) {
        if (showToast) {
          showToast("🟢 تم حفظ إعدادات مديول المبيعات بنجاح وتطبيقها في كامل النظام!");
        }
        if (onConfigUpdated) {
          onConfigUpdated(config);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        if (showToast) {
          showToast(`⚠️ تم الحفظ محلياً (${err.error || "خطأ مؤقت بالخادم"})`);
        }
      }
    } catch (err: any) {
      if (showToast) {
        showToast(`❌ تعذر حفظ الإعدادات: ${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        "هل أنت متأكد من استعادة الإعدادات الافتراضية لمديول المبيعات والتوريد؟",
      )
    ) {
      setConfig(DEFAULT_SALES_CONFIG);
      if (showToast) {
        showToast("ℹ️ تم استعادة الإعدادات الافتراضية للمبيعات، اضغط حفظ للتثبيت.");
      }
    }
  };

  const updateField = <K extends keyof SalesConfig>(key: K, value: SalesConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "defaultWarehouseId") {
        const found = warehouses.find((w) => String(w.id) === String(value));
        if (found) {
          next.defaultWarehouseName = found.name;
        }
      }
      return next;
    });
  };

  const tabs = [
    {
      id: "products" as const,
      label: "منتجات المبيعات",
      icon: Package,
      desc: "تكوين منتجات البيع، ربط الأصناف المخزنية، وقوائم الأسعار المتعددة",
    },
    {
      id: "pos_integration" as const,
      label: "الربط مع نقطة البيع (POS)",
      icon: Store,
      desc: "ربط منتجات الكاشير بنظام المبيعات مع مرونة تعديل وفروق الأسعار بين المديولين",
    },
    {
      id: "general" as const,
      label: "الإعدادات العامة",
      icon: Settings,
      desc: "المخزن الافتراضي، الضرائب، مدد الصلاحية، والبادئات",
    },
    {
      id: "inventory" as const,
      label: "المخازن والصرف",
      icon: Warehouse,
      desc: "سياسات حجز المخزون، الصرف التلقائي، ومنع العجز",
    },
    {
      id: "credit_returns" as const,
      label: "الائتمان والمرتجعات",
      icon: ShieldAlert,
      desc: "ضوابط مديونية العملاء، فترات المرتجع، والإشعارات الدائنة",
    },
    {
      id: "commissions" as const,
      label: "العمولات والتارجت",
      icon: Award,
      desc: "استحقاق عمولات المناديب، الحد الأدنى للربحية، والنسب",
    },
    {
      id: "print_docs" as const,
      label: "تصميم الطباعة والمستندات",
      icon: Printer,
      desc: "ترويسة الفاتورة، السجل التجاري، الشروط والتوقيعات",
    },
  ];

  return (
    <div className="space-y-6 text-right font-cairo">
      {/* Header bar inside settings view */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-sm">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">
                إعدادات مديول المبيعات والتوريد
              </h2>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                Sales Configurations
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              تهيئة سياسات الصرف والمخازن، حدود الائتمان، نسب الضرائب والعمولات، والربط المتكامل مع نقطة البيع (POS)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab !== "products" ? (
            <>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="استعادة القيم الافتراضية الموصى بها للنظام"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>استعادة الافتراضي</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {saving ? (
                  <span>جاري الحفظ...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ جميع الإعدادات</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200/80 rounded-xl text-indigo-700 text-xs font-black">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>إدارة وتكوين منتجات البيع وقوائم الأسعار</span>
            </div>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>رجوع</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtab Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-200" />
                )}
              </div>
              <div>
                <span className="text-xs font-black block">{tab.label}</span>
                <span
                  className={`text-[10px] font-bold block mt-0.5 line-clamp-1 ${
                    isSelected ? "text-indigo-100" : "text-slate-400"
                  }`}
                >
                  {tab.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 0. Sales Products Sub-Tab */}
      {activeTab === "products" && (
        <div className="pt-1">
          <SalesProductsView showToast={showToast} />
        </div>
      )}

      {/* Content Form Body */}
      {activeTab !== "products" && (
        <>
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* TAB 1: GENERAL SETTINGS */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>القيم الافتراضية والبادئات الأساسية لأوامر البيع</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                تطبق هذه الإعدادات تلقائياً عند إنشاء أي عرض سعر أو أمر بيع أو فاتورة جديدة
              </p>
            </div>

            {/* Quick POS Integration Highlight */}
            <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              config.linkPosWithSales
                ? "bg-purple-50/70 border-purple-200 text-purple-950"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  config.linkPosWithSales ? "bg-purple-600 text-white shadow-sm" : "bg-slate-200 text-slate-500"
                }`}>
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">الربط التلقائي مع نقطة البيع (POS)</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      config.linkPosWithSales ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}>
                      {config.linkPosWithSales ? "مفعل ومربوط" : "غير مفعل"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                    إظهار منتجات الكاشير ونقطة البيع في عروض الأسعار وفواتير المبيعات مع مرونة تعديل وفروق الأسعار
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateField("linkPosWithSales", !config.linkPosWithSales)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    config.linkPosWithSales
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 hover:bg-purple-700"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  }`}
                >
                  {config.linkPosWithSales ? "تعطيل الربط" : "تفعيل الربط الآن"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pos_integration")}
                  className="px-3 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إعدادات الربط المتقدمة ←
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Default Warehouse */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  المخزن الافتراضي للتسليم والصرف <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  <select
                    value={config.defaultWarehouseId}
                    onChange={(e) => updateField("defaultWarehouseId", e.target.value)}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {warehouses.map((wh, idx) => (
                      <option key={`wh-${wh.id || wh.name || idx}-${idx}`} value={wh.id}>
                        {wh.name || wh.warehouse_name || `مخزن #${wh.id}`}
                      </option>
                    ))}
                    {warehouses.length === 0 && (
                      <option value="1">المخزن الرئيسي</option>
                    )}
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  يتم تحديده افتراضياً في أوامر البيع وإذن الصرف مع إمكانية تغييره
                </p>
              </div>

              {/* Default Price List */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  قائمة الأسعار الافتراضية
                </label>
                <div className="relative">
                  <Percent className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  <select
                    value={config.defaultPriceList}
                    onChange={(e) => updateField("defaultPriceList", e.target.value)}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="قطاعي">قائمة أسعار القطاعي (العامة)</option>
                    <option value="جملة">قائمة أسعار الجملة</option>
                    <option value="نصف جملة">قائمة أسعار نصف الجملة</option>
                    <option value="VIP / كبار العملاء">قائمة كبار العملاء (VIP)</option>
                    <option value="عقود حكومية">قائمة العقود والجهات الحكومية</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  تحدد السعر التلقائي للصنف عند إضافته لأمر البيع
                </p>
              </div>

              {/* Default Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  طريقة السداد الافتراضية
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  <select
                    value={config.defaultPaymentMethod}
                    onChange={(e) => updateField("defaultPaymentMethod", e.target.value)}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="أجل">أجل (ذمم مدينة على حساب العميل)</option>
                    <option value="نقدي">نقدي (توريد الخزينة فوراً)</option>
                    <option value="تحويل بنكي">تحويل بنكي / شيكات</option>
                    <option value="بطاقة بنكية">دفع إلكتروني / Visa</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  تحدد طبيعة القيد المحاسبي التلقائي المصاحب للفاتورة
                </p>
              </div>

              {/* Default VAT Rate */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  نسبة ضريبة القيمة المضافة الافتراضية (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={config.defaultVatRate}
                    onChange={(e) => updateField("defaultVatRate", Number(e.target.value))}
                    className="w-full pr-4 pl-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left font-mono"
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  النسبة الرسمية المطبقة على أصناف عروض الأسعار وفواتير البيع (14% في مصر)
                </p>
              </div>

              {/* Quotation Validity Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  مدة سريان عرض السعر (بالأيام)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={config.quotationValidityDays}
                    onChange={(e) => updateField("quotationValidityDays", Number(e.target.value))}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  يتم حساب تاريخ انتهاء صلاحية العرض تلقائياً بناءً على هذا الرقم
                </p>
              </div>
            </div>

            {/* Document Numbering Prefixes */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                <span>بادئات الترقيم التسلسلي للمستندات البيعية (Document Prefixes)</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    عروض الأسعار
                  </label>
                  <input
                    type="text"
                    value={config.quotationPrefix}
                    onChange={(e) => updateField("quotationPrefix", e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="QUO-"
                  />
                  <span className="text-[9px] text-slate-400 font-mono block mt-1 text-center">
                    مثال: {config.quotationPrefix}2026-001
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    أوامر البيع
                  </label>
                  <input
                    type="text"
                    value={config.orderPrefix}
                    onChange={(e) => updateField("orderPrefix", e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="SO-"
                  />
                  <span className="text-[9px] text-slate-400 font-mono block mt-1 text-center">
                    مثال: {config.orderPrefix}2026-001
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    أذونات التسليم
                  </label>
                  <input
                    type="text"
                    value={config.deliveryPrefix}
                    onChange={(e) => updateField("deliveryPrefix", e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="DN-"
                  />
                  <span className="text-[9px] text-slate-400 font-mono block mt-1 text-center">
                    مثال: {config.deliveryPrefix}2026-001
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    فواتير البيع
                  </label>
                  <input
                    type="text"
                    value={config.invoicePrefix}
                    onChange={(e) => updateField("invoicePrefix", e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="INV-"
                  />
                  <span className="text-[9px] text-slate-400 font-mono block mt-1 text-center">
                    مثال: {config.invoicePrefix}2026-001
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    مرتجعات البيع
                  </label>
                  <input
                    type="text"
                    value={config.returnPrefix}
                    onChange={(e) => updateField("returnPrefix", e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="SR-"
                  />
                  <span className="text-[9px] text-slate-400 font-mono block mt-1 text-center">
                    مثال: {config.returnPrefix}2026-001
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1.5: POS INTEGRATION (الربط مع نقطة البيع) */}
        {activeTab === "pos_integration" && (
          <div className="space-y-6">
            {/* Header / Master Switch Banner */}
            <div className={`p-6 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm ${
              config.linkPosWithSales
                ? "bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border-purple-200"
                : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-start sm:items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${
                  config.linkPosWithSales
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105"
                    : "bg-slate-200 text-slate-500"
                }`}>
                  <Store className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900">
                      الربط والتكامل التلقائي مع نقطة البيع (POS Integration)
                    </h3>
                    <span className={`text-[11px] font-black px-3 py-0.5 rounded-full border ${
                      config.linkPosWithSales
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-slate-200 text-slate-600 border-slate-300"
                    }`}>
                      {config.linkPosWithSales ? "● الربط مفعل ونشط" : "○ الربط معطل"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-1 max-w-2xl leading-relaxed">
                    عند تفعيل الربط، ستظهر منتجات نقطة البيع (POS) تلقائياً في مديول المبيعات، عروض الأسعار، أوامر البيع، والفواتير مع اختلاف وتمايز الأسعار بين المديولين، مع خصم المخزون بدقة تامة من مستودعات المكونات.
                  </p>
                </div>
              </div>

              {/* Master Toggle Button */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !config.linkPosWithSales;
                    updateField("linkPosWithSales", nextVal);
                    if (nextVal) {
                      loadPosPreview(config.posPriceStrategy, config.posPriceMarginPercent);
                    }
                  }}
                  className={`px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2.5 transition-all shadow-md cursor-pointer ${
                    config.linkPosWithSales
                      ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25 ring-4 ring-purple-600/20"
                      : "bg-slate-800 hover:bg-slate-900 text-white"
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>{config.linkPosWithSales ? "تعطيل ربط نقطة البيع" : "تفعيل الربط المباشر مع POS"}</span>
                </button>
              </div>
            </div>

            {/* Pricing Strategy & Price Discrepancy (اختلاف الأسعار بين المديولين) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                    <span>سياسة تسعير منتجات نقطة البيع في مديول المبيعات (اختلاف الأسعار)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                    حدد كيفية احتساب سعر البيع في عروض الأسعار والفواتير مقارنة بسعر الكاشير في نقطة البيع
                  </p>
                </div>
                <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 self-start sm:self-auto">
                  تعديل تسعير مخصص
                </span>
              </div>

              {/* Radio Strategies Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Markup */}
                <div
                  onClick={() => {
                    updateField("posPriceStrategy", "markup");
                    loadPosPreview("markup", config.posPriceMarginPercent);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-right flex flex-col justify-between ${
                    config.posPriceStrategy === "markup"
                      ? "border-purple-600 bg-purple-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800">زيادة نسبة مئوية (+ Markup)</span>
                    <input
                      type="radio"
                      name="posPriceStrategy"
                      checked={config.posPriceStrategy === "markup"}
                      onChange={() => {}}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                    إضافة هامش ربح إضافي فوق سعر الكاشير (مناسب للبيع الآجل أو التوصيل والتوريد)
                  </p>
                  <span className="mt-3 text-[10px] font-black text-purple-700 bg-white border border-purple-200 px-2 py-0.5 rounded-md inline-block self-start">
                    سعر المبيعات = سعر POS + {config.posPriceMarginPercent}%
                  </span>
                </div>

                {/* 2. Discount */}
                <div
                  onClick={() => {
                    updateField("posPriceStrategy", "discount");
                    loadPosPreview("discount", config.posPriceMarginPercent);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-right flex flex-col justify-between ${
                    config.posPriceStrategy === "discount"
                      ? "border-purple-600 bg-purple-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800">خصم نسبة مئوية (- Discount)</span>
                    <input
                      type="radio"
                      name="posPriceStrategy"
                      checked={config.posPriceStrategy === "discount"}
                      onChange={() => {}}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                    تطبيق خصم مباشر على سعر الكاشير (مثالي لعملاء الجملة والتوزيع)
                  </p>
                  <span className="mt-3 text-[10px] font-black text-purple-700 bg-white border border-purple-200 px-2 py-0.5 rounded-md inline-block self-start">
                    سعر المبيعات = سعر POS - {config.posPriceMarginPercent}%
                  </span>
                </div>

                {/* 3. Same */}
                <div
                  onClick={() => {
                    updateField("posPriceStrategy", "same");
                    loadPosPreview("same", 0);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-right flex flex-col justify-between ${
                    config.posPriceStrategy === "same"
                      ? "border-purple-600 bg-purple-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800">نفس سعر الكاشير (Same)</span>
                    <input
                      type="radio"
                      name="posPriceStrategy"
                      checked={config.posPriceStrategy === "same"}
                      onChange={() => {}}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                    استخدام نفس سعر البيع المعرف في نقطة البيع دون أي تغيير أو تعديل
                  </p>
                  <span className="mt-3 text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md inline-block self-start">
                    سعر المبيعات = سعر POS
                  </span>
                </div>

                {/* 4. Custom */}
                <div
                  onClick={() => {
                    updateField("posPriceStrategy", "custom");
                    loadPosPreview("custom", 0);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-right flex flex-col justify-between ${
                    config.posPriceStrategy === "custom"
                      ? "border-purple-600 bg-purple-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800">تسعير مخصص ومستقل (Custom)</span>
                    <input
                      type="radio"
                      name="posPriceStrategy"
                      checked={config.posPriceStrategy === "custom"}
                      onChange={() => {}}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                    إمكانية تحديد سعر مبيعات مستقل لكل منتج من شاشة إدارة منتجات المبيعات
                  </p>
                  <span className="mt-3 text-[10px] font-black text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-md inline-block self-start">
                    تسعير مستقل بالكامل
                  </span>
                </div>
              </div>

              {/* Price Margin Percentage Input & Interactive Simulator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                {/* Margin % Input */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 block">
                    نسبة تعديل السعر المئوية (فرق السعر بين الكاشير والمبيعات)
                  </label>
                  <div className="relative">
                    <Percent className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="0.5"
                      disabled={config.posPriceStrategy === "same" || config.posPriceStrategy === "custom"}
                      value={config.posPriceMarginPercent}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateField("posPriceMarginPercent", val);
                        loadPosPreview(config.posPriceStrategy, val);
                      }}
                      className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 font-mono text-left"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {config.posPriceStrategy === "markup"
                      ? "تضاف هذه النسبة مئوية إلى سعر الكاشير في نقطة البيع لحساب سعر مديول المبيعات"
                      : config.posPriceStrategy === "discount"
                      ? "تخصم هذه النسبة مئوية من سعر الكاشير لحساب سعر مديول المبيعات"
                      : "النسبة غير مطبقة مع هذا الخيار"}
                  </p>
                </div>

                {/* Interactive Simulator Box */}
                <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/50 border border-purple-200/80 rounded-2xl p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-black text-purple-900 block mb-2">
                    محاكي فرق الأسعار المباشر (Live Pricing Simulator):
                  </span>
                  {(() => {
                    const samplePosPrice = 100;
                    let simulatedPrice = samplePosPrice;
                    if (config.posPriceStrategy === "markup") {
                      simulatedPrice = Math.round(samplePosPrice * (1 + config.posPriceMarginPercent / 100) * 100) / 100;
                    } else if (config.posPriceStrategy === "discount") {
                      simulatedPrice = Math.max(0, Math.round(samplePosPrice * (1 - config.posPriceMarginPercent / 100) * 100) / 100);
                    }
                    const diff = Math.round((simulatedPrice - samplePosPrice) * 100) / 100;
                    return (
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100 shadow-xs">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold block">سعر الكاشير (POS):</span>
                          <span className="text-sm font-black text-slate-800 font-mono">100.00 ج.م</span>
                        </div>
                        <div className="flex flex-col items-center px-2">
                          <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                          <span className={`text-[10px] font-black font-mono mt-0.5 ${
                            diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-500"
                          }`}>
                            {diff > 0 ? `+${diff} ج.م` : diff < 0 ? `${diff} ج.م` : "0 ج.م"}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-[10px] text-purple-600 font-bold block">سعر مديول المبيعات:</span>
                          <span className="text-sm font-black text-purple-700 font-mono">{simulatedPrice.toFixed(2)} ج.م</span>
                        </div>
                      </div>
                    );
                  })()}
                  <span className="text-[10px] text-slate-500 font-bold mt-2">
                    يتم تطبيق هذه المعادلة تلقائياً على كافة أصناف نقطة البيع عند إنشائها في عروض الأسعار أو الفواتير.
                  </span>
                </div>
              </div>
            </div>

            {/* Additional POS Policy Options */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-2">
                <Warehouse className="w-4 h-4 text-emerald-600" />
                <span>سياسات الربط وصرف المخزون لمنتجات نقطة البيع</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Sync Active Only */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-black text-slate-800">
                      ربط المنتجات النشطة فقط من نقطة البيع
                    </h5>
                    <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                      استبعاد المنتجات المعطلة أو المؤرشفة في الكاشير من شاشات البيع والتوريد
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.posSyncActiveOnly}
                    onChange={(e) => updateField("posSyncActiveOnly", e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded-lg focus:ring-purple-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* 2. Allow Override */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-black text-slate-800">
                      السماح بتعديل سعر منتج نقطة البيع يدوياً في الفاتورة
                    </h5>
                    <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                      إتاحة تغيير سعر الصنف أثناء تحرير أمر البيع أو الفاتورة حسب تفاوض العميل
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.posAllowPriceOverrideInSales}
                    onChange={(e) => updateField("posAllowPriceOverrideInSales", e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded-lg focus:ring-purple-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* 3. Show Badge */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-black text-slate-800">
                      إظهار شارة مميزة [نقطة البيع POS] في جداول المبيعات
                    </h5>
                    <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                      تمييز أصناف نقطة البيع بشارة بنفسجية في شاشات البحث والجداول لسهولة التعرف عليها
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.posShowBadge}
                    onChange={(e) => updateField("posShowBadge", e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded-lg focus:ring-purple-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* 4. Default Warehouse */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-black text-slate-800">
                      المستودع الافتراضي لصرف منتجات نقطة البيع
                    </h5>
                    <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                      المستودع الذي يتم منه التحقق من رصيد المكونات وخصم البضاعة عند التسليم
                    </p>
                  </div>
                  <select
                    value={config.posDefaultWarehouseId}
                    onChange={(e) => updateField("posDefaultWarehouseId", e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {warehouses.map((w, idx) => (
                      <option key={`pos-wh-${w.id || idx}`} value={w.id}>
                        {w.name || `مخزن #${w.id}`}
                      </option>
                    ))}
                    {warehouses.length === 0 && <option value="1">المخزن الرئيسي</option>}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Stats & Instant Actions */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">إجمالي منتجات POS:</span>
                  <span className="text-2xl font-black font-mono text-purple-400">
                    {posStatus.totalPosProducts} صنف
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">النشطة في الكاشير:</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {posStatus.activePosProducts} صنف
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">المفعلة في المبيعات:</span>
                  <span className="text-2xl font-black font-mono text-indigo-400">
                    {posPreviewItems.filter((i) => i.isAvailableInSales).length} صنف
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">مرتبطة بالمخزون:</span>
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {posPreviewItems.filter((i) => i.ingredientId).length} صنف
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => handleBulkToggleSales(true)}
                  disabled={bulkUpdatingPos}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="تفعيل ومشاركة كافة منتجات نقطة البيع دفعة واحدة داخل موديول المبيعات"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تفعيل جميع منتجات POS في المبيعات</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkToggleSales(false)}
                  disabled={bulkUpdatingPos}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  title="تعطيل مشاركة كافة المنتجات في موديول المبيعات"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تعطيل مشاركة الكل</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncPosNow}
                  disabled={syncingPos}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-purple-600/30 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingPos ? "animate-spin" : ""}`} />
                  <span>{syncingPos ? "جاري الحفظ والمزامنة..." : "حفظ ومزامنة فورية"}</span>
                </button>
              </div>
            </div>

            {/* Live POS Products Management & Sharing Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Store className="w-5 h-5 text-purple-600" />
                      <span>جميع منتجات نقطة البيع وإدارتها في المبيعات (All POS Products)</span>
                    </h4>
                    <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      {posPreviewItems.length} منتج
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    يمكنك هنا استعراض كافة منتجات الكاشير وتفعيل أو تعطيل ظهورها الفوري في المبيعات وأوامر البيع بنقرة واحدة
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadPosPreview(config.posPriceStrategy, config.posPriceMarginPercent)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPosPreview ? "animate-spin" : ""}`} />
                    <span>تحديث القائمة</span>
                  </button>
                </div>
              </div>

              {/* Search & Filtering Bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="relative flex-1 w-full">
                  <Info className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={posSearchTerm}
                    onChange={(e) => setPosSearchTerm(e.target.value)}
                    placeholder="بحث سريع بالاسم، الكود، الباركود، أو الصنف المخزني..."
                    className="w-full pr-10 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Category Filter */}
                  <select
                    value={posCategoryFilter}
                    onChange={(e) => setPosCategoryFilter(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-right"
                  >
                    <option value="all">كل التصنيفات</option>
                    {Array.from(new Set(posPreviewItems.map((i) => i.category).filter(Boolean))).map((cat, idx) => (
                      <option key={`pos-cat-${cat}-${idx}`} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  {/* Sales Availability Filter */}
                  <select
                    value={posSalesStatusFilter}
                    onChange={(e) => setPosSalesStatusFilter(e.target.value as any)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-right"
                  >
                    <option value="all">كل حالات المبيعات</option>
                    <option value="enabled">متاح في المبيعات فقط</option>
                    <option value="disabled">غير متاح في المبيعات</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                      <th className="p-3">اسم المنتج في POS</th>
                      <th className="p-3">الكود / الباركود</th>
                      <th className="p-3">الصنف المخزني المرتبط</th>
                      <th className="p-3">سعر الكاشير (POS)</th>
                      <th className="p-3">سعر المبيعات</th>
                      <th className="p-3">فرق السعر</th>
                      <th className="p-3 text-center">متاح في المبيعات</th>
                      <th className="p-3 text-center">حالة POS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {loadingPosPreview ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">
                          جاري تحميل منتجات نقطة البيع...
                        </td>
                      </tr>
                    ) : (() => {
                      const filtered = posPreviewItems.filter((item) => {
                        const q = posSearchTerm.toLowerCase().trim();
                        const matchesQuery =
                          !q ||
                          (item.name && item.name.toLowerCase().includes(q)) ||
                          (item.code && item.code.toLowerCase().includes(q)) ||
                          (item.barcode && item.barcode.toLowerCase().includes(q)) ||
                          (item.ingredientName && item.ingredientName.toLowerCase().includes(q)) ||
                          (item.ingredientCode && item.ingredientCode.toLowerCase().includes(q));

                        const matchesCategory =
                          posCategoryFilter === "all" || item.category === posCategoryFilter;

                        const matchesSalesStatus =
                          posSalesStatusFilter === "all" ||
                          (posSalesStatusFilter === "enabled" && item.isAvailableInSales) ||
                          (posSalesStatusFilter === "disabled" && !item.isAvailableInSales);

                        return matchesQuery && matchesCategory && matchesSalesStatus;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400">
                              لا توجد منتجات مطابقة لخيارات البحث أو الفلترة الحالية.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((item, idx) => (
                        <tr
                          key={`pos-item-${item.id || idx}`}
                          className={`hover:bg-purple-50/40 transition-colors ${
                            item.isAvailableInSales ? "bg-white" : "bg-slate-50/40 opacity-80"
                          }`}
                        >
                          {/* Name & Category */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-mono text-[10px] font-black">
                                <Store className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-black text-slate-900 block leading-tight">
                                  {item.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {item.category} • {item.unit || "قطعة"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Code & Barcode */}
                          <td className="p-3">
                            <span className="font-mono text-slate-700 block text-xs">
                              {item.code}
                            </span>
                            {item.barcode && (
                              <span className="font-mono text-[10px] text-slate-400 block">
                                {item.barcode}
                              </span>
                            )}
                          </td>

                          {/* Linked Master Ingredient */}
                          <td className="p-3">
                            {item.ingredientName ? (
                              <div>
                                <span className="font-black text-slate-800 flex items-center gap-1">
                                  <Warehouse className="w-3 h-3 text-emerald-600 shrink-0" />
                                  {item.ingredientName}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-mono block">
                                  رصيد متاح: {item.availableStock ?? 0} {item.ingredientUnit || item.unit}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                غير مرتبط بصنف مخزني
                              </span>
                            )}
                          </td>

                          {/* POS Price */}
                          <td className="p-3 font-mono font-black text-slate-700">
                            {Number(item.posPrice || 0).toFixed(2)} ج.م
                          </td>

                          {/* Sales Price */}
                          <td className="p-3">
                            {editingPriceId === item.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={editingPriceVal}
                                  onChange={(e) => setEditingPriceVal(e.target.value)}
                                  className="w-20 p-1 bg-white border border-purple-400 rounded-lg text-xs font-mono font-black text-center"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomPrice(item)}
                                  className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                                  title="حفظ"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPriceId(null)}
                                  className="p-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 cursor-pointer"
                                  title="إلغاء"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingPriceId(item.id);
                                  setEditingPriceVal(String(item.salesPrice || item.posPrice));
                                }}
                                className="cursor-pointer group flex items-center gap-1.5"
                                title="انقر لتحديد سعر مبيعات مخصص"
                              >
                                <span className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60 group-hover:border-purple-400 transition-colors">
                                  {Number(item.salesPrice || 0).toFixed(2)} ج.م
                                </span>
                                {item.customSalesPrice && (
                                  <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1 rounded">
                                    مخصص
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Price Difference */}
                          <td className="p-3 font-mono font-black">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] ${
                                item.priceDifference > 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : item.priceDifference < 0
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.priceDifference > 0 ? `+${item.priceDifference}` : item.priceDifference} ج.م
                              {item.priceDifferencePct !== 0 && ` (${item.priceDifferencePct > 0 ? `+${item.priceDifferencePct}%` : `${item.priceDifferencePct}%`})`}
                            </span>
                          </td>

                          {/* Sales Availability Switch */}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSinglePosProductSales(item)}
                              disabled={togglingProductId === item.id}
                              className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                item.isAvailableInSales
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-600/20"
                                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              }`}
                              title={
                                item.isAvailableInSales
                                  ? "متاح في المبيعات وأوامر البيع - انقر للتعطيل"
                                  : "غير متاح في المبيعات - انقر للتفعيل الفوري"
                              }
                            >
                              {togglingProductId === item.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : item.isAvailableInSales ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                              )}
                              <span>{item.isAvailableInSales ? "متاح في Sales" : "غير متاح"}</span>
                            </button>
                          </td>

                          {/* POS Active Status */}
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                item.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {item.isActive ? "نشط" : "معطل"}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Bottom Explanatory Card */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-950 font-bold leading-relaxed">
                  <strong>معمارية مشاركة المنتجات الموحدة (Unified Product Source):</strong> كافة المنتجات المفعّلة هنا تظهر فورياً في موديول المبيعات (عروض الأسعار، أوامر البيع، وأذونات التسليم)، ويتم الصرف من المستودع المرتبط بالصنف دون أي تكرار لسجلات المنتجات أو الأصناف المخزنية.
                </p>
              </div>
            </div>
          </div>
        )}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-emerald-600" />
                <span>سياسات حجز وصرف المخزون والربط مع المستودعات</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                تحديد آلية صرف البضاعة من المخازن وحساب الأرصدة المتاحة والمحجوزة
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1 */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    حجز المخزون تلقائياً عند حفظ أمر البيع
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    يتم تحويل الكميات المباعة إلى رصيد محجوز (Reserved) لحماية الطلب من البيع المزدوج
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.autoReserveStockOnOrder}
                    onChange={(e) => updateField("autoReserveStockOnOrder", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Option 2 */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    التحقق الصارم من الرصيد ومنع البيع عند العجز
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    منع ترحيل أي أمر بيع أو إذن تسليم إذا كانت الكمية المطلوبة غير متوفرة بالمخزن
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.preventNegativeInventory}
                    onChange={(e) => updateField("preventNegativeInventory", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Option 3 */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    التسليم والترحيل المباشر للمخازن عند تأكيد أمر البيع
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    إصدار إذن تسليم مخزني رسمي وصرف الكمية من المستودع تلقائياً بضغطة زر واحدة
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.autoDispatchDeliveryOnConfirm}
                    onChange={(e) => updateField("autoDispatchDeliveryOnConfirm", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Option 4 */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    السماح بالتسليم والصرف الجزئي لأوامر البيع
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    إمكانية صرف دفعات جزئية من أمر البيع الواحد ومتابعة الكميات المتبقية للتسليم
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.allowPartialDelivery}
                    onChange={(e) => updateField("allowPartialDelivery", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CREDIT & RETURNS */}
        {activeTab === "credit_returns" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-600" />
                <span>ضوابط مديونية العملاء وسياسات المرتجعات</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                حماية أصول الشركة المالية وضبط المبيعات الآجلة ومرتجعات العملاء
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    تفعيل الفحص الصارم للحد الائتماني للعميل
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    تحذير أو إيقاف أمر البيع عند تجاوز رصيد العميل الحد الائتماني المحدد له في ملفه
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.enforceCustomerCreditLimit}
                    onChange={(e) => updateField("enforceCustomerCreditLimit", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    منع البيع الآجل للعملاء المتأخرين في السداد
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    إلزام العميل بالسداد النقدي فقط إذا كانت لديه فواتير مستحقة متأخرة تجاوزت فترة السماح
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.blockOverdueCustomers}
                    onChange={(e) => updateField("blockOverdueCustomers", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    اشتراط وجود فاتورة بيع أصلية لتسجيل المرتجع
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    مطابقة الأصناف المرتجعة مع الفاتورة الصادرة لمنع المرتجعات غير الموثقة
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.requireOriginalInvoiceForReturn}
                    onChange={(e) => updateField("requireOriginalInvoiceForReturn", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    إصدار إشعار دائن تلقائي لحساب العميل
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                    تخفيض مديونية العميل وإنشاء قيد محاسبي عكسي آلياً عند اعتماد إذن المرتجع
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={config.autoGenerateCreditNote}
                    onChange={(e) => updateField("autoGenerateCreditNote", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-black text-slate-700 block mb-1">
                المهلة القصوى لمرتجع المبيعات بعد الاستلام (بالأيام)
              </label>
              <div className="w-full max-w-xs relative">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={config.maxReturnDays}
                  onChange={(e) => updateField("maxReturnDays", Number(e.target.value))}
                  className="w-full pr-4 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                يتم تنبيه المستخدم عند محاولة تسجيل مرتجع لفاتورة تجاوزت هذه المدة
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: COMMISSIONS & TARGETS */}
        {activeTab === "commissions" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                <span>سياسات عمولات وتارجت ممثلي المبيعات</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                تحديد شروط وتوقيت احتساب عمولات المناديب بناءً على الأرباح والتحصيل
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  شرط استحقاق عمولة المندوب
                </label>
                <select
                  value={config.commissionTrigger}
                  onChange={(e) => updateField("commissionTrigger", e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="invoice">عند اعتماد وإصدار فاتورة البيع</option>
                  <option value="payment">عند التحصيل النقدي الفعلي للفاتورة</option>
                </select>
                <p className="text-[10px] text-slate-400 font-bold">
                  يوصى بالتحصيل الفعلي لربط العمولات بالسيولة النقدية المستلمة
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  النسبة الافتراضية لعمولة المندوب (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={config.defaultCommissionRate}
                    onChange={(e) => updateField("defaultCommissionRate", Number(e.target.value))}
                    className="w-full pr-4 pl-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-left"
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  تطبق على صافي قيمة مبيعات الفاتورة بعد الخصومات
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  الحد الأدنى لهامش ربح الفاتورة للاستحقاق (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={config.minProfitMarginForCommission}
                    onChange={(e) => updateField("minProfitMarginForCommission", Number(e.target.value))}
                    className="w-full pr-4 pl-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-left"
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">
                  إذا قل هامش ربح الفاتورة عن هذه النسبة لا تصرف العمولة لحماية أرباح الشركة
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PRINTING & DOCUMENT TEMPLATES */}
        {activeTab === "print_docs" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>إعدادات وتخصيص طباعة عروض الأسعار وفواتير البيع</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                البيانات الرسمية، الشروط والأحكام، والتذييل الذي يظهر في مستندات PDF والطباعة
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">
                  الاسم التجاري المطبوع بالترويسة
                </label>
                <input
                  type="text"
                  value={config.companyCommercialName}
                  onChange={(e) => updateField("companyCommercialName", e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">
                  رقم السجل التجاري
                </label>
                <input
                  type="text"
                  value={config.companyCommercialReg}
                  onChange={(e) => updateField("companyCommercialReg", e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">
                  رقم البطاقة الضريبية (Tax ID)
                </label>
                <input
                  type="text"
                  value={config.companyTaxId}
                  onChange={(e) => updateField("companyTaxId", e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">
                  شروط وأحكام عرض السعر الافتراضية
                </label>
                <textarea
                  rows={3}
                  value={config.quotationTerms}
                  onChange={(e) => updateField("quotationTerms", e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">
                  تذييل وملاحظات فاتورة البيع الرسمية
                </label>
                <textarea
                  rows={2}
                  value={config.invoiceFooterNotes}
                  onChange={(e) => updateField("invoiceFooterNotes", e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showSignaturesOnPrint}
                  onChange={(e) => updateField("showSignaturesOnPrint", e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  إظهار خانات توقيع العميل والمبيعات
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showTaxDetailsOnPrint}
                  onChange={(e) => updateField("showTaxDetailsOnPrint", e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  إظهار تفاصيل ضريبة القيمة المضافة
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showItemCodeOnPrint}
                  onChange={(e) => updateField("showItemCodeOnPrint", e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  إظهار كود الصنف (Item Code)
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Save Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>يتم حفظ وتعميم هذه الإعدادات على كافة مستخدمي مديول المبيعات</span>
        </span>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          {saving ? (
            <span>جاري حفظ الإعدادات...</span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>حفظ وتطبيق الإعدادات الآن</span>
            </>
          )}
        </button>
      </div>
    </>
  )}
</div>
  );
};
