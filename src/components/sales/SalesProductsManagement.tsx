import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  DollarSign,
  Download,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  Layers,
  List,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Upload,
  Warehouse,
  X,
  FileSpreadsheet,
  Copy,
  ArrowRightLeft,
  History,
  Check,
  Building2,
  HelpCircle,
  Percent,
  Clock,
  ShieldCheck,
  Grid3X3,
  TrendingUp,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";
import * as XLSX from "xlsx";

interface SalesProduct {
  id: number;
  name: string;
  code: string;
  sku: string;
  barcode?: string;
  category: string;
  categoryId?: number | null;
  productType: string;
  unit: string;
  description: string;
  isActive: boolean;
  image: string;
  masterItemId?: number | null;
  masterItemName?: string | null;
  masterItemCode?: string | null;
  masterItemUnit?: string | null;
  masterItemBarcode?: string | null;
  inventoryCost: number;
  lastPurchasePrice: number;
  totalStock: number;
  availableStock: number;
  warehouseStockDetails: Array<{
    warehouseId: number;
    warehouseName: string;
    quantity: number;
    available: number;
  }>;
  basePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  specialPrice: number;
  minPrice: number;
  allowPriceOverride: boolean;
  allowBelowMinPrice: boolean;
  currency: string;
  priceListId?: number | null;
  taxable: boolean;
  taxType: string;
  taxRate: number;
  priceIncludesTax: boolean;
  defaultWarehouseId?: number | null;
  defaultWarehouse: string;
  allowMultiWarehouse: boolean;
  allowNegativeStock: boolean;
  reorderLevel: number;
  minOrderQty: number;
  maxOrderQty: number;
  trackBatches: boolean;
  trackSerials: boolean;
  trackExpiry: boolean;
  isSellable: boolean;
  allowDiscount: boolean;
  maxDiscountPct: number;
  allowCreditSale: boolean;
  allowExceedCredit: boolean;
  profitAmount: number;
  profitMarginPct: number;
  createdAt: string;
  updatedAt: string;
  isPosLinked?: boolean;
  posPrice?: number;
  posProductId?: number;
}

interface MasterInventoryItem {
  id: number;
  name: string;
  code: string;
  unit: string;
  barcode: string;
  category: string;
  cost: number;
  lastPurchasePrice: number;
  totalStock: number;
  availableStock: number;
  warehouses: Array<{
    warehouseId: number;
    warehouseName: string;
    quantity: number;
    available: number;
  }>;
}

interface SalesProductsStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  linkedToInventory: number;
  noPrice: number;
  unlinkedFromInventory: number;
  lowStockCount: number;
  totalLinkedStockValue: number;
}

const PRESET_IMAGES = [
  { name: "كرتونة بضاعة", url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=500&q=80" },
  { name: "زيوت ومواد غذائية", url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80" },
  { name: "سوبر ماركت معبأ", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80" },
  { name: "مشروبات وعصائر", url: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=500&q=80" },
  { name: "منتجات تامة ومغلفة", url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=500&q=80" },
  { name: "أدوات ومستلزمات", url: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=500&q=80" },
];

const DEFAULT_FORM_STATE: Partial<SalesProduct> = {
  name: "",
  code: "",
  sku: "",
  barcode: "",
  category: "منتجات مبيعات عامة",
  categoryId: null,
  productType: "sale",
  unit: "قطعة",
  description: "",
  isActive: true,
  image: "",
  masterItemId: null,
  basePrice: 0,
  wholesalePrice: 0,
  retailPrice: 0,
  specialPrice: 0,
  minPrice: 0,
  allowPriceOverride: false,
  allowBelowMinPrice: false,
  currency: "جنيه مصري",
  priceListId: null,
  taxable: false,
  taxType: "VAT",
  taxRate: 0,
  priceIncludesTax: false,
  defaultWarehouseId: null,
  defaultWarehouse: "المخزن الرئيسي",
  allowMultiWarehouse: true,
  allowNegativeStock: false,
  reorderLevel: 5,
  minOrderQty: 1,
  maxOrderQty: 1000,
  trackBatches: false,
  trackSerials: false,
  trackExpiry: false,
  isSellable: true,
  allowDiscount: true,
  maxDiscountPct: 15,
  allowCreditSale: true,
  allowExceedCredit: false,
};

export const SalesProductsManagement: React.FC<{
  onBack?: () => void;
  onOpenInventoryItem?: (itemId: number) => void;
}> = ({ onBack, onOpenInventoryItem }) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [stats, setStats] = useState<SalesProductsStats>({
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    linkedToInventory: 0,
    noPrice: 0,
    unlinkedFromInventory: 0,
    lowStockCount: 0,
    totalLinkedStockValue: 0,
  });
  const [masterItems, setMasterItems] = useState<MasterInventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedProductType, setSelectedProductType] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "sales" | "pos">("all");
  const [linkFilter, setLinkFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "has_price" | "no_price">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<Partial<SalesProduct>>(DEFAULT_FORM_STATE);
  const [activeFormTab, setActiveFormTab] = useState<
    "basic" | "inventory" | "pricing" | "tax" | "warehouse" | "policy"
  >("basic");
  const [isSaving, setIsSaving] = useState(false);

  // Master item combobox search in modal
  const [masterSearchQuery, setMasterSearchQuery] = useState("");
  const [selectedMasterItem, setSelectedMasterItem] = useState<MasterInventoryItem | null>(null);

  // Preview & Movement Modals
  const [previewProduct, setPreviewProduct] = useState<SalesProduct | null>(null);
  const [movementProduct, setMovementProduct] = useState<SalesProduct | null>(null);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Products
      const prodRes = await api.get("/api/v2/sales/products");
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.products || []);
      }

      // 2. Stats
      const statsRes = await api.get("/api/v2/sales/products/stats");
      if (statsRes.ok) {
        const st = await statsRes.json();
        setStats(st);
      }

      // 3. Master Items
      const miRes = await api.get("/api/v2/sales/products/master-items");
      if (miRes.ok) {
        const mi = await miRes.json();
        setMasterItems(mi || []);
      }

      // 4. Warehouses
      const whRes = await api.get("/api/warehouses");
      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(Array.isArray(whData) ? whData : whData.data || []);
      }

      // 5. Price lists
      const plRes = await api.get("/api/v2/sales/price-lists");
      if (plRes.ok) {
        const plData = await plRes.json();
        setPriceLists(Array.isArray(plData) ? plData : []);
      }
    } catch (err) {
      console.error("Error loading sales products data:", err);
      showToast("حدث خطأ أثناء تحميل بيانات المنتجات من الخادم");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Master Items filtered in Modal Combobox
  const filteredMasterItems = useMemo(() => {
    if (!masterSearchQuery.trim()) return masterItems.slice(0, 30);
    const q = masterSearchQuery.toLowerCase();
    return masterItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.barcode && m.barcode.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [masterItems, masterSearchQuery]);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = (p.code || "").toLowerCase().includes(q);
        const matchSku = (p.sku || "").toLowerCase().includes(q);
        const matchBarcode = (p.barcode || "").toLowerCase().includes(q);
        const matchMasterName = (p.masterItemName || "").toLowerCase().includes(q);
        const matchMasterCode = (p.masterItemCode || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchSku && !matchBarcode && !matchMasterName && !matchMasterCode) {
          return false;
        }
      }

      // 2. Category
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }

      // 3. Product Type
      if (selectedProductType !== "all" && p.productType !== selectedProductType) {
        return false;
      }

      // 4. Warehouse
      if (selectedWarehouse !== "all") {
        const hasWarehouse = p.warehouseStockDetails?.some((w) => String(w.warehouseId) === selectedWarehouse);
        if (!hasWarehouse && String(p.defaultWarehouseId) !== selectedWarehouse) {
          return false;
        }
      }

      // 5. Active Status
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;

      // 6. Link Status
      if (linkFilter === "linked" && !p.masterItemId) return false;
      if (linkFilter === "unlinked" && p.masterItemId) return false;

      // 7. Price Status
      if (priceFilter === "has_price" && p.basePrice <= 0 && p.retailPrice <= 0) return false;
      if (priceFilter === "no_price" && (p.basePrice > 0 || p.retailPrice > 0)) return false;

      // 8. Stock Status
      if (stockFilter === "in_stock" && p.availableStock <= p.reorderLevel) return false;
      if (stockFilter === "low_stock" && (p.availableStock <= 0 || p.availableStock > p.reorderLevel)) return false;
      if (stockFilter === "out_of_stock" && p.availableStock > 0) return false;

      // 9. Source Filter (all, sales only, pos only)
      if (sourceFilter === "pos" && !p.isPosLinked && p.productType !== "pos_linked") return false;
      if (sourceFilter === "sales" && (p.isPosLinked || p.productType === "pos_linked")) return false;

      return true;
    });
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedProductType,
    selectedWarehouse,
    statusFilter,
    sourceFilter,
    linkFilter,
    priceFilter,
    stockFilter,
  ]);

  // Paginated data
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;

  // Handlers
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setFormData({
      ...DEFAULT_FORM_STATE,
      code: `SPRD-${Date.now().toString().slice(-6)}`,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
    });
    setSelectedMasterItem(null);
    setMasterSearchQuery("");
    setActiveFormTab("basic");
    setShowModal(true);
  };

  const handleOpenEditModal = (p: SalesProduct) => {
    setModalMode("edit");
    setFormData({ ...p });
    if (p.masterItemId) {
      const found = masterItems.find((m) => m.id === p.masterItemId) || null;
      setSelectedMasterItem(found || {
        id: p.masterItemId,
        name: p.masterItemName || "صنف مخزني",
        code: p.masterItemCode || "",
        unit: p.masterItemUnit || "قطعة",
        barcode: p.masterItemBarcode || "",
        category: "أصناف مخزنية",
        cost: p.inventoryCost || 0,
        lastPurchasePrice: p.lastPurchasePrice || 0,
        totalStock: p.totalStock || 0,
        availableStock: p.availableStock || 0,
        warehouses: p.warehouseStockDetails || [],
      });
    } else {
      setSelectedMasterItem(null);
    }
    setMasterSearchQuery("");
    setActiveFormTab("basic");
    setShowModal(true);
  };

  const handleDuplicateProduct = (p: SalesProduct) => {
    setModalMode("create");
    setFormData({
      ...p,
      id: undefined,
      name: `${p.name} (نسخة)`,
      code: `SPRD-${Date.now().toString().slice(-6)}`,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
    });
    if (p.masterItemId) {
      const found = masterItems.find((m) => m.id === p.masterItemId) || null;
      setSelectedMasterItem(found);
    } else {
      setSelectedMasterItem(null);
    }
    setActiveFormTab("basic");
    setShowModal(true);
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await api.patch(`/api/v2/sales/products/${id}/toggle-status`, {});
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
        showToast(updated.isActive ? "تم تفعيل المنتج وتسميعه في عروض الأسعار وقوائم البيع" : "تم تعطيل المنتج وإيقافه في المبيعات");
        // refresh stats
        const statsRes = await api.get("/api/v2/sales/products/stats");
        if (statsRes.ok) setStats(await statsRes.json());
        // Dispatch global sync event to all sales components
        window.dispatchEvent(
          new CustomEvent("sales_products_updated", {
            detail: { action: "toggle", product: updated, id, timestamp: Date.now() },
          })
        );
        window.dispatchEvent(
          new CustomEvent("sales_pricing_updated", {
            detail: { product: updated, timestamp: Date.now() },
          })
        );
      }
    } catch (err) {
      showToast("فشل تغيير حالة المنتج");
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف منتج المبيعات "${name}" نهائياً من قاعدة البيانات؟`)) return;
    try {
      const res = await api.delete(`/api/v2/sales/products/${id}`);
      if (res.ok || res.status === 204) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showToast(`تم حذف المنتج "${name}" وإزالته من قوائم المبيعات بنجاح.`);
        const statsRes = await api.get("/api/v2/sales/products/stats");
        if (statsRes.ok) setStats(await statsRes.json());
        // Dispatch global sync event to all sales components
        window.dispatchEvent(
          new CustomEvent("sales_products_updated", {
            detail: { action: "delete", id, name, timestamp: Date.now() },
          })
        );
      } else {
        showToast("فشل حذف المنتج من قاعدة البيانات");
      }
    } catch (err) {
      showToast("خطأ أثناء حذف المنتج");
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast("يرجى إدخال اسم منتج المبيعات");
      setActiveFormTab("basic");
      return;
    }

    setIsSaving(true);
    try {
      const masterId = selectedMasterItem ? selectedMasterItem.id : (formData.masterItemId || null);
      const basePrice = Number(formData.basePrice) || 0;

      const payload = {
        ...formData,
        name: formData.name.trim(),
        code: formData.code?.trim() || `SPRD-${Date.now().toString().slice(-6)}`,
        sku: formData.sku?.trim() || formData.code?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        barcode: formData.barcode?.trim() || null,
        category: formData.category || "منتجات عامة",
        product_type: formData.productType || "sale",
        productType: formData.productType || "sale",
        unit: formData.unit || "قطعة",
        description: formData.description || "",
        is_active: formData.isActive !== false,
        isActive: formData.isActive !== false,
        master_item_id: masterId,
        masterItemId: masterId,
        inventory_item_id: masterId,
        inventoryItemId: masterId,
        base_price: basePrice,
        basePrice: basePrice,
        wholesale_price: Number(formData.wholesalePrice) || 0,
        wholesalePrice: Number(formData.wholesalePrice) || 0,
        retail_price: Number(formData.retailPrice) || basePrice,
        retailPrice: Number(formData.retailPrice) || basePrice,
        special_price: Number(formData.specialPrice) || 0,
        specialPrice: Number(formData.specialPrice) || 0,
        min_price: Number(formData.minPrice) || 0,
        minPrice: Number(formData.minPrice) || 0,
        allow_price_override: Boolean(formData.allowPriceOverride),
        allowPriceOverride: Boolean(formData.allowPriceOverride),
        allow_below_min_price: Boolean(formData.allowBelowMinPrice),
        allowBelowMinPrice: Boolean(formData.allowBelowMinPrice),
        currency: formData.currency || "جنيه مصري",
        taxable: Boolean(formData.taxable) && Number(formData.taxRate || 0) > 0,
        tax_type: formData.taxType || "VAT",
        taxType: formData.taxType || "VAT",
        tax_rate: Boolean(formData.taxable) ? (Number(formData.taxRate) || 0) : 0,
        taxRate: Boolean(formData.taxable) ? (Number(formData.taxRate) || 0) : 0,
        price_includes_tax: Boolean(formData.priceIncludesTax),
        priceIncludesTax: Boolean(formData.priceIncludesTax),
        default_warehouse: formData.defaultWarehouse || "المخزن الرئيسي",
        defaultWarehouse: formData.defaultWarehouse || "المخزن الرئيسي",
        allow_multi_warehouse: formData.allowMultiWarehouse !== false,
        allowMultiWarehouse: formData.allowMultiWarehouse !== false,
        allow_negative_stock: Boolean(formData.allowNegativeStock),
        allowNegativeStock: Boolean(formData.allowNegativeStock),
        reorder_level: Number(formData.reorderLevel) || 0,
        reorderLevel: Number(formData.reorderLevel) || 0,
        min_order_qty: Number(formData.minOrderQty) || 1,
        minOrderQty: Number(formData.minOrderQty) || 1,
        max_order_qty: Number(formData.maxOrderQty) || 1000,
        maxOrderQty: Number(formData.maxOrderQty) || 1000,
        track_batches: Boolean(formData.trackBatches),
        trackBatches: Boolean(formData.trackBatches),
        track_serials: Boolean(formData.trackSerials),
        trackSerials: Boolean(formData.trackSerials),
        track_expiry: Boolean(formData.trackExpiry),
        trackExpiry: Boolean(formData.trackExpiry),
        is_sellable: formData.isSellable !== false,
        isSellable: formData.isSellable !== false,
        allow_discount: formData.allowDiscount !== false,
        allowDiscount: formData.allowDiscount !== false,
        max_discount_pct: Number(formData.maxDiscountPct) || 15,
        maxDiscountPct: Number(formData.maxDiscountPct) || 15,
        allow_credit_sale: formData.allowCreditSale !== false,
        allowCreditSale: formData.allowCreditSale !== false,
        allow_exceed_credit: Boolean(formData.allowExceedCredit),
        allowExceedCredit: Boolean(formData.allowExceedCredit),
      };

      let res;
      if (modalMode === "create") {
        res = await api.post("/api/v2/sales/products", payload);
      } else {
        const targetId = formData.id || (payload as any).id;
        res = await api.put(`/api/v2/sales/products/${targetId}`, payload);
      }

      if (res && res.ok) {
        const saved = await res.json();
        if (modalMode === "create") {
          setProducts((prev) => [saved, ...prev]);
          showToast(`تم إنشاء منتج المبيعات "${saved.name}" وتسميعه في عروض الأسعار، أوامر البيع، وقوائم الأسعار!`);
        } else {
          setProducts((prev) => prev.map((p) => (p.id === saved.id || p.code === saved.code ? saved : p)));
          showToast(`تم تحديث منتج المبيعات "${saved.name}" وتسميع الأسعار والإعدادات في كافة المبيعات!`);
        }
        setShowModal(false);
        fetchData();

        // Dispatch instant real-time sync event across entire sales module
        window.dispatchEvent(
          new CustomEvent("sales_products_updated", {
            detail: { action: modalMode, product: saved, timestamp: Date.now() },
          })
        );
        window.dispatchEvent(
          new CustomEvent("sales_pricing_updated", {
            detail: { product: saved, timestamp: Date.now() },
          })
        );
      } else {
        let errMessage = "فشل حفظ المنتج في قاعدة البيانات";
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch (_) {}
        showToast(errMessage);
      }
    } catch (err: any) {
      console.error("Save product error:", err);
      showToast("حدث خطأ غير متوقع أثناء حفظ المنتج");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenMovementModal = async (p: SalesProduct) => {
    setMovementProduct(p);
    setIsLoadingMovements(true);
    try {
      const res = await api.get(`/api/v2/sales/products/${p.id}/movement`);
      if (res.ok) {
        const list = await res.json();
        setMovementsList(list || []);
      }
    } catch (err) {
      console.error("Failed to load movements:", err);
      setMovementsList([]);
    } finally {
      setIsLoadingMovements(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredProducts.map((p, idx) => ({
      "#": idx + 1,
      "اسم المنتج": p.name,
      "كود المنتج (Code)": p.code,
      "SKU": p.sku,
      "الباركود": p.barcode || "",
      "القسم": p.category,
      "نوع المنتج": p.productType,
      "الوحدة": p.unit,
      "الصنف المخزني المرتبط": p.masterItemName || "غير مرتبط",
      "كود الصنف المخزني": p.masterItemCode || "",
      "سعر البيع الأساسي": p.basePrice,
      "سعر الجملة": p.wholesalePrice,
      "سعر التجزئة": p.retailPrice,
      "تكلفة المخزون (التكلفة الفعلية)": p.inventoryCost,
      "قيمة الربح": p.profitAmount,
      "هامش الربح %": `${p.profitMarginPct}%`,
      "نسبة الضريبة %": `${p.taxRate}%`,
      "الرصيد المتاح بالمخزن": p.availableStock,
      "إجمالي المخزون": p.totalStock,
      "المخزن الافتراضي": p.defaultWarehouse,
      "حالة المنتج": p.isActive ? "نشط" : "معطل",
      "حالة الربط": p.masterItemId ? "مرتبط بالمخزون" : "غير مرتبط",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "منتجات المبيعات");
    XLSX.writeFile(wb, `Sales_Products_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("تم تصدير ملف إكسيل للمنتجات بنجاح");
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        "اسم المنتج": "زيت طعام عباد الشمس 1 لتر",
        "كود المنتج": "SPRD-00101",
        "SKU": "SKU-OIL-1L",
        "الباركود": "6221000123456",
        "القسم": "زيوت ومواد غذائية",
        "الوحدة": "لتر",
        "سعر البيع الأساسي": 70,
        "سعر الجملة": 65,
        "سعر التجزئة": 70,
        "سعر خاص": 63,
        "أقل سعر بيع": 62,
        "نسبة الضريبة": 14,
        "المخزن الافتراضي": "المخزن الرئيسي",
        "كود الصنف المخزني للربط (اختياري)": "ITEM-1001",
        "الوصف": "زيت عباد شمس عالي الجودة للبيع والتوزيع",
      },
      {
        "اسم المنتج": "أرز مصري درجة أولى 5 كجم",
        "كود المنتج": "SPRD-00102",
        "SKU": "SKU-RICE-5KG",
        "الباركود": "6221000987654",
        "القسم": "حبوب وبقوليات",
        "الوحدة": "كيس",
        "سعر البيع الأساسي": 180,
        "سعر الجملة": 165,
        "سعر التجزئة": 180,
        "سعر خاص": 160,
        "أقل سعر بيع": 158,
        "نسبة الضريبة": 14,
        "المخزن الافتراضي": "المخزن الرئيسي",
        "كود الصنف المخزني للربط (اختياري)": "ITEM-1002",
        "الوصف": "أرز مصري معبأ 5 كجم",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج استيراد منتجات المبيعات");
    XLSX.writeFile(wb, "Sales_Products_Template.xlsx");
    showToast("تم تحميل نموذج الإكسيل بنجاح");
  };

  // Import from Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawData || rawData.length === 0) {
          showToast("الملف فارغ أو غير مطابق للنموذج");
          return;
        }

        let importedCount = 0;
        for (const row of rawData) {
          const name = row["اسم المنتج"] || row["name"];
          if (!name) continue;

          const linkedCode = row["كود الصنف المخزني للربط (اختياري)"] || row["master_code"];
          let masterId = null;
          if (linkedCode) {
            const foundMaster = masterItems.find(
              (m) => m.code.toLowerCase() === String(linkedCode).trim().toLowerCase()
            );
            if (foundMaster) masterId = foundMaster.id;
          }

          const payload: Partial<SalesProduct> = {
            name: String(name).trim(),
            code: row["كود المنتج"] || row["code"] || `SPRD-${Date.now().toString().slice(-6)}-${importedCount}`,
            sku: row["SKU"] || row["sku"] || `SKU-${Date.now().toString().slice(-6)}`,
            barcode: row["الباركود"] || row["barcode"] || "",
            category: row["القسم"] || row["category"] || "منتجات عامة",
            unit: row["الوحدة"] || row["unit"] || "قطعة",
            basePrice: Number(row["سعر البيع الأساسي"] || row["price"] || 0),
            wholesalePrice: Number(row["سعر الجملة"] || 0),
            retailPrice: Number(row["سعر التجزئة"] || row["سعر البيع الأساسي"] || 0),
            specialPrice: Number(row["سعر خاص"] || 0),
            minPrice: Number(row["أقل سعر بيع"] || 0),
            taxRate: Number(row["نسبة الضريبة"] || 14),
            defaultWarehouse: row["المخزن الافتراضي"] || "المخزن الرئيسي",
            description: row["الوصف"] || "",
            masterItemId: masterId,
            isActive: true,
          };

          const res = await api.post("/api/v2/sales/products", payload);
          if (res.ok) importedCount++;
        }

        showToast(`تم استيراد ${importedCount} منتج مبيعات بنجاح إلى قاعدة البيانات!`);
        fetchData();
      } catch (err) {
        console.error("Excel import error:", err);
        showToast("فشل استيراد ملف الإكسيل. تأكد من صحة الأعمدة.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Calculate live profit margin for form
  const formCalculatedMargin = useMemo(() => {
    const cost = selectedMasterItem ? selectedMasterItem.cost : 0;
    const price = Number(formData.basePrice) || Number(formData.retailPrice) || 0;
    const profit = price > cost ? price - cost : 0;
    const marginPct = price > 0 ? ((profit / price) * 100).toFixed(2) : "0.00";
    return { cost, price, profit, marginPct };
  }, [formData.basePrice, formData.retailPrice, selectedMasterItem]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-5 bg-slate-900/95 text-white px-6 py-3.5 rounded-2xl shadow-2xl z-50 animate-bounce text-xs font-black flex items-center gap-2.5 border border-slate-700">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-xs">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>إدارة منتجات المبيعات</span>
                <span className="text-slate-300 font-normal">|</span>
                <span className="text-xs text-slate-500 font-bold">
                  إدارة المنتجات والأسعار وإعدادات البيع وربطها بالأصناف المخزنية والمخازن
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-black">
                  Sales Products Master
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  متصل بالمخازن والمالية
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>منتج جديد</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2.5 px-3.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="استيراد المنتجات من ملف إكسيل"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>استيراد Excel</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2.5 px-3.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="تحميل نموذج إكسيل فارغ جاهز للملء"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>نموذج Excel</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2.5 px-3.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="تحديث البيانات فورياً"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2.5 px-3.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="تصدير القائمة الحالية إلى ملف إكسيل"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3.5 rounded-2xl text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>رجوع</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards (Interactive Top Row) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Total */}
        <div
          onClick={() => {
            setStatusFilter("all");
            setLinkFilter("all");
            setPriceFilter("all");
            setStockFilter("all");
            setSourceFilter("all");
            setCurrentPage(1);
          }}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-black">إجمالي المنتجات</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-800 mt-1">{stats.totalProducts}</h3>
          <span className="text-[9px] text-indigo-600 font-bold mt-0.5">منتج مسجل</span>
        </div>

        {/* 2. Active */}
        <div
          onClick={() => {
            setStatusFilter("active");
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 transition-all ${
            statusFilter === "active" ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20" : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 font-black">المنتجات النشطة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-emerald-600 mt-1">{stats.activeProducts}</h3>
          <span className="text-[9px] text-emerald-500 font-bold mt-0.5">متاحة للبيع</span>
        </div>

        {/* 3. Inactive */}
        <div
          onClick={() => {
            setStatusFilter("inactive");
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-400 transition-all ${
            statusFilter === "inactive" ? "bg-slate-100 border-slate-400 ring-2 ring-slate-500/20" : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-black">غير النشطة</span>
            <EyeOff className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-600 mt-1">{stats.inactiveProducts}</h3>
          <span className="text-[9px] text-slate-400 font-bold mt-0.5">معطلة عن البيع</span>
        </div>

        {/* 4. Linked to Inventory */}
        <div
          onClick={() => {
            setLinkFilter("linked");
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition-all ${
            linkFilter === "linked" ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20" : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-indigo-600 font-black">المرتبطة بالمخزون</span>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-xl font-black text-indigo-600 mt-1">{stats.linkedToInventory}</h3>
          <span className="text-[9px] text-indigo-500 font-bold mt-0.5">خصم آلي فور البيع</span>
        </div>

        {/* 5. No Price */}
        <div
          onClick={() => {
            setPriceFilter("no_price");
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-300 transition-all ${
            priceFilter === "no_price" ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20" : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-600 font-black">بدون سعر بيع</span>
            <Tag className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-xl font-black text-amber-600 mt-1">{stats.noPrice}</h3>
          <span className="text-[9px] text-amber-500 font-bold mt-0.5">تحتاج تحديد سعر</span>
        </div>

        {/* 6. Unlinked */}
        <div
          onClick={() => {
            setLinkFilter("unlinked");
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between cursor-pointer hover:border-rose-300 transition-all ${
            linkFilter === "unlinked" ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20" : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-600 font-black">بدون صنف مخزني</span>
            <Layers className="w-4 h-4 text-rose-600" />
          </div>
          <h3 className="text-xl font-black text-rose-600 mt-1">{stats.unlinkedFromInventory}</h3>
          <span className="text-[9px] text-rose-500 font-bold mt-0.5">مبيعات/خدمات قائمة</span>
        </div>

        {/* 7. Low Stock */}
        <div
          onClick={() => {
            setStockFilter("low_stock");
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between cursor-pointer hover:border-orange-300 transition-all ${
            stockFilter === "low_stock" ? "bg-orange-50/70 border-orange-300 ring-2 ring-orange-500/20" : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-orange-600 font-black">منخفضة المخزون</span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <h3 className="text-xl font-black text-orange-600 mt-1">{stats.lowStockCount}</h3>
          <span className="text-[9px] text-orange-500 font-bold mt-0.5">وصلت حد إعادة الطلب</span>
        </div>

        {/* 8. Total Linked Stock Valuation */}
        <div className="bg-white p-3.5 rounded-2xl border border-purple-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-purple-600 font-black">قيمة المخزون المرتبط</span>
            <Warehouse className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-sm font-black text-purple-700 mt-1">
            {Number(stats.totalLinkedStockValue || 0).toLocaleString()} <span className="text-[9px]">ج.م</span>
          </h3>
          <span className="text-[9px] text-purple-500 font-bold mt-0.5">تقييم بالتكلفة</span>
        </div>
      </div>

      {/* Search & Advanced Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Instant Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="البحث في الاسم، SKU، الباركود، كود المنتج، اسم الصنف المخزني..."
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Selects */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">كل الأقسام</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Warehouse Select */}
            <select
              value={selectedWarehouse}
              onChange={(e) => {
                setSelectedWarehouse(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">كل المخازن</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Product Type Select */}
            <select
              value={selectedProductType}
              onChange={(e) => {
                setSelectedProductType(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">كل الأنواع</option>
              <option value="sale">منتج بيع مباشر</option>
              <option value="manufactured">منتج تام الصنع</option>
              <option value="commercial">سلعة تجارية</option>
              <option value="service">خدمة مبيعات</option>
              <option value="bundle">باقة / تجميعة</option>
            </select>

            {/* View Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "table" ? "bg-white text-indigo-600 shadow-xs font-black" : "text-slate-500 hover:text-slate-700"
                }`}
                title="عرض الجدول"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "grid" ? "bg-white text-indigo-600 shadow-xs font-black" : "text-slate-500 hover:text-slate-700"
                }`}
                title="عرض البطاقات"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-bold ml-1">تصفية سريعة:</span>

          {/* 1. All */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setLinkFilter("all");
              setPriceFilter("all");
              setStockFilter("all");
              setSourceFilter("all");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
              statusFilter === "all" && linkFilter === "all" && priceFilter === "all" && stockFilter === "all" && sourceFilter === "all"
                ? "bg-slate-800 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            الكل ({products.length})
          </button>

          {/* 2. Independent Sales */}
          <button
            type="button"
            onClick={() => {
              setSourceFilter(sourceFilter === "sales" ? "all" : "sales");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              sourceFilter === "sales"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100"
            }`}
          >
            مبيعات مستقلة
          </button>

          {/* 3. POS Products */}
          <button
            type="button"
            onClick={() => {
              setSourceFilter(sourceFilter === "pos" ? "all" : "pos");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              sourceFilter === "pos"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>نقطة البيع POS</span>
          </button>

          {/* 4. Active Only */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "active" ? "all" : "active");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            نشط فقط
          </button>

          {/* 5. Inactive Only */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "inactive" ? "all" : "inactive");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            معطل فقط
          </button>

          {/* 6. Linked to Inventory */}
          <button
            type="button"
            onClick={() => {
              setLinkFilter(linkFilter === "linked" ? "all" : "linked");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              linkFilter === "linked"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            مرتبطة بالمخزون
          </button>

          {/* 7. Unlinked */}
          <button
            type="button"
            onClick={() => {
              setLinkFilter(linkFilter === "unlinked" ? "all" : "unlinked");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              linkFilter === "unlinked"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            غير مرتبط بالمخزون
          </button>

          {/* 8. No Sales Price */}
          <button
            type="button"
            onClick={() => {
              setPriceFilter(priceFilter === "no_price" ? "all" : "no_price");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              priceFilter === "no_price"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            بدون سعر بيع
          </button>

          {/* 9. Low Stock */}
          <button
            type="button"
            onClick={() => {
              setStockFilter(stockFilter === "low_stock" ? "all" : "low_stock");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              stockFilter === "low_stock"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            منخفض المخزون
          </button>

          {/* Reset Filters Button */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setLinkFilter("all");
              setPriceFilter("all");
              setStockFilter("all");
              setSourceFilter("all");
              setSelectedCategory("all");
              setSelectedWarehouse("all");
              setSelectedProductType("all");
              setSearchQuery("");
              setCurrentPage(1);
            }}
            className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer mr-auto flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        </div>
      </div>

      {/* Main Table / Grid Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-black text-slate-600">جارٍ جلب منتجات المبيعات والأرصدة من قاعدة البيانات...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">لا توجد منتجات مبيعات مطابقة</h3>
            <p className="text-xs text-slate-400 font-bold max-w-md mx-auto">
              {searchQuery || selectedCategory !== "all"
                ? "لا توجد نتائج تطابق معايير البحث الحالية. جرب تغيير كلمة البحث أو إعادة تعيين الفلاتر."
                : "لم يتم إنشاء أي منتجات مبيعات بعد. يمكنك الضغط على زر '+ منتج جديد' أو استيراد ملف إكسيل للبدء."}
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-2xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول منتج مبيعات</span>
            </button>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 font-black text-slate-600">
                <tr>
                  <th className="p-4">المنتج</th>
                  <th className="p-4">SKU / الكود</th>
                  <th className="p-4">الصنف المخزني المرتبط</th>
                  <th className="p-4 text-center">القسم</th>
                  <th className="p-4 text-center">الوحدة</th>
                  <th className="p-4 text-left">سعر البيع</th>
                  <th className="p-4 text-left">سعر التكلفة</th>
                  <th className="p-4 text-center">هامش الربح</th>
                  <th className="p-4 text-center">الضريبة</th>
                  <th className="p-4 text-center">المخزون المتاح</th>
                  <th className="p-4 text-center">المخزن الافتراضي</th>
                  <th className="p-4 text-center">الحالة</th>
                  <th className="p-4 text-center">الربط</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {paginatedProducts.map((p) => {
                  const isLowStock = p.availableStock > 0 && p.availableStock <= p.reorderLevel;
                  const isOutOfStock = p.availableStock <= 0;

                  return (
                    <tr key={`sales-prod-${p.id}`} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Name & Image */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              p.isPosLinked || p.productType === "pos_linked"
                                ? "bg-purple-50 border border-purple-200 text-purple-600"
                                : "bg-indigo-50 border border-indigo-100 text-indigo-600"
                            }`}>
                              {p.isPosLinked || p.productType === "pos_linked" ? (
                                <Store className="w-5 h-5" />
                              ) : (
                                <Package className="w-5 h-5" />
                              )}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-slate-900 block leading-snug">{p.name}</span>
                              {(p.isPosLinked || p.productType === "pos_linked") && (
                                <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                  <Store className="w-2.5 h-2.5 text-purple-600" />
                                  نقطة البيع (POS)
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <span className="text-[10px] text-slate-400 font-normal line-clamp-1 max-w-[200px]">
                                {p.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU & Code */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-800 text-[11px] font-black block">{p.code}</span>
                          {p.sku && p.sku !== p.code && (
                            <span className="text-[10px] text-slate-400 font-mono block">SKU: {p.sku}</span>
                          )}
                          {p.barcode && (
                            <span className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                              <Barcode className="w-3 h-3" /> {p.barcode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Linked Master Item */}
                      <td className="p-4">
                        {p.masterItemId ? (
                          <div className="space-y-0.5">
                            <span className="font-black text-indigo-700 block text-xs">
                              {p.masterItemName || `صنف #${p.masterItemId}`}
                            </span>
                            <span className="text-[10px] text-indigo-500 font-mono block">
                              كود: {p.masterItemCode || `ITEM-${p.masterItemId}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-normal italic">
                            غير مرتبط بصنف مخزني
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black border border-slate-200/60">
                          {p.category}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="p-4 text-center text-slate-600 font-black">{p.unit}</td>

                      {/* Selling Price */}
                      <td className="p-4 text-left">
                        <span className="font-black text-slate-900 text-xs block">
                          {Number(p.basePrice || p.retailPrice || 0).toLocaleString()} ج.م
                        </span>
                        {(p.isPosLinked || p.productType === "pos_linked") && p.posPrice !== undefined && (
                          <span className="text-[10px] text-purple-700 font-bold block mt-0.5">
                            الكاشير: {Number(p.posPrice).toLocaleString()} ج.م
                          </span>
                        )}
                      </td>

                      {/* Cost Price */}
                      <td className="p-4 text-left">
                        <span className="font-bold text-slate-600 text-xs">
                          {Number(p.inventoryCost || 0).toLocaleString()} ج.م
                        </span>
                      </td>

                      {/* Profit Margin */}
                      <td className="p-4 text-center">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-emerald-600 block">
                            +{Number(p.profitAmount || 0).toLocaleString()} ج.م
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                              p.profitMarginPct >= 25
                                ? "bg-emerald-50 text-emerald-700"
                                : p.profitMarginPct > 0
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {p.profitMarginPct}%
                          </span>
                        </div>
                      </td>

                      {/* Tax */}
                      <td className="p-4 text-center">
                        {p.taxable ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-200">
                            {p.taxRate}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal">معفى</span>
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="p-4 text-center">
                        {p.masterItemId ? (
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-black inline-flex items-center gap-1 ${
                              isOutOfStock
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isLowStock
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {p.availableStock} {p.unit}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Default Warehouse */}
                      <td className="p-4 text-center">
                        <span className="text-slate-700 text-xs font-bold">{p.defaultWarehouse || "المخزن الرئيسي"}</span>
                      </td>

                      {/* Active Status */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p.id)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                            p.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {p.isActive ? "نشط" : "معطل"}
                        </button>
                      </td>

                      {/* Link Status */}
                      <td className="p-4 text-center">
                        {p.masterItemId ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black border border-indigo-200 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> مرتبط
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
                            غير مرتبط
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewProduct(p)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
                            title="عرض تفاصيل المنتج"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors cursor-pointer"
                            title="تعديل المنتج"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateProduct(p)}
                            className="p-1.5 hover:bg-teal-50 text-teal-600 rounded-xl transition-colors cursor-pointer"
                            title="نسخ المنتج"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMovementModal(p)}
                            className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors cursor-pointer"
                            title="سجل حركات المبيعات للمنتج"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="حذف المنتج"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {paginatedProducts.map((p) => (
              <div
                key={`sales-grid-${p.id}`}
                className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="relative mb-3">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-36 object-cover rounded-2xl border border-slate-100"
                      />
                    ) : (
                      <div className="w-full h-36 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-500">
                        <Package className="w-12 h-12 stroke-1" />
                      </div>
                    )}
                    <span
                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-black shadow-xs ${
                        p.isActive
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-600 text-white"
                      }`}
                    >
                      {p.isActive ? "نشط" : "معطل"}
                    </span>
                    {p.masterItemId && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[9px] font-black shadow-xs">
                        مرتبط بالمخزون
                      </span>
                    )}
                    {(p.isPosLinked || p.productType === "pos_linked") && (
                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 bg-purple-600 text-white rounded-full text-[9px] font-black shadow-xs flex items-center gap-1">
                        <Store className="w-2.5 h-2.5" /> نقطة البيع
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono block">{p.code}</span>
                    <h3 className="font-black text-slate-800 text-sm leading-snug line-clamp-1">{p.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold">{p.category}</p>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px] font-bold">سعر البيع:</span>
                      <span className="font-black text-indigo-600 text-sm">
                        {Number(p.basePrice || p.retailPrice || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                    {(p.isPosLinked || p.productType === "pos_linked") && p.posPrice !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-purple-600 text-[11px] font-bold">سعر الكاشير (POS):</span>
                        <span className="font-black text-purple-700 text-xs">
                          {Number(p.posPrice).toLocaleString()} ج.م
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px] font-bold">التكلفة الفعلية:</span>
                      <span className="font-bold text-slate-700">
                        {Number(p.inventoryCost || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 text-[11px] font-bold">المخزون المتاح:</span>
                      <span
                        className={`font-black ${
                          p.availableStock > 0 ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {p.availableStock} {p.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(p)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenMovementModal(p)}
                      className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
                      title="حركات المبيعات"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id, p.name)}
                      className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewProduct(p)}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>تفاصيل</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Toolbar */}
        {!isLoading && filteredProducts.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-500 font-bold">
              <span>عرض</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-slate-800 font-black cursor-pointer"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>من أصل {filteredProducts.length} منتج مبيعات</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
              >
                السابق
              </button>
              <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-black rounded-xl border border-indigo-200">
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Add / Edit Product Modal (Unified, High-Fidelity Spacious Single-Page Form) */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white max-w-6xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] transition-all">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm shadow-indigo-200">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-800">
                      {modalMode === "create" ? "إضافة منتج مبيعات جديد" : "تعديل إعدادات منتج المبيعات"}
                    </h3>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-700">
                      صفحة موحدة وسلسة
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    إدارة بيانات البيع، قوائم الأسعار، الربط المخزني، الضرائب، والمخازن في نموذج واحد متكامل وشامل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Section Anchor Navigation */}
            <div className="flex items-center overflow-x-auto border-b border-slate-200/90 bg-slate-100/70 px-6 py-2.5 gap-2 shrink-0 scrollbar-thin">
              <span className="text-[11px] font-black text-slate-400 shrink-0 ml-1">انتقال سريع:</span>
              {[
                { id: "sec-basic", label: "1. البيانات الأساسية", icon: Tag },
                { id: "sec-inventory", label: "2. الربط بالمخزون", icon: Warehouse },
                { id: "sec-pricing", label: "3. أسعار البيع والتكلفة", icon: DollarSign },
                { id: "sec-tax", label: "4. الضرائب", icon: Percent },
                { id: "sec-warehouse", label: "5. المخازن والتتبع", icon: Boxes },
                { id: "sec-policy", label: "6. سياسات البيع", icon: ShieldCheck },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(t.id);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  <t.icon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Form Body: All Sections in One Seamless Single Page */}
            <form onSubmit={handleSaveProduct} className="p-6 md:p-8 overflow-y-auto space-y-7 flex-1 text-xs bg-slate-50/40">
              {/* SECTION 1: Basic Info */}
              <div id="sec-basic" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">1. البيانات الأساسية وتصنيف المنتج</h4>
                      <p className="text-[11px] text-slate-400 font-bold">اسم المنتج، الأكواد، الباركود، التصنيف والوحدة</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">بيانات الهوية</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
                    <label className="font-black text-slate-700 block">
                      اسم المنتج <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: زيت طعام 1 لتر، أرز معبأ 5 كجم..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">كود المنتج (Code)</label>
                    <input
                      type="text"
                      value={formData.code || ""}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="SPRD-00101"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">كود SKU</label>
                    <input
                      type="text"
                      value={formData.sku || ""}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="SKU-OIL-1L"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">الباركود (Barcode)</label>
                    <div className="relative">
                      <Barcode className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.barcode || ""}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="6221000123456"
                        className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">القسم / التصنيف</label>
                    <input
                      type="text"
                      value={formData.category || ""}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="زيوت ومواد غذائية"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">نوع المنتج</label>
                    <select
                      value={formData.productType || "sale"}
                      onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="sale">منتج بيع مباشر</option>
                      <option value="commercial">سلعة تجارية / توزيع</option>
                      <option value="manufactured">منتج تام الصنع (تصنيع)</option>
                      <option value="service">خدمة مبيعات / استشارة</option>
                      <option value="bundle">باقة / تجميعة</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">الوحدة الأساسية للبيع</label>
                    <input
                      type="text"
                      value={formData.unit || "قطعة"}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="قطعة، لتر، كرتونة، كجم..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
                    <label className="font-bold text-slate-700 block">وصف المنتج وملاحظات البيع</label>
                    <textarea
                      rows={2}
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="ملاحظات توضيحية حول المنتج، الاستخدام، أو مواصفات العرض..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Image Preset / URL */}
                  <div className="space-y-2 sm:col-span-2 md:col-span-3">
                    <label className="font-bold text-slate-700 block">صورة المنتج</label>
                    <input
                      type="text"
                      value={formData.image || ""}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="رابط صورة المنتج (URL)..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">أو اختر صورة جاهزة:</span>
                      {PRESET_IMAGES.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, image: img.url })}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 text-[10px] font-bold text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors shrink-0"
                        >
                          {img.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Master Inventory Item Link */}
              <div id="sec-inventory" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                      <Warehouse className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">2. الربط بالصنف المخزني الرئيسي (Master Inventory Item)</h4>
                      <p className="text-[11px] text-slate-400 font-bold">المصدر الموحد للحقيقة للصنف المخزني، احتساب التكلفة وخصم المستودعات</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">ربط المستودع</span>
                </div>

                <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-1">
                  <h5 className="font-black text-indigo-900 text-xs flex items-center gap-1.5">
                    <Warehouse className="w-4 h-4 text-indigo-600" />
                    <span>تكامل المخزون والمبيعات المباشر</span>
                  </h5>
                  <p className="text-[11px] text-indigo-700 font-bold leading-relaxed">
                    يضمن الربط وجود مصدر واحد للحقيقة للصنف المخزني في المخازن، وحساب تكلفة البضاعة المباعة (COGS)
                    وخصم الكميات من المستودعات تلقائياً عند تأكيد أذون التسليم، دون تكرار للأصناف.
                  </p>
                </div>

                {/* Selected Master Item Card */}
                {selectedMasterItem ? (
                  <div className="bg-white border-2 border-indigo-500 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                          <Boxes className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-indigo-600 uppercase">الصنف المخزني المرتبط</span>
                          <h4 className="text-sm font-black text-slate-900">{selectedMasterItem.name}</h4>
                          <span className="text-[11px] font-mono text-slate-500">
                            كود: {selectedMasterItem.code} | وحدة: {selectedMasterItem.unit}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMasterItem(null);
                          setFormData({ ...formData, masterItemId: null });
                        }}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 transition-colors"
                      >
                        إلغاء الربط
                      </button>
                    </div>

                    {/* Live Stock & Cost Info from Inventory System */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">التكلفة المخزنية الحالية</span>
                        <span className="text-xs font-black text-slate-900">
                          {Number(selectedMasterItem.cost || 0).toLocaleString()} ج.م
                        </span>
                        <span className="text-[9px] text-slate-400 block font-normal">(محسوبة من نظام التكاليف)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">إجمالي الرصيد بالمخازن</span>
                        <span className="text-xs font-black text-indigo-600">
                          {selectedMasterItem.totalStock} {selectedMasterItem.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">الرصيد المتاح للصرف</span>
                        <span className="text-xs font-black text-emerald-600">
                          {selectedMasterItem.availableStock} {selectedMasterItem.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">آخر سعر شراء مسجل</span>
                        <span className="text-xs font-black text-slate-700">
                          {Number(selectedMasterItem.lastPurchasePrice || selectedMasterItem.cost || 0).toLocaleString()} ج.م
                        </span>
                      </div>
                    </div>

                    {/* Warehouse Availability Breakdown */}
                    {selectedMasterItem.warehouses && selectedMasterItem.warehouses.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-black text-slate-700">المخازن التي يتوفر بها الصنف:</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedMasterItem.warehouses.map((w, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs"
                            >
                              {w.warehouseName}: <strong className="text-indigo-600 font-black">{w.available}</strong> {selectedMasterItem.unit}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Search and Pick Master Inventory Item */
                  <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                    <label className="font-black text-slate-800 block text-xs">
                      اختر الصنف المخزني من شجرة الأصناف (Master Items):
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={masterSearchQuery}
                        onChange={(e) => setMasterSearchQuery(e.target.value)}
                        placeholder="ابحث بالاسم، الكود، الباركود، أو SKU للصنف المخزني..."
                        className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 p-2">
                      {filteredMasterItems.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMasterItem(m);
                            setFormData({
                              ...formData,
                              masterItemId: m.id,
                              unit: formData.unit || m.unit,
                            });
                          }}
                          className="p-3 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <span className="font-black text-slate-800 text-xs block">{m.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              كود: {m.code} | وحدة: {m.unit} | التكلفة: {Number(m.cost || 0).toLocaleString()} ج.م
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-black text-emerald-600 block">
                              رصيد: {m.availableStock} {m.unit}
                            </span>
                            <span className="text-[10px] text-indigo-600 font-bold hover:underline">
                              اختيار وربط
                            </span>
                          </div>
                        </div>
                      ))}
                      {filteredMasterItems.length === 0 && (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          لا توجد أصناف مخزنية مطابقة لكلمة البحث
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Pricing & Cost Analysis */}
              <div id="sec-pricing" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">3. أسعار البيع، التكلفة، وهامش الربح</h4>
                      <p className="text-[11px] text-slate-400 font-bold">تسعير مرن للمبيعات، حساب هوامش الربحية التلقائي، وقوائم الأسعار</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">التسعير والربحية</span>
                </div>

                {/* Cost & Gross Profit Summary Bar */}
                <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-md grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">تكلفة الصنف الفعلية</span>
                    <span className="text-base font-black text-amber-400">
                      {Number(formCalculatedMargin.cost).toLocaleString()} ج.م
                    </span>
                    <span className="text-[9px] text-slate-400 block font-normal">مصدر التكلفة: نظام المخازن</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">سعر البيع الأساسي</span>
                    <span className="text-base font-black text-indigo-300">
                      {Number(formCalculatedMargin.price).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">قيمة هامش الربح</span>
                    <span className="text-base font-black text-emerald-400">
                      +{Number(formCalculatedMargin.profit).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">نسبة هامش الربح</span>
                    <span className="text-base font-black text-emerald-400">
                      {formCalculatedMargin.marginPct}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-black text-slate-800 block">
                      سعر البيع الأساسي <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.basePrice !== undefined && formData.basePrice !== null ? formData.basePrice : ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          basePrice: parseFloat(e.target.value) || 0,
                          retailPrice: formData.retailPrice || parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="70.00"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">سعر الجملة (Wholesale)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.wholesalePrice !== undefined && formData.wholesalePrice !== null ? formData.wholesalePrice : ""}
                      onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                      placeholder="65.00"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">سعر التجزئة (Retail)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.retailPrice !== undefined && formData.retailPrice !== null ? formData.retailPrice : ""}
                      onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="70.00"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">سعر خاص / VIP</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.specialPrice !== undefined && formData.specialPrice !== null ? formData.specialPrice : ""}
                      onChange={(e) => setFormData({ ...formData, specialPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="62.00"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">أقل سعر بيع مسموح (الحد الأدنى)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.minPrice !== undefined && formData.minPrice !== null ? formData.minPrice : ""}
                      onChange={(e) => setFormData({ ...formData, minPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="60.00"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">العملة</label>
                    <input
                      type="text"
                      value={formData.currency || "جنيه مصري"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Price Lists Integration */}
                {priceLists.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="font-bold text-slate-700 block">ربط بقائمة أسعار مبيعات محددة</label>
                    <select
                      value={formData.priceListId || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priceListId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">القائمة الافتراضية العامة</option>
                      {priceLists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.type || "خصم"} - {pl.discount_percent}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pricing Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowPriceOverride || false}
                      onChange={(e) => setFormData({ ...formData, allowPriceOverride: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح للمندوب / البائع بتعديل السعر أثناء تحرير أمر البيع
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowBelowMinPrice || false}
                      onChange={(e) => setFormData({ ...formData, allowBelowMinPrice: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح بالبيع بأقل من الحد الأدنى (يتطلب موافقة إدارية)
                    </span>
                  </label>
                </div>
              </div>

              {/* SECTION 4: Taxes */}
              <div id="sec-tax" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">4. إعدادات الضرائب وضريبة القيمة المضافة</h4>
                      <p className="text-[11px] text-slate-400 font-bold">الخضوع الضريبي، نوع الضريبة، والنسبة المطبقة في الفواتير</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl">الضرائب</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-3 p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.taxable !== false}
                        onChange={(e) => setFormData({ ...formData, taxable: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                      />
                      <div>
                        <span className="font-black text-indigo-900 text-xs block">المنتج خاضع لضريبة القيمة المضافة (VAT)</span>
                        <span className="text-[11px] text-indigo-600 font-bold">
                          يتم احتساب الضريبة تلقائياً في فواتير المبيعات وترحيلها لحساب مصلحة الضرائب بالدفاتر
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">نوع الضريبة</label>
                    <select
                      value={formData.taxType || "VAT"}
                      onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="VAT">ضريبة القيمة المضافة القياسية (VAT)</option>
                      <option value="ZeroRated">ضريبة صفرية (0%)</option>
                      <option value="Exempt">معفى ضريبياً</option>
                      <option value="TableTax">ضريبة جدول</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">نسبة الضريبة %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.taxRate !== undefined ? formData.taxRate : 14}
                      onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                      placeholder="14"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.priceIncludesTax || false}
                        onChange={(e) => setFormData({ ...formData, priceIncludesTax: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-slate-700 text-xs">
                        سعر البيع المعروض شامل ضريبة القيمة المضافة (Price inclusive of Tax)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Warehouses & Inventory Controls */}
              <div id="sec-warehouse" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">5. إعدادات المخازن والتتبع وحركات الرصيد</h4>
                      <p className="text-[11px] text-slate-400 font-bold">المخزن الافتراضي للصرف، التتبع بالتشغيلات وتواريخ الصلاحية</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-xl">المخازن والتتبع</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700 block">المخزن الافتراضي للصرف</label>
                    <select
                      value={formData.defaultWarehouseId || ""}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        const foundWh = warehouses.find((w) => w.id === id);
                        setFormData({
                          ...formData,
                          defaultWarehouseId: id,
                          defaultWarehouse: foundWh ? foundWh.name : "المخزن الرئيسي",
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">المخزن الرئيسي (افتراضي)</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">حد إعادة الطلب (Reorder)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorderLevel || 0}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                      placeholder="5"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">الحد الأدنى للطلب (MOQ)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.minOrderQty || 1}
                      onChange={(e) => setFormData({ ...formData, minOrderQty: parseFloat(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700 block">الحد الأقصى لكمية الطلب للعميل</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxOrderQty || 1000}
                      onChange={(e) => setFormData({ ...formData, maxOrderQty: parseFloat(e.target.value) || 1000 })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Checkbox controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowMultiWarehouse !== false}
                      onChange={(e) => setFormData({ ...formData, allowMultiWarehouse: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح بتنفيذ أمر البيع والصرف من أكثر من مخزن
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowNegativeStock || false}
                      onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح بإصدار أمر البيع عند عدم توفر رصيد كافي بالمخزن (بيع بالسالب)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.trackBatches || false}
                      onChange={(e) => setFormData({ ...formData, trackBatches: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      تتبع رقم التشغيلة / الدفعة (Batch / Lot Number)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.trackExpiry || false}
                      onChange={(e) => setFormData({ ...formData, trackExpiry: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      تتبع تاريخ الصلاحية وسحب الأقدم أولاً (FEFO)
                    </span>
                  </label>
                </div>
              </div>

              {/* SECTION 6: Sales Policies & Workflow */}
              <div id="sec-policy" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-black">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">6. سياسات البيع وصلاحيات المعاملات</h4>
                      <p className="text-[11px] text-slate-400 font-bold">حدود الخصومات، البيع الآجل، وتفعيل المنتج في أوامر البيع</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-xl">سياسات البيع</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">الحد الأقصى المسموح للخصم %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.maxDiscountPct || 15}
                      onChange={(e) => setFormData({ ...formData, maxDiscountPct: parseFloat(e.target.value) || 0 })}
                      placeholder="15"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isSellable !== false}
                      onChange={(e) => setFormData({ ...formData, isSellable: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح بإدراج هذا المنتج في عروض الأسعار وأوامر البيع
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowDiscount !== false}
                      onChange={(e) => setFormData({ ...formData, allowDiscount: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح بتطبيق الخصومات التجارية على هذا المنتج
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowCreditSale !== false}
                      onChange={(e) => setFormData({ ...formData, allowCreditSale: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">
                      السماح بالبيع الآجل للعملاء (على الحساب)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-emerald-700 text-xs">
                      حالة المنتج نشط ومفعل في دورة المبيعات
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur-xs py-3 px-2 rounded-2xl shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-bold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span>السعر: <strong className="text-indigo-600">{Number(formData.basePrice || 0).toLocaleString()} ج.م</strong></span>
                    <span>•</span>
                    <span>التكلفة: <strong className="text-amber-600">{Number(formCalculatedMargin.cost || 0).toLocaleString()} ج.م</strong></span>
                    <span>•</span>
                    <span>هامش الربح: <strong className="text-emerald-600">{formCalculatedMargin.marginPct}%</strong></span>
                    <span>•</span>
                    <span>الحالة: <strong className={formData.isActive !== false ? "text-emerald-600" : "text-rose-600"}>{formData.isActive !== false ? "نشط" : "معطل"}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جارٍ الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ في قاعدة البيانات</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Product Details Quick Preview Modal */}
      {/* ========================================================================= */}
      {previewProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                {previewProduct.image ? (
                  <img
                    src={previewProduct.image}
                    alt={previewProduct.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black text-slate-800">{previewProduct.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">كود: {previewProduct.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price and Stock Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">سعر البيع الأساسي</span>
                <span className="text-sm font-black text-indigo-600">
                  {Number(previewProduct.basePrice || previewProduct.retailPrice || 0).toLocaleString()} ج.م
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">التكلفة المخزنية</span>
                <span className="text-sm font-black text-slate-700">
                  {Number(previewProduct.inventoryCost || 0).toLocaleString()} ج.م
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">هامش الربح</span>
                <span className="text-sm font-black text-emerald-600">
                  {previewProduct.profitMarginPct}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">الرصيد المتاح</span>
                <span className="text-sm font-black text-slate-800">
                  {previewProduct.availableStock} {previewProduct.unit}
                </span>
              </div>
            </div>

            {/* Master Item Info */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2 text-xs">
              <span className="text-[11px] font-black text-indigo-900 block">الصنف المخزني المرتبط:</span>
              {previewProduct.masterItemId ? (
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-indigo-200">
                  <div>
                    <span className="font-black text-slate-800 block">{previewProduct.masterItemName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">كود: {previewProduct.masterItemCode}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black">
                    رصيد: {previewProduct.availableStock} {previewProduct.unit}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 italic">هذا المنتج غير مرتبط بصنف مخزني رئيسي.</span>
              )}
            </div>

            {/* Warehouse Stock Breakdown */}
            {previewProduct.warehouseStockDetails && previewProduct.warehouseStockDetails.length > 0 && (
              <div className="space-y-2 text-xs">
                <span className="font-black text-slate-700">توزيع الأرصدة عبر المستودعات:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {previewProduct.warehouseStockDetails.map((w, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between">
                      <span className="font-bold text-slate-700">{w.warehouseName}</span>
                      <span className="font-black text-indigo-600">
                        {w.available} / {w.quantity} {previewProduct.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Sales Movements Modal */}
      {/* ========================================================================= */}
      {movementProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <span>سجل حركات المبيعات: {movementProduct.name}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">كود: {movementProduct.code}</span>
              </div>
              <button
                type="button"
                onClick={() => setMovementProduct(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingMovements ? (
              <div className="p-12 text-center text-slate-500 font-bold text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>جارٍ جلب سجل المبيعات...</span>
              </div>
            ) : movementsList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold text-xs">
                لا توجد حركات مبيعات أو فواتير مسجلة لهذا المنتج بعد
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-600">
                    <tr>
                      <th className="p-3">نوع الحركة</th>
                      <th className="p-3">رقم المستند</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3 text-left">السعر</th>
                      <th className="p-3 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {movementsList.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              m.type === "فاتورة مبيعات"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-black text-slate-800">{m.docNo}</td>
                        <td className="p-3 text-slate-500">{m.date}</td>
                        <td className="p-3 text-slate-700">{m.party || "عميل عام"}</td>
                        <td className="p-3 text-center font-black text-slate-900">{m.qty}</td>
                        <td className="p-3 text-left text-slate-700">{Number(m.price || 0).toLocaleString()} ج.م</td>
                        <td className="p-3 text-left font-black text-indigo-600">{Number(m.total || 0).toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMovementProduct(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
